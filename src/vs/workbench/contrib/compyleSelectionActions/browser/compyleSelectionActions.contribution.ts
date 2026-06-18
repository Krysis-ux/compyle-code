/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';
import { localize } from '../../../../nls.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { EditorAction, registerEditorAction } from '../../../../editor/browser/editorExtensions.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';

const CompyleEditorMenu = new MenuId('CompyleEditorMenu');

MenuRegistry.appendMenuItem(MenuId.EditorContext, {
	submenu: CompyleEditorMenu,
	// allow-any-unicode-next-line
	title: localize('compyle.submenu', "Compyle ✦"),
	group: 'compyle',
	order: 1,
	when: EditorContextKeys.hasNonEmptySelection,
});

function stripFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
	return fenced ? fenced[1] : trimmed;
}

interface IBrainSelectionResult {
	reply: string;
	languageId: string;
}

/**
 * Sends the current selection to Compyle Brain. All accessor.get() calls are made synchronously
 * by the caller before invoking this function so no accessor is taken here.
 */
async function askBrainAboutSelection(
	brainService: ICompyleBrainService,
	notificationService: INotificationService,
	progressService: IProgressService,
	editor: ICodeEditor,
	system: string,
	title: string,
	maxTokens: number,
): Promise<IBrainSelectionResult | undefined> {
	if (!brainService.isConfigured()) {
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.selection.noBrain', "Configure Compyle Brain (an AI provider) to use AI selection actions.") });
		return undefined;
	}
	if (!editor.hasModel()) {
		return undefined;
	}
	const selection = editor.getSelection();
	if (!selection || selection.isEmpty()) {
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.selection.empty', "Select some code first.") });
		return undefined;
	}

	const model = editor.getModel();
	const languageId = model.getLanguageId();
	const code = model.getValueInRange(selection);

	try {
		const reply = await progressService.withProgress(
			{ location: ProgressLocation.Notification, title },
			() => brainService.chat([{ role: 'user', content: `Language: ${languageId}\n\n${code}` }], { system, maxTokens }),
		);
		return { reply, languageId };
	} catch (error) {
		notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		return undefined;
	}
}

async function openScratch(editorService: IEditorService, name: string, contents: string, languageId: string): Promise<void> {
	await editorService.openEditor({
		resource: URI.from({ scheme: Schemas.untitled, path: name }),
		contents,
		languageId,
		options: { pinned: true },
	});
}

function replaceSelection(editor: ICodeEditor, text: string): void {
	const selection = editor.getSelection();
	if (!selection) {
		return;
	}
	editor.pushUndoStop();
	editor.executeEdits('compyleSelectionAction', [{ range: selection, text, forceMoveMarkers: true }]);
	editor.pushUndoStop();
}

// ---------------------------------------------------------------------------
// Existing actions (migrated to submenu)
// ---------------------------------------------------------------------------

class CompyleExplainSelectionAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.explain',
			label: localize('compyle.selection.explain', "Explain Selection"),
			alias: 'Compyle: Explain Selection',
			precondition: EditorContextKeys.editorTextFocus,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const editorService = accessor.get(IEditorService);
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			'Explain the following code clearly and concisely in Markdown. Cover what it does, the key logic, and any gotchas. Do not rewrite the code.',
			localize('compyle.selection.explaining', "Explaining selection…"), 2048);
		if (result) {
			await openScratch(editorService, 'Compyle Explanation.md', result.reply.trim(), 'markdown');
		}
	}
}

class CompyleCommentSelectionAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.comment',
			label: localize('compyle.selection.comment', "Add Comments"),
			alias: 'Compyle: Add Comments to Selection',
			precondition: EditorContextKeys.writable,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			'Add clear, idiomatic comments and docstrings to the following code. Return ONLY the updated code. No explanations, no markdown fences. Preserve all behavior and formatting.',
			localize('compyle.selection.commenting', "Adding comments…"), 4096);
		if (result) {
			replaceSelection(editor, stripFences(result.reply));
		}
	}
}

class CompyleRefactorSelectionAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.refactor',
			label: localize('compyle.selection.refactor', "Refactor"),
			alias: 'Compyle: Refactor Selection',
			precondition: EditorContextKeys.writable,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			'Refactor the following code for clarity and quality WITHOUT changing its behavior. Return ONLY the refactored code. No explanations, no markdown fences. Preserve the surrounding indentation.',
			localize('compyle.selection.refactoring', "Refactoring…"), 4096);
		if (result) {
			replaceSelection(editor, stripFences(result.reply));
		}
	}
}

class CompyleTestsSelectionAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.tests',
			label: localize('compyle.selection.tests', "Write Tests"),
			alias: 'Compyle: Write Tests for Selection',
			precondition: EditorContextKeys.editorTextFocus,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const editorService = accessor.get(IEditorService);
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			'Write thorough unit tests for the following code using the conventional test framework for the language. Return ONLY the test file contents. No explanations, no markdown fences.',
			localize('compyle.selection.testing', "Writing tests…"), 4096);
		if (result) {
			await openScratch(editorService, 'Compyle Tests', stripFences(result.reply), result.languageId);
		}
	}
}

// ---------------------------------------------------------------------------
// New actions
// ---------------------------------------------------------------------------

class CompyleFindBugsAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.findBugs',
			label: localize('compyle.selection.findBugs', "Find Bugs"),
			alias: 'Compyle: Find Bugs in Selection',
			precondition: EditorContextKeys.editorTextFocus,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const editorService = accessor.get(IEditorService);
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			'Analyze the following code for bugs, logic errors, security issues, and bad practices. Return a bullet-point list of specific issues found. If no issues are found, return exactly: "No issues found." Do not include code blocks.',
			localize('compyle.selection.findingBugs', "Finding bugs…"), 2048);
		if (result) {
			await openScratch(editorService, 'Compyle Bug Report.md', result.reply.trim(), 'markdown');
		}
	}
}

class CompyleGenerateDocsAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.generateDocs',
			label: localize('compyle.selection.generateDocs', "Generate Docs"),
			alias: 'Compyle: Generate Docs for Selection',
			precondition: EditorContextKeys.writable,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			'Add JSDoc or docstring documentation to the following code using the idiomatic documentation format for the language. Return ONLY the documented code. No explanations, no markdown fences. Preserve all behavior and formatting.',
			localize('compyle.selection.generatingDocs', "Generating docs…"), 4096);
		if (result) {
			replaceSelection(editor, stripFences(result.reply));
		}
	}
}

class CompyleSimplifyAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.simplify',
			label: localize('compyle.selection.simplify', "Simplify"),
			alias: 'Compyle: Simplify Selection',
			precondition: EditorContextKeys.writable,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			'Simplify the following code to be shorter and more readable without changing its behavior. Return ONLY the simplified code. No explanations, no markdown fences.',
			localize('compyle.selection.simplifying', "Simplifying…"), 4096);
		if (result) {
			replaceSelection(editor, stripFences(result.reply));
		}
	}
}

class CompyleTranslateAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.selection.translate',
			label: localize('compyle.selection.translate', "Translate to…"),
			alias: 'Compyle: Translate Selection to Another Language',
			precondition: EditorContextKeys.editorTextFocus,
		});
	}
	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const editorService = accessor.get(IEditorService);

		const target = await quickInput.input({
			prompt: localize('compyle.selection.translatePrompt', "Translate to which language? (e.g. Python, Rust, Go)"),
			placeHolder: localize('compyle.selection.translatePlaceholder', "Target language"),
		});
		if (!target) {
			return;
		}
		const result = await askBrainAboutSelection(brainService, notificationService, progressService, editor,
			`Translate the following code to ${target}. Match the idioms and conventions of ${target}. Return ONLY the translated code. No explanations, no markdown fences.`,
			localize('compyle.selection.translating', "Translating to {0}…", target), 4096);
		if (result) {
			await openScratch(editorService, `Compyle Translated.${target.toLowerCase()}`, stripFences(result.reply), result.languageId);
		}
	}
}

registerEditorAction(CompyleExplainSelectionAction);
registerEditorAction(CompyleCommentSelectionAction);
registerEditorAction(CompyleRefactorSelectionAction);
registerEditorAction(CompyleTestsSelectionAction);
registerEditorAction(CompyleFindBugsAction);
registerEditorAction(CompyleGenerateDocsAction);
registerEditorAction(CompyleSimplifyAction);
registerEditorAction(CompyleTranslateAction);

MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.explain', title: localize('compyle.submenu.explain', "Explain Selection") },
	group: '1_read',
	order: 1,
});
MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.findBugs', title: localize('compyle.submenu.findBugs', "Find Bugs") },
	group: '1_read',
	order: 2,
});
MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.comment', title: localize('compyle.submenu.comment', "Add Comments") },
	group: '2_modify',
	order: 1,
});
MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.refactor', title: localize('compyle.submenu.refactor', "Refactor") },
	group: '2_modify',
	order: 2,
});
MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.generateDocs', title: localize('compyle.submenu.generateDocs', "Generate Docs") },
	group: '2_modify',
	order: 3,
});
MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.simplify', title: localize('compyle.submenu.simplify', "Simplify") },
	group: '2_modify',
	order: 4,
});
MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.tests', title: localize('compyle.submenu.tests', "Write Tests") },
	group: '3_generate',
	order: 1,
});
MenuRegistry.appendMenuItem(CompyleEditorMenu, {
	command: { id: 'compyle.selection.translate', title: localize('compyle.submenu.translate', "Translate to…") },
	group: '3_generate',
	order: 2,
});
