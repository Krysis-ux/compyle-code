/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		'compyle.themes.randomOnLaunch': {
			type: 'boolean',
			default: false,
			description: localize('compyle.themes.randomOnLaunch', "Apply a random theme from your favorites each time Compyle Code starts."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.themes.matchOS': {
			type: 'boolean',
			default: true,
			description: localize('compyle.themes.matchOS', "Automatically switch between light and dark themes based on your OS appearance setting."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.themes.reduceTransparency': {
			type: 'boolean',
			default: false,
			description: localize('compyle.themes.reduceTransparency', "Reduce UI transparency effects for better readability or accessibility."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.themes.reduceMotion': {
			type: 'string',
			default: 'auto',
			enum: ['auto', 'on', 'off'],
			enumDescriptions: [
				localize('reduceMotion.auto', "Respect OS reduce-motion setting"),
				localize('reduceMotion.on', "Always reduce animations"),
				localize('reduceMotion.off', "Allow all animations"),
			],
			description: localize('compyle.themes.reduceMotion', "Control UI animation intensity."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.themes.favorites': {
			type: 'array',
			items: { type: 'string' },
			default: [],
			description: localize('compyle.themes.favorites', "List of favorite theme IDs for quick switching and random-on-launch."),
			scope: ConfigurationScope.APPLICATION,
		},
	}
});

// ---------------------------------------------------------------------------
// Theme categories for the Compyle Theme Gallery
// ---------------------------------------------------------------------------

export interface CompyleThemeCategory {
	readonly id: string;
	readonly label: string;
	readonly themeIds: string[];
}

export const COMPYLE_THEME_CATEGORIES: CompyleThemeCategory[] = [
	{
		id: 'dark',
		label: localize('themeCategory.dark', "Dark"),
		themeIds: ['Default Dark Modern', 'Default Dark+', 'Compyle Dark', 'Dark 2026', 'Solarized Dark'],
	},
	{
		id: 'light',
		label: localize('themeCategory.light', "Light"),
		themeIds: ['Default Light Modern', 'Default Light+', 'Compyle Light', 'Light 2026', 'Solarized Light'],
	},
	{
		id: 'high-contrast',
		label: localize('themeCategory.highContrast', "High Contrast"),
		themeIds: ['Default High Contrast', 'Default High Contrast Light'],
	},
	{
		id: 'neon',
		label: localize('themeCategory.neon', "Neon"),
		themeIds: [],
	},
	{
		id: 'cyber',
		label: localize('themeCategory.cyber', "Cyber"),
		themeIds: [],
	},
	{
		id: 'minimal',
		label: localize('themeCategory.minimal', "Minimal"),
		themeIds: [],
	},
	{
		id: 'retro',
		label: localize('themeCategory.retro', "Retro"),
		themeIds: [],
	},
	{
		id: 'focus',
		label: localize('themeCategory.focus', "Focus"),
		themeIds: [],
	},
	{
		id: 'oled',
		label: localize('themeCategory.oled', "OLED"),
		themeIds: [],
	},
	{
		id: 'classroom',
		label: localize('themeCategory.classroom', "Classroom / Beginner"),
		themeIds: [],
	},
	{
		id: 'hacker-lab',
		label: localize('themeCategory.hackerLab', "Hacker Lab"),
		themeIds: [],
	},
];

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

class OpenThemeGalleryAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.themes.openGallery',
			title: { value: localize('compyle.themes.openGallery', "Open Theme Gallery"), original: 'Open Theme Gallery' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		// Opens the standard theme picker — Compyle Theme Gallery UI is a future enhancement
		await commandService.executeCommand('workbench.action.selectTheme');
	}
}

class RandomThemeAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.themes.random',
			title: { value: localize('compyle.themes.random', "Apply Random Theme"), original: 'Apply Random Theme' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: pick randomly from favorites or all installed themes
	}
}

class FavoriteCurrentThemeAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.themes.favoriteCurrentTheme',
			title: { value: localize('compyle.themes.favoriteCurrentTheme', "Add Current Theme to Favorites"), original: 'Add Current Theme to Favorites' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: add current workbench.colorTheme to compyle.themes.favorites
	}
}

registerAction2(OpenThemeGalleryAction);
registerAction2(RandomThemeAction);
registerAction2(FavoriteCurrentThemeAction);
