/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleChat.css';
import { $, append, clearNode, addDisposableListener } from '../../../../base/browser/dom.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { timeout } from '../../../../base/common/async.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { encodeBase64 } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IRequestService, asJson, asText } from '../../../../platform/request/common/request.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ITerminalService, ITerminalGroupService } from '../../terminal/browser/terminal.js';
import { CompyleBrainProvider } from '../common/compyleBrain.js';
import { ICompyleBrainService, ICompyleChatMessage } from './compyleBrainService.js';
import { ICompyleAgentService, ICompyleAgentEvent } from './compyleAgentService.js';
import { ICompyleChatHistoryService } from './compyleChatHistoryService.js';
import { ICompyleMemoryService } from './compyleMemoryService.js';
import { ICompyleSkillService } from '../../compyleSkillStudio/browser/compyleSkillService.js';
import { ICompyleSkill } from '../../compyleSkillStudio/common/compyleSkills.js';
import { ICompyleRouterService } from '../../compyleRouter/browser/compyleRouterService.js';
import { ICompyleRouterTrainingService } from './compyleRouterTrainingService.js';
import { simpleLineDiff } from '../common/compyleDiff.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { COMPYLE_AGENT_MODE_SETTING, COMPYLE_AGENT_MODES } from '../common/compyleAgentModes.js';

interface IContextItem {
	readonly label: string;
	readonly content: string;
}

interface IChatMessage {
	readonly role: 'user' | 'assistant';
	readonly content: string;
	readonly images?: readonly string[];
}

