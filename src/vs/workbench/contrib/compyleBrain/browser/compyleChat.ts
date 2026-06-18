/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleChat.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { timeout } from '../../../../base/common/async.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IRequestService, asJson, asText } from '../../../../platform/request/common/request.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ITerminalService, ITerminalGroupService } from '../../terminal/browser/terminal.js';
import { CompyleBrainProvider } from '../common/compyleBrain.js';
import { ICompyleBrainService, ICompyleChatMessage } from './compyleBrainService.js';
import { CompyleChatInput } from './compyleChatInput.js';
import { COMPYLE_AGENT_MODE_SETTING, COMPYLE_AGENT_MODES } from '../common/compyleAgentModes.js';

interface IContextItem {
	readonly label: string;
	readonly content: string;
}

interface IChatMessage {
	readonly role: 'user' | 'assistant';
	readonly content: string;
}

interface IGitHubRepo {
	full_name: string;
	description: string;
	stargazers_count: number;
	default_branch: string;
}

export class CompyleChatEditor extends EditorPane {

	static readonly ID = 'workbench.editors.compyleChat';

	private _root!: HTMLElement;
	private _modelSelect!: HTMLSelectElement;
	private _modeSelect!: HTMLSelectElement;
	private _statusPill!: HTMLElement;
	private _ollamaBanner!: HTMLElement;
	private _contextStrip!: HTMLElement;
	private _msgList!: HTMLElement;
	private _textarea!: HTMLTextAreaElement;
	private _sendBtn!: HTMLButtonElement;

	private readonly _history: IChatMessage[] = [];
	private readonly _contextItems: IContextItem[] = [];
	private _busy = false;
	private _busyCts: CancellationTokenSource | undefined;
	private _startingOllama = false;

