/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleLocalModels.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { timeout } from '../../../../base/common/async.js';
import { basename, dirname, joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ITerminalService, ITerminalGroupService } from '../../terminal/browser/terminal.js';
import { CompyleBrainProvider, ILocalModelInfo, OLLAMA_CATALOG } from '../common/compyleBrain.js';
import { buildHfModelUrl, buildHfSearchUrl, buildOllamaHfPull, IHfModel, parseGgufQuants, parseHfModels } from '../common/compyleModelSearch.js';
import { ICompyleBrainService } from './compyleBrainService.js';
import { CompyleLocalModelsInput } from './compyleLocalModelsInput.js';
import { ICompyleRouterService } from '../../compyleRouter/browser/compyleRouterService.js';
import { COMPYLE_ROUTER_CUSTOM_PATH_SETTING, COMPYLE_ROUTER_MODE_SETTING, parseRouterConfigText, serializeRouterRulesJsonl } from '../../compyleRouter/common/compyleRouter.js';

type CatalogSizeFilter = 'all' | 'small' | 'medium' | 'large';

interface ILocalProviderCard {
	readonly provider: CompyleBrainProvider;
	readonly title: string;
	readonly endpoint: string;
	/** Whether this provider supports model download/delete (Ollama only). */
	readonly manageable: boolean;
}

type LocalProviderStatus = 'not-tested' | 'testing' | 'connected' | 'not-running' | 'misconfigured';

interface ILocalProviderStatus {
	readonly state: LocalProviderStatus;
	readonly message: string;
}

const LOCAL_PROVIDERS: readonly ILocalProviderCard[] = [
	{ provider: CompyleBrainProvider.Ollama, title: 'Ollama', endpoint: 'http://localhost:11434/v1', manageable: true },
	{ provider: CompyleBrainProvider.LMStudio, title: 'LM Studio', endpoint: 'http://localhost:1234/v1', manageable: false },
	{ provider: CompyleBrainProvider.Local, title: 'Custom Endpoint', endpoint: 'http://localhost:8000/v1', manageable: false },
];

export class CompyleLocalModelsEditor extends EditorPane {

	static readonly ID = 'compyleLocalModels';

	private _root!: HTMLElement;
	private _status!: HTMLElement;
	private _lastStatus: { label: string; status: ILocalProviderStatus } | undefined;

	private _installed: ILocalModelInfo[] = [];
	private _loadingModels = false;
	private _modelsError: string | undefined;
	private _catalogFilter = '';
	private _sizeFilter: CatalogSizeFilter = 'all';
	private _startingOllama = false;
	private _routers: string[] = [];
	private _routerCounts = new Map<string, number>();
	private _loadingRouters = false;
	private _routersError: string | undefined;
	private readonly _downloads = new Map<string, { percent: number; status: string }>();
	private readonly _downloadEls = new Map<string, { bar: HTMLElement; label: HTMLElement }>();
	private _pullCts: CancellationTokenSource | undefined;

