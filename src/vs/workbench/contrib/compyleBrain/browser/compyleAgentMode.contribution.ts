/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { COMPYLE_AGENT_MODE_SETTING, COMPYLE_AGENT_MODES, getAgentModeInfo } from '../common/compyleAgentModes.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

// ---------------------------------------------------------------------------
// Setting
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[COMPYLE_AGENT_MODE_SETTING]: {
			type: 'string',
			enum: COMPYLE_AGENT_MODES.map(m => m.id),
			enumDescriptions: COMPYLE_AGENT_MODES.map(m => m.description),
			default: 'code',
			description: localize('compyle.agent.mode', "Agent mode steers how Compyle Brain responds. Each mode prepends a role-specific instruction to every AI request. Switch it from the status bar."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

// ---------------------------------------------------------------------------
// Pick command
// ---------------------------------------------------------------------------

interface IModePickItem extends IQuickPickItem {
	readonly modeId: string;
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.agent.pickMode',
			title: { value: localize('compyle.agent.pickMode', "Pick Agent Mode"), original: 'Pick Agent Mode' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const configurationService = accessor.get(IConfigurationService);

		const current = configurationService.getValue<string>(COMPYLE_AGENT_MODE_SETTING);
		const items: IModePickItem[] = COMPYLE_AGENT_MODES.map(mode => ({
			modeId: mode.id,
			label: `$(${mode.icon}) ${mode.name}`,
			description: mode.id === current ? localize('compyle.agent.active', "Active") : undefined,
			detail: mode.description,
		}));

		const picked = await quickInputService.pick(items, {
			placeHolder: localize('compyle.agent.pickPlaceholder', "Choose how Compyle Brain should respond"),
		});
		if (picked) {
			await configurationService.updateValue(COMPYLE_AGENT_MODE_SETTING, picked.modeId);
		}
	}
});

// ---------------------------------------------------------------------------
// Status bar chip
// ---------------------------------------------------------------------------

class CompyleAgentModeStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleAgentModeStatusBar';

	private readonly _entryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super();
		this._update();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(COMPYLE_AGENT_MODE_SETTING)) {
				this._update();
			}
		}));
	}

	private _update(): void {
		const mode = getAgentModeInfo(this._configurationService.getValue<string>(COMPYLE_AGENT_MODE_SETTING));
		const entry: IStatusbarEntry = {
			name: localize('compyle.agent.statusBar.name', "Compyle Agent Mode"),
			text: `$(${mode.icon}) ${mode.name}`,
			ariaLabel: localize('compyle.agent.statusBar.aria', "Compyle agent mode: {0}. Click to change.", mode.name),
			tooltip: localize('compyle.agent.statusBar.tooltip', "Agent mode: {0} — {1}. Click to change.", mode.name, mode.description),
			command: 'compyle.agent.pickMode',
		};

		if (this._entryAccessor.value) {
			this._entryAccessor.value.update(entry);
		} else {
			this._entryAccessor.value = this._statusbarService.addEntry(entry, 'status.compyle.agentMode', StatusbarAlignment.RIGHT, 97);
		}
	}
}

registerWorkbenchContribution2(
	CompyleAgentModeStatusBarContribution.ID,
	CompyleAgentModeStatusBarContribution,
	WorkbenchPhase.AfterRestored,
);
