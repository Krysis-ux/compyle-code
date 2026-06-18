/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

interface ICommandCenterItem extends IQuickPickItem {
	readonly runId: string;
}

const CODE_LANGUAGES = new Set(['html', 'css', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue', 'svelte', 'python']);

function item(label: string, description: string, runId: string, icon?: string): ICommandCenterItem {
	return { label: icon ? `$(${icon}) ${label}` : label, description, runId };
}

function sep(label: string): IQuickPickSeparator {
	return { type: 'separator', label };
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.commandCenter.open',
			title: { value: localize('compyle.commandCenter.open', "Command Center"), original: 'Command Center' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Period,
			},
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const commandService = accessor.get(ICommandService);
		const contextService = accessor.get(IWorkspaceContextService);
		const codeEditorService = accessor.get(ICodeEditorService);

		const hasWorkspace = contextService.getWorkbenchState() !== WorkbenchState.EMPTY;
		const activeLang = codeEditorService.getActiveCodeEditor()?.getModel()?.getLanguageId();
		const isCodeFile = !!activeLang && CODE_LANGUAGES.has(activeLang);

		const items: Array<ICommandCenterItem | IQuickPickSeparator> = [];

		// ---- Context-aware suggestions ----
		const suggestions: ICommandCenterItem[] = [];
		if (!hasWorkspace) {
			suggestions.push(item(localize('cc.newProject', "Create Project"), localize('cc.newProject.d', "Choose app type and scaffold a runnable project"), 'compyle.starter.open', 'rocket'));
			suggestions.push(item(localize('cc.openFolder', "Open Folder"), localize('cc.openFolder.d', "Open an existing project"), 'workbench.action.files.openFolder', 'folder-opened'));
		} else {
			suggestions.push(item(localize('cc.explain', "Explain My Project"), localize('cc.explain.d', "Understand this codebase"), 'compyle.explain.project', 'book'));
			suggestions.push(item(localize('cc.runDoctor', "Run Doctor"), localize('cc.runDoctor.d', "How to run this project"), 'compyle.runDoctor.open', 'pulse'));
			suggestions.push(item(localize('cc.quality', "Quality Guardian"), localize('cc.quality.d', "Run lint, type, test, build"), 'compyle.qualityGuardian.open', 'shield'));
		}
		if (isCodeFile) {
			suggestions.push(item(localize('cc.askBrainFile', "Ask Compyle Brain"), localize('cc.askBrainFile.d', "Get help with the current code"), 'compyle.brain.ask', 'sparkle'));
		}
		if (suggestions.length) {
			items.push(sep(localize('cc.suggested', "Suggested")));
			items.push(...suggestions);
		}

		// ---- Compyle features ----
		items.push(sep(localize('cc.compyle', "Compyle")));
		items.push(item(localize('cc.home', "Home"), localize('cc.home.d', "Dashboard"), 'compyle.home.open', 'home'));
		items.push(item(localize('cc.appearance', "Appearance Studio"), localize('cc.appearance.d', "Glass & vibrancy"), 'compyle.appearance.openStudio', 'paintcan'));
		items.push(item(localize('cc.themes', "Theme Gallery"), localize('cc.themes.d', "Browse themes"), 'compyle.themes.openGallery', 'symbol-color'));
		items.push(item(localize('cc.transform', "Transform Center"), localize('cc.transform.d', "Convert files, data, code"), 'compyle.transform.open', 'arrow-swap'));
		items.push(item(localize('cc.starter', "Create Project"), localize('cc.starter.d', "Project type, libraries, and tools"), 'compyle.starter.open', 'rocket'));
		items.push(item(localize('cc.localModels', "Local Models"), localize('cc.localModels.d', "Ollama, LM Studio, local endpoint"), 'compyle.brain.openLocalModels', 'server-process'));
		items.push(item(localize('cc.runDoctorAll', "Run Doctor"), localize('cc.runDoctorAll.d', "How to run this project"), 'compyle.runDoctor.open', 'pulse'));
		items.push(item(localize('cc.qualityAll', "Quality Guardian"), localize('cc.qualityAll.d', "Lint, type, test, build"), 'compyle.qualityGuardian.open', 'shield'));
		items.push(item(localize('cc.explainAll', "Explain My Project"), localize('cc.explainAll.d', "Understand this codebase"), 'compyle.explain.project', 'book'));
		items.push(item(localize('cc.ship', "Ship Center"), localize('cc.ship.d', "Build, check, deploy"), 'compyle.ship.open', 'cloud-upload'));
		items.push(item(localize('cc.preview', "Live Preview"), localize('cc.preview.d', "See your app in the editor"), 'compyle.preview.open', 'preview'));
		items.push(item(localize('cc.agent', "Agent Workspace"), localize('cc.agent.d', "AI tasks, diffs, apply, undo"), 'compyle.agent.open', 'robot'));
		items.push(item(localize('cc.ask', "Ask Compyle Brain"), localize('cc.ask.d', "AI assistant"), 'compyle.brain.ask', 'sparkle'));

		// ---- Search handoffs ----
		items.push(sep(localize('cc.go', "Go")));
		items.push(item(localize('cc.commands', "Search Commands…"), localize('cc.commands.d', "Command Palette"), 'workbench.action.showCommands', 'terminal'));
		items.push(item(localize('cc.files', "Go to File…"), localize('cc.files.d', "Quick open"), 'workbench.action.quickOpen', 'go-to-file'));
		items.push(item(localize('cc.settings', "Search Settings…"), localize('cc.settings.d', "Settings"), 'workbench.action.openSettings', 'settings-gear'));

		const picked = await quickInputService.pick(items, {
			placeHolder: localize('cc.placeholder', "Search Compyle, commands, files…"),
			matchOnDescription: true,
		});
		if (picked && 'runId' in picked) {
			await commandService.executeCommand(picked.runId);
		}
	}
});

// ---------------------------------------------------------------------------
// Project Pulse — the always-visible launcher anchor on the status bar.
// One click opens the Command Center, the single doorway to every Compyle tool.
// ---------------------------------------------------------------------------

class CompyleProjectPulseContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleProjectPulse';

	constructor(
		@IStatusbarService statusbarService: IStatusbarService,
	) {
		super();

		const entry: IStatusbarEntry = {
			name: localize('compyle.pulse.name', "Compyle"),
			text: '$(compass) Compyle',
			ariaLabel: localize('compyle.pulse.aria', "Open the Compyle Command Center"),
			tooltip: localize('compyle.pulse.tooltip', "Compyle — everything in one place ({0})", 'Ctrl+Shift+.'),
			command: 'compyle.commandCenter.open',
		};

		const accessor: IStatusbarEntryAccessor = statusbarService.addEntry(
			entry,
			'status.compyle.pulse',
			StatusbarAlignment.LEFT,
			Number.MAX_SAFE_INTEGER, // leftmost — the anchor
		);
		this._register(accessor);
	}
}

registerWorkbenchContribution2(
	CompyleProjectPulseContribution.ID,
	CompyleProjectPulseContribution,
	WorkbenchPhase.AfterRestored,
);