	private readonly _disposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IRequestService private readonly _requestService: IRequestService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
	) {
		super(CompyleChatEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.cpc-root'));
		this._buildHeader();
		this._buildModelBar();
		this._buildOllamaBanner();
		this._buildContextStrip();
		this._buildMessages();
		this._buildInputArea();

		this._disposables.add(this._brainService.onDidChangeConfig(() => this._refreshStatus()));
		this._disposables.add(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(COMPYLE_AGENT_MODE_SETTING)) {
				this._refreshModeSelect();
			}
		}));
	}

	private _buildHeader(): void {
		const header = append(this._root, $('.cpc-header'));
		const left = append(header, $('.cpc-header-left'));
		append(left, $('.cpc-logo.codicon.codicon-robot'));
		append(left, $('h2.cpc-title', undefined, localize('compyleChat.title', "Compyle AI")));

		const right = append(header, $('.cpc-header-right'));

		const modeLabel = append(right, $('span', undefined, localize('compyleChat.mode', "Mode:")));
		modeLabel.style.fontSize = '12px';
		modeLabel.style.opacity = '0.65';
		modeLabel.style.marginRight = '4px';

		this._modeSelect = append(right, $('select.cpc-model-select')) as HTMLSelectElement;
		for (const mode of COMPYLE_AGENT_MODES) {
			const opt = append(this._modeSelect, $('option')) as HTMLOptionElement;
			opt.value = mode.id;
			opt.textContent = mode.name;
		}
		const currentMode = this._configurationService.getValue<string>(COMPYLE_AGENT_MODE_SETTING) || 'code';
		this._modeSelect.value = currentMode;
		this._disposables.add(addDisposableListener(this._modeSelect, 'change', () => {
			this._configurationService.updateValue(COMPYLE_AGENT_MODE_SETTING, this._modeSelect.value);
		}));

		const clearBtn = append(right, $('button.cpc-btn.small', undefined, localize('compyleChat.clear', "Clear")));
		this._disposables.add(addDisposableListener(clearBtn, 'click', () => this._clearHistory()));

		const settingsBtn = append(right, $('button.cpc-btn.small', undefined, '$(gear)'));
		this._disposables.add(addDisposableListener(settingsBtn, 'click', () => {
			this._configurationService.updateValue('workbench.action.openSettings', 'compyle.brain');
		}));
	}

	private _buildModelBar(): void {
		const bar = append(this._root, $('.cpc-modelbar'));
		append(bar, $('span.cpc-model-label', undefined, localize('compyleChat.model', "Model:")));

		this._modelSelect = append(bar, $('select.cpc-model-select')) as HTMLSelectElement;
		const placeholder = append(this._modelSelect, $('option')) as HTMLOptionElement;
		placeholder.value = '';
		placeholder.textContent = localize('compyleChat.loadingModels', "Loading models…");
		placeholder.disabled = true;
		this._modelSelect.value = '';

		this._disposables.add(addDisposableListener(this._modelSelect, 'change', () => {
			const model = this._modelSelect.value;
			if (model) {
				this._configurationService.updateValue('compyle.brain.model', model);
			}
		}));

		this._statusPill = append(bar, $('.cpc-status-pill'));
		this._refreshStatus();
	}

	private _buildOllamaBanner(): void {
		this._ollamaBanner = append(this._root, $('.cpc-ollama-banner.hidden'));
		append(this._ollamaBanner, $('span', undefined, localize('compyleChat.ollamaNotRunning', "Ollama is not running. Start it to use local models.")));
		const startBtn = append(this._ollamaBanner, $('button.cpc-btn.small', undefined, localize('compyleChat.startOllama', "Start Ollama")));
		this._disposables.add(addDisposableListener(startBtn, 'click', () => this._startOllama()));
	}

	private _buildContextStrip(): void {
		this._contextStrip = append(this._root, $('.cpc-context-strip'));
	}

	private _buildMessages(): void {
		this._msgList = append(this._root, $('.cpc-messages'));
		this._renderEmptyState();
	}

	private _buildInputArea(): void {
		const area = append(this._root, $('.cpc-input-area'));

		const toolbar = append(area, $('.cpc-toolbar'));
		const githubBtn = append(toolbar, $('button.cpc-tool-btn', undefined, '$(github) ', localize('compyleChat.githubSearch', "Search GitHub")));
		this._disposables.add(addDisposableListener(githubBtn, 'click', () => this._searchGitHub()));

		const row = append(area, $('.cpc-input-row'));
		this._textarea = append(row, $('textarea.cpc-textarea')) as HTMLTextAreaElement;
		this._textarea.placeholder = localize('compyleChat.placeholder', "Ask Compyle AI…");
		this._textarea.rows = 2;

		this._disposables.add(addDisposableListener(this._textarea, 'keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this._send();
			}
		}));

		this._disposables.add(addDisposableListener(this._textarea, 'input', () => {
			this._textarea.style.height = 'auto';
			this._textarea.style.height = Math.min(this._textarea.scrollHeight, 180) + 'px';
		}));

		// allow-any-unicode-next-line
		this._sendBtn = append(row, $('button.cpc-send-btn', undefined, localize('compyleChat.send', "Send ↵"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(this._sendBtn, 'click', () => this._send()));
	}

	private _renderEmptyState(): void {
		clearNode(this._msgList);
		const empty = append(this._msgList, $('.cpc-empty-state'));
		append(empty, $('.cpc-empty-icon.codicon.codicon-robot'));
		append(empty, $('p.cpc-empty-title', undefined, localize('compyleChat.emptyTitle', "Compyle AI")));
		append(empty, $('p.cpc-empty-hint', undefined, localize('compyleChat.emptyHint', "Select a local model above and start chatting. Press Enter to send, Shift+Enter for a new line.")));
	}

	private _appendBubble(role: 'user' | 'assistant', content: string): HTMLElement {
		const wrap = append(this._msgList, $(`.cpc-msg.${role}`));
		append(wrap, $('span.cpc-msg-role', undefined, role === 'user' ? localize('compyleChat.you', "You") : localize('compyleChat.ai', "Compyle AI")));
		const bubble = append(wrap, $('.cpc-bubble'));
		bubble.textContent = content;
		return bubble;
	}

	private _appendTypingIndicator(): HTMLElement {
		const wrap = append(this._msgList, $('.cpc-msg.assistant'));
		const typing = append(wrap, $('.cpc-typing'));
		append(typing, $('.cpc-typing-dot'));
		append(typing, $('.cpc-typing-dot'));
		append(typing, $('.cpc-typing-dot'));
		this._scrollToBottom();
		return wrap;
	}

	private _scrollToBottom(): void {
		this._msgList.scrollTop = this._msgList.scrollHeight;
	}

	private async _send(): Promise<void> {
		const text = this._textarea.value.trim();
		if (!text || this._busy) {
			return;
		}

		if (this._history.length === 0) {
			clearNode(this._msgList);
		}

		this._history.push({ role: 'user', content: text });
		this._appendBubble('user', text);
		this._textarea.value = '';
		this._textarea.style.height = 'auto';
		this._sendBtn.disabled = true;
		this._busy = true;

		const typing = this._appendTypingIndicator();

		this._busyCts = new CancellationTokenSource();
		try {
			const messages: ICompyleChatMessage[] = [];

			// Inject context items as a system context prefix
			if (this._contextItems.length > 0) {
				const contextBlock = this._contextItems.map(c => `[${c.label}]\n${c.content}`).join('\n\n---\n\n');
				messages.push({ role: 'user', content: `Context for this conversation:\n\n${contextBlock}` });
				messages.push({ role: 'assistant', content: 'Understood. I have read the context above and will use it to assist you.' });
			}

			for (const m of this._history.slice(0, -1)) {
				messages.push({ role: m.role, content: m.content });
			}
			messages.push({ role: 'user', content: text });

			const reply = await this._brainService.chat(messages, { silent: false }, this._busyCts.token);
			this._history.push({ role: 'assistant', content: reply });
			typing.remove();
			this._appendBubble('assistant', reply);
			this._scrollToBottom();
		} catch (err: unknown) {
			typing.remove();
			const errMsg = err instanceof Error ? err.message : String(err);
			this._history.push({ role: 'assistant', content: `⚠ ${errMsg}` });
			this._appendBubble('assistant', `⚠ ${errMsg}`);
			this._scrollToBottom();
		} finally {
			this._busyCts?.dispose();
			this._busyCts = undefined;
			this._busy = false;
			this._sendBtn.disabled = false;
			this._textarea.focus();
		}
	}

	private _clearHistory(): void {
		this._history.length = 0;
		this._renderEmptyState();
	}

	// ---- Model refresh --------------------------------------------------

	private async _refreshModels(): Promise<void> {
		try {
			const models = await this._brainService.listLocalModels();
			clearNode(this._modelSelect);

			if (models.length === 0) {
				const empty = append(this._modelSelect, $('option')) as HTMLOptionElement;
				empty.value = '';
				empty.textContent = localize('compyleChat.noModels', "No models installed");
				empty.disabled = true;
				this._ollamaBanner.classList.remove('hidden');
				return;
			}

			this._ollamaBanner.classList.add('hidden');

			const currentModel = this._configurationService.getValue<string>('compyle.brain.model') || '';
			for (const m of models) {
				const opt = append(this._modelSelect, $('option')) as HTMLOptionElement;
				opt.value = m.name;
				opt.textContent = m.name;
			}
			this._modelSelect.value = currentModel || models[0].name;
			if (!currentModel && models.length > 0) {
				this._configurationService.updateValue('compyle.brain.model', models[0].name);
			}
		} catch {
			// Ollama not running
			clearNode(this._modelSelect);
			const errOpt = append(this._modelSelect, $('option')) as HTMLOptionElement;
			errOpt.value = '';
			errOpt.textContent = localize('compyleChat.ollamaDown', "Ollama not running");
			errOpt.disabled = true;
			this._ollamaBanner.classList.remove('hidden');
		}
	}

	private _refreshStatus(): void {
		const configured = this._brainService.isConfigured();
		clearNode(this._statusPill);
		if (configured) {
			this._statusPill.className = 'cpc-status-pill ok';
			append(this._statusPill, $('.cpc-status-dot'));
			append(this._statusPill, $('span', undefined, localize('compyleChat.connected', "Connected")));
		} else {
			this._statusPill.className = 'cpc-status-pill error';
			append(this._statusPill, $('.cpc-status-dot'));
			append(this._statusPill, $('span', undefined, localize('compyleChat.notConfigured', "Configure AI in Settings")));
		}
	}

	private _refreshModeSelect(): void {
		const currentMode = this._configurationService.getValue<string>(COMPYLE_AGENT_MODE_SETTING) || 'code';
		if (this._modeSelect) {
			this._modeSelect.value = currentMode;
		}
	}

	// ---- Ollama startup -------------------------------------------------

	private async _startOllama(): Promise<void> {
		if (this._startingOllama) {
			return;
		}
		this._startingOllama = true;
		this._notificationService.info(localize('compyleChat.startingOllama', "Starting Ollama in the terminal…"));
		try {
			const terminal = await this._terminalService.createTerminal({ config: { name: 'Ollama' } });
			this._terminalGroupService.showPanel(true);
			terminal.sendText('ollama serve', true);

			for (let i = 0; i < 16; i++) {
				await timeout(1000);
				try {
					await this._brainService.listLocalModels();
					this._notificationService.notify({ message: localize('compyleChat.ollamaStarted', "Ollama is running!"), severity: Severity.Info });
					this._ollamaBanner.classList.add('hidden');
					await this._refreshModels();
					return;
				} catch {
					// still starting
				}
			}
			this._notificationService.warn(localize('compyleChat.ollamaTimeout', "Ollama did not start within 16 seconds. Try 'ollama serve' in a terminal."));
		} finally {
			this._startingOllama = false;
		}
	}

	// ---- GitHub search --------------------------------------------------

	private async _searchGitHub(): Promise<void> {
		const picker = this._quickInputService.createQuickPick<IQuickPickItem & { repo: IGitHubRepo }>();
		picker.placeholder = localize('compyleChat.githubSearchPlaceholder', "Search GitHub public repos (e.g. react-query, express, zustand)");
		picker.matchOnDescription = true;
		picker.matchOnDetail = true;

		let debounceId: ReturnType<typeof setTimeout> | undefined;
		this._disposables.add(picker.onDidChangeValue(async (query) => {
			if (debounceId !== undefined) {
				clearTimeout(debounceId);
			}
			if (!query.trim()) {
				picker.items = [];
				return;
			}
			debounceId = setTimeout(async () => {
				picker.busy = true;
				try {
					const cts = new CancellationTokenSource();
					const res = await this._requestService.request({
						type: 'GET',
						url: `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=8&sort=stars`,
						headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CompyleCode/1.0' },
						callSite: 'compyleChat.githubSearch',
					}, cts.token);
					const json = await asJson<{ items?: IGitHubRepo[] }>(res);
					const repos = json?.items ?? [];
					picker.items = repos.map(r => ({
						label: r.full_name,
						// allow-any-unicode-next-line
						description: `⭐ ${r.stargazers_count.toLocaleString()}`,
						detail: r.description || '',
						repo: r,
					}));
				} catch {
					picker.items = [];
				} finally {
					picker.busy = false;
				}
			}, 400);
		}));

		this._disposables.add(picker.onDidAccept(async () => {
			const selected = picker.selectedItems[0];
			if (!selected) {
				return;
			}
			picker.hide();
			const repo = selected.repo;
			this._notificationService.info(localize('compyleChat.fetchingReadme', "Fetching README from {0}…", repo.full_name));
			try {
				const cts = new CancellationTokenSource();
				const readmeRes = await this._requestService.request({
					type: 'GET',
					url: `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/README.md`,
					headers: { 'User-Agent': 'CompyleCode/1.0' },
					callSite: 'compyleChat.readmeDownload',
				}, cts.token);
				const text = await asText(readmeRes) ?? '';
				const trimmed = text.slice(0, 6000); // keep it manageable
				this._contextItems.push({ label: `GitHub: ${repo.full_name}`, content: trimmed });
				this._renderContextStrip();
			} catch {
				this._notificationService.warn(localize('compyleChat.readmeFailed', "Could not fetch README from {0}.", repo.full_name));
			}
		}));

		picker.show();
	}

	private _renderContextStrip(): void {
		clearNode(this._contextStrip);
		for (let i = 0; i < this._contextItems.length; i++) {
			const item = this._contextItems[i];
			const chip = append(this._contextStrip, $('.cpc-context-chip'));
			// allow-any-unicode-next-line
			append(chip, $('span', undefined, `📦 ${item.label}`));
			const removeBtn = append(chip, $('button.cpc-context-chip-remove', undefined, '×')) as HTMLButtonElement;
			const idx = i;
			this._disposables.add(addDisposableListener(removeBtn, 'click', () => {
				this._contextItems.splice(idx, 1);
				this._renderContextStrip();
			}));
		}
	}

	override async setInput(input: CompyleChatInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: import('../../../../base/common/cancellation.js').CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this._refreshStatus();
		// Only auto-load models if provider is Ollama or LMStudio.
		const config = this._brainService.getConfig();
		if (config.provider === CompyleBrainProvider.Ollama || config.provider === CompyleBrainProvider.LMStudio) {
			await this._refreshModels();
		} else {
			clearNode(this._modelSelect);
			const opt = append(this._modelSelect, $('option')) as HTMLOptionElement;
			const modelName = config.model || localize('compyleChat.noModelSet', "No model set");
			opt.value = modelName;
			opt.textContent = modelName;
			this._ollamaBanner.classList.add('hidden');
		}
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}

	override dispose(): void {
		this._busyCts?.cancel();
		this._busyCts?.dispose();
		super.dispose();
	}
}
