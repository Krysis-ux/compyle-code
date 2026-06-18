/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleStarter.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { COMPYLE_TEMPLATES, getAddOn, getAddOnsForTemplate, IProjectAddOn, IProjectTemplate, ProjectKind } from '../common/compyleTemplates.js';
import { CompyleStarterInput } from './compyleStarterInput.js';
import { ICompyleStarterService } from './compyleStarterService.js';

const KIND_LABELS: Record<ProjectKind, string> = {
	website: localize("compyleStarter.kind.website", "Website"),
	webapp: localize("compyleStarter.kind.webapp", "Web App"),
	desktop: localize("compyleStarter.kind.desktop", "Desktop App"),
	api: localize("compyleStarter.kind.api", "API / Backend"),
	cli: localize("compyleStarter.kind.cli", "CLI Tool"),
	bot: localize("compyleStarter.kind.bot", "Bot / Automation"),
};

const KINDS: readonly ProjectKind[] = ['website', 'webapp', 'desktop', 'api', 'cli', 'bot'];

export class CompyleStarterEditor extends EditorPane {

	static readonly ID = 'compyleStarter';

	private _grid!: HTMLElement;
	private _inspector!: HTMLElement;
	private _searchInput!: HTMLInputElement;

	private readonly _cardDisposables = this._register(new DisposableStore());
	private readonly _inspectorDisposables = this._register(new DisposableStore());
	private _kind: ProjectKind = 'webapp';
	private _search = '';
	private _selectedTemplateId: string | undefined;
	private readonly _selectedAddOns = new Set<string>();

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICommandService private readonly _commandService: ICommandService,
		@ICompyleStarterService private readonly _starterService: ICompyleStarterService,
	) {
		super(CompyleStarterEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.cst-root'));

		const header = append(root, $('.cst-header'));
		const titleBox = append(header, $('.cst-title-box'));
		append(titleBox, $('h2.cst-title', undefined, localize("compyleStarter.heading", "Create Project")));
		append(titleBox, $('.cst-subtitle', undefined, localize("compyleStarter.subheading", "Choose what you are building, add the right tools, then scaffold a runnable project.")));

		const headerActions = append(header, $('.cst-header-actions'));
		const localModelsButton = append(headerActions, $('button.cst-secondary', undefined, localize("compyleStarter.localModels", "Local Models"))) as HTMLButtonElement;
		this._register(addDisposableListener(localModelsButton, 'click', () => this._commandService.executeCommand('compyle.brain.openLocalModels')));
		this._searchInput = append(headerActions, $('input.cst-search')) as HTMLInputElement;
		this._searchInput.type = 'text';
		this._searchInput.placeholder = localize("compyleStarter.search", "Search templates...");
		this._register(addDisposableListener(this._searchInput, 'input', () => {
			this._search = this._searchInput.value.trim().toLowerCase();
			this._render();
		}));

		const tabs = append(root, $('.cst-tabs'));
		for (const kind of KINDS) {
			const tab = append(tabs, $('.cst-tab', { 'data-kind': kind }, KIND_LABELS[kind]));
			if (kind === this._kind) {
				tab.classList.add('active');
			}
			this._register(addDisposableListener(tab, 'click', () => {
				this._kind = kind;
				this._selectedTemplateId = undefined;
				for (const t of tabs.children) {
					t.classList.toggle('active', t.getAttribute('data-kind') === kind);
				}
				this._render();
			}));
		}

		const body = append(root, $('.cst-builder'));
		this._grid = append(body, $('.cst-grid'));
		this._inspector = append(body, $('.cst-inspector'));
		this._render();
	}

	private _visible(): IProjectTemplate[] {
		return COMPYLE_TEMPLATES.filter(template => {
			if (template.kind !== this._kind) {
				return false;
			}
			if (this._search) {
				const haystack = `${template.name} ${template.description} ${template.stack.join(' ')} ${template.tags.join(' ')}`.toLowerCase();
				if (!haystack.includes(this._search)) {
					return false;
				}
			}
			return true;
		});
	}

	private _render(): void {
		if (!this._grid || !this._inspector) {
			return;
		}
		this._cardDisposables.clear();
		clearNode(this._grid);

		const templates = this._visible();
		if (!this._selectedTemplateId || !templates.some(template => template.id === this._selectedTemplateId)) {
			const first = templates[0];
			if (first) {
				this._selectTemplate(first, false);
			}
		}

		if (templates.length === 0) {
			append(this._grid, $('.cst-empty', undefined, localize("compyleStarter.noMatch", "No templates match your search.")));
			this._renderInspector(undefined);
			return;
		}
		for (const template of templates) {
			this._renderCard(template);
		}
		this._renderInspector(templates.find(template => template.id === this._selectedTemplateId));
	}

	private _selectTemplate(template: IProjectTemplate, rerender: boolean): void {
		this._selectedTemplateId = template.id;
		this._selectedAddOns.clear();
		for (const addOnId of template.recommendedAddOns) {
			this._selectedAddOns.add(addOnId);
		}
		if (rerender) {
			this._render();
		}
	}

	private _renderCard(template: IProjectTemplate): void {
		const card = append(this._grid, $('.cst-card'));
		card.style.setProperty('--tpl-accent', template.accent);
		card.classList.toggle('selected', template.id === this._selectedTemplateId);

		append(card, $('.cst-accent'));
		const body = append(card, $('.cst-card-body'));
		const titleRow = append(body, $('.cst-card-title-row'));
		append(titleRow, $('.cst-card-name', undefined, template.name));
		append(titleRow, $(`.cst-diff.diff-${template.difficulty}`, undefined, template.difficulty));
		append(body, $('.cst-card-desc', undefined, template.description));
		append(body, $('.cst-launch', undefined, template.launchProfile));

		const stack = append(body, $('.cst-stack'));
		for (const tech of template.stack) {
			append(stack, $('.cst-chip', undefined, tech));
		}

		this._cardDisposables.add(addDisposableListener(card, 'click', () => this._selectTemplate(template, true)));
	}

	private _renderInspector(template: IProjectTemplate | undefined): void {
		this._inspectorDisposables.clear();
		clearNode(this._inspector);

		append(this._inspector, $('h3.cst-inspector-title', undefined, localize("compyleStarter.inspector", "Project Setup")));
		if (!template) {
			append(this._inspector, $('.cst-empty', undefined, localize("compyleStarter.pickKind", "Pick a project type to see templates.")));
			return;
		}

		append(this._inspector, $('.cst-selected-name', undefined, template.name));
		append(this._inspector, $('.cst-selected-desc', undefined, template.runInstructions));

		append(this._inspector, $('.cst-inspector-label', undefined, localize("compyleStarter.addOns", "Recommended Tools")));
		for (const addOn of getAddOnsForTemplate(template)) {
			this._renderAddOn(addOn, template.recommendedAddOns.includes(addOn.id));
		}

		const createButton = append(this._inspector, $('button.cst-create', undefined, localize("compyleStarter.create", "Create Project"))) as HTMLButtonElement;
		this._inspectorDisposables.add(addDisposableListener(createButton, 'click', () => this._create(template)));
		append(this._inspector, $('.cst-note', undefined, localize("compyleStarter.installNote", "Compyle writes selected config and example files only. It does not run install commands.")));
	}

	private _renderAddOn(addOn: IProjectAddOn, recommended: boolean): void {
		const label = append(this._inspector, $('label.cst-addon')) as HTMLLabelElement;
		const checkbox = append(label, $('input')) as HTMLInputElement;
		checkbox.type = 'checkbox';
		checkbox.checked = this._selectedAddOns.has(addOn.id);
		const body = append(label, $('.cst-addon-body'));
		const title = recommended
			? localize("compyleStarter.addOnRecommended", "{0} (Recommended)", addOn.name)
			: addOn.name;
		append(body, $('.cst-addon-name', undefined, title));
		append(body, $('.cst-addon-desc', undefined, addOn.description));
		this._inspectorDisposables.add(addDisposableListener(checkbox, 'change', () => {
			if (checkbox.checked) {
				this._selectedAddOns.add(addOn.id);
			} else {
				this._selectedAddOns.delete(addOn.id);
			}
		}));
	}

	private async _create(template: IProjectTemplate): Promise<void> {
		const addOns = Array.from(this._selectedAddOns, id => getAddOn(id)).filter((addOn): addOn is IProjectAddOn => !!addOn);
		await this._starterService.createProject(template, addOns);
	}

	override async setInput(input: CompyleStarterInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
