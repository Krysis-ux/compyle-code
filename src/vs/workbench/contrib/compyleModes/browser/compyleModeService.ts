/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { CompyleModeId, COMPYLE_ACTIVE_MODE_SETTING } from '../common/compyleModes.js';

export const ICompyleModeService = createDecorator<ICompyleModeService>('compyleModeService');

export interface ICompyleModeService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeMode: Event<CompyleModeId | 'none'>;
	getActiveMode(): CompyleModeId | 'none';
	switchMode(id: CompyleModeId | 'none'): Promise<void>;
}

interface IModeApplicationRecord {
	sidebarWasHidden: boolean;
	panelWasHidden: boolean;
	motionClassAdded: boolean;
}

export class CompyleModeService extends Disposable implements ICompyleModeService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeMode = this._register(new Emitter<CompyleModeId | 'none'>());
	readonly onDidChangeMode: Event<CompyleModeId | 'none'> = this._onDidChangeMode.event;

	private _lastApplication: IModeApplicationRecord | undefined;

	constructor(
		@IConfigurationService private readonly _configService: IConfigurationService,
		@IWorkbenchLayoutService private readonly _layoutService: IWorkbenchLayoutService,
	) {
		super();
		this._register(this._configService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(COMPYLE_ACTIVE_MODE_SETTING)) {
				this._applyCurrentMode();
			}
		}));
	}

	getActiveMode(): CompyleModeId | 'none' {
		return this._configService.getValue<CompyleModeId | 'none'>(COMPYLE_ACTIVE_MODE_SETTING) ?? 'none';
	}

	async switchMode(id: CompyleModeId | 'none'): Promise<void> {
		await this._configService.updateValue(COMPYLE_ACTIVE_MODE_SETTING, id);
		// _applyCurrentMode() fires via onDidChangeConfiguration listener above
	}

	private _applyCurrentMode(): void {
		const id = this.getActiveMode();
		this._revertEffects();
		if (id !== 'none') {
			this._applyEffects(id);
		}
		this._onDidChangeMode.fire(id);
	}

	private _revertEffects(): void {
		if (!this._lastApplication) {
			return;
		}
		const rec = this._lastApplication;
		if (!rec.sidebarWasHidden) {
			this._layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
		}
		if (!rec.panelWasHidden) {
			this._layoutService.setPartHidden(false, Parts.PANEL_PART);
		}
		if (rec.motionClassAdded) {
			this._layoutService.mainContainer.classList.remove('compyle-reduce-motion');
		}
		this._lastApplication = undefined;
	}

	private _applyEffects(id: CompyleModeId): void {
		const rec: IModeApplicationRecord = {
			sidebarWasHidden: !this._layoutService.isVisible(Parts.SIDEBAR_PART),
			panelWasHidden: !this._layoutService.isVisible(Parts.PANEL_PART),
			motionClassAdded: false,
		};

		if (id === 'focus') {
			const hideSidePanels = this._configService.getValue<boolean>('compyle.modes.focus.hideSidePanels');
			if (hideSidePanels) {
				this._layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
				this._layoutService.setPartHidden(true, Parts.PANEL_PART);
			}
			const reduceMotion = this._configService.getValue<boolean>('compyle.modes.focus.reduceMotion');
			if (reduceMotion) {
				this._layoutService.mainContainer.classList.add('compyle-reduce-motion');
				rec.motionClassAdded = true;
			}
		}

		this._lastApplication = rec;
	}
}

registerSingleton(ICompyleModeService, CompyleModeService, InstantiationType.Delayed);
