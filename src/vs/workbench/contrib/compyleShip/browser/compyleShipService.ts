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
import { ICompyleRunDoctorService } from '../../compyleRunDoctor/browser/compyleRunDoctorService.js';
import { buildShipPlan, IShipPlan, IShipStep, ShipStepStatus } from '../common/compyleShip.js';

export const ICompyleShipService = createDecorator<ICompyleShipService>('compyleShipService');

export interface ICompyleShipService {
	readonly _serviceBrand: undefined;
	hasWorkspace(): boolean;
	getPlan(): Promise<IShipPlan>;
	runStep(step: IShipStep): Promise<ShipStepStatus>;
}

const STEP_TIMEOUT_MS = 600_000;

export class CompyleShipService implements ICompyleShipService {
	declare readonly _serviceBrand: undefined;

	private _terminal: ITerminalInstance | undefined;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ICompyleRunDoctorService private readonly _runDoctorService: ICompyleRunDoctorService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
	) { }

	hasWorkspace(): boolean {
		return this._contextService.getWorkspace().folders.length > 0;
	}

	private _root(): URI | undefined {
		return this._contextService.getWorkspace().folders[0]?.uri;
	}

	async getPlan(): Promise<IShipPlan> {
		const plan = await this._runDoctorService.diagnose();
		const root = this._root();

		let envFilePresent = false;
		let gitignoreContent: string | undefined;
		let files: string[] = [];
		if (root) {
			try {
				const stat = await this._fileService.resolve(root);
				files = (stat.children ?? []).map(c => c.name);
				envFilePresent = files.includes('.env');
			} catch {
				// ignore
			}
			if (files.includes('.gitignore')) {
				try {
					gitignoreContent = (await this._fileService.readFile(URI.joinPath(root, '.gitignore'))).value.toString();
				} catch {
					// ignore
				}
			}
		}

		return buildShipPlan(plan, { files, envFilePresent, gitignoreContent });
	}

	private async _ensureTerminal(): Promise<ITerminalInstance> {
		if (this._terminal && this._terminalService.instances.includes(this._terminal)) {
			return this._terminal;
		}
		const cwd = this._root();
		this._terminal = await this._terminalService.createTerminal(cwd ? { cwd } : {});
		return this._terminal;
	}

	async runStep(step: IShipStep): Promise<ShipStepStatus> {
		if (!step.command) {
			return 'unknown';
		}
		const instance = await this._ensureTerminal();
		this._terminalService.setActiveInstance(instance);
		await this._terminalGroupService.showPanel(false);

		const result = this._awaitCommandResult(instance);
		await instance.sendText(step.command, true);
		return result;
	}

	private _awaitCommandResult(instance: ITerminalInstance): Promise<ShipStepStatus> {
		return new Promise<ShipStepStatus>(resolve => {
			const store = new DisposableStore();
			let settled = false;
			const finish = (status: ShipStepStatus) => {
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

			const timer = setTimeout(() => finish('unknown'), STEP_TIMEOUT_MS);
			store.add(toDisposable(() => clearTimeout(timer)));
		});
	}
}

registerSingleton(ICompyleShipService, CompyleShipService, InstantiationType.Delayed);
