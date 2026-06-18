/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './compyleQualityGuardianService.js';

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { CompyleQualityGuardianEditor } from './compyleQualityGuardian.js';
import { CompyleQualityGuardianInput, CompyleQualityGuardianInputSerializer } from './compyleQualityGuardianInput.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleQualityGuardianEditor,
		CompyleQualityGuardianEditor.ID,
		localize('compyleQualityGuardian', "Quality Guardian"),
	),
	[new SyncDescriptor(CompyleQualityGuardianInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleQualityGuardianInput.ID, CompyleQualityGuardianInputSerializer);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.qualityGuardian.open',
			title: { value: localize('compyle.qualityGuardian.open', "Open Quality Guardian"), original: 'Open Quality Guardian' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleQualityGuardianInput);
		await editorService.openEditor(input, { pinned: false });
	}
});
