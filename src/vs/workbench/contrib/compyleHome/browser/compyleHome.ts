/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleHome.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { isRecentFolder, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { CompyleHomeInput } from './compyleHomeInput.js';

interface IToolEntry {
	readonly command: string;
	readonly label: string;
	readonly description: string;
	readonly icon: string;
}

const TOOLS: IToolEntry[] = [
	{ command: 'compyle.starter.open', label: localize("compyleHome.tool.starter", "Create Project"), description: localize("compyleHome.tool.starter.desc", "Pick an app type, tools, and scaffold a runnable project."), icon: 'rocket' },
	{ command: 'compyle.appearance.openStudio', label: localize("compyleHome.tool.appearance", "Appearance Studio"), description: localize("compyleHome.tool.appearance.desc", "Change the whole interface personality."), icon: 'paintcan' },
	{ command: 'compyle.brain.openLocalModels', label: localize("compyleHome.tool.localModels", "Local Models"), description: localize("compyleHome.tool.localModels.desc", "Configure Ollama, LM Studio, or a local endpoint."), icon: 'server-process' },
	{ command: 'compyle.themes.openGallery', label: localize("compyleHome.tool.themes", "Theme Gallery"), description: localize("compyleHome.tool.themes.desc", "Browse themes with live previews."), icon: 'symbol-color' },
	{ command: 'compyle.runDoctor.open', label: localize("compyleHome.tool.runDoctor", "Run Doctor"), description: localize("compyleHome.tool.runDoctor.desc", "Figure out how to run any project."), icon: 'pulse' },
	{ command: 'compyle.transform.open', label: localize("compyleHome.tool.transform", "Transform Center"), description: localize("compyleHome.tool.transform.desc", "Convert files, data, and code."), icon: 'arrow-swap' },
	{ command: 'compyle.qualityGuardian.open', label: localize("compyleHome.tool.quality", "Quality Guardian"), description: localize("compyleHome.tool.quality.desc", "Lint, type-check, test, and build."), icon: 'shield' },
	{ command: 'compyle.explain.project', label: localize("compyleHome.tool.explain", "Explain My Project"), description: localize("compyleHome.tool.explain.desc", "Understand any codebase fast."), icon: 'book' },
	{ command: 'compyle.ship.open', label: localize("compyleHome.tool.ship", "Ship Center"), description: localize("compyleHome.tool.ship.desc", "Build, check, and deploy."), icon: 'cloud-upload' },
	{ command: 'compyle.preview.open', label: localize("compyleHome.tool.preview", "Live Preview"), description: localize("compyleHome.tool.preview.desc", "See your app in the editor."), icon: 'preview' },
	{ command: 'compyle.agent.open', label: localize("compyleHome.tool.agent", "Agent Workspace"), description: localize("compyleHome.tool.agent.desc", "Reviewable AI tasks, diffs, apply, reject, and undo."), icon: 'robot' },
	{ command: 'compyle.skillStudio.open', label: localize("compyleHome.tool.skills", "Skill Studio"), description: localize("compyleHome.tool.skills.desc", "Create reusable instruction sets for Compyle Brain."), icon: 'lightbulb' },
	{ command: 'compyle.router.openConfig', label: localize("compyleHome.tool.router", "Compyle Router"), description: localize("compyleHome.tool.router.desc", "Route AI requests and screen output for risky content."), icon: 'git-merge' },
];

export class CompyleHomeEditor extends EditorPane {

	static readonly ID = 'compyleHome';

	private _recentList!: HTMLElement;

	private readonly _recentDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICommandService private readonly _commandService: ICommandService,
		@IWorkspacesService private readonly _workspacesService: IWorkspacesService,
		@IHostService private readonly _hostService: IHostService,
		@ILabelService private readonly _labelService: ILabelService,
		@IProductService private readonly _productService: IProductService,
	) {
		super(CompyleHomeEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.chd-root'));

		// Hero
		const hero = append(root, $('.chd-hero'));
		append(hero, $('.chd-logo.codicon.codicon-rocket'));
		append(hero, $('h1.chd-app-name', undefined, this._productService.nameLong || 'Compyle Code'));
		append(hero, $('.chd-tagline', undefined, localize("compyleHome.tagline", "Turn messy ideas into finished, tested, shipped projects.")));

		const heroActions = append(hero, $('.chd-hero-actions'));
		this._addHeroAction(heroActions, localize("compyleHome.newProject", "Create Project"), true, () => this._commandService.executeCommand('compyle.starter.open'));
		this._addHeroAction(heroActions, localize("compyleHome.openFolder", "Open Folder"), false, () => this._openFolder());
		this._addHeroAction(heroActions, localize("compyleHome.clone", "Clone Repository"), false, () => this._commandService.executeCommand('git.clone'));

		// Body columns
		const columns = append(root, $('.chd-columns'));

		const toolsCol = append(columns, $('.chd-col'));
		append(toolsCol, $('h2.chd-section-title', undefined, localize("compyleHome.tools", "Tools")));
		const toolsGrid = append(toolsCol, $('.chd-tools'));
		for (const tool of TOOLS) {
			this._renderTool(toolsGrid, tool);
		}

		const recentCol = append(columns, $('.chd-col.chd-recent-col'));
		append(recentCol, $('h2.chd-section-title', undefined, localize("compyleHome.recent", "Recent Projects")));
		this._recentList = append(recentCol, $('.chd-recent'));
	}

	private _addHeroAction(parent: HTMLElement, label: string, primary: boolean, run: () => void): void {
		const button = append(parent, $(`button.chd-hero-btn${primary ? '.primary' : ''}`, undefined, label)) as HTMLButtonElement;
		this._register(addDisposableListener(button, 'click', run));
	}

	private _renderTool(parent: HTMLElement, tool: IToolEntry): void {
		const card = append(parent, $('.chd-tool'));
		append(card, $(`.chd-tool-icon.codicon.codicon-${tool.icon}`));
		const info = append(card, $('.chd-tool-info'));
		append(info, $('.chd-tool-label', undefined, tool.label));
		append(info, $('.chd-tool-desc', undefined, tool.description));
		this._register(addDisposableListener(card, 'click', () => this._commandService.executeCommand(tool.command)));
	}

	private async _openFolder(): Promise<void> {
		try {
			await this._commandService.executeCommand('workbench.action.files.openFolder');
		} catch {
			await this._commandService.executeCommand('workbench.action.files.openFileFolder');
		}
	}

	override async setInput(input: CompyleHomeInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		await this._renderRecent();
	}

	private async _renderRecent(): Promise<void> {
		this._recentDisposables.clear();
		clearNode(this._recentList);

		const recents = await this._workspacesService.getRecentlyOpened();
		const folders = recents.workspaces.filter(isRecentFolder).slice(0, 8);

		if (folders.length === 0) {
			append(this._recentList, $('.chd-recent-empty', undefined, localize("compyleHome.noRecent", "No recent projects yet. Create one to get started.")));
			return;
		}

		for (const folder of folders) {
			const row = append(this._recentList, $('.chd-recent-row'));
			append(row, $('span.chd-recent-icon.codicon.codicon-folder'));
			const info = append(row, $('.chd-recent-info'));
			append(info, $('.chd-recent-name', undefined, folder.label || basename(folder.folderUri)));
			append(info, $('.chd-recent-path', undefined, this._labelService.getUriLabel(folder.folderUri)));
			this._recentDisposables.add(addDisposableListener(row, 'click', () => this._hostService.openWindow([{ folderUri: folder.folderUri }], { forceNewWindow: false })));
		}
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
