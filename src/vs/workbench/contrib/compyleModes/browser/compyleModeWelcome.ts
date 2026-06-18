/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { ILifecycleService, LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { COMPYLE_MODES_STORAGE_KEY, COMPYLE_ACTIVE_MODE_SETTING } from '../common/compyleModes.js';

export class CompyleModeWelcomeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleModeWelcome';

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super();

		lifecycleService.when(LifecyclePhase.Restored).then(() => {
			this._checkAndPrompt();
		});

		this._register(this._contextService.onDidChangeWorkspaceFolders(e => {
			if (e.added.length > 0) {
				this._checkAndPrompt();
			}
		}));
	}

	private _checkAndPrompt(): void {
		const askOnFolderOpen = this._configurationService.getValue<boolean>('compyle.modes.askOnFolderOpen');
		if (!askOnFolderOpen) { return; }

		if (this._contextService.getWorkbenchState() === WorkbenchState.EMPTY) { return; }

		const alreadyShown = this._storageService.getBoolean(
			COMPYLE_MODES_STORAGE_KEY,
			StorageScope.WORKSPACE,
			false,
		);
		if (alreadyShown) { return; }

		const activeMode = this._configurationService.getValue<string>(COMPYLE_ACTIVE_MODE_SETTING);
		if (activeMode && activeMode !== 'none') { return; }

		this._storageService.store(
			COMPYLE_MODES_STORAGE_KEY,
			true,
			StorageScope.WORKSPACE,
			StorageTarget.MACHINE,
		);

		this._notificationService.prompt(
			Severity.Info,
			'Choose your workspace experience - Compyle can shape the editor around how you want to work.',
			[
				{
					label: 'Choose Now',
					run: () => this._commandService.executeCommand('compyle.modes.switch'),
				},
				{
					label: 'Decide Later',
					run: () => { /* dismiss */ },
				},
			],
		);
	}
}

registerWorkbenchContribution2(
	CompyleModeWelcomeContribution.ID,
	CompyleModeWelcomeContribution,
	WorkbenchPhase.AfterRestored,
);
