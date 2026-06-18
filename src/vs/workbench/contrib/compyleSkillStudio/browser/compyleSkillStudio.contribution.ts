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
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { CompyleSkillStudioEditor } from './compyleSkillStudio.js';
import { CompyleSkillStudioInput, CompyleSkillStudioInputSerializer } from './compyleSkillStudioInput.js';
// Side-effect import registers the skill service singleton.
import './compyleSkillService.js';
import { COMPYLE_SKILLS_DEFAULT_DIR, COMPYLE_SKILLS_DIR_SETTING, COMPYLE_SKILL_STUDIO_ENABLED_SETTING } from '../common/compyleSkills.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[COMPYLE_SKILL_STUDIO_ENABLED_SETTING]: {
			type: 'boolean',
			default: true,
			description: localize('compyle.skillStudio.enabled', "Enable Skill Studio — create reusable instruction sets for Compyle Brain."),
			scope: ConfigurationScope.APPLICATION,
		},
		[COMPYLE_SKILLS_DIR_SETTING]: {
			type: 'string',
			default: COMPYLE_SKILLS_DEFAULT_DIR,
			description: localize('compyle.skillStudio.skillsDir', "Folder (relative to the workspace) where Compyle skills are stored."),
			scope: ConfigurationScope.RESOURCE,
		},
	},
});

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleSkillStudioEditor,
		CompyleSkillStudioEditor.ID,
		localize('compyleSkillStudio', "Skill Studio"),
	),
	[new SyncDescriptor(CompyleSkillStudioInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleSkillStudioInput.ID, CompyleSkillStudioInputSerializer);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.skillStudio.open',
			title: { value: localize('compyle.skillStudio.open', "Open Skill Studio"), original: 'Open Skill Studio' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleSkillStudioInput);
		await editorService.openEditor(input, { pinned: false });
	}
});
