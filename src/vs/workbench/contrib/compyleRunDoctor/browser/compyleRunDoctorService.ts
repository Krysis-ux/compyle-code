/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ITerminalService, ITerminalGroupService } from '../../terminal/browser/terminal.js';
import { buildRunPlan, ENV_EXAMPLE_NAMES, IPackageJsonShape, IRunPlan, IRunPlanInput } from '../common/compyleRunDoctor.js';

export const ICompyleRunDoctorService = createDecorator<ICompyleRunDoctorService>('compyleRunDoctorService');

export interface ICompyleRunDoctorService {
	readonly _serviceBrand: undefined;
	/** Whether a workspace folder is open to diagnose. */
	hasWorkspace(): boolean;
	/** Inspect the first workspace folder and produce a run plan. */
	diagnose(): Promise<IRunPlan>;
	/** Run a shell command in a focused integrated terminal rooted at the project. */
	runCommand(command: string): Promise<void>;
	/** Open a URL in the built-in Simple Browser, falling back to the system browser. */
	openPreview(url: string): Promise<void>;
	/** Write a RUNNING.md doc describing the plan and return its location. */
	writeRunDocs(plan: IRunPlan): Promise<URI>;
}

const PYTHON_FRAMEWORK_HINTS = ['fastapi', 'flask', 'django', 'streamlit', 'poetry', 'uvicorn'];

export class CompyleRunDoctorService implements ICompyleRunDoctorService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@ICommandService private readonly _commandService: ICommandService,
		@IOpenerService private readonly _openerService: IOpenerService,
	) { }

	hasWorkspace(): boolean {
		return this._contextService.getWorkspace().folders.length > 0;
	}

	private _root(): URI | undefined {
		return this._contextService.getWorkspace().folders[0]?.uri;
	}

	async diagnose(): Promise<IRunPlan> {
		const root = this._root();
		if (!root) {
			return buildRunPlan({ files: [], hasNodeModules: false, pythonDeps: [], envFilePresent: false });
		}

		let names: string[] = [];
		try {
			const stat = await this._fileService.resolve(root);
			names = (stat.children ?? []).map(c => c.name);
		} catch {
			// Folder unreadable — fall through with empty listing.
		}

		const input: IRunPlanInput = {
			files: names,
			hasNodeModules: names.includes('node_modules'),
			envFilePresent: names.includes('.env'),
			packageJson: await this._readPackageJson(root, names),
			envExampleContent: await this._readEnvExample(root, names),
			pythonDeps: await this._readPythonDeps(root, names),
		};

		return buildRunPlan(input);
	}

	private async _readText(uri: URI): Promise<string | undefined> {
		try {
			const content = await this._fileService.readFile(uri);
			return content.value.toString();
		} catch {
			return undefined;
		}
	}

	private async _readPackageJson(root: URI, names: string[]): Promise<IPackageJsonShape | undefined> {
		if (!names.includes('package.json')) {
			return undefined;
		}
		const text = await this._readText(URI.joinPath(root, 'package.json'));
		if (!text) {
			return undefined;
		}
		try {
			return JSON.parse(text) as IPackageJsonShape;
		} catch {
			return undefined;
		}
	}

	private async _readEnvExample(root: URI, names: string[]): Promise<string | undefined> {
		const exampleName = ENV_EXAMPLE_NAMES.find(n => names.includes(n));
		return exampleName ? this._readText(URI.joinPath(root, exampleName)) : undefined;
	}

	private async _readPythonDeps(root: URI, names: string[]): Promise<string[]> {
		const deps = new Set<string>();

		if (names.includes('requirements.txt')) {
			const text = await this._readText(URI.joinPath(root, 'requirements.txt'));
			if (text) {
				for (const line of text.split(/\r?\n/)) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
						continue;
					}
					const match = /^([A-Za-z0-9_.-]+)/.exec(trimmed);
					if (match) {
						deps.add(match[1].toLowerCase());
					}
				}
			}
		}

		// For pyproject.toml / Pipfile we only need framework hints — scan for known names.
		for (const manifest of ['pyproject.toml', 'Pipfile']) {
			if (names.includes(manifest)) {
				const text = (await this._readText(URI.joinPath(root, manifest)))?.toLowerCase();
				if (text) {
					for (const hint of PYTHON_FRAMEWORK_HINTS) {
						if (text.includes(hint)) {
							deps.add(hint);
						}
					}
				}
			}
		}

		return Array.from(deps);
	}

	async runCommand(command: string): Promise<void> {
		const cwd = this._root();
		const instance = await this._terminalService.createTerminal(cwd ? { cwd } : {});
		this._terminalService.setActiveInstance(instance);
		await this._terminalGroupService.showPanel(true);
		await instance.sendText(command, true);
	}

	async openPreview(url: string): Promise<void> {
		try {
			await this._commandService.executeCommand('simpleBrowser.show', url);
		} catch {
			await this._openerService.open(URI.parse(url));
		}
	}

	async writeRunDocs(plan: IRunPlan): Promise<URI> {
		const root = this._root();
		if (!root) {
			throw new Error('No workspace folder is open.');
		}
		const target = URI.joinPath(root, '.compyle', 'RUNNING.md');
		await this._fileService.writeFile(target, VSBuffer.fromString(this._renderRunDocs(plan)));
		return target;
	}

	private _renderRunDocs(plan: IRunPlan): string {
		const lines: string[] = [];
		lines.push('# Running This Project', '', `_Generated by Compyle Run Doctor._`, '');
		lines.push(`- **Type:** ${plan.projectType}`);
		lines.push(`- **Language:** ${plan.language}`);
		if (plan.framework) { lines.push(`- **Framework:** ${plan.framework}`); }
		if (plan.packageManager) { lines.push(`- **Package manager:** ${plan.packageManager}`); }
		if (plan.runtime) { lines.push(`- **Runtime:** ${plan.runtime}`); }
		if (plan.url) { lines.push(`- **Local URL:** ${plan.url}`); }
		lines.push('', '## Commands', '');
		for (const cmd of [plan.install, plan.dev, plan.build, plan.test]) {
			if (cmd) { lines.push(`- **${cmd.label}:** \`${cmd.command}\``); }
		}
		if (plan.envKeys.length) {
			lines.push('', '## Environment variables', '', 'Create a `.env` file with:', '');
			for (const key of plan.envKeys) { lines.push(`- \`${key}\``); }
		}
		if (plan.warnings.length) {
			lines.push('', '## Heads up', '');
			for (const warning of plan.warnings) { lines.push(`- ${warning}`); }
		}
		lines.push('', '## Overview', '', plan.explanation, '');
		return lines.join('\n');
	}
}

registerSingleton(ICompyleRunDoctorService, CompyleRunDoctorService, InstantiationType.Delayed);
