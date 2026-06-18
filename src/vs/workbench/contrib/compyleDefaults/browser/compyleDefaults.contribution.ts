/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

const COMPYLE_DEFAULTS_APPLIED_KEY = 'compyle.premiumDefaults.applied';

/**
 * Opinionated, premium-feeling editor defaults. Applied once on first run so Compyle
 * looks and feels better than stock VS Code out of the box — without overriding any
 * setting the user has already chosen.
 */
const PREMIUM_DEFAULTS: ReadonlyArray<[string, unknown]> = [
	['editor.fontLigatures', true],
	['editor.cursorBlinking', 'smooth'],
	['editor.cursorSmoothCaretAnimation', 'on'],
	['editor.smoothScrolling', true],
	['editor.stickyScroll.enabled', true],
	['editor.guides.bracketPairs', 'active'],
	['editor.bracketPairColorization.enabled', true],
	['editor.cursorSurroundingLines', 6],
	['editor.padding.top', 12],
	['editor.renderWhitespace', 'boundary'],
	['editor.minimap.renderCharacters', false],
	['workbench.list.smoothScrolling', true],
];

async function applyPremiumDefaults(configurationService: IConfigurationService, force: boolean): Promise<number> {
	let applied = 0;
	for (const [key, value] of PREMIUM_DEFAULTS) {
		if (!force && configurationService.inspect(key).userValue !== undefined) {
			continue; // respect the user's explicit choice
		}
		await configurationService.updateValue(key, value, ConfigurationTarget.USER);
		applied++;
	}
	return applied;
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.applyPremiumDefaults',
			title: { value: localize('compyle.applyPremiumDefaults', "Apply Premium Editor Defaults"), original: 'Apply Premium Editor Defaults' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		await applyPremiumDefaults(configurationService, true);
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.applyPremiumDefaults.done', "Applied Compyle's premium editor defaults.") });
	}
});

class CompyleDefaultsStartupContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleDefaults';

	constructor(
		@IStorageService storageService: IStorageService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		if (storageService.getBoolean(COMPYLE_DEFAULTS_APPLIED_KEY, StorageScope.APPLICATION, false)) {
			return;
		}
		storageService.store(COMPYLE_DEFAULTS_APPLIED_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
		void applyPremiumDefaults(configurationService, false);
	}
}

registerWorkbenchContribution2(
	CompyleDefaultsStartupContribution.ID,
	CompyleDefaultsStartupContribution,
	WorkbenchPhase.Eventually,
);