	private readonly _disposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@ICompyleRouterService private readonly _routerService: ICompyleRouterService,
		@IProgressService private readonly _progressService: IProgressService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IRequestService private readonly _requestService: IRequestService,
		@IFileService private readonly _fileService: IFileService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
	) {
		super(CompyleLocalModelsEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.clm-root'));
		this._render();
		void this._refreshModels();
		void this._refreshRouters();
	}

	// -- data --------------------------------------------------------------

	private async _refreshModels(): Promise<void> {
		this._loadingModels = true;
		this._modelsError = undefined;
		this._render();
		try {
			this._installed = await this._brainService.listLocalModels();
		} catch (error) {
			this._installed = [];
			this._modelsError = error instanceof Error ? error.message : String(error);
		} finally {
			this._loadingModels = false;
			this._render();
		}
	}

	private async _refreshRouters(): Promise<void> {
		this._loadingRouters = true;
		this._routersError = undefined;
		this._render();
		try {
			this._routers = await this._routerService.listRouters();
			const counts = new Map<string, number>();
			for (const router of this._routers) {
				const config = await this._routerService.getRouter(router);
				counts.set(router, config.rules.length);
			}
			this._routerCounts = counts;
		} catch (error) {
			this._routers = [];
			this._routerCounts.clear();
			this._routersError = error instanceof Error ? error.message : String(error);
		} finally {
			this._loadingRouters = false;
			this._render();
		}
	}

	private async _createRouter(): Promise<void> {
		const name = await this._quickInputService.input({
			title: localize("compyleLocalModels.newRouterTitle", "New Router"),
			prompt: localize("compyleLocalModels.newRouterPrompt", "Name this custom router"),
			placeHolder: 'local-coding-router',
		});
		if (!name?.trim()) {
			return;
		}
		try {
			await this._routerService.createRouter(name.trim());
			await this._refreshRouters();
			this._notificationService.info(localize("compyleLocalModels.routerCreated", "Created router \"{0}\".", name.trim()));
		} catch (error) {
			this._notificationService.error(error instanceof Error ? error.message : String(error));
		}
	}

	private async _importRouter(): Promise<void> {
		const picked = await this._fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectMany: false,
			title: localize("compyleLocalModels.importRouterTitle", "Import a router JSON or JSONL file"),
			filters: [{ name: 'Router', extensions: ['json', 'jsonl'] }],
		});
		if (!picked || picked.length === 0) {
			return;
		}
		const source = picked[0];
		const defaultName = basename(source).replace(/\.(jsonl?|router)$/i, '') || 'imported-router';
		const name = await this._quickInputService.input({
			title: localize("compyleLocalModels.importRouterNameTitle", "Import Router"),
			prompt: localize("compyleLocalModels.importRouterNamePrompt", "Name the new custom router"),
			value: defaultName,
		});
		if (!name?.trim()) {
			return;
		}
		try {
			const raw = (await this._fileService.readFile(source)).value.toString();
			const config = parseRouterConfigText(raw);
			if (config.rules.length === 0) {
				this._notificationService.warn(localize("compyleLocalModels.importRouterEmpty", "That file did not contain any valid router rules."));
				return;
			}
			await this._routerService.saveRouter(name.trim(), config);
			await this._refreshRouters();
			this._notificationService.info(localize("compyleLocalModels.importRouterDone", "Imported {0} rule(s) into \"{1}\".", config.rules.length, name.trim()));
		} catch (error) {
			this._notificationService.error(error instanceof Error ? error.message : String(error));
		}
	}

	private async _exportRouter(name: string): Promise<void> {
		try {
			const config = await this._routerService.getRouter(name);
			const defaultFolder = await this._fileDialogService.defaultFolderPath();
			const target = await this._fileDialogService.showSaveDialog({
				title: localize("compyleLocalModels.exportRouterTitle", "Export Router"),
				defaultUri: joinPath(defaultFolder, `${name}.jsonl`),
				filters: [{ name: 'JSONL', extensions: ['jsonl'] }, { name: 'JSON', extensions: ['json'] }],
			});
			if (!target) {
				return;
			}
			const text = target.path.toLowerCase().endsWith('.json')
				? JSON.stringify(config, undefined, '\t') + '\n'
				: serializeRouterRulesJsonl(config.rules);
			await this._fileService.writeFile(target, VSBuffer.fromString(text));
			this._notificationService.info(localize("compyleLocalModels.exportRouterDone", "Exported router \"{0}\".", name));
		} catch (error) {
			this._notificationService.error(error instanceof Error ? error.message : String(error));
		}
	}

	private async _useRouterForTraining(name: string): Promise<void> {
		await this._configurationService.updateValue('compyle.router.trainingTarget', name);
		this._render();
		this._notificationService.info(localize("compyleLocalModels.trainingRouterSet", "Router training target set to \"{0}\".", name));
	}

	private async _useRouterForRouting(name: string): Promise<void> {
		try {
			await this._routerService.activateRouter(name);
			this._render();
			this._notificationService.info(localize("compyleLocalModels.routingRouterSet", "Custom routing now uses \"{0}\".", name));
		} catch (error) {
			this._notificationService.error(error instanceof Error ? error.message : String(error));
		}
	}

	/** Launch `ollama serve` in a terminal, then poll until the server answers. */
	private async _startOllama(): Promise<void> {
		if (this._startingOllama) {
			return;
		}
		this._startingOllama = true;
		this._render();
		try {
			const instance = await this._terminalService.createTerminal({});
			this._terminalService.setActiveInstance(instance);
			await this._terminalGroupService.showPanel(true);
			await instance.sendText('ollama serve', true);

			for (let i = 0; i < 12; i++) {
				await timeout(1000);
				try {
					this._installed = await this._brainService.listLocalModels();
					this._modelsError = undefined;
					this._notificationService.info(localize("compyleLocalModels.ollamaUp", "Ollama is running."));
					return;
				} catch {
					// Not up yet — keep polling.
				}
			}
			this._notificationService.notify({
				severity: Severity.Warning,
				message: localize("compyleLocalModels.ollamaSlow", "Started Ollama, but it is not responding yet. Click Refresh Models in a moment."),
			});
		} catch (error) {
			this._notificationService.error(error instanceof Error ? error.message : String(error));
		} finally {
			this._startingOllama = false;
			this._render();
		}
	}

	/** Import a local .gguf file into Ollama via a generated Modelfile. */
	private async _importGguf(): Promise<void> {
		const picked = await this._fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectMany: false,
			title: localize("compyleLocalModels.importTitle", "Select a .gguf model file"),
			filters: [{ name: 'GGUF', extensions: ['gguf'] }],
		});
		if (!picked || picked.length === 0) {
			return;
		}
		const gguf = picked[0];
		const name = await this._quickInputService.input({
			prompt: localize("compyleLocalModels.importName", "Name for the imported model"),
			placeHolder: 'my-model',
		});
		if (!name) {
			return;
		}
		const modelfile = joinPath(dirname(gguf), `${name}.Modelfile`);
		try {
			await this._fileService.writeFile(modelfile, VSBuffer.fromString(`FROM ${gguf.fsPath}\n`));
			const instance = await this._terminalService.createTerminal({ cwd: dirname(gguf) });
			this._terminalService.setActiveInstance(instance);
			await this._terminalGroupService.showPanel(true);
			await instance.sendText(`ollama create ${name} -f "${modelfile.fsPath}"`, true);
			this._notificationService.info(localize("compyleLocalModels.importing", "Importing {0} into Ollama. Click Refresh Models when it finishes.", name));
		} catch (error) {
			this._notificationService.error(error instanceof Error ? error.message : String(error));
		}
	}

	private _sizeGb(size: string): number {
		const match = size.match(/([\d.]+)\s*GB/i);
		return match ? parseFloat(match[1]) : 0;
	}

	private _matchesSizeFilter(size: string): boolean {
		if (this._sizeFilter === 'all') {
			return true;
		}
		const gb = this._sizeGb(size);
		if (this._sizeFilter === 'small') {
			return gb > 0 && gb < 3;
		}
		if (this._sizeFilter === 'medium') {
			return gb >= 3 && gb <= 8;
		}
		return gb > 8;
	}

	private async _switchProvider(card: ILocalProviderCard): Promise<void> {
		await this._configurationService.updateValue('compyle.brain.enabled', true);
		await this._configurationService.updateValue('compyle.brain.provider', card.provider);
		await this._configurationService.updateValue('compyle.brain.endpoint', card.endpoint);
		await this._configurationService.updateValue('compyle.brain.localOnly', true);
		this._render();
		void this._refreshModels();
	}

	private async _useModel(name: string): Promise<void> {
		await this._configurationService.updateValue('compyle.brain.enabled', true);
		await this._configurationService.updateValue('compyle.brain.model', name);
		this._render();
	}

	private async _deleteModel(name: string): Promise<void> {
		this._notificationService.prompt(
			Severity.Warning,
			localize("compyleLocalModels.deleteConfirm", "Delete the model \"{0}\" from Ollama? This frees disk space and cannot be undone.", name),
			[{
				label: localize("compyleLocalModels.deleteAction", "Delete"),
				run: async () => {
					try {
						await this._brainService.deleteLocalModel(name);
						await this._refreshModels();
					} catch (error) {
						this._notificationService.error(error instanceof Error ? error.message : String(error));
					}
				},
			}],
		);
	}

	private async _download(name: string): Promise<void> {
		const trimmed = name.trim();
		if (!trimmed || this._pullCts) {
			return;
		}
		this._pullCts = new CancellationTokenSource();
		this._downloads.set(trimmed, { percent: 0, status: localize("compyleLocalModels.starting", "Starting…") });
		this._render();
		try {
			await this._brainService.pullLocalModel(trimmed, progress => {
				const percent = progress.total && progress.total > 0
					? Math.round(((progress.completed ?? 0) / progress.total) * 100)
					: (this._downloads.get(trimmed)?.percent ?? 0);
				this._downloads.set(trimmed, { percent, status: progress.status || '' });
				this._updateDownloadEl(trimmed);
			}, this._pullCts.token);
			if (!this._pullCts.token.isCancellationRequested) {
				this._notificationService.info(localize("compyleLocalModels.pulled", "Downloaded {0}.", trimmed));
			}
		} catch (error) {
			this._notificationService.error(localize("compyleLocalModels.pullFailed", "Could not download {0}: {1}", trimmed, error instanceof Error ? error.message : String(error)));
		} finally {
			this._downloads.delete(trimmed);
			this._pullCts?.dispose();
			this._pullCts = undefined;
			await this._refreshModels();
		}
	}

	// -- Hugging Face search -----------------------------------------------

	private async _searchHuggingFace(): Promise<void> {
		type ModelPick = IQuickPickItem & { hf?: IHfModel; catalogName?: string };
		const picker = this._quickInputService.createQuickPick<ModelPick>({ useSeparators: true });
		picker.placeholder = localize("compyleLocalModels.searchPlaceholder", "Search Hugging Face for GGUF models (e.g. qwen2.5 coder)…");
		picker.matchOnDescription = true;
		picker.matchOnDetail = true;
		this._disposables.add(picker);

		const curatedItems = (query: string): (ModelPick | IQuickPickSeparator)[] => {
			const q = query.toLowerCase();
			const curated = OLLAMA_CATALOG.filter(c => !q || c.name.toLowerCase().includes(q) || c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
			if (!curated.length) {
				return [];
			}
			const items: (ModelPick | IQuickPickSeparator)[] = [{ type: 'separator', label: localize("compyleLocalModels.recommended", "Recommended (Ollama)") }];
			for (const c of curated) {
				items.push({ label: c.name, description: c.size, detail: c.description, catalogName: c.name });
			}
			return items;
		};
		picker.items = curatedItems('');

		let debounce: ReturnType<typeof setTimeout> | undefined;
		this._disposables.add(picker.onDidChangeValue(value => {
			if (debounce !== undefined) {
				clearTimeout(debounce);
			}
			const query = value.trim();
			if (!query) {
				picker.items = curatedItems('');
				return;
			}
			debounce = setTimeout(async () => {
				picker.busy = true;
				try {
					const cts = new CancellationTokenSource();
					const res = await this._requestService.request({ type: 'GET', url: buildHfSearchUrl(query), headers: { 'User-Agent': 'CompyleCode/1.0' }, callSite: 'compyleLocalModels.hfSearch' }, cts.token);
					const models = parseHfModels(await asJson<unknown>(res));
					const items = curatedItems(query);
					if (models.length) {
						items.push({ type: 'separator', label: localize("compyleLocalModels.hfResults", "Hugging Face (GGUF)") });
						for (const m of models) {
							items.push({ label: m.id, description: localize("compyleLocalModels.hfStats", "{0} downloads · {1} likes", m.downloads.toLocaleString(), m.likes.toLocaleString()), hf: m });
						}
					}
					picker.items = items;
				} catch {
					// Keep the current items on a failed fetch.
				} finally {
					picker.busy = false;
				}
			}, 350);
		}));

		this._disposables.add(picker.onDidAccept(async () => {
			const selected = picker.selectedItems[0];
			if (!selected) {
				return;
			}
			picker.hide();
			if (selected.catalogName) {
				await this._download(selected.catalogName);
			} else if (selected.hf) {
				await this._pickQuantAndPull(selected.hf);
			}
		}));

		picker.show();
	}

	private async _pickQuantAndPull(model: IHfModel): Promise<void> {
		let quants: string[] = [];
		try {
			const cts = new CancellationTokenSource();
			const res = await this._requestService.request({ type: 'GET', url: buildHfModelUrl(model.id), headers: { 'User-Agent': 'CompyleCode/1.0' }, callSite: 'compyleLocalModels.hfModel' }, cts.token);
			quants = parseGgufQuants(await asJson<unknown>(res));
		} catch {
			// No quant list — fall back to the default tag.
		}

		let quant: string | undefined;
		if (quants.length > 1) {
			const picked = await this._quickInputService.pick(quants.map(q => ({ label: q })), { placeHolder: localize("compyleLocalModels.pickQuant", "Pick a quantization for {0}", model.id) });
			if (!picked) {
				return;
			}
			quant = picked.label;
		} else if (quants.length === 1) {
			quant = quants[0];
		}
		await this._runOllamaPull(buildOllamaHfPull(model.id, quant));
	}

	private async _runOllamaPull(name: string): Promise<void> {
		this._notificationService.info(localize("compyleLocalModels.pullingHf", "Pulling {0} via Ollama…", name));
		try {
			const instance = await this._terminalService.createTerminal({});
			this._terminalService.setActiveInstance(instance);
			await this._terminalGroupService.showPanel(true);
			await instance.sendText(`ollama pull ${name}`, true);
		} catch (error) {
			this._notificationService.error(error instanceof Error ? error.message : String(error));
		}
	}

	private _updateDownloadEl(name: string): void {
		const els = this._downloadEls.get(name);
		const state = this._downloads.get(name);
		if (!els || !state) {
			return;
		}
		els.bar.style.width = `${state.percent}%`;
		els.label.textContent = state.status ? `${state.status} · ${state.percent}%` : `${state.percent}%`;
	}

	private async _testConnection(): Promise<void> {
		const provider = this._brainService.getConfig().provider;
		const label = LOCAL_PROVIDERS.find(p => p.provider === provider)?.title ?? localize("compyleLocalModels.provider.generic", "Provider");
		this._lastStatus = { label, status: { state: 'testing', message: localize("compyleLocalModels.testingMessage", "Testing the endpoint and model…") } };
		this._renderStatusSummary();
		const result = await this._progressService.withProgress(
			{ location: ProgressLocation.Notification, title: localize("compyleLocalModels.progress", "Testing local model connection…") },
			() => this._brainService.testConnection(),
		);
		const status: ILocalProviderStatus = result.ok
			? { state: 'connected', message: localize("compyleLocalModels.connectedMessage", "Model replied successfully.") }
			: { state: this._classifyFailure(result.message), message: result.message };
		this._lastStatus = { label, status };
		this._renderStatusSummary();
	}

	// -- rendering ---------------------------------------------------------

	private _render(): void {
		if (!this._root) {
			return;
		}
		this._disposables.clear();
		this._downloadEls.clear();
		clearNode(this._root);

		const config = this._brainService.getConfig();

		const header = append(this._root, $('.clm-header'));
		append(header, $('h2.clm-title', undefined, localize("compyleLocalModels.heading", "Local Models")));
		append(header, $('.clm-subtitle', undefined, localize("compyleLocalModels.subheading", "Run models on your own machine with Ollama, LM Studio, or any OpenAI-compatible server. Compyle keeps local-only mode on.")));

		const summary = append(this._root, $('.clm-summary'));
		append(summary, $('.clm-summary-item', undefined, localize("compyleLocalModels.provider", "Provider: {0}", config.provider)));
		append(summary, $('.clm-summary-item', undefined, localize("compyleLocalModels.model", "Model: {0}", config.model || localize("compyleLocalModels.notSet", "Not Set"))));
		append(summary, $('.clm-summary-item', undefined, localize("compyleLocalModels.endpointSummary", "Endpoint: {0}", config.endpoint || localize("compyleLocalModels.default", "Default"))));

		this._status = append(this._root, $('.clm-status'));
		this._renderStatusSummary();

		this._renderConnection(config.provider, config.endpoint ?? '');
		this._renderInstalled(config.model ?? '');
		this._renderBrowse();
		this._renderRouters();
		this._renderAdvanced(config);
	}

	private _renderConnection(activeProvider: CompyleBrainProvider, endpoint: string): void {
		const section = append(this._root, $('.clm-section'));
		append(section, $('.clm-section-title', undefined, localize("compyleLocalModels.connection", "Connection")));

		const chips = append(section, $('.clm-chips'));
		for (const card of LOCAL_PROVIDERS) {
			const chip = append(chips, $(`button.clm-chip${card.provider === activeProvider ? '.active' : ''}`, undefined, card.title)) as HTMLButtonElement;
			this._disposables.add(addDisposableListener(chip, 'click', () => void this._switchProvider(card)));
		}

		const row = append(section, $('.clm-option-row'));
		append(row, $('label.clm-option-label', undefined, localize("compyleLocalModels.endpoint", "Endpoint")));
		const input = append(row, $('input.clm-input')) as HTMLInputElement;
		input.type = 'text';
		input.value = endpoint;
		input.placeholder = LOCAL_PROVIDERS.find(p => p.provider === activeProvider)?.endpoint ?? 'http://localhost:11434/v1';
		this._disposables.add(addDisposableListener(input, 'change', () => {
			void this._configurationService.updateValue('compyle.brain.endpoint', input.value.trim());
		}));

		const actions = append(section, $('.clm-actions'));
		const testBtn = append(actions, $('button.clm-btn', undefined, localize("compyleLocalModels.test", "Test Connection"))) as HTMLButtonElement;
		const refreshBtn = append(actions, $('button.clm-btn', undefined, localize("compyleLocalModels.refresh", "Refresh Models"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(testBtn, 'click', () => void this._testConnection()));
		this._disposables.add(addDisposableListener(refreshBtn, 'click', () => void this._refreshModels()));
	}

	private _renderInstalled(activeModel: string): void {
		const section = append(this._root, $('.clm-section'));
		const titleRow = append(section, $('.clm-section-title'));
		append(titleRow, $('span', undefined, localize("compyleLocalModels.installed", "Installed Models")));
		if (this._installed.length > 0) {
			append(titleRow, $('span.clm-count', undefined, String(this._installed.length)));
		}

		if (this._loadingModels) {
			append(section, $('.clm-empty', undefined, localize("compyleLocalModels.loading", "Loading models…")));
			return;
		}
		if (this._modelsError) {
			const state = this._classifyFailure(this._modelsError);
			const message = state === 'not-running'
				? localize("compyleLocalModels.notRunningHint", "Could not reach the local server. Start it and click Refresh Models.")
				: this._modelsError;
			append(section, $('.clm-empty.error', undefined, message));
			// One-click start for Ollama when the server is down.
			if (state === 'not-running' && this._brainService.getConfig().provider === CompyleBrainProvider.Ollama) {
				const actions = append(section, $('.clm-actions'));
				const startBtn = append(actions, $('button.clm-btn.primary', undefined,
					this._startingOllama
						? localize("compyleLocalModels.starting", "Starting…")
						: localize("compyleLocalModels.startOllama", "Start Ollama"))) as HTMLButtonElement;
				startBtn.disabled = this._startingOllama;
				this._disposables.add(addDisposableListener(startBtn, 'click', () => void this._startOllama()));
			}
			return;
		}
		if (this._installed.length === 0) {
			append(section, $('.clm-empty', undefined, localize("compyleLocalModels.noneInstalled", "No models installed yet. Download one below so the server has something to run — otherwise requests fail with \"model not found\".")));
			return;
		}

		const list = append(section, $('.clm-model-list'));
		for (const model of this._installed) {
			const row = append(list, $(`.clm-model-row${model.name === activeModel ? '.active' : ''}`));
			const info = append(row, $('.clm-model-info'));
			append(info, $('.clm-model-name', undefined, model.name));
			const meta = append(info, $('.clm-model-meta'));
			if (model.parameterSize) { append(meta, $('span', undefined, model.parameterSize)); }
			if (model.quantization) { append(meta, $('span', undefined, model.quantization)); }
			const size = this._formatBytes(model.sizeBytes);
			if (size) { append(meta, $('span', undefined, size)); }

			const actions = append(row, $('.clm-model-actions'));
			if (model.name === activeModel) {
				append(actions, $('span.clm-tag.active', undefined, localize("compyleLocalModels.inUse", "In Use")));
			} else {
				const useBtn = append(actions, $('button.clm-btn.primary', undefined, localize("compyleLocalModels.use", "Use"))) as HTMLButtonElement;
				this._disposables.add(addDisposableListener(useBtn, 'click', () => void this._useModel(model.name)));
			}
			const delBtn = append(actions, $('button.clm-btn.danger', undefined, localize("compyleLocalModels.delete", "Delete"))) as HTMLButtonElement;
			this._disposables.add(addDisposableListener(delBtn, 'click', () => void this._deleteModel(model.name)));
		}
	}

	private _renderBrowse(): void {
		const section = append(this._root, $('.clm-section'));
		const titleRow = append(section, $('.clm-section-titlerow'));
		append(titleRow, $('.clm-section-title', undefined, localize("compyleLocalModels.browse", "Browse & Download")));
		const searchBtn = append(titleRow, $('button.clm-btn', undefined, localize("compyleLocalModels.searchHf", "Search Hugging Face…"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(searchBtn, 'click', () => void this._searchHuggingFace()));
		append(section, $('.clm-section-hint', undefined, localize("compyleLocalModels.browseHint", "Pick a recommended model or pull any model by name. Downloads run through Ollama.")));

		const filter = append(section, $('input.clm-input.clm-filter')) as HTMLInputElement;
		filter.type = 'text';
		filter.placeholder = localize("compyleLocalModels.filterPlaceholder", "Search models by name or description…");
		filter.value = this._catalogFilter;

		// Size buckets so users can match models to their hardware.
		const sizeRow = append(section, $('.clm-size-filters'));
		const sizeOptions: { id: CatalogSizeFilter; label: string }[] = [
			{ id: 'all', label: localize("compyleLocalModels.size.all", "All sizes") },
			{ id: 'small', label: localize("compyleLocalModels.size.small", "< 3 GB") },
			// allow-any-unicode-next-line
			{ id: 'medium', label: localize("compyleLocalModels.size.medium", "3–8 GB") },
			{ id: 'large', label: localize("compyleLocalModels.size.large", "> 8 GB") },
		];

		const listEl = append(section, $('.clm-catalog'));
		for (const option of sizeOptions) {
			const chip = append(sizeRow, $(`button.clm-size-chip${option.id === this._sizeFilter ? '.active' : ''}`, undefined, option.label)) as HTMLButtonElement;
			this._disposables.add(addDisposableListener(chip, 'click', () => {
				this._sizeFilter = option.id;
				for (const sibling of Array.from(sizeRow.children)) {
					sibling.classList.toggle('active', sibling === chip);
				}
				this._renderCatalogList(listEl);
			}));
		}

		this._renderCatalogList(listEl);
		this._disposables.add(addDisposableListener(filter, 'input', () => {
			this._catalogFilter = filter.value;
			this._renderCatalogList(listEl);
		}));

		// Pull any model by exact name/tag.
		const pullRow = append(section, $('.clm-pull-row'));
		const pullInput = append(pullRow, $('input.clm-input')) as HTMLInputElement;
		pullInput.type = 'text';
		pullInput.placeholder = localize("compyleLocalModels.pullPlaceholder", "Pull any model by name, e.g. qwen2.5-coder:7b");
		const pullBtn = append(pullRow, $('button.clm-btn.primary', undefined, localize("compyleLocalModels.download", "Download"))) as HTMLButtonElement;
		const startPull = () => {
			const name = pullInput.value.trim();
			if (name) { void this._download(name); }
		};
		this._disposables.add(addDisposableListener(pullBtn, 'click', startPull));
		this._disposables.add(addDisposableListener(pullInput, 'keydown', e => {
			if ((e as KeyboardEvent).key === 'Enter') { startPull(); }
		}));

		// Import a local .gguf file into Ollama.
		const importRow = append(section, $('.clm-pull-row'));
		append(importRow, $('.clm-section-hint', undefined, localize("compyleLocalModels.importHint", "Have a model file already? Import a .gguf into Ollama.")));
		const importBtn = append(importRow, $('button.clm-btn', undefined, localize("compyleLocalModels.importGguf", "Import .gguf…"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(importBtn, 'click', () => void this._importGguf()));
	}

	private _renderRouters(): void {
		const section = append(this._root, $('.clm-section'));
		const titleRow = append(section, $('.clm-section-title'));
		append(titleRow, $('span', undefined, localize("compyleLocalModels.routers", "Custom Routers")));
		if (this._routers.length > 0) {
			append(titleRow, $('span.clm-count', undefined, String(this._routers.length)));
		}
		append(section, $('.clm-section-hint', undefined, localize("compyleLocalModels.routersHint", "Create named routers, import JSON/JSONL rule files, export them for sharing, or make one the active custom router.")));

		const actions = append(section, $('.clm-actions'));
		const createBtn = append(actions, $('button.clm-btn.primary', undefined, localize("compyleLocalModels.createRouter", "Create Router"))) as HTMLButtonElement;
		const importBtn = append(actions, $('button.clm-btn', undefined, localize("compyleLocalModels.importRouter", "Import Router"))) as HTMLButtonElement;
		const refreshBtn = append(actions, $('button.clm-btn', undefined, localize("compyleLocalModels.refreshRouters", "Refresh Routers"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(createBtn, 'click', () => void this._createRouter()));
		this._disposables.add(addDisposableListener(importBtn, 'click', () => void this._importRouter()));
		this._disposables.add(addDisposableListener(refreshBtn, 'click', () => void this._refreshRouters()));

		if (this._loadingRouters) {
			append(section, $('.clm-empty', undefined, localize("compyleLocalModels.loadingRouters", "Loading routers...")));
			return;
		}
		if (this._routersError) {
			append(section, $('.clm-empty.error', undefined, this._routersError));
			return;
		}
		if (this._routers.length === 0) {
			append(section, $('.clm-empty', undefined, localize("compyleLocalModels.noRouters", "No custom routers yet. Create one, or import one of the reference router files.")));
			return;
		}

		const trainingTarget = this._configurationService.getValue<string>('compyle.router.trainingTarget') || '';
		const routingMode = this._configurationService.getValue<string>(COMPYLE_ROUTER_MODE_SETTING);
		const customPath = (this._configurationService.getValue<string>(COMPYLE_ROUTER_CUSTOM_PATH_SETTING) || '').replace(/\\/g, '/').toLowerCase();
		const list = append(section, $('.clm-router-list'));
		for (const name of this._routers) {
			const activeRouting = routingMode === 'custom' && customPath.endsWith(`.compyle/routers/${name.toLowerCase()}.jsonl`);
			const activeTraining = trainingTarget === name;
			const row = append(list, $('.clm-router-row'));
			const info = append(row, $('.clm-router-info'));
			const nameLine = append(info, $('.clm-router-name-row'));
			append(nameLine, $('.clm-router-name', undefined, name));
			if (activeRouting) {
				append(nameLine, $('span.clm-tag.active', undefined, localize("compyleLocalModels.activeRouting", "Routing")));
			}
			if (activeTraining) {
				append(nameLine, $('span.clm-tag', undefined, localize("compyleLocalModels.activeTraining", "Training Target")));
			}
			append(info, $('.clm-router-meta', undefined, localize("compyleLocalModels.routerRuleCount", "{0} rule(s)", this._routerCounts.get(name) ?? 0)));

			const rowActions = append(row, $('.clm-router-actions'));
			const routeBtn = append(rowActions, $('button.clm-btn.primary', undefined, localize("compyleLocalModels.useForRouting", "Use For Routing"))) as HTMLButtonElement;
			const trainBtn = append(rowActions, $('button.clm-btn', undefined, localize("compyleLocalModels.useForTraining", "Use For Training"))) as HTMLButtonElement;
			const exportBtn = append(rowActions, $('button.clm-btn', undefined, localize("compyleLocalModels.exportRouter", "Export"))) as HTMLButtonElement;
			routeBtn.disabled = activeRouting;
			trainBtn.disabled = activeTraining;
			this._disposables.add(addDisposableListener(routeBtn, 'click', () => void this._useRouterForRouting(name)));
			this._disposables.add(addDisposableListener(trainBtn, 'click', () => void this._useRouterForTraining(name)));
			this._disposables.add(addDisposableListener(exportBtn, 'click', () => void this._exportRouter(name)));
		}
	}

	private _renderCatalogList(container: HTMLElement): void {
		clearNode(container);
		const installedNames = new Set(this._installed.map(m => m.name));
		const filter = this._catalogFilter.trim().toLowerCase();
		const entries = OLLAMA_CATALOG.filter(entry =>
			this._matchesSizeFilter(entry.size)
			&& (!filter
				|| entry.name.toLowerCase().includes(filter)
				|| entry.label.toLowerCase().includes(filter)
				|| entry.description.toLowerCase().includes(filter)));

		if (entries.length === 0) {
			append(container, $('.clm-empty', undefined, localize("compyleLocalModels.noMatches", "No catalog models match \"{0}\". Use the field below to pull it by exact name.", this._catalogFilter)));
			return;
		}

		for (const entry of entries) {
			const item = append(container, $('.clm-catalog-item'));
			const info = append(item, $('.clm-catalog-info'));
			const titleRow = append(info, $('.clm-catalog-titlerow'));
			append(titleRow, $('span.clm-catalog-label', undefined, entry.label));
			append(titleRow, $('code.clm-catalog-name', undefined, entry.name));
			append(titleRow, $('span.clm-catalog-size', undefined, entry.size));
			append(info, $('.clm-catalog-desc', undefined, entry.description));

			const downloading = this._downloads.has(entry.name);
			if (downloading) {
				this._appendProgress(item, entry.name);
			} else if (installedNames.has(entry.name)) {
				append(item, $('span.clm-tag', undefined, localize("compyleLocalModels.installedTag", "Installed")));
			} else {
				const dlBtn = append(item, $('button.clm-btn.primary', undefined, localize("compyleLocalModels.download", "Download"))) as HTMLButtonElement;
				dlBtn.disabled = !!this._pullCts;
				this._disposables.add(addDisposableListener(dlBtn, 'click', () => void this._download(entry.name)));
			}
		}
	}

	private _appendProgress(parent: HTMLElement, name: string): void {
		const state = this._downloads.get(name) ?? { percent: 0, status: '' };
		const wrap = append(parent, $('.clm-progress'));
		const track = append(wrap, $('.clm-progress-track'));
		const bar = append(track, $('.clm-progress-bar')) as HTMLElement;
		bar.style.width = `${state.percent}%`;
		const label = append(wrap, $('.clm-progress-label')) as HTMLElement;
		label.textContent = state.status ? `${state.status} · ${state.percent}%` : `${state.percent}%`;
		const cancel = append(wrap, $('button.clm-btn.small', undefined, localize("compyleLocalModels.cancel", "Cancel"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(cancel, 'click', () => this._pullCts?.cancel()));
		this._downloadEls.set(name, { bar, label });
	}

	private _renderAdvanced(config: ReturnType<ICompyleBrainService['getConfig']>): void {
		const section = append(this._root, $('.clm-section'));
		append(section, $('.clm-section-title', undefined, localize("compyleLocalModels.advanced", "Advanced Options")));

		this._addNumberOption(section, localize("compyleLocalModels.temperature", "Temperature"),
			localize("compyleLocalModels.temperatureHint", "0 = focused, 2 = creative"),
			'compyle.brain.temperature', config.temperature, 0, 2, 0.1);
		this._addNumberOption(section, localize("compyleLocalModels.contextLength", "Context Length"),
			localize("compyleLocalModels.contextLengthHint", "Ollama num_ctx. 0 uses the model default. Larger = more VRAM."),
			'compyle.brain.contextLength', config.contextLength, 0, 131072, 512);
		this._addNumberOption(section, localize("compyleLocalModels.maxTokens", "Max Tokens"),
			localize("compyleLocalModels.maxTokensHint", "Maximum length of a single reply."),
			'compyle.brain.maxTokens', config.maxTokens, 1, 32768, 1);

		const keepRow = append(section, $('.clm-option-row'));
		append(keepRow, $('label.clm-option-label', undefined, localize("compyleLocalModels.keepAlive", "Keep Alive")));
		const keepInput = append(keepRow, $('input.clm-input.small')) as HTMLInputElement;
		keepInput.type = 'text';
		keepInput.value = config.keepAlive;
		keepInput.placeholder = '5m';
		append(keepRow, $('.clm-option-hint', undefined, localize("compyleLocalModels.keepAliveHint", "How long Ollama keeps the model in VRAM (e.g. 5m, 1h, -1 for always).")));
		this._disposables.add(addDisposableListener(keepInput, 'change', () => {
			void this._configurationService.updateValue('compyle.brain.keepAlive', keepInput.value.trim() || '5m');
		}));
	}

	private _addNumberOption(parent: HTMLElement, label: string, hint: string, settingKey: string, value: number, min: number, max: number, step: number): void {
		const row = append(parent, $('.clm-option-row'));
		append(row, $('label.clm-option-label', undefined, label));
		const input = append(row, $('input.clm-input.small')) as HTMLInputElement;
		input.type = 'number';
		input.min = String(min);
		input.max = String(max);
		input.step = String(step);
		input.value = String(value);
		append(row, $('.clm-option-hint', undefined, hint));
		this._disposables.add(addDisposableListener(input, 'change', () => {
			const parsed = Number(input.value);
			if (Number.isFinite(parsed)) {
				void this._configurationService.updateValue(settingKey, Math.min(max, Math.max(min, parsed)));
			}
		}));
	}

	private _renderStatusSummary(): void {
		clearNode(this._status);
		if (!this._lastStatus) {
			append(this._status, $('.clm-status-row.neutral', undefined, localize("compyleLocalModels.statusHint", "Test the connection to verify the server and model, or refresh to list installed models.")));
			return;
		}
		const state = this._lastStatus.status.state;
		const tone = state === 'connected' ? 'ok' : state === 'testing' ? 'neutral' : 'error';
		const icon = state === 'connected' ? 'codicon-check' : state === 'testing' ? 'codicon-loading' : 'codicon-warning';
		const row = append(this._status, $(`.clm-status-row.${tone}`));
		append(row, $(`span.codicon.${icon}`));
		append(row, $('span', undefined, `${this._lastStatus.label}: ${this._statusLabel(state)}. ${this._lastStatus.status.message}`));
	}

	private _statusLabel(state: LocalProviderStatus): string {
		switch (state) {
			case 'connected': return localize("compyleLocalModels.connectedLabel", "Connected");
			case 'not-running': return localize("compyleLocalModels.notRunningLabel", "Not Running");
			case 'misconfigured': return localize("compyleLocalModels.misconfiguredLabel", "Misconfigured");
			case 'testing': return localize("compyleLocalModels.testingLabel", "Testing");
			default: return localize("compyleLocalModels.notTestedLabel", "Not Tested");
		}
	}

	private _classifyFailure(message: string): LocalProviderStatus {
		const normalized = message.toLowerCase();
		if (normalized.includes('econnrefused') || normalized.includes('connection refused') || normalized.includes('fetch failed') || normalized.includes('socket') || normalized.includes('connect')) {
			return 'not-running';
		}
		return 'misconfigured';
	}

	private _formatBytes(bytes?: number): string {
		if (!bytes || bytes <= 0) {
			return '';
		}
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let value = bytes;
		let unit = 0;
		while (value >= 1024 && unit < units.length - 1) {
			value /= 1024;
			unit++;
		}
		return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
	}

	override async setInput(input: CompyleLocalModelsInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
	}

	layout(dimension: Dimension): void {
		// Give the scroll container an explicit size so overflow-y: auto can scroll the
		// (now much taller) content instead of clipping it.
		if (this._root) {
			this._root.style.height = `${dimension.height}px`;
			this._root.style.width = `${dimension.width}px`;
		}
	}
}
