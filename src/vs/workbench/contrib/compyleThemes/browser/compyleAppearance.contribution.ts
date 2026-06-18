/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleShared.css';
import './media/compyleVibrancy.css';
import './compyleMinimalModeStatusBar.js';

import { localize } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { CompyleAppearanceStudioEditor } from './compyleAppearanceStudio.js';
import { CompyleAppearanceStudioInput, CompyleAppearanceStudioInputSerializer } from './compyleAppearanceStudioInput.js';
import { ICompyleVibrancyService } from './compyleVibrancyService.js';
import {
	COMPYLE_APPEARANCE_MODE_SETTING,
	COMPYLE_COMPACT_MODE_SETTING,
	COMPYLE_MINIMAL_MODE_SETTING,
	COMPYLE_REDUCED_MOTION_SETTING,
	COMPYLE_VIBRANCY_BLUR_SETTING,
	COMPYLE_VIBRANCY_DEFAULTS,
	COMPYLE_VIBRANCY_OPACITY_SETTING,
	COMPYLE_VIBRANCY_STYLE_SETTING,
	COMPYLE_VIBRANCY_TINT_SETTING,
} from '../common/compyleVibrancy.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[COMPYLE_APPEARANCE_MODE_SETTING]: {
			type: 'string',
			enum: ['standard', 'vibrancy'],
			enumDescriptions: [
				localize('compyle.appearance.mode.standard', "Clean, fully opaque interface."),
				localize('compyle.appearance.mode.vibrancy', "Frosted-glass surfaces with depth and blur."),
			],
			default: COMPYLE_VIBRANCY_DEFAULTS.mode,
			description: localize('compyle.appearance.mode', "Overall appearance mode. Use the Appearance Studio to preview and switch."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_VIBRANCY_STYLE_SETTING]: {
			type: 'string',
			enum: ['frost', 'acrylic', 'mica', 'tint'],
			enumDescriptions: [
				localize('compyle.appearance.style.frost', "Light, neutral frosted glass."),
				localize('compyle.appearance.style.acrylic', "Saturated, tinted, lively depth."),
				localize('compyle.appearance.style.mica', "Subtle, quiet material tint."),
				localize('compyle.appearance.style.tint', "Translucent accent wash."),
			],
			default: COMPYLE_VIBRANCY_DEFAULTS.style,
			description: localize('compyle.appearance.style', "Glass style used when appearance mode is Vibrancy."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_VIBRANCY_OPACITY_SETTING]: {
			type: 'number',
			minimum: 0.3,
			maximum: 1,
			default: COMPYLE_VIBRANCY_DEFAULTS.opacity,
			description: localize('compyle.appearance.opacity', "Surface opacity for glass chrome (0.3 very see-through, 1.0 solid)."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_VIBRANCY_BLUR_SETTING]: {
			type: 'number',
			minimum: 0,
			maximum: 40,
			default: COMPYLE_VIBRANCY_DEFAULTS.blur,
			description: localize('compyle.appearance.blurRadius', "Backdrop blur radius in pixels for glass surfaces."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_VIBRANCY_TINT_SETTING]: {
			type: 'string',
			default: COMPYLE_VIBRANCY_DEFAULTS.tint,
			description: localize('compyle.appearance.tint', "Accent tint (hex) layered into the glass and depth background."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_REDUCED_MOTION_SETTING]: {
			type: 'boolean',
			default: false,
			description: localize('compyle.appearance.reducedMotion', "Reduce interface animations and cap glass blur for comfort and performance."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_COMPACT_MODE_SETTING]: {
			type: 'boolean',
			default: false,
			description: localize('compyle.appearance.compactMode', "Tighten tabs, status bar, and list rows for a denser layout without hiding features."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_MINIMAL_MODE_SETTING]: {
			type: 'boolean',
			default: false,
			description: localize('compyle.minimalMode.enabled', "Minimal mode reduces interface chrome with flatter surfaces and quieter tabs without hiding any features. Toggle it from the status bar or the command palette."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

// ---------------------------------------------------------------------------
// Appearance Studio editor
// ---------------------------------------------------------------------------

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleAppearanceStudioEditor,
		CompyleAppearanceStudioEditor.ID,
		localize('compyleAppearanceStudio', "Appearance Studio"),
	),
	[new SyncDescriptor(CompyleAppearanceStudioInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleAppearanceStudioInput.ID, CompyleAppearanceStudioInputSerializer);

// ---------------------------------------------------------------------------
// Startup: force the vibrancy service to instantiate and restore styling
// ---------------------------------------------------------------------------

class CompyleAppearanceContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleAppearance';

	constructor(
		@ICompyleVibrancyService _vibrancyService: ICompyleVibrancyService,
	) {
		// The service applies persisted appearance in its constructor.
	}
}

registerWorkbenchContribution2(
	CompyleAppearanceContribution.ID,
	CompyleAppearanceContribution,
	WorkbenchPhase.BlockRestore,
);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.appearance.openStudio',
			title: { value: localize('compyle.appearance.openStudio', "Open Appearance Studio"), original: 'Open Appearance Studio' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleAppearanceStudioInput);
		await editorService.openEditor(input, { pinned: false });
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.appearance.reset',
			title: { value: localize('compyle.appearance.reset', "Reset Appearance"), original: 'Reset Appearance' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(ICompyleVibrancyService).reset();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.appearance.toggleVibrancy',
			title: { value: localize('compyle.appearance.toggleVibrancy', "Toggle Vibrancy"), original: 'Toggle Vibrancy' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const vibrancy = accessor.get(ICompyleVibrancyService);
		await vibrancy.setMode(vibrancy.getMode() === 'vibrancy' ? 'standard' : 'vibrancy');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.minimalMode.toggle',
			title: { value: localize('compyle.minimalMode.toggle', "Toggle Minimal Mode"), original: 'Toggle Minimal Mode' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const vibrancy = accessor.get(ICompyleVibrancyService);
		await vibrancy.setMinimalMode(!vibrancy.isMinimalMode());
	}
});

// ---------------------------------------------------------------------------
// Menu entry points (Themes submenu — appears in the gear and Preferences menus)
// ---------------------------------------------------------------------------

MenuRegistry.appendMenuItem(MenuId.for('ThemesSubMenu'), {
	command: {
		id: 'compyle.appearance.openStudio',
		title: localize('compyle.appearance.openStudio.menu', "Appearance Studio"),
	},
	order: -1,
});
