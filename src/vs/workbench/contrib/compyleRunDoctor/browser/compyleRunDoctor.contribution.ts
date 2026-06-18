/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './compyleRunDoctorService.js';

import { localize } from '../../../../nls.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { CompyleRunDoctorEditor } from './compyleRunDoctor.js';
import { CompyleRunDoctorInput, CompyleRunDoctorInputSerializer } from './compyleRunDoctorInput.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };
const OPEN_COMMAND_ID = 'compyle.runDoctor.open';

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleRunDoctorEditor,
		CompyleRunDoctorEditor.ID,
		localize('compyleRunDoctor', "Run Doctor"),
	),
	[new SyncDescriptor(CompyleRunDoctorInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleRunDoctorInput.ID, CompyleRunDoctorInputSerializer);

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: OPEN_COMMAND_ID,
			title: { value: localize('compyle.runDoctor.open', "Run Doctor"), original: 'Run Doctor' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleRunDoctorInput);
		await editorService.openEditor(input, { pinned: false });
	}
});

// ---------------------------------------------------------------------------
// Status bar entry (shown while a folder is open)
// ---------------------------------------------------------------------------

class CompyleRunDoctorStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleRunDoctorStatusBar';

	private readonly _entry = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
	) {
		super();

		this._update();
		this._register(this._contextService.onDidChangeWorkbenchState(() => this._update()));
	}

	private _update(): void {
		if (this._contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			this._entry.clear();
			return;
		}

		const entry: IStatusbarEntry = {
			name: localize('compyle.runDoctor.statusBar.name', "Run Doctor"),
			text: '$(rocket) Run Doctor',
			ariaLabel: localize('compyle.runDoctor.statusBar.aria', "Run Doctor — figure out how to run this project"),
			tooltip: localize('compyle.runDoctor.statusBar.tooltip', "Run Doctor — detect how to install, run, build, and test this project"),
			command: OPEN_COMMAND_ID,
		};

		if (this._entry.value) {
			this._entry.value.update(entry);
		} else {
			this._entry.value = this._statusbarService.addEntry(entry, 'status.compyle.runDoctor', StatusbarAlignment.LEFT, 90);
		}
	}
}

registerWorkbenchContribution2(
	CompyleRunDoctorStatusBarContribution.ID,
	CompyleRunDoctorStatusBarContribution,
	WorkbenchPhase.AfterRestored,
);
