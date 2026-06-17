/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleLocalModels.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { CompyleBrainProvider, ILocalModelInfo, OLLAMA_CATALOG } from '../common/compyleBrain.js';
import { ICompyleBrainService } from './compyleBrainService.js';
import { CompyleLocalModelsInput } from './compyleLocalModelsInput.js';

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
		@IProgressService private readonly _progressService: IProgressService,
		@INotificationService private readonly _notificationService: INotificationService,
	) {
		super(CompyleLocalModelsEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.clm-root'));
		this._render();
		void this._refreshModels();
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
				? localize("compyleLocalModels.notRunningHint", "Could not reach the local server. Start it (for Ollama, run \"ollama serve\") and click Refresh Models.")
				: this._modelsError;
			append(section, $('.clm-empty.error', undefined, message));
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
		append(section, $('.clm-section-title', undefined, localize("compyleLocalModels.browse", "Browse & Download")));
		append(section, $('.clm-section-hint', undefined, localize("compyleLocalModels.browseHint", "Pick a recommended model or pull any model by name. Downloads run through Ollama.")));

		const filter = append(section, $('input.clm-input.clm-filter')) as HTMLInputElement;
		filter.type = 'text';
		filter.placeholder = localize("compyleLocalModels.filterPlaceholder", "Filter models…");
		filter.value = this._catalogFilter;

		const listEl = append(section, $('.clm-catalog'));
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
	}

	private _renderCatalogList(container: HTMLElement): void {
		clearNode(container);
		const installedNames = new Set(this._installed.map(m => m.name));
		const filter = this._catalogFilter.trim().toLowerCase();
		const entries = OLLAMA_CATALOG.filter(entry =>
			!filter
			|| entry.name.toLowerCase().includes(filter)
			|| entry.label.toLowerCase().includes(filter)
			|| entry.description.toLowerCase().includes(filter));

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
