/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { CompyleRouterEditor } from './compyleRouter.js';
import { CompyleRouterInput, CompyleRouterInputSerializer } from './compyleRouterInput.js';
// Side-effect import registers the router service singleton.
import './compyleRouterService.js';
import {
	COMPYLE_ROUTER_CUSTOM_PATH_SETTING,
	COMPYLE_ROUTER_CUSTOM_TEMPLATE,
	COMPYLE_ROUTER_LOG_SETTING,
	COMPYLE_ROUTER_MODE_SETTING,
	COMPYLE_ROUTER_QUALITY_GATE_SETTING,
} from '../common/compyleRouter.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };
const DEFAULT_CONFIG_REL_PATH = '.compyle/router.json';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[COMPYLE_ROUTER_MODE_SETTING]: {
			type: 'string',
			enum: ['none', 'default', 'custom'],
			enumDescriptions: [
				localize('compyle.router.mode.none', "No routing — requests go straight to the provider."),
				localize('compyle.router.mode.default', "Built-in Compyle routing table and quality gate."),
				localize('compyle.router.mode.custom', "User-defined keyword rules from a JSON config."),
			],
			default: 'default',
			description: localize('compyle.router.mode', "How Compyle Router steers AI requests. Open the Router with \"Compyle: Open Router\"."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_ROUTER_CUSTOM_PATH_SETTING]: {
			type: 'string',
			default: '',
			description: localize('compyle.router.customConfigPath', "Path to a custom router JSON config (absolute, or relative to the workspace). Used when the router mode is Custom."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_ROUTER_QUALITY_GATE_SETTING]: {
			type: 'boolean',
			default: true,
			description: localize('compyle.router.enableQualityGate', "Scan AI output for likely secrets and dangerous shell commands, and prepend a warning when found."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_ROUTER_LOG_SETTING]: {
			type: 'boolean',
			default: false,
			description: localize('compyle.router.logRouting', "Record recent routing decisions so they can be reviewed in the Router."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleRouterEditor,
		CompyleRouterEditor.ID,
		localize('compyleRouter', "Compyle Router"),
	),
	[new SyncDescriptor(CompyleRouterInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleRouterInput.ID, CompyleRouterInputSerializer);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveConfigUri(configurationService: IConfigurationService, contextService: IWorkspaceContextService): URI | undefined {
	const raw = configurationService.getValue<string>(COMPYLE_ROUTER_CUSTOM_PATH_SETTING);
	if (!raw) {
		return undefined;
	}
	if (/^(?:[a-zA-Z]:[\\/]|\/)/.test(raw)) {
		return URI.file(raw);
	}
	const root = contextService.getWorkspace().folders[0]?.uri;
	return root ? joinPath(root, raw) : undefined;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.router.openConfig',
			title: { value: localize('compyle.router.openConfig', "Open Router"), original: 'Open Router' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleRouterInput);
		await editorService.openEditor(input, { pinned: false });
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.router.createTemplate',
			title: { value: localize('compyle.router.createTemplate', "Create Custom Router Template"), original: 'Create Custom Router Template' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const contextService = accessor.get(IWorkspaceContextService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const notificationService = accessor.get(INotificationService);

		const root = contextService.getWorkspace().folders[0]?.uri;
		if (!root) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.router.noFolder', "Open a folder first to create a router config.") });
			return;
		}
		const target = joinPath(root, DEFAULT_CONFIG_REL_PATH);
		if (!(await fileService.exists(target))) {
			await fileService.writeFile(target, VSBuffer.fromString(JSON.stringify(COMPYLE_ROUTER_CUSTOM_TEMPLATE, null, '\t') + '\n'));
		}
		await configurationService.updateValue(COMPYLE_ROUTER_CUSTOM_PATH_SETTING, DEFAULT_CONFIG_REL_PATH);
		await configurationService.updateValue(COMPYLE_ROUTER_MODE_SETTING, 'custom');
		await editorService.openEditor({ resource: target, options: { pinned: true } });
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.router.openConfigFile',
			title: { value: localize('compyle.router.openConfigFile', "Open Router Config File"), original: 'Open Router Config File' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const contextService = accessor.get(IWorkspaceContextService);
		const editorService = accessor.get(IEditorService);
		const notificationService = accessor.get(INotificationService);

		const uri = resolveConfigUri(configurationService, contextService);
		if (!uri) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.router.noConfig', "No router config path set. Use \"Create Custom Router Template\" or \"Import Config\".") });
			return;
		}
		await editorService.openEditor({ resource: uri, options: { pinned: true } });
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.router.importConfig',
			title: { value: localize('compyle.router.importConfig', "Import Router Config..."), original: 'Import Router Config...' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const fileDialogService = accessor.get(IFileDialogService);
		const configurationService = accessor.get(IConfigurationService);

		const picked = await fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectMany: false,
			title: localize('compyle.router.importTitle', "Select a router config JSON"),
			filters: [{ name: 'JSON', extensions: ['json'] }],
		});
		if (!picked || picked.length === 0) {
			return;
		}
		await configurationService.updateValue(COMPYLE_ROUTER_CUSTOM_PATH_SETTING, picked[0].fsPath);
		await configurationService.updateValue(COMPYLE_ROUTER_MODE_SETTING, 'custom');
	}
});
