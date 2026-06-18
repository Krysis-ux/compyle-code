/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleTransform.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { COMPYLE_TRANSFORMERS, getTransformer, ITransformer, runTransform, TransformCategory } from '../common/compyleTransforms.js';
import { CompyleTransformInput } from './compyleTransformInput.js';

const CATEGORY_LABELS: Record<TransformCategory, string> = {
	data: localize("compyleTransform.category.data", "Data"),
	docs: localize("compyleTransform.category.docs", "Docs"),
	code: localize("compyleTransform.category.code", "Code (AI)"),
};

export class CompyleTransformEditor extends EditorPane {

	static readonly ID = 'compyleTransform';

	private _select!: HTMLSelectElement;
	private _inputArea!: HTMLTextAreaElement;
	private _output!: HTMLTextAreaElement;
	private _warnings!: HTMLElement;
	private _convertButton!: HTMLButtonElement;
	private _note!: HTMLElement;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICodeEditorService private readonly _codeEditorService: ICodeEditorService,
		@IEditorService private readonly _editorService: IEditorService,
		@IClipboardService private readonly _clipboardService: IClipboardService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IProgressService private readonly _progressService: IProgressService,
	) {
		super(CompyleTransformEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.ctc-root'));

		const header = append(root, $('.ctc-header'));
		append(header, $('h2.ctc-title', undefined, localize("compyleTransform.heading", "Transform Center")));
		append(header, $('.ctc-subtitle', undefined, localize("compyleTransform.subheading", "Convert and migrate files, data, and code.")));

		// Toolbar
		const toolbar = append(root, $('.ctc-toolbar'));
		this._select = append(toolbar, $('select.ctc-select')) as HTMLSelectElement;
		this._populateSelect();
		this._register(addDisposableListener(this._select, 'change', () => this._onSelectChanged()));

		const loadButton = append(toolbar, $('button.ctc-tool', undefined, localize("compyleTransform.loadFile", "Load Current File"))) as HTMLButtonElement;
		this._register(addDisposableListener(loadButton, 'click', () => this._loadCurrentFile()));

		this._convertButton = append(toolbar, $('button.ctc-tool.primary', undefined, localize("compyleTransform.convert", "Convert"))) as HTMLButtonElement;
		this._register(addDisposableListener(this._convertButton, 'click', () => { void this._convert(); }));

		// Panes
		const panes = append(root, $('.ctc-panes'));
		const inputPane = append(panes, $('.ctc-pane'));
		append(inputPane, $('.ctc-pane-label', undefined, localize("compyleTransform.input", "Input")));
		this._inputArea = append(inputPane, $('textarea.ctc-area')) as HTMLTextAreaElement;
		this._inputArea.placeholder = localize("compyleTransform.inputPlaceholder", "Paste your content here, or use Load Current File…");
		this._inputArea.spellcheck = false;

		const outputPane = append(panes, $('.ctc-pane'));
		const outputHeader = append(outputPane, $('.ctc-pane-header'));
		append(outputHeader, $('.ctc-pane-label', undefined, localize("compyleTransform.output", "Output")));
		const outputActions = append(outputHeader, $('.ctc-out-actions'));
		const copyButton = append(outputActions, $('button.ctc-mini', undefined, localize("compyleTransform.copy", "Copy"))) as HTMLButtonElement;
		this._register(addDisposableListener(copyButton, 'click', () => this._clipboardService.writeText(this._output.value)));
		const openButton = append(outputActions, $('button.ctc-mini', undefined, localize("compyleTransform.openInEditor", "Open in Editor"))) as HTMLButtonElement;
		this._register(addDisposableListener(openButton, 'click', () => this._openInEditor()));
		this._output = append(outputPane, $('textarea.ctc-area')) as HTMLTextAreaElement;
		this._output.readOnly = true;
		this._output.spellcheck = false;

		this._note = append(root, $('.ctc-note'));
		this._warnings = append(root, $('.ctc-warnings'));

		this._onSelectChanged();
	}

	private _populateSelect(): void {
		const categories: TransformCategory[] = ['data', 'docs', 'code'];
		for (const category of categories) {
			const group = append(this._select, $('optgroup')) as HTMLOptGroupElement;
			group.label = CATEGORY_LABELS[category];
			for (const transformer of COMPYLE_TRANSFORMERS.filter(t => t.category === category)) {
				const option = append(group, $('option')) as HTMLOptionElement;
				option.value = transformer.id;
				option.textContent = transformer.needsAI ? `${transformer.label} (AI)` : transformer.label;
			}
		}
	}

	private _current(): ITransformer | undefined {
		return getTransformer(this._select.value);
	}

	private _onSelectChanged(): void {
		const transformer = this._current();
		if (!transformer) {
			return;
		}
		if (transformer.needsAI) {
			const ready = this._brainService.isConfigured();
			this._convertButton.disabled = !ready;
			this._note.textContent = ready
				? localize("compyleTransform.aiReady", "{0}: powered by Compyle Brain. Review the output before using it.", transformer.description)
				: localize("compyleTransform.needsAI", "{0}: needs Compyle Brain (AI). Configure a provider in Settings or open Local Models.", transformer.description);
			this._note.classList.toggle('needs-ai', !ready);
		} else {
			this._convertButton.disabled = false;
			this._note.textContent = transformer.description;
			this._note.classList.remove('needs-ai');
		}
	}

	private async _convert(): Promise<void> {
		const transformer = this._current();
		if (!transformer) {
			return;
		}
		if (transformer.needsAI) {
			await this._convertWithAI(transformer);
			return;
		}
		const result = runTransform(transformer.id, this._inputArea.value);
		this._output.value = result.output;
		this._renderWarnings(result.warnings);
	}

	private async _convertWithAI(transformer: ITransformer): Promise<void> {
		if (!this._brainService.isConfigured()) {
			return;
		}
		const input = this._inputArea.value.trim();
		if (!input) {
			this._renderWarnings([localize("compyleTransform.noInput", "Paste some input to convert first.")]);
			return;
		}

		const system = 'You are a precise code and data conversion engine. Output ONLY the converted result. Do not add explanations, comments, or Markdown code fences.';
		const prompt = `Conversion: ${transformer.label}.\n\nConvert the following input:\n\n${input}`;

		this._convertButton.disabled = true;
		this._output.value = localize("compyleTransform.converting", "Converting…");
		try {
			const answer = await this._progressService.withProgress(
				{ location: ProgressLocation.Notification, title: localize("compyleTransform.aiProgress", "Compyle Brain is converting…") },
				() => this._brainService.chat([{ role: 'user', content: prompt }], { system, maxTokens: 4096 }),
			);
			this._output.value = this._stripFences(answer);
			this._renderWarnings([localize("compyleTransform.aiWarning", "AI conversion — review carefully, it may need manual fixes.")]);
		} catch (error) {
			this._output.value = '';
			this._renderWarnings([error instanceof Error ? error.message : String(error)]);
		} finally {
			this._convertButton.disabled = false;
		}
	}

	private _stripFences(text: string): string {
		const trimmed = text.trim();
		const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
		return fenced ? fenced[1] : trimmed;
	}

	private _renderWarnings(warnings: string[]): void {
		clearNode(this._warnings);
		for (const warning of warnings) {
			const row = append(this._warnings, $('.ctc-warning'));
			append(row, $('span.codicon.codicon-info.ctc-warning-icon'));
			append(row, $('span', undefined, warning));
		}
	}

	private _loadCurrentFile(): void {
		const editor = this._codeEditorService.getActiveCodeEditor() ?? this._codeEditorService.listCodeEditors().find(e => e.hasModel());
		const model = editor?.getModel();
		if (model) {
			this._inputArea.value = model.getValue();
		} else {
			this._renderWarnings([localize("compyleTransform.noActiveFile", "Open a file in the editor first, then use Load Current File.")]);
		}
	}

	private async _openInEditor(): Promise<void> {
		const transformer = this._current();
		if (!this._output.value) {
			return;
		}
		await this._editorService.openEditor({
			resource: undefined,
			contents: this._output.value,
			languageId: transformer?.outputLanguage,
		});
	}

	override async setInput(input: CompyleTransformInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
