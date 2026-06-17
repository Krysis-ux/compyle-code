/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { COMPYLE_ACTIVE_MODE_SETTING, CompyleModeId } from '../common/compyleModes.js';
import { COMPYLE_MODES } from '../common/compyleModesRegistry.js';
import { ICompyleModeService } from './compyleModeService.js';

const STATUS_BAR_ENTRY_ID = 'status.compyle.mode';

const MODE_ICONS: Record<CompyleModeId, string> = {
	flow: '$(zap)',
	focus: '$(target)',
	tutor: '$(book)',
	resolve: '$(debug)',
};

export class CompyleModeStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleModeStatusBar';

	private readonly _entryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ICompyleModeService private readonly _modeService: ICompyleModeService,
	) {
		super();

		this._updateStatusBarEntry();

		this._register(this._modeService.onDidChangeMode(() => {
			this._updateStatusBarEntry();
		}));

		this._register(this._contextService.onDidChangeWorkbenchState(() => {
			this._updateStatusBarEntry();
		}));
	}

	private _updateStatusBarEntry(): void {
		const modeId = this._configurationService.getValue<string>(COMPYLE_ACTIVE_MODE_SETTING) as CompyleModeId | 'none' | undefined;
		const hasWorkspace = this._contextService.getWorkbenchState() !== WorkbenchState.EMPTY;

		if (!modeId || modeId === 'none') {
			if (this._entryAccessor.value) {
				this._entryAccessor.clear();
			}
			return;
		}

		const mode = COMPYLE_MODES.get(modeId);
		if (!mode) {
			this._entryAccessor.clear();
			return;
		}

		const icon = MODE_ICONS[mode.id] ?? '$(compyle)';
		const text = `${icon} Compyle: ${mode.shortName}`;
		const tooltip = [
			`Workspace Experience: ${mode.displayName}`,
			mode.tagline,
			'',
			'Click to switch workspace experience.',
			hasWorkspace ? '' : 'Open a folder to enable all features.',
		].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();

		const entry: IStatusbarEntry = {
			name: 'Compyle Workspace Experience',
			text,
			ariaLabel: `Compyle workspace experience: ${mode.displayName}`,
			tooltip,
			command: 'compyle.modes.switch',
		};

		if (this._entryAccessor.value) {
			this._entryAccessor.value.update(entry);
		} else {
			this._entryAccessor.value = this._statusbarService.addEntry(
				entry,
				STATUS_BAR_ENTRY_ID,
				StatusbarAlignment.LEFT,
				{ location: { id: 'status.editor.mode', priority: 100 }, alignment: StatusbarAlignment.RIGHT },
			);
		}
	}
}

registerWorkbenchContribution2(
	CompyleModeStatusBarContribution.ID,
	CompyleModeStatusBarContribution,
	WorkbenchPhase.AfterRestored,
);
