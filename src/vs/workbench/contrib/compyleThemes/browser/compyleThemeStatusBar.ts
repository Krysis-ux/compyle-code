/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

const STATUS_BAR_ENTRY_ID = 'status.compyle.theme';
const SHOW_SETTING = 'compyle.themes.showStatusBarEntry';

export class CompyleThemeStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleThemeStatusBar';

	private readonly _entryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IWorkbenchThemeService private readonly _themeService: IWorkbenchThemeService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super();

		this._update();

		this._register(this._themeService.onDidColorThemeChange(() => this._update()));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(SHOW_SETTING)) {
				this._update();
			}
		}));
	}

	private _update(): void {
		const show = this._configurationService.getValue<boolean>(SHOW_SETTING) !== false;
		if (!show) {
			this._entryAccessor.clear();
			return;
		}

		const theme = this._themeService.getColorTheme();
		const entry: IStatusbarEntry = {
			name: localize('compyle.themes.statusBar.name', "Compyle Theme"),
			text: `$(symbol-color) ${theme.label}`,
			ariaLabel: localize('compyle.themes.statusBar.aria', "Current theme: {0}. Click to open the Theme Gallery.", theme.label),
			tooltip: localize('compyle.themes.statusBar.tooltip', "Theme: {0} — click to browse the Theme Gallery", theme.label),
			command: 'compyle.themes.openGallery',
		};

		if (this._entryAccessor.value) {
			this._entryAccessor.value.update(entry);
		} else {
			this._entryAccessor.value = this._statusbarService.addEntry(
				entry,
				STATUS_BAR_ENTRY_ID,
				StatusbarAlignment.RIGHT,
				100,
			);
		}
	}
}

registerWorkbenchContribution2(
	CompyleThemeStatusBarContribution.ID,
	CompyleThemeStatusBarContribution,
	WorkbenchPhase.AfterRestored,
);
