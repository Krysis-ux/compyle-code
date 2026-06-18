/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleInlineEdit.css';
import { $, append, clearNode, addDisposableListener } from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize } from '../../../../nls.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ICodeEditor, IContentWidget, IContentWidgetPosition, ContentWidgetPositionPreference } from '../../../../editor/browser/editorBrowser.js';
import { EditorAction, registerEditorAction, registerEditorContribution, EditorContributionInstantiation } from '../../../../editor/browser/editorExtensions.js';
import { IEditorContribution, IEditorDecorationsCollection } from '../../../../editor/common/editorCommon.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { Range } from '../../../../editor/common/core/range.js';
import { Selection } from '../../../../editor/common/core/selection.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

const INLINE_EDIT_SYSTEM = [
	'You are Compyle\'s inline code editor.',
	'You rewrite a snippet of the user\'s code according to their instruction.',
	'Rules:',
	'- Return ONLY the replacement code for the snippet.',
	'- No explanations, no commentary, no markdown code fences.',
	'- Preserve the surrounding indentation and code style.',
	'- If asked to add code, return the original snippet plus the addition.',
].join('\n');

function buildUserPrompt(instruction: string, languageId: string, code: string): string {
	return [
		`Language: ${languageId}`,
		`Instruction: ${instruction}`,
		'',
		'Code to rewrite:',
		code,
	].join('\n');
}

function stripFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
	return fenced ? fenced[1] : trimmed;
}

/** Range that a replacement starting at `start` spans, given the inserted text. */
function rangeOfInsertedText(start: { lineNumber: number; column: number }, text: string): Range {
	const lines = text.split('\n');
	const endLineNumber = start.lineNumber + lines.length - 1;
	const endColumn = lines.length === 1 ? start.column + lines[0].length : lines[lines.length - 1].length + 1;
	return new Range(start.lineNumber, start.column, endLineNumber, endColumn);
}

/**
 * A small floating widget anchored at the selection. Has two modes: a prompt input,
 * and a review bar (Accept / Reject) shown after the AI edit is applied.
 */
class InlineEditWidget implements IContentWidget {

	readonly allowEditorOverflow = true;
	readonly suppressMouseDown = false;

	private readonly _domNode: HTMLElement;
	private readonly _body: HTMLElement;
	private readonly _hint: HTMLElement;
	private readonly _error: HTMLElement;
	private _input: HTMLTextAreaElement | undefined;
	private _send: HTMLButtonElement | undefined;
	private readonly _disposables = new DisposableStore();

