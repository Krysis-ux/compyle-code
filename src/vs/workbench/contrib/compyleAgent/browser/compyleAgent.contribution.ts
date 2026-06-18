/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './compyleAgentService.js';

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { CompyleAgentEditor } from './compyleAgent.js';
import { CompyleAgentInput, CompyleAgentInputSerializer } from './compyleAgentInput.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		'compyle.agent.scopeFolder': {
			type: 'string',
			default: '',
			description: localize('compyle.agent.scopeFolder', "Restrict Compyle agents to a folder (relative to the workspace root). Leave empty to allow the whole workspace. Excluded files (see compyle.brain.excludePatterns) are always blocked."),
			scope: ConfigurationScope.RESOURCE,
		},
	},
});

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleAgentEditor,
		CompyleAgentEditor.ID,
		localize('compyleAgent', "Agent Workspace"),
	),
	[new SyncDescriptor(CompyleAgentInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleAgentInput.ID, CompyleAgentInputSerializer);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.agent.open',
			title: { value: localize('compyle.agent.open', "Open Agent Workspace"), original: 'Open Agent Workspace' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleAgentInput);
		await editorService.openEditor(input, { pinned: false });
	}
});
