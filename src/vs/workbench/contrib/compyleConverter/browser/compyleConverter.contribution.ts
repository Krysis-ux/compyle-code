/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
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
import { CompyleConverterEditor } from './compyleConverter.js';
import { CompyleConverterInput, CompyleConverterInputSerializer } from './compyleConverterInput.js';
// Side-effect import registers the converter service singleton.
import './compyleConverterService.js';
import { COMPYLE_CONVERTER_CONVERTX_ENDPOINT_SETTING, COMPYLE_CONVERTER_ENABLED_SETTING, COMPYLE_CONVERTER_OUTPUT_DIR_SETTING } from './compyleConverterService.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };
const OPEN_COMMAND_ID = 'compyle.converter.open';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[COMPYLE_CONVERTER_ENABLED_SETTING]: {
			type: 'boolean',
			default: true,
			description: localize('compyle.converter.enabled', "Enable the Compyle file converter and its right-click menu entries."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_CONVERTER_CONVERTX_ENDPOINT_SETTING]: {
			type: 'string',
			default: '',
			description: localize('compyle.converter.convertxEndpoint', "Base URL of a self-hosted ConvertX server for the long tail of formats (e.g. http://localhost:3000). Leave empty to use local tools only."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_CONVERTER_OUTPUT_DIR_SETTING]: {
			type: 'string',
			default: '',
			description: localize('compyle.converter.outputDirectory', "Directory for converted files. Leave empty to write next to the source file."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleConverterEditor,
		CompyleConverterEditor.ID,
		localize('compyleConverter', "Compyle Converter"),
	),
	[new SyncDescriptor(CompyleConverterInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleConverterInput.ID, CompyleConverterInputSerializer);

// ---------------------------------------------------------------------------
// Open command + context menus
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: OPEN_COMMAND_ID,
			title: { value: localize('compyle.converter.open', "Convert with Compyle..."), original: 'Convert with Compyle...' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor, resource?: URI): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);

		if (configurationService.getValue<boolean>(COMPYLE_CONVERTER_ENABLED_SETTING) === false) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.converter.disabled', "The Compyle converter is turned off. Enable it in Settings.") });
			return;
		}

		// From the explorer the resource is passed in; otherwise use the active editor.
		const source = resource ?? editorService.activeEditor?.resource;
		if (!source) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.converter.noFile', "Open or right-click a file to convert it.") });
			return;
		}
		const input = instantiationService.createInstance(CompyleConverterInput, source);
		await editorService.openEditor(input, { pinned: true });
	}
});

MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
	command: {
		id: OPEN_COMMAND_ID,
		title: localize('compyle.converter.explorerMenu', "Convert with Compyle..."),
	},
	group: '7_modification',
	order: 40,
});

MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
	command: {
		id: OPEN_COMMAND_ID,
		title: localize('compyle.converter.editorMenu', "Convert with Compyle..."),
	},
	group: '2_files',
	order: 40,
});
