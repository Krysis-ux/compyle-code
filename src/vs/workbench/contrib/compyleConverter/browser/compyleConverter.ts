/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleConverter.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { basename } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { CompyleConverterInput } from './compyleConverterInput.js';
import { ICompyleConverterService } from './compyleConverterService.js';
import {
	COMPYLE_CATEGORY_LABELS,
	COMPYLE_TOOLS,
	CompyleConverterCategory,
	ICompyleFormat,
	searchFormats,
} from '../common/compyleConverterFormats.js';

const ALL_CATEGORIES: readonly (CompyleConverterCategory | 'all')[] = ['all', 'documents', 'images', 'video', 'audio', 'data', 'ebooks'];

export class CompyleConverterEditor extends EditorPane {

	static readonly ID = 'compyleConverter';

	private _root!: HTMLElement;
	private _gridEl!: HTMLElement;
	private _source: URI | undefined;
	private _query = '';
	private _category: CompyleConverterCategory | 'all' = 'all';

	private readonly _gridDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleConverterService private readonly _converterService: ICompyleConverterService,
		@INotificationService private readonly _notificationService: INotificationService,
	) {
		super(CompyleConverterEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.cc-root.compyle-panel'));
	}

	override async setInput(input: CompyleConverterInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this._source = input.source;
		this._render();
	}

	private _render(): void {
		if (!this._root || !this._source) {
			return;
		}
		clearNode(this._root);

		const source = this._source;
		const sourceExt = (source.path.split('.').pop() ?? '').toLowerCase();

		// Header
		const header = append(this._root, $('.cc-header'));
		append(header, $('h2.cc-title', undefined, localize('compyleConverter.heading', "Convert File")));
		const fileRow = append(header, $('.cc-file'));
		append(fileRow, $('span.cc-file-name', undefined, basename(source)));
		append(fileRow, $('span.cc-file-ext', undefined, sourceExt ? `.${sourceExt}` : localize('compyleConverter.noExt', "no extension")));

		if (this._converterService.hasConvertXEndpoint()) {
			const convertx = append(header, $('button.cc-convertx', undefined, localize('compyleConverter.convertx', "Open ConvertX (1000+ formats)"))) as HTMLButtonElement;
			this._register(addDisposableListener(convertx, 'click', () => this._converterService.openConvertX()));
		}

		// Search
		const searchRow = append(this._root, $('.cc-search'));
		const searchInput = append(searchRow, $('input.cc-search-input')) as HTMLInputElement;
		searchInput.type = 'text';
		searchInput.placeholder = localize('compyleConverter.search', "Search target formats (e.g. mp4, pdf, markdown)...");
		searchInput.value = this._query;
		this._register(addDisposableListener(searchInput, 'input', () => {
			this._query = searchInput.value;
			this._renderGrid();
		}));

		// Category tabs
		const tabs = append(this._root, $('.cc-tabs'));
		for (const cat of ALL_CATEGORIES) {
			const label = cat === 'all' ? localize('compyleConverter.all', "All") : COMPYLE_CATEGORY_LABELS[cat];
			const tab = append(tabs, $('button.cc-tab', undefined, label)) as HTMLButtonElement;
			tab.classList.toggle('active', cat === this._category);
			this._register(addDisposableListener(tab, 'click', () => {
				this._category = cat;
				this._render();
			}));
		}

		this._gridEl = append(this._root, $('.cc-grid'));
		this._renderGrid();
	}

	private _renderGrid(): void {
		if (!this._gridEl || !this._source) {
			return;
		}
		this._gridDisposables.clear();
		clearNode(this._gridEl);

		const source = this._source;
		const sourceExt = (source.path.split('.').pop() ?? '').toLowerCase();
		let formats = searchFormats(this._query);
		if (this._category !== 'all') {
			formats = formats.filter(f => f.category === this._category);
		}
		// Don't offer converting a file to its own format.
		formats = formats.filter(f => f.ext !== sourceExt);

		if (formats.length === 0) {
			append(this._gridEl, $('.cc-empty', undefined, localize('compyleConverter.noFormats', "No matching target formats.")));
			return;
		}

		for (const format of formats) {
			this._renderFormatChip(source, format);
		}
	}

	private _renderFormatChip(source: URI, format: ICompyleFormat): void {
		const chip = append(this._gridEl, $('.cc-chip'));
		append(chip, $('.cc-chip-ext', undefined, `.${format.ext}`));
		append(chip, $('.cc-chip-label', undefined, format.label));
		const tool = COMPYLE_TOOLS[format.tool];
		append(chip, $('.cc-chip-tool', undefined, localize('compyleConverter.requires', "via {0}", tool.name)));
		this._gridDisposables.add(addDisposableListener(chip, 'click', () => this._convert(source, format)));
	}

	private async _convert(source: URI, format: ICompyleFormat): Promise<void> {
		try {
			const result = await this._converterService.convert(source, format);
			const tool = COMPYLE_TOOLS[format.tool];
			this._notificationService.notify({
				severity: Severity.Info,
				message: localize('compyleConverter.running', "Converting to {0} → {1} (via {2}). If the command is not found, install it: {3}", format.label, result.outputPath, tool.name, tool.install),
			});
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
