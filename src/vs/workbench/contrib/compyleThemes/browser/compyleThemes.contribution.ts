/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { CompyleThemeGalleryEditor } from './compyleThemeGallery.js';
import { CompyleThemeGalleryInput, CompyleThemeGalleryInputSerializer } from './compyleThemeGalleryInput.js';

// Side-effect import for the status bar contribution
import './compyleThemeStatusBar.js';

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
		'compyle.themes.showStatusBarEntry': {
			type: 'boolean',
			default: true,
			description: localize('compyle.themes.showStatusBarEntry', "Show the current theme in the status bar with a quick link to the Theme Gallery."),
			scope: ConfigurationScope.APPLICATION,
		},
	}
});

// ---------------------------------------------------------------------------
// Theme Gallery editor
// ---------------------------------------------------------------------------

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleThemeGalleryEditor,
		CompyleThemeGalleryEditor.ID,
		localize('compyleThemeGallery', "Theme Gallery"),
	),
	[new SyncDescriptor(CompyleThemeGalleryInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleThemeGalleryInput.ID, CompyleThemeGalleryInputSerializer);

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
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleThemeGalleryInput);
		await editorService.openEditor(input, { pinned: false });
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

	override async run(accessor: ServicesAccessor): Promise<void> {
		const themeService = accessor.get(IWorkbenchThemeService);
		const configurationService = accessor.get(IConfigurationService);

		const favorites = configurationService.getValue<string[]>('compyle.themes.favorites') ?? [];
		const allThemes = await themeService.getColorThemes();

		// Prefer favorites; fall back to all installed themes.
		const pool = favorites.length
			? allThemes.filter(t => favorites.includes(t.settingsId))
			: allThemes;
		if (pool.length === 0) {
			return;
		}

		const currentId = themeService.getColorTheme().settingsId;
		const candidates = pool.length > 1 ? pool.filter(t => t.settingsId !== currentId) : pool;
		const pick = candidates[Math.floor(Math.random() * candidates.length)];
		await themeService.setColorTheme(pick.id, 'auto');
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

	override async run(accessor: ServicesAccessor): Promise<void> {
		const themeService = accessor.get(IWorkbenchThemeService);
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);

		const current = themeService.getColorTheme();
		const favorites = configurationService.getValue<string[]>('compyle.themes.favorites') ?? [];
		if (favorites.includes(current.settingsId)) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.themes.alreadyFavorite', "\"{0}\" is already in your favorites.", current.label) });
			return;
		}

		await configurationService.updateValue('compyle.themes.favorites', [...favorites, current.settingsId]);
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.themes.addedFavorite', "Added \"{0}\" to your theme favorites.", current.label) });
	}
}

registerAction2(OpenThemeGalleryAction);
registerAction2(RandomThemeAction);
registerAction2(FavoriteCurrentThemeAction);

// ---------------------------------------------------------------------------
// Menu entry points
// ---------------------------------------------------------------------------

// Surface the gallery at the top of the existing "Themes" submenu, which appears
// both in the Manage gear menu (GlobalActivity) and the Preferences menu.
const themesSubMenu = MenuId.for('ThemesSubMenu');

MenuRegistry.appendMenuItem(themesSubMenu, {
	command: {
		id: 'compyle.themes.openGallery',
		title: localize('compyle.themes.openGallery.menu', "Theme Gallery"),
	},
	order: 0,
});
