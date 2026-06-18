/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { TerminalCapability, type ICommandDetectionCapability } from '../../../../platform/terminal/common/capabilities/capabilities.js';
import { ITerminalService, ITerminalGroupService, ITerminalInstance } from '../../terminal/browser/terminal.js';
import { detectQualityChecks, IQualityCheck, QualityCheckStatus } from '../common/compyleQualityChecks.js';

export const ICompyleQualityGuardianService = createDecorator<ICompyleQualityGuardianService>('compyleQualityGuardianService');

export interface ICompyleQualityGuardianService {
	readonly _serviceBrand: undefined;
	hasWorkspace(): boolean;
	/** Detect which quality checks apply to the open project. */
	getChecks(): Promise<IQualityCheck[]>;
	/** Run a check in the integrated terminal and resolve its result. */
	runCheck(check: IQualityCheck): Promise<QualityCheckStatus>;
}

const PYTHON_TOOL_HINTS = ['ruff', 'black', 'mypy', 'flake8', 'pytest'];
const CHECK_TIMEOUT_MS = 300_000;

export class CompyleQualityGuardianService implements ICompyleQualityGuardianService {
	declare readonly _serviceBrand: undefined;

	private _terminal: ITerminalInstance | undefined;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
	) { }

	hasWorkspace(): boolean {
		return this._contextService.getWorkspace().folders.length > 0;
	}

	private _root(): URI | undefined {
		return this._contextService.getWorkspace().folders[0]?.uri;
	}

	private async _readText(uri: URI): Promise<string | undefined> {
		try {
			return (await this._fileService.readFile(uri)).value.toString();
		} catch {
			return undefined;
		}
	}

	async getChecks(): Promise<IQualityCheck[]> {
		const root = this._root();
		if (!root) {
			return [];
		}

		let names: string[] = [];
		try {
			const stat = await this._fileService.resolve(root);
			names = (stat.children ?? []).map(c => c.name);
		} catch {
			return [];
		}

		let packageJson: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | undefined;
		if (names.includes('package.json')) {
			const text = await this._readText(URI.joinPath(root, 'package.json'));
			if (text) {
				try { packageJson = JSON.parse(text); } catch { /* ignore malformed */ }
			}
		}

		const pythonDeps = new Set<string>();
		for (const manifest of ['requirements.txt', 'pyproject.toml', 'Pipfile']) {
			if (names.includes(manifest)) {
				const text = (await this._readText(URI.joinPath(root, manifest)))?.toLowerCase();
				if (text) {
					for (const hint of PYTHON_TOOL_HINTS) {
						if (text.includes(hint)) { pythonDeps.add(hint); }
					}
				}
			}
		}

		return detectQualityChecks({ files: names, packageJson, pythonDeps: Array.from(pythonDeps) });
	}

	private async _ensureTerminal(): Promise<ITerminalInstance> {
		if (this._terminal && this._terminalService.instances.includes(this._terminal)) {
			return this._terminal;
		}
		const cwd = this._root();
		this._terminal = await this._terminalService.createTerminal(cwd ? { cwd } : {});
		return this._terminal;
	}

	async runCheck(check: IQualityCheck): Promise<QualityCheckStatus> {
		const instance = await this._ensureTerminal();
		this._terminalService.setActiveInstance(instance);
		await this._terminalGroupService.showPanel(false);

		const result = this._awaitCommandResult(instance);
		await instance.sendText(check.command, true);
		return result;
	}

	private _awaitCommandResult(instance: ITerminalInstance): Promise<QualityCheckStatus> {
		return new Promise<QualityCheckStatus>(resolve => {
			const store = new DisposableStore();
			let settled = false;
			const finish = (status: QualityCheckStatus) => {
				if (!settled) {
					settled = true;
					store.dispose();
					resolve(status);
				}
			};

			const attach = (capability: ICommandDetectionCapability) => {
				store.add(capability.onCommandFinished(command => {
					finish(command.exitCode === undefined ? 'unknown' : command.exitCode === 0 ? 'passed' : 'failed');
				}));
			};

			const existing = instance.capabilities.get(TerminalCapability.CommandDetection);
			if (existing) {
				attach(existing);
			} else {
				store.add(instance.capabilities.onDidAddCommandDetectionCapability(attach));
			}

			const timer = setTimeout(() => finish('unknown'), CHECK_TIMEOUT_MS);
			store.add(toDisposable(() => clearTimeout(timer)));
		});
	}
}

registerSingleton(ICompyleQualityGuardianService, CompyleQualityGuardianService, InstantiationType.Delayed);
