/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ICompyleVibrancyService } from './compyleVibrancyService.js';

const STATUS_BAR_ENTRY_ID = 'status.compyle.minimalMode';

export class CompyleMinimalModeStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleMinimalModeStatusBar';

	private readonly _entryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@ICompyleVibrancyService private readonly _vibrancyService: ICompyleVibrancyService,
	) {
		super();

		this._update();
		this._register(this._vibrancyService.onDidChangeAppearance(() => this._update()));
	}

	private _update(): void {
		const on = this._vibrancyService.isMinimalMode();
		const entry: IStatusbarEntry = {
			name: localize('compyle.minimalMode.statusBar.name', "Compyle Minimal Mode"),
			text: on ? '$(layout) Minimal' : '$(layout)',
			ariaLabel: on
				? localize('compyle.minimalMode.statusBar.ariaOn', "Minimal mode is on. Click to turn it off.")
				: localize('compyle.minimalMode.statusBar.ariaOff', "Minimal mode is off. Click to turn it on."),
			tooltip: on
				? localize('compyle.minimalMode.statusBar.tooltipOn', "Minimal mode on — click for the full interface")
				: localize('compyle.minimalMode.statusBar.tooltipOff', "Minimal mode off — click to quiet the interface"),
			command: 'compyle.minimalMode.toggle',
		};

		if (this._entryAccessor.value) {
			this._entryAccessor.value.update(entry);
		} else {
			this._entryAccessor.value = this._statusbarService.addEntry(
				entry,
				STATUS_BAR_ENTRY_ID,
				StatusbarAlignment.RIGHT,
				99,
			);
		}
	}
}

registerWorkbenchContribution2(
	CompyleMinimalModeStatusBarContribution.ID,
	CompyleMinimalModeStatusBarContribution,
	WorkbenchPhase.AfterRestored,
);
