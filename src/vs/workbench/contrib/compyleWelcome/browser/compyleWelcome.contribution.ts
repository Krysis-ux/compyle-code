/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2, MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { CompyleWelcomeEditor } from './compyleWelcome.js';
import { CompyleWelcomeInput, CompyleWelcomeInputSerializer, COMPYLE_WELCOME_COMPLETED_KEY } from './compyleWelcomeInput.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleWelcomeEditor,
		CompyleWelcomeEditor.ID,
		localize('compyleWelcome', "Welcome to Compyle"),
	),
	[new SyncDescriptor(CompyleWelcomeInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleWelcomeInput.ID, CompyleWelcomeInputSerializer);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.welcome.open',
			title: { value: localize('compyle.welcome.open', "Open Welcome"), original: 'Open Welcome' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleWelcomeInput);
		await editorService.openEditor(input, { pinned: false });
	}
});

MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
	command: {
		id: 'compyle.welcome.open',
		title: localize('compyle.welcome.menu', "Welcome to Compyle"),
	},
	group: '1_welcome',
	order: 1,
});

/**
 * Opens the Welcome editor exactly once, on the first launch. The flag is set as
 * soon as it opens so it never nags again, regardless of whether the user finishes.
 */
class CompyleWelcomeStartupContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleWelcomeStartup';

	constructor(
		@IStorageService storageService: IStorageService,
		@IEditorService editorService: IEditorService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		if (storageService.getBoolean(COMPYLE_WELCOME_COMPLETED_KEY, StorageScope.APPLICATION, false)) {
			return;
		}
		storageService.store(COMPYLE_WELCOME_COMPLETED_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
		const input = instantiationService.createInstance(CompyleWelcomeInput);
		void editorService.openEditor(input, { pinned: false });
	}
}

registerWorkbenchContribution2(
	CompyleWelcomeStartupContribution.ID,
	CompyleWelcomeStartupContribution,
	WorkbenchPhase.AfterRestored,
);