/** Model families known to accept images via Ollama's /api/chat. */
const VISION_MODEL_HINTS = ['llava', 'llama3.2-vision', 'llama-3.2-vision', 'bakllava', 'moondream', 'minicpm-v', 'qwen2-vl', 'qwen2.5-vl'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

/** Heuristic for spotting a failed command run so we can offer to remember the mistake. */
function looksLikeFailure(output: string): boolean {
	return /\b(error|exception|traceback|failed|failure|not found|cannot find|undefined is not|syntaxerror|cannot read|enoent)\b/i.test(output);
}

interface IGitHubRepo {
	full_name: string;
	description: string;
	stargazers_count: number;
	default_branch: string;
}

/** Largest slice of the active file we send as context, in characters. */
const ACTIVE_FILE_CONTEXT_LIMIT = 12000;
/** Largest README slice we keep when adding a GitHub repo as context. */
const README_CONTEXT_LIMIT = 6000;
/** How many top-level workspace entries we list for project context. */
const PROJECT_TREE_LIMIT = 80;

/**
 * The full Compyle AI chat experience, hostable inside either an editor pane or
 * an auxiliary-bar view. It owns the model picker, the conversation, GitHub
 * search context, and — importantly — automatic awareness of the project and
 * the files the user currently has open.
 */
export class CompyleChatWidget extends Disposable {

	private _root!: HTMLElement;
	private _modelSelect!: HTMLSelectElement;
	private _modeSelect!: HTMLSelectElement;
	private _statusPill!: HTMLElement;
	private _ollamaBanner!: HTMLElement;
	private _contextInfo!: HTMLElement;
	private _contextStrip!: HTMLElement;
	private _msgList!: HTMLElement;
	private _textarea!: HTMLTextAreaElement;
	private _sendBtn!: HTMLButtonElement;
	private _contextToggle!: HTMLButtonElement;
	private _fullControlBtn!: HTMLButtonElement;
	private _attachStrip!: HTMLElement;
	private _skillStrip!: HTMLElement;
	private _trainingBtn!: HTMLButtonElement;
	private _pendingImages: { name: string; base64: string }[] = [];
	private _activeSkills: { name: string; body: string }[] = [];
	private _lastUserText = '';

	/** Full conversation context sent to the model (user inputs, assistant replies, tool results). */
	private readonly _context: IChatMessage[] = [];
	/** The user-visible turns (real user inputs + assistant replies), used for re-render and history. */
	private readonly _visible: IChatMessage[] = [];
	private readonly _contextItems: IContextItem[] = [];
	private _useProjectContext = true;
	private _busy = false;
	private _busyCts: CancellationTokenSource | undefined;
	private _startingOllama = false;
	private _rendered = false;
	private _sessionId = generateUuid();
	private _saveHandle: ReturnType<typeof setTimeout> | undefined;

	private readonly _disposables = this._register(new DisposableStore());

	constructor(
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@ICompyleAgentService private readonly _agentService: ICompyleAgentService,
		@ICompyleChatHistoryService private readonly _historyService: ICompyleChatHistoryService,
		@ICompyleMemoryService private readonly _memoryService: ICompyleMemoryService,
		@ICompyleSkillService private readonly _skillService: ICompyleSkillService,
		@ICompyleRouterService private readonly _routerService: ICompyleRouterService,
		@ICompyleRouterTrainingService private readonly _trainingService: ICompyleRouterTrainingService,
		@ICommandService private readonly _commandService: ICommandService,
		@IMarkdownRendererService private readonly _markdownRendererService: IMarkdownRendererService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IRequestService private readonly _requestService: IRequestService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IEditorService private readonly _editorService: IEditorService,
		@IModelService private readonly _modelService: IModelService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly _fileService: IFileService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@ILabelService private readonly _labelService: ILabelService,
	) {
		super();
	}

	/** Build the chat UI into the given container. Call once per host. */
	render(parent: HTMLElement): void {
		this._root = append(parent, $('.cpc-root'));
		this._buildHeader();
		this._buildModelBar();
		this._buildContextInfo();
		this._buildOllamaBanner();
		this._buildContextStrip();
		this._buildMessages();
		this._buildInputArea();
		this._rendered = true;

		this._disposables.add(this._brainService.onDidChangeConfig(() => this._refreshStatus()));
		this._disposables.add(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(COMPYLE_AGENT_MODE_SETTING)) {
				this._refreshModeSelect();
			}
			if (e.affectsConfiguration('compyle.brain.agentEditing')) {
				this._updateFullControlLabel();
			}
			if (e.affectsConfiguration('compyle.router.trainingEnabled') || e.affectsConfiguration('compyle.router.trainingTarget')) {
				this._updateTrainingLabel();
			}
		}));
		this._disposables.add(this._editorService.onDidActiveEditorChange(() => this._updateContextInfo()));
		this._disposables.add(this._editorService.onDidVisibleEditorsChange(() => this._updateContextInfo()));

		this._updateContextInfo();
	}

	/** Refresh status + model list. Call when the host becomes visible. */
	async show(): Promise<void> {
		if (!this._rendered) {
			return;
		}
		this._refreshStatus();
		this._updateContextInfo();
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

	focusInput(): void {
		this._textarea?.focus();
	}

	// ---- UI construction --------------------------------------------------

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

		this._fullControlBtn = append(right, $('button.cpc-btn.small')) as HTMLButtonElement;
		this._updateFullControlLabel();
		this._disposables.add(addDisposableListener(this._fullControlBtn, 'click', () => {
			const auto = this._configurationService.getValue<string>('compyle.brain.agentEditing') === 'auto';
			this._configurationService.updateValue('compyle.brain.agentEditing', auto ? 'approve' : 'auto');
		}));

		const newChatBtn = append(right, $('button.cpc-btn.small')) as HTMLButtonElement;
		append(newChatBtn, $('span.codicon.codicon-add'));
		newChatBtn.title = localize('compyleChat.newChat', "New Chat");
		this._disposables.add(addDisposableListener(newChatBtn, 'click', () => this._newChat()));

		const historyBtn = append(right, $('button.cpc-btn.small')) as HTMLButtonElement;
		append(historyBtn, $('span.codicon.codicon-history'));
		historyBtn.title = localize('compyleChat.history', "Chat History");
		this._disposables.add(addDisposableListener(historyBtn, 'click', () => this._openHistory()));

		const settingsBtn = append(right, $('button.cpc-btn.small'));
		append(settingsBtn, $('span.codicon.codicon-gear'));
		settingsBtn.title = localize('compyleChat.settings', "Compyle AI Settings");
		this._disposables.add(addDisposableListener(settingsBtn, 'click', () => {
			this._commandService.executeCommand('workbench.action.openSettings', 'compyle.brain');
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

	private _buildContextInfo(): void {
		const row = append(this._root, $('.cpc-context-info'));
		this._contextInfo = append(row, $('.cpc-context-info-text'));

		this._contextToggle = append(row, $('button.cpc-context-info-toggle')) as HTMLButtonElement;
		this._updateContextToggleLabel();
		this._disposables.add(addDisposableListener(this._contextToggle, 'click', () => {
			this._useProjectContext = !this._useProjectContext;
			this._updateContextToggleLabel();
			this._updateContextInfo();
		}));
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
		const attachBtn = append(toolbar, $('button.cpc-tool-btn'));
		append(attachBtn, $('span.codicon.codicon-attach'));
		append(attachBtn, $('span', undefined, localize('compyleChat.attach', "Attach")));
		this._disposables.add(addDisposableListener(attachBtn, 'click', () => this._attachFiles()));

		const skillsBtn = append(toolbar, $('button.cpc-tool-btn'));
		append(skillsBtn, $('span.codicon.codicon-lightbulb'));
		append(skillsBtn, $('span', undefined, localize('compyleChat.useSkills', "Use Skills")));
		this._disposables.add(addDisposableListener(skillsBtn, 'click', () => this._chooseSkills()));

		const createSkillBtn = append(toolbar, $('button.cpc-tool-btn'));
		append(createSkillBtn, $('span.codicon.codicon-sparkle'));
		append(createSkillBtn, $('span', undefined, localize('compyleChat.createSkill', "Create Skill")));
		this._disposables.add(addDisposableListener(createSkillBtn, 'click', () => this._createSkillFromChat()));

		this._trainingBtn = append(toolbar, $('button.cpc-tool-btn')) as HTMLButtonElement;
		this._updateTrainingLabel();
		this._disposables.add(addDisposableListener(this._trainingBtn, 'click', () => this._toggleRouterTraining()));

		const githubBtn = append(toolbar, $('button.cpc-tool-btn'));
		append(githubBtn, $('span.codicon.codicon-github'));
		append(githubBtn, $('span', undefined, localize('compyleChat.githubSearch', "Search GitHub")));
		this._disposables.add(addDisposableListener(githubBtn, 'click', () => this._searchGitHub()));

		this._skillStrip = append(area, $('.cpc-skill-strip'));
		this._attachStrip = append(area, $('.cpc-attach-strip'));

		const row = append(area, $('.cpc-input-row'));
		this._textarea = append(row, $('textarea.cpc-textarea')) as HTMLTextAreaElement;
		this._textarea.placeholder = localize('compyleChat.placeholder', "Ask Compyle AI about your code…");
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

		this._sendBtn = append(row, $('button.cpc-send-btn', undefined, localize('compyleChat.send', "Send"))) as HTMLButtonElement;
		this._disposables.add(addDisposableListener(this._sendBtn, 'click', () => this._send()));
	}

	// ---- Attachments ------------------------------------------------------

	private async _attachFiles(): Promise<void> {
		const uris = await this._fileDialogService.showOpenDialog({
			title: localize('compyleChat.attachTitle', "Attach Images or Files"),
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			filters: [
				{ name: localize('compyleChat.images', "Images"), extensions: IMAGE_EXTENSIONS },
				{ name: localize('compyleChat.allFiles', "All Files"), extensions: ['*'] },
			],
		});
		if (!uris || uris.length === 0) {
			return;
		}
		for (const uri of uris) {
			const ext = (uri.path.split('.').pop() ?? '').toLowerCase();
			const name = this._labelService.getUriBasenameLabel(uri);
			try {
				const content = await this._fileService.readFile(uri);
				if (IMAGE_EXTENSIONS.includes(ext)) {
					this._pendingImages.push({ name, base64: encodeBase64(content.value) });
				} else {
					// Non-image files become text context, capped to keep the prompt manageable.
					this._contextItems.push({ label: name, content: content.value.toString().slice(0, 20000) });
					this._renderContextStrip();
				}
			} catch {
				this._notificationService.warn(localize('compyleChat.attachFailed', "Could not read {0}.", name));
			}
		}
		this._renderAttachStrip();
		this._maybeWarnVision();
	}

	private _renderAttachStrip(): void {
		clearNode(this._attachStrip);
		for (let i = 0; i < this._pendingImages.length; i++) {
			const chip = append(this._attachStrip, $('.cpc-attach-chip'));
			append(chip, $('span.codicon.codicon-file-media'));
			append(chip, $('span', undefined, this._pendingImages[i].name));
			const removeBtn = append(chip, $('button.cpc-context-chip-remove')) as HTMLButtonElement;
			append(removeBtn, $('span.codicon.codicon-close'));
			const idx = i;
			this._disposables.add(addDisposableListener(removeBtn, 'click', () => {
				this._pendingImages.splice(idx, 1);
				this._renderAttachStrip();
			}));
		}
	}

	private _maybeWarnVision(): void {
		if (this._pendingImages.length === 0) {
			return;
		}
		const model = (this._configurationService.getValue<string>('compyle.brain.model') || '').toLowerCase();
		if (!VISION_MODEL_HINTS.some(h => model.includes(h))) {
			this._notificationService.info(localize('compyleChat.notVision', "The current model may not be able to see images. Try a vision model such as llava or llama3.2-vision."));
		}
	}

	private _renderEmptyState(): void {
		clearNode(this._msgList);
		const empty = append(this._msgList, $('.cpc-empty-state'));
		append(empty, $('.cpc-empty-icon.codicon.codicon-robot'));
		append(empty, $('p.cpc-empty-title', undefined, localize('compyleChat.emptyTitle', "Compyle AI")));
		append(empty, $('p.cpc-empty-hint', undefined, localize('compyleChat.emptyHint', "Pick a local model above and ask anything. Compyle AI can see your open files and project — ask it to explain, fix, or extend your code.")));
	}

	/** Create a message shell with a role row + "add to memory" action. `getContent` reads the message text lazily. */
	private _createBubbleShell(role: 'user' | 'assistant', getContent: () => string): HTMLElement {
		const wrap = append(this._msgList, $(`.cpc-msg.${role}`));
		const roleRow = append(wrap, $('.cpc-msg-role-row'));
		append(roleRow, $('span.cpc-msg-role', undefined, role === 'user' ? localize('compyleChat.you', "You") : localize('compyleChat.ai', "Compyle AI")));
		const memBtn = append(roleRow, $('button.cpc-msg-action')) as HTMLButtonElement;
		append(memBtn, $('span.codicon.codicon-bookmark'));
		memBtn.title = localize('compyleChat.addMemory', "Add to long-term memory");
		this._disposables.add(addDisposableListener(memBtn, 'click', () => this._addToMemory(getContent())));
		return append(wrap, $('.cpc-bubble'));
	}

	private _appendBubble(role: 'user' | 'assistant', content: string): HTMLElement {
		const bubble = this._createBubbleShell(role, () => content);
		if (role === 'assistant') {
			this._disposables.add(this._renderMarkdownInto(bubble, content));
		} else {
			bubble.textContent = content;
		}
		return bubble;
	}

	/**
	 * Render assistant text as markdown so code blocks are syntax-highlighted and
	 * distinct from prose. The workbench wires an editor-based code-block renderer
	 * into the markdown service, so we get highlighting for free.
	 */
	private _renderMarkdownInto(bubble: HTMLElement, text: string): IDisposable {
		clearNode(bubble);
		const md = new MarkdownString(text);
		md.isTrusted = false;
		const rendered = this._markdownRendererService.render(md);
		bubble.appendChild(rendered.element);
		return rendered;
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

	// ---- Sending ----------------------------------------------------------

	private async _send(): Promise<void> {
		const text = this._textarea.value.trim();
		if (!text || this._busy) {
			return;
		}
		this._lastUserText = text;

		if (this._context.length === 0) {
			clearNode(this._msgList);
		}

		const images = this._pendingImages.length ? this._pendingImages.map(i => i.base64) : undefined;
		const imageNames = this._pendingImages.map(i => i.name);
		this._context.push({ role: 'user', content: text, images });
		this._visible.push({ role: 'user', content: text, images });
		const userBubble = this._appendBubble('user', text);
		if (imageNames.length) {
			// allow-any-unicode-next-line
			append(userBubble, $('.cpc-attach-note', undefined, localize('compyleChat.attachedNote', "📎 {0} image(s): {1}", imageNames.length, imageNames.join(', '))));
		}
		this._pendingImages = [];
		this._renderAttachStrip();
		this._textarea.value = '';
		this._textarea.style.height = 'auto';
		this._sendBtn.disabled = true;
		this._busy = true;

		const typing = this._appendTypingIndicator();

		// Per-turn live-render state for the streaming assistant bubble(s).
		let liveBubble: HTMLElement | undefined;
		let liveHolder: { text: string } | undefined;
		let liveBuffer = '';
		let liveRender: IDisposable | undefined;
		let renderScheduled = false;
		let lastFailure: string | undefined;
		const reRender = () => {
			if (liveBubble) {
				if (liveHolder) {
					liveHolder.text = liveBuffer;
				}
				liveRender?.dispose();
				liveRender = this._renderMarkdownInto(liveBubble, liveBuffer);
				this._scrollToBottom();
			}
		};
		const ensureLiveBubble = () => {
			typing.remove();
			if (!liveBubble) {
				liveHolder = { text: '' };
				liveBubble = this._createBubbleShell('assistant', () => liveHolder?.text ?? '');
				liveBuffer = '';
			}
		};
		const sealLiveBubble = (finalText: string) => {
			if (liveBubble) {
				liveBuffer = finalText;
				if (liveHolder) {
					liveHolder.text = finalText;
				}
				liveRender?.dispose();
				liveRender = this._renderMarkdownInto(liveBubble, liveBuffer);
				this._disposables.add(liveRender);
			}
			liveBubble = undefined;
			liveHolder = undefined;
			liveRender = undefined;
			liveBuffer = '';
			renderScheduled = false;
		};

		const onEvent = (e: ICompyleAgentEvent): void => {
			switch (e.type) {
				case 'token':
					ensureLiveBubble();
					liveBuffer += e.delta;
					if (!renderScheduled) {
						renderScheduled = true;
						setTimeout(() => { renderScheduled = false; reRender(); }, 80);
					}
					break;
				case 'assistant-done':
					sealLiveBubble(e.text);
					if (e.text.trim()) {
						this._visible.push({ role: 'assistant', content: e.text });
					}
					break;
				case 'diff':
					this._appendDiffCard(e.path, e.original, e.modified, e.accept, e.reject);
					break;
				case 'applied':
					this._appendStatusRow('codicon-check', localize('compyleChat.appliedEdit', "Applied edit to {0}", e.path));
					break;
				case 'rejected':
					this._appendStatusRow('codicon-close', localize('compyleChat.rejectedEdit', "Rejected edit to {0}", e.path));
					break;
				case 'run-output':
					this._appendStatusRow('codicon-terminal', localize('compyleChat.ranCommand', "Ran: {0}", e.command));
					if (looksLikeFailure(e.output)) {
						lastFailure = e.output;
					}
					break;
				case 'error':
					this._appendStatusRow('codicon-warning', e.message);
					break;
			}
		};

		this._busyCts = new CancellationTokenSource();
		try {
			const messages = await this._buildAgentMessages();
			const result = await this._agentService.run(messages, onEvent, this._busyCts.token);
			this._context.push(...result.transcriptAdditions);
			typing.remove();
			this._scrollToBottom();
			this._scheduleSave();
			if (lastFailure) {
				const trainingEnabled = this._configurationService.getValue<boolean>('compyle.router.trainingEnabled') === true;
				const trainingTarget = this._configurationService.getValue<string>('compyle.router.trainingTarget') || '';
				if (trainingEnabled && trainingTarget) {
					// Router training is on: silently learn a rule from the failure.
					const rule = await this._trainingService.synthesizeFromFailure({ prompt: this._lastUserText, output: lastFailure, routerName: trainingTarget });
					if (rule) {
						this._appendStatusRow('codicon-git-merge', localize('compyleChat.trainedRule', "Router training: added rule \"{0}\" to {1}", rule.name, trainingTarget));
					}
				} else {
					await this._offerMistakeCapture(lastFailure);
				}
			}
		} catch (err: unknown) {
			typing.remove();
			sealLiveBubble(liveBuffer);
			const errMsg = err instanceof Error ? err.message : String(err);
			this._appendStatusRow('codicon-warning', errMsg);
			this._scrollToBottom();
		} finally {
			this._busyCts?.dispose();
			this._busyCts = undefined;
			this._busy = false;
			this._sendBtn.disabled = false;
			this._textarea.focus();
		}
	}

	/** Build the message list for the agent: ephemeral project/context preamble + the conversation so far. */
	private async _buildAgentMessages(): Promise<ICompyleChatMessage[]> {
		const messages: ICompyleChatMessage[] = [];
		const contextBlocks: string[] = [];
		if (this._activeSkills.length > 0) {
			const skillsText = this._activeSkills.map(s => `## Skill: ${s.name}\n${s.body}`).join('\n\n');
			contextBlocks.push(`Active skills you must follow:\n\n${skillsText}`);
		}
		if (this._useProjectContext) {
			const projectContext = await this._gatherWorkspaceContext();
			if (projectContext) {
				contextBlocks.push(projectContext);
			}
		}
		for (const item of this._contextItems) {
			contextBlocks.push(`[${item.label}]\n${item.content}`);
		}
		if (contextBlocks.length > 0) {
			messages.push({ role: 'user', content: `Context for this conversation — the user's open project and files:\n\n${contextBlocks.join('\n\n---\n\n')}` });
			messages.push({ role: 'assistant', content: 'Understood. I can see your project and the files you have open, and I will use them to help.' });
		}
		for (const m of this._context) {
			messages.push({ role: m.role, content: m.content, images: m.images });
		}
		return messages;
	}

	private _appendStatusRow(codicon: string, text: string): void {
		const row = append(this._msgList, $('.cpc-status-row'));
		append(row, $(`span.codicon.${codicon}`));
		append(row, $('span', undefined, text));
		this._scrollToBottom();
	}

	private _appendDiffCard(path: string, original: string, modified: string, accept: () => void, reject: () => void): void {
		const card = append(this._msgList, $('.cpc-diff'));
		const head = append(card, $('.cpc-diff-head'));
		append(head, $('span.codicon.codicon-diff-single'));
		append(head, $('span.cpc-diff-path', undefined, path));

		const body = append(card, $('.cpc-diff-body'));
		const { removed, added } = simpleLineDiff(original, modified);
		for (const line of removed) {
			append(body, $('.cpc-diff-line.del', undefined, `- ${line}`));
		}
		for (const line of added) {
			append(body, $('.cpc-diff-line.add', undefined, `+ ${line}`));
		}

		const actions = append(card, $('.cpc-diff-actions'));
		const applyBtn = append(actions, $('button.cpc-btn.primary.small', undefined, localize('compyleChat.apply', "Apply"))) as HTMLButtonElement;
		const rejectBtn = append(actions, $('button.cpc-btn.small', undefined, localize('compyleChat.reject', "Reject"))) as HTMLButtonElement;
		const settle = (decision: () => void, label: string) => {
			applyBtn.disabled = true;
			rejectBtn.disabled = true;
			clearNode(actions);
			append(actions, $('span.cpc-diff-settled', undefined, label));
			decision();
		};
		this._disposables.add(addDisposableListener(applyBtn, 'click', () => settle(accept, localize('compyleChat.applied', "Applied"))));
		this._disposables.add(addDisposableListener(rejectBtn, 'click', () => settle(reject, localize('compyleChat.rejected', "Rejected"))));
		this._scrollToBottom();
	}

	// ---- Chat history (sessions) -----------------------------------------

	private _newChat(): void {
		this._saveSession();
		this._context.length = 0;
		this._visible.length = 0;
		this._contextItems.length = 0;
		this._renderContextStrip();
		this._sessionId = generateUuid();
		this._renderEmptyState();
	}

	private async _openHistory(): Promise<void> {
		const sessions = this._historyService.list();
		if (sessions.length === 0) {
			this._notificationService.info(localize('compyleChat.noHistory', "No saved chats yet."));
			return;
		}
		const picks = sessions.map(s => ({
			id: s.id,
			label: s.title || localize('compyleChat.untitled', "Untitled chat"),
			description: new Date(s.updatedAt).toLocaleString(),
		}));
		const picked = await this._quickInputService.pick(picks, { placeHolder: localize('compyleChat.pickChat', "Open a previous chat") });
		if (!picked) {
			return;
		}
		const session = this._historyService.load(picked.id);
		if (!session) {
			return;
		}
		this._saveSession();
		this._sessionId = session.id;
		this._context.length = 0;
		this._context.push(...session.context);
		this._visible.length = 0;
		this._visible.push(...session.visible);
		this._renderVisible();
	}

	private _renderVisible(): void {
		clearNode(this._msgList);
		if (this._visible.length === 0) {
			this._renderEmptyState();
			return;
		}
		for (const m of this._visible) {
			this._appendBubble(m.role, m.content);
		}
		this._scrollToBottom();
	}

	private _saveSession(): void {
		if (this._visible.length === 0) {
			return;
		}
		const firstUser = this._visible.find(m => m.role === 'user');
		const title = (firstUser?.content ?? localize('compyleChat.untitled', "Untitled chat")).slice(0, 60);
		const now = Date.now();
		const existing = this._historyService.load(this._sessionId);
		this._historyService.save({
			id: this._sessionId,
			title,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
			context: this._context.map(m => ({ role: m.role, content: m.content, images: m.images })),
			visible: this._visible.map(m => ({ role: m.role, content: m.content, images: m.images })),
		});
	}

	private _scheduleSave(): void {
		if (this._saveHandle !== undefined) {
			clearTimeout(this._saveHandle);
		}
		this._saveHandle = setTimeout(() => {
			this._saveHandle = undefined;
			this._saveSession();
		}, 600);
	}

	// ---- Skills -----------------------------------------------------------

	private _readPresets(): Record<string, string[]> {
		const raw = this._configurationService.getValue<Record<string, string[]>>('compyle.brain.skillPresets');
		return raw && typeof raw === 'object' ? raw : {};
	}

	private async _chooseSkills(): Promise<void> {
		const files = await this._skillService.listSkills();
		if (files.length === 0) {
			this._notificationService.info(localize('compyleChat.noSkills', "No skills found. Create them in Skill Studio or with \"Create Skill\"."));
			return;
		}
		const presets = this._readPresets();
		type SkillPick = IQuickPickItem & { skill?: ICompyleSkill; presetName?: string };
		const items: (SkillPick | IQuickPickSeparator)[] = [];
		const presetNames = Object.keys(presets);
		if (presetNames.length) {
			items.push({ type: 'separator', label: localize('compyleChat.presets', "Presets") });
			for (const name of presetNames) {
				items.push({ label: name, description: localize('compyleChat.presetSkills', "Preset · {0} skill(s)", presets[name].length), presetName: name });
			}
		}
		items.push({ type: 'separator', label: localize('compyleChat.skillsLabel', "Skills") });
		for (const f of files) {
			items.push({ label: f.skill.name, description: f.skill.description, skill: f.skill, picked: this._activeSkills.some(s => s.name === f.skill.name) });
		}

		const picked = await this._quickInputService.pick(items, { canPickMany: true, placeHolder: localize('compyleChat.pickSkills', "Select skills to guide Compyle AI (added to every message)") });
		if (!picked) {
			return;
		}

		const byName = new Map(files.map(f => [f.skill.name, f.skill]));
		const active = new Map<string, ICompyleSkill>();
		for (const p of picked) {
			if (p.presetName) {
				for (const n of presets[p.presetName] ?? []) {
					const s = byName.get(n);
					if (s) {
						active.set(n, s);
					}
				}
			} else if (p.skill) {
				active.set(p.skill.name, p.skill);
			}
		}
		this._activeSkills = [...active.values()].map(s => ({ name: s.name, body: s.body }));
		this._renderSkillChips();

		if (this._activeSkills.length > 0) {
			await this._maybeSavePreset();
		}
	}

	private async _maybeSavePreset(): Promise<void> {
		const choice = await this._quickInputService.pick(
			[
				{ label: localize('compyleChat.done', "Done"), id: 'done' },
				{ label: localize('compyleChat.savePreset', "Save this set as a preset…"), id: 'save' },
			],
			{ placeHolder: localize('compyleChat.savePresetQ', "Save this skill selection as a reusable preset?") },
		);
		if (!choice || choice.id !== 'save') {
			return;
		}
		const name = await this._quickInputService.input({ title: localize('compyleChat.presetName', "Preset name"), placeHolder: localize('compyleChat.presetNamePh', "e.g. Frontend, Security review") });
		if (!name) {
			return;
		}
		const presets = this._readPresets();
		presets[name] = this._activeSkills.map(s => s.name);
		await this._configurationService.updateValue('compyle.brain.skillPresets', presets);
		this._notificationService.info(localize('compyleChat.presetSaved', "Saved preset \"{0}\".", name));
	}

	private _renderSkillChips(): void {
		clearNode(this._skillStrip);
		for (let i = 0; i < this._activeSkills.length; i++) {
			const chip = append(this._skillStrip, $('.cpc-skill-chip'));
			append(chip, $('span.codicon.codicon-lightbulb'));
			append(chip, $('span', undefined, this._activeSkills[i].name));
			const removeBtn = append(chip, $('button.cpc-context-chip-remove')) as HTMLButtonElement;
			append(removeBtn, $('span.codicon.codicon-close'));
			const idx = i;
			this._disposables.add(addDisposableListener(removeBtn, 'click', () => {
				this._activeSkills.splice(idx, 1);
				this._renderSkillChips();
			}));
		}
	}

	private async _createSkillFromChat(): Promise<void> {
		if (this._visible.length === 0) {
			this._notificationService.info(localize('compyleChat.skillNeedsChat', "Have a conversation first, then create a skill from it."));
			return;
		}
		const transcript = this._visible.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n').slice(0, 8000);
		const prompt = 'From the following conversation, distill a reusable Compyle skill. Respond with ONLY a JSON object and nothing else: {"name": "short title", "description": "one sentence", "tags": ["tag1"], "trigger": ["keyword"], "body": "markdown instructions the assistant should follow"}.\n\nConversation:\n' + transcript;
		this._notificationService.info(localize('compyleChat.creatingSkill', "Creating a skill from this chat…"));
		try {
			const reply = await this._brainService.chat([{ role: 'user', content: prompt }], { maxTokens: 1024, silent: true });
			const skill = this._extractSkill(reply);
			if (!skill) {
				this._notificationService.warn(localize('compyleChat.skillParseFailed', "Could not read a skill from the model's reply. Try again or create one in Skill Studio."));
				return;
			}
			await this._skillService.saveSkill(skill);
			this._notificationService.info(localize('compyleChat.skillSaved', "Saved skill \"{0}\" to Skill Studio.", skill.name));
		} catch (err) {
			this._notificationService.warn(err instanceof Error ? err.message : String(err));
		}
	}

	private _extractSkill(reply: string): ICompyleSkill | undefined {
		const match = reply.match(/\{[\s\S]*\}/);
		if (!match) {
			return undefined;
		}
		try {
			const obj = JSON.parse(match[0]) as Partial<ICompyleSkill>;
			if (!obj.name || !obj.body) {
				return undefined;
			}
			return {
				name: String(obj.name),
				description: String(obj.description ?? ''),
				tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
				trigger: Array.isArray(obj.trigger) ? obj.trigger.map(String) : [],
				body: String(obj.body),
			};
		} catch {
			return undefined;
		}
	}

	// ---- Long-term memory -------------------------------------------------

	private async _addToMemory(text: string): Promise<void> {
		if (!text.trim()) {
			return;
		}
		this._notificationService.info(localize('compyleChat.savingMemory', "Saving to long-term memory…"));
		let fact = text.trim();
		try {
			if (this._brainService.isConfigured()) {
				const reply = await this._brainService.chat(
					[{ role: 'user', content: `Summarize the following as one concise fact to remember. Reply with the single sentence only, no preamble:\n\n${text.slice(0, 2000)}` }],
					{ maxTokens: 80, silent: true },
				);
				const firstLine = reply.trim().split('\n')[0];
				if (firstLine) {
					fact = firstLine;
				}
			}
		} catch {
			// Fall back to the raw text when distillation fails.
		}
		await this._memoryService.append(fact);
		this._notificationService.info(localize('compyleChat.savedMemory', "Added to long-term memory."));
	}

	private async _offerMistakeCapture(output: string): Promise<void> {
		const choice = await this._quickInputService.pick(
			[
				{ label: localize('compyleChat.saveMistakeMem', "Save this mistake to long-term memory"), id: 'mem' },
				{ label: localize('compyleChat.saveMistakeRouter', "Create a router rule so it does not happen again"), id: 'router' },
				{ label: localize('compyleChat.ignoreMistake', "Ignore"), id: 'no' },
			],
			{ placeHolder: localize('compyleChat.mistakeQ', "The last run reported an error. Remember it so it does not happen again?") },
		);
		if (choice?.id === 'mem') {
			await this._addToMemory(`Mistake to avoid — this error occurred during a run: ${output.slice(0, 600)}`);
		} else if (choice?.id === 'router') {
			await this._synthesizeRouterRule(this._lastUserText, output);
		}
	}

	// ---- Router training --------------------------------------------------

	private _updateTrainingLabel(): void {
		if (!this._trainingBtn) {
			return;
		}
		const enabled = this._configurationService.getValue<boolean>('compyle.router.trainingEnabled') === true;
		const target = this._configurationService.getValue<string>('compyle.router.trainingTarget') || '';
		clearNode(this._trainingBtn);
		append(this._trainingBtn, $(`span.codicon.${enabled ? 'codicon-debug-rerun' : 'codicon-git-merge'}`));
		append(this._trainingBtn, $('span', undefined, enabled
			? localize('compyleChat.trainingOn', "Training: {0}", target || '?')
			: localize('compyleChat.routerTraining', "Router Training")));
		this._trainingBtn.classList.toggle('active', enabled);
	}

	private async _pickTrainingRouter(): Promise<string | undefined> {
		const routers = await this._routerService.listRouters();
		type RouterPick = IQuickPickItem & { newRouter?: boolean; routerName?: string };
		const items: (RouterPick | IQuickPickSeparator)[] = [{ label: localize('compyleChat.newRouter', "Create new router…"), newRouter: true }];
		if (routers.length) {
			items.push({ type: 'separator', label: localize('compyleChat.existingRouters', "Existing routers") });
			for (const r of routers) {
				items.push({ label: r, routerName: r });
			}
		}
		const picked = await this._quickInputService.pick(items, { placeHolder: localize('compyleChat.pickRouter', "Where should Compyle AI save what it learns?") });
		if (!picked) {
			return undefined;
		}
		if (picked.newRouter) {
			const name = await this._quickInputService.input({ title: localize('compyleChat.routerName', "New router name"), placeHolder: localize('compyleChat.routerNamePh', "e.g. general-coding") });
			if (!name) {
				return undefined;
			}
			await this._routerService.createRouter(name);
			return name;
		}
		return picked.routerName;
	}

	private async _toggleRouterTraining(): Promise<void> {
		const enabled = this._configurationService.getValue<boolean>('compyle.router.trainingEnabled') === true;
		if (enabled) {
			await this._configurationService.updateValue('compyle.router.trainingEnabled', false);
			this._notificationService.info(localize('compyleChat.trainingOff', "Router training is off."));
			return;
		}
		const target = await this._pickTrainingRouter();
		if (!target) {
			return;
		}
		await this._configurationService.updateValue('compyle.router.trainingTarget', target);
		await this._configurationService.updateValue('compyle.router.trainingEnabled', true);
		this._notificationService.info(localize('compyleChat.trainingStarted', "Router training on — Compyle AI will learn from its mistakes into \"{0}\".", target));
	}

	private async _synthesizeRouterRule(prompt: string, output: string): Promise<string | undefined> {
		const target = await this._pickTrainingRouter();
		if (!target) {
			return undefined;
		}
		const rule = await this._trainingService.synthesizeFromFailure({ prompt, output, routerName: target });
		if (rule) {
			this._notificationService.info(localize('compyleChat.ruleAdded', "Added rule \"{0}\" to router \"{1}\".", rule.name, target));
			return target;
		}
		this._notificationService.warn(localize('compyleChat.ruleFailed', "Could not synthesize a router rule from that failure."));
		return undefined;
	}

	// ---- Project / file context ------------------------------------------

	private _updateContextToggleLabel(): void {
		clearNode(this._contextToggle);
		append(this._contextToggle, $(`span.codicon.${this._useProjectContext ? 'codicon-eye' : 'codicon-eye-closed'}`));
		append(this._contextToggle, $('span', undefined, this._useProjectContext
			? localize('compyleChat.contextOn', "Project context on")
			: localize('compyleChat.contextOff', "Project context off")));
		this._contextToggle.classList.toggle('active', this._useProjectContext);
	}

	private _updateContextInfo(): void {
		if (!this._contextInfo) {
			return;
		}
		clearNode(this._contextInfo);
		if (!this._useProjectContext) {
			this._contextInfo.classList.add('off');
			append(this._contextInfo, $('span', undefined, localize('compyleChat.notSeeing', "Compyle AI is not reading your files.")));
			return;
		}
		this._contextInfo.classList.remove('off');

		const active = this._editorService.activeEditor?.resource;
		const openCount = new Set(
			this._editorService.editors.map(e => e.resource?.toString()).filter((r): r is string => !!r),
		).size;

		append(this._contextInfo, $('span.codicon.codicon-eye'));
		const activeLabel = active
			? this._labelService.getUriLabel(active, { relative: true })
			: localize('compyleChat.noActiveFile', "no file open");
		append(this._contextInfo, $('span', undefined, localize('compyleChat.seeing', "Seeing {0} · {1} open file(s)", activeLabel, openCount)));
	}

	/** Build a context string describing the workspace, open files, and active file. */
	private async _gatherWorkspaceContext(): Promise<string> {
		const parts: string[] = [];

		const memory = await this._memoryService.read();
		if (memory.trim()) {
			parts.push(`# Long-term memory (facts to remember)\n${memory.slice(-4000)}`);
		}

		const folders = this._workspaceContextService.getWorkspace().folders;
		if (folders.length > 0) {
			const root = folders[0];
			parts.push(`# Project: ${root.name}`);
			try {
				const stat = await this._fileService.resolve(root.uri);
				if (stat.children) {
					const entries = stat.children
						.filter(c => !c.name.startsWith('.') || c.name === '.env.example')
						.slice(0, PROJECT_TREE_LIMIT)
						.map(c => c.isDirectory ? `${c.name}/` : c.name);
					if (entries.length > 0) {
						parts.push(`Top-level entries:\n${entries.join('\n')}`);
					}
				}
			} catch {
				// Workspace may be virtual or unavailable; skip the tree.
			}
		}

		const openResources = this._editorService.editors
			.map(e => e.resource)
			.filter((r): r is URI => !!r);
		if (openResources.length > 0) {
			const labels = Array.from(new Set(openResources.map(r => this._labelService.getUriLabel(r, { relative: true }))));
			parts.push(`Open files:\n${labels.join('\n')}`);
		}

		const active = this._editorService.activeEditor?.resource;
		if (active) {
			const model = this._modelService.getModel(active);
			if (model) {
				const value = model.getValue();
				const capped = value.length > ACTIVE_FILE_CONTEXT_LIMIT
					? value.slice(0, ACTIVE_FILE_CONTEXT_LIMIT) + '\n…(truncated)…'
					: value;
				const label = this._labelService.getUriLabel(active, { relative: true });
				parts.push(`Active file (${label}):\n\`\`\`\n${capped}\n\`\`\``);
			}
		}

		return parts.join('\n\n');
	}

	// ---- Model refresh ----------------------------------------------------

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

	private _updateFullControlLabel(): void {
		if (!this._fullControlBtn) {
			return;
		}
		const auto = this._configurationService.getValue<string>('compyle.brain.agentEditing') === 'auto';
		clearNode(this._fullControlBtn);
		append(this._fullControlBtn, $(`span.codicon.${auto ? 'codicon-unlock' : 'codicon-lock'}`));
		append(this._fullControlBtn, $('span', undefined, auto
			? localize('compyleChat.fullControlOn', "Full control")
			: localize('compyleChat.approveEdits', "Approve edits")));
		this._fullControlBtn.classList.toggle('active', auto);
		this._fullControlBtn.title = auto
			? localize('compyleChat.fullControlTooltip', "Compyle AI applies edits and runs commands automatically. Click to require approval.")
			: localize('compyleChat.approveTooltip', "Compyle AI shows a diff and waits for approval before editing. Click for full control.");
	}

	// ---- Ollama startup ---------------------------------------------------

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

	// ---- GitHub search ----------------------------------------------------

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
				const trimmed = text.slice(0, README_CONTEXT_LIMIT);
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
			append(chip, $('span.codicon.codicon-package'));
			append(chip, $('span', undefined, item.label));
			const removeBtn = append(chip, $('button.cpc-context-chip-remove')) as HTMLButtonElement;
			append(removeBtn, $('span.codicon.codicon-close'));
			const idx = i;
			this._disposables.add(addDisposableListener(removeBtn, 'click', () => {
				this._contextItems.splice(idx, 1);
				this._renderContextStrip();
			}));
		}
	}

	override dispose(): void {
		if (this._saveHandle !== undefined) {
			clearTimeout(this._saveHandle);
			this._saveHandle = undefined;
		}
		this._saveSession();
		this._busyCts?.cancel();
		this._busyCts?.dispose();
		super.dispose();
	}
}