	constructor(
		private readonly _editor: ICodeEditor,
		onSubmit: (instruction: string) => void,
		private readonly _onCancel: () => void,
	) {
		this._domNode = $('.compyle-inline-edit');
		this._body = append(this._domNode, $('.cie-row'));

		this._input = append(this._body, $('textarea.cie-input')) as HTMLTextAreaElement;
		this._input.placeholder = localize('compyle.inlineEdit.placeholder', "Describe the change… (Enter to run, Esc to cancel)");
		this._input.rows = 1;
		this._input.spellcheck = false;

		this._send = append(this._body, $('button.cie-send', undefined, localize('compyle.inlineEdit.run', "Edit"))) as HTMLButtonElement;

		this._hint = append(this._domNode, $('.cie-hint'));
		append(this._hint, $('span', undefined, localize('compyle.inlineEdit.hint', "Compyle Brain")));
		this._error = append(this._hint, $('span.cie-error'));

		const submit = () => {
			const value = this._input?.value.trim();
			if (value) {
				onSubmit(value);
			}
		};

		this._disposables.add(addDisposableListener(this._send, 'click', submit));
		this._disposables.add(addDisposableListener(this._input, 'keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				submit();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				this._onCancel();
			}
		}));
		this._disposables.add(addDisposableListener(this._input, 'input', () => this._autoSize()));
	}

	private _autoSize(): void {
		if (!this._input) {
			return;
		}
		this._input.style.height = 'auto';
		this._input.style.height = `${Math.min(this._input.scrollHeight, 160)}px`;
	}

	getId(): string {
		return 'compyle.inlineEdit.widget';
	}

	getDomNode(): HTMLElement {
		return this._domNode;
	}

	getPosition(): IContentWidgetPosition | null {
		const selection = this._editor.getSelection();
		const position = selection ? selection.getStartPosition() : this._editor.getPosition();
		return position ? { position, preference: [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW] } : null;
	}

	show(): void {
		this._editor.addContentWidget(this);
		setTimeout(() => this._input?.focus(), 0);
	}

	setBusy(busy: boolean): void {
		this._domNode.classList.toggle('busy', busy);
		if (this._send) {
			this._send.disabled = busy;
			this._send.textContent = busy ? localize('compyle.inlineEdit.running', "Editing…") : localize('compyle.inlineEdit.run', "Edit");
		}
		if (this._input) {
			this._input.readOnly = busy;
		}
	}

	showError(message: string): void {
		this._error.textContent = message;
	}

	/** Switch to the review bar after an edit has been applied. */
	enterReviewMode(onAccept: () => void, onReject: () => void): void {
		this._input = undefined;
		this._send = undefined;
		clearNode(this._body);
		this._domNode.classList.remove('busy');

		append(this._body, $('.cie-review-label', undefined, localize('compyle.inlineEdit.review', "AI edit applied")));
		const reject = append(this._body, $('button.cie-send.cie-reject', undefined, localize('compyle.inlineEdit.reject', "Reject"))) as HTMLButtonElement;
		const accept = append(this._body, $('button.cie-send', undefined, localize('compyle.inlineEdit.accept', "Accept"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(reject, 'click', onReject));
		this._disposables.add(addDisposableListener(accept, 'click', onAccept));
		this._hint.firstChild!.textContent = localize('compyle.inlineEdit.reviewHint', "Accept to keep, Reject to revert");
		setTimeout(() => accept.focus(), 0);
	}

	dispose(): void {
		this._editor.removeContentWidget(this);
		this._disposables.dispose();
	}
}

export class CompyleInlineEditController extends Disposable implements IEditorContribution {

	static readonly ID = 'editor.contrib.compyleInlineEdit';

	static get(editor: ICodeEditor): CompyleInlineEditController | null {
		return editor.getContribution<CompyleInlineEditController>(CompyleInlineEditController.ID);
	}

	private _widget: InlineEditWidget | undefined;
	private _decorations: IEditorDecorationsCollection | undefined;

	constructor(
		private readonly _editor: ICodeEditor,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super();
	}

	show(): void {
		if (this._configurationService.getValue<string>('compyle.modes.activeMode') === 'focus') {
			return;
		}
		if (!this._editor.hasModel()) {
			return;
		}
		this._closeWidget();
		const widget = this._widget = new InlineEditWidget(
			this._editor,
			instruction => this._run(instruction),
			() => this._closeWidget(),
		);
		widget.show();
	}

	private async _run(instruction: string): Promise<void> {
		if (!this._editor.hasModel() || !this._widget) {
			return;
		}
		if (!this._brainService.isConfigured()) {
			this._widget.showError(localize('compyle.inlineEdit.noBrain', "Configure Compyle Brain first."));
			return;
		}

		const model = this._editor.getModel();
		let selection = this._editor.getSelection();
		if (!selection) {
			return;
		}
		if (selection.isEmpty()) {
			const line = selection.startLineNumber;
			selection = new Selection(line, 1, line, model.getLineMaxColumn(line));
		}

		const originalText = model.getValueInRange(selection);
		const languageId = model.getLanguageId();
		const start = selection.getStartPosition();

		this._widget.setBusy(true);
		try {
			const reply = await this._brainService.chat(
				[{ role: 'user', content: buildUserPrompt(instruction, languageId, originalText) }],
				{ system: INLINE_EDIT_SYSTEM, maxTokens: 4096 },
			);
			const result = stripFences(reply);

			this._editor.pushUndoStop();
			this._editor.executeEdits('compyleInlineEdit', [{ range: selection, text: result, forceMoveMarkers: true }]);
			this._editor.pushUndoStop();

			// Highlight the freshly written range and offer Accept / Reject.
			const proposedRange = rangeOfInsertedText(start, result);
			this._decorations = this._editor.createDecorationsCollection([{
				range: proposedRange,
				options: { description: 'compyle-inline-edit-pending', className: 'compyle-inline-edit-pending', isWholeLine: false },
			}]);

			this._widget?.enterReviewMode(
				() => this._closeWidget(),
				() => {
					this._editor.pushUndoStop();
					this._editor.executeEdits('compyleInlineEdit.revert', [{ range: proposedRange, text: originalText, forceMoveMarkers: true }]);
					this._editor.pushUndoStop();
					this._closeWidget();
				},
			);
		} catch (error) {
			this._widget?.setBusy(false);
			this._widget?.showError(error instanceof Error ? error.message : String(error));
		}
	}

	private _closeWidget(): void {
		this._decorations?.clear();
		this._decorations = undefined;
		this._widget?.dispose();
		this._widget = undefined;
		this._editor.focus();
	}

	override dispose(): void {
		this._closeWidget();
		super.dispose();
	}
}

class CompyleInlineEditAction extends EditorAction {
	constructor() {
		super({
			id: 'compyle.inlineEdit.start',
			label: localize('compyle.inlineEdit.start', "Compyle: Inline AI Edit"),
			alias: 'Compyle: Inline AI Edit',
			precondition: EditorContextKeys.writable,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.CtrlCmd | KeyCode.KeyI,
				weight: KeybindingWeight.EditorContrib,
			},
			contextMenuOpts: {
				group: '1_modification',
				order: 1.5,
			},
		});
	}

	run(_accessor: ServicesAccessor, editor: ICodeEditor): void {
		CompyleInlineEditController.get(editor)?.show();
	}
}

registerEditorContribution(CompyleInlineEditController.ID, CompyleInlineEditController, EditorContributionInstantiation.Lazy);
registerEditorAction(CompyleInlineEditAction);
