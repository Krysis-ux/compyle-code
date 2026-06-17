/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { CompyleBrainProvider, CompyleBrainProviderConfig } from '../common/compyleBrain.js';

export const ICompyleBrainService = createDecorator<ICompyleBrainService>('compyleBrainService');

export interface ICompyleChatMessage {
	readonly role: 'user' | 'assistant';
	readonly content: string;
}

export interface ICompyleChatOptions {
	readonly system?: string;
	readonly maxTokens?: number;
	/** Skip the cloud-send confirmation (caller has already confirmed). */
	readonly silent?: boolean;
}

export interface ICompyleBrainService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeConfig: Event<void>;

	/** AI is enabled and a provider is selected. Does not guarantee an API key is present. */
	isConfigured(): boolean;
	getConfig(): CompyleBrainProviderConfig;

	hasApiKey(): Promise<boolean>;
	setApiKey(key: string): Promise<void>;
	clearApiKey(): Promise<void>;

	/** Send a chat completion to the configured provider and return the text reply. */
	chat(messages: ICompyleChatMessage[], options?: ICompyleChatOptions, token?: CancellationToken): Promise<string>;
	/** Validate the configuration with a tiny round-trip. */
	testConnection(): Promise<{ ok: boolean; message: string }>;
}

const PROVIDER_DEFAULT_ENDPOINTS: Record<string, string> = {
	[CompyleBrainProvider.OpenAICompatible]: 'https://api.openai.com/v1',
	[CompyleBrainProvider.OpenRouter]: 'https://openrouter.ai/api/v1',
	[CompyleBrainProvider.Ollama]: 'http://localhost:11434/v1',
	[CompyleBrainProvider.LMStudio]: 'http://localhost:1234/v1',
	[CompyleBrainProvider.Anthropic]: 'https://api.anthropic.com',
};

const SECRET_KEY_PREFIX = 'compyle.brain.apiKey:';

export class CompyleBrainService extends Disposable implements ICompyleBrainService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeConfig = this._register(new Emitter<void>());
	readonly onDidChangeConfig = this._onDidChangeConfig.event;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ISecretStorageService private readonly _secretStorageService: ISecretStorageService,
		@IRequestService private readonly _requestService: IRequestService,
		@IDialogService private readonly _dialogService: IDialogService,
	) {
		super();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('compyle.brain')) {
				this._onDidChangeConfig.fire();
			}
		}));
	}

	getConfig(): CompyleBrainProviderConfig {
		const get = <T>(key: string, fallback: T): T => this._configurationService.getValue<T>(`compyle.brain.${key}`) ?? fallback;
		return {
			provider: get<CompyleBrainProvider>('provider', CompyleBrainProvider.None),
			endpoint: get<string>('endpoint', '') || undefined,
			model: get<string>('model', '') || undefined,
			localOnly: get<boolean>('localOnly', false),
			confirmBeforeCloudSend: get<boolean>('confirmBeforeCloudSend', true),
		};
	}

	isConfigured(): boolean {
		const enabled = this._configurationService.getValue<boolean>('compyle.brain.enabled') === true;
		return enabled && this.getConfig().provider !== CompyleBrainProvider.None;
	}

	private _secretKey(provider: CompyleBrainProvider): string {
		return SECRET_KEY_PREFIX + provider;
	}

	async hasApiKey(): Promise<boolean> {
		const key = await this._secretStorageService.get(this._secretKey(this.getConfig().provider));
		return !!key;
	}

	async setApiKey(key: string): Promise<void> {
		await this._secretStorageService.set(this._secretKey(this.getConfig().provider), key);
		this._onDidChangeConfig.fire();
	}

	async clearApiKey(): Promise<void> {
		await this._secretStorageService.delete(this._secretKey(this.getConfig().provider));
		this._onDidChangeConfig.fire();
	}

	private _endpoint(config: CompyleBrainProviderConfig): string {
		return (config.endpoint || PROVIDER_DEFAULT_ENDPOINTS[config.provider] || '').replace(/\/$/, '');
	}

	private _isCloud(config: CompyleBrainProviderConfig): boolean {
		switch (config.provider) {
			case CompyleBrainProvider.Anthropic:
			case CompyleBrainProvider.OpenRouter:
				return true;
			case CompyleBrainProvider.OpenAICompatible: {
				const endpoint = this._endpoint(config);
				return !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(endpoint);
			}
			default:
				return false; // ollama, lmstudio, local
		}
	}

	async chat(messages: ICompyleChatMessage[], options: ICompyleChatOptions = {}, token: CancellationToken = CancellationToken.None): Promise<string> {
		const activeMode = this._configurationService.getValue<string>('compyle.modes.activeMode');
		if (activeMode === 'focus') {
			throw new Error(localize('compyle.brain.focusMode', "AI is off in Focus mode. Switch to another mode to use Compyle Brain."));
		}

		const config = this.getConfig();
		if (config.provider === CompyleBrainProvider.None) {
			throw new Error(localize('compyle.brain.notConfigured', "Compyle Brain has no AI provider selected. Configure one in Settings."));
		}
		if (!config.model) {
			throw new Error(localize('compyle.brain.noModel', "No model is set. Set \"compyle.brain.model\" in Settings."));
		}

		const cloud = this._isCloud(config);
		if (cloud && config.localOnly) {
			throw new Error(localize('compyle.brain.localOnlyBlocked', "Local-only mode is on, but \"{0}\" is a cloud provider. Switch to a local provider or turn off local-only mode.", config.provider));
		}

		const apiKey = await this._secretStorageService.get(this._secretKey(config.provider));
		if (cloud && !apiKey) {
			throw new Error(localize('compyle.brain.noKey', "No API key set for this provider. Run \"Compyle Brain: Set API Key\" first."));
		}

		if (cloud && config.confirmBeforeCloudSend && !options.silent) {
			const result = await this._dialogService.confirm({
				message: localize('compyle.brain.confirmSend', "Send this request to {0}?", config.provider),
				detail: localize('compyle.brain.confirmSendDetail', "Your prompt will be sent to a cloud AI provider. You can disable this prompt in Settings (compyle.brain.confirmBeforeCloudSend)."),
				primaryButton: localize('compyle.brain.send', "Send"),
			});
			if (!result.confirmed) {
				throw new Error(localize('compyle.brain.cancelled', "Request cancelled."));
			}
		}

		return config.provider === CompyleBrainProvider.Anthropic
			? this._chatAnthropic(config, apiKey, messages, options, token)
			: this._chatOpenAICompatible(config, apiKey, messages, options, token);
	}

	private async _chatAnthropic(config: CompyleBrainProviderConfig, apiKey: string | undefined, messages: ICompyleChatMessage[], options: ICompyleChatOptions, token: CancellationToken): Promise<string> {
		const body = {
			model: config.model,
			max_tokens: options.maxTokens ?? 1024,
			system: options.system,
			messages: messages.map(m => ({ role: m.role, content: m.content })),
		};
		const context = await this._requestService.request({
			type: 'POST',
			url: `${this._endpoint(config)}/v1/messages`,
			headers: {
				'content-type': 'application/json',
				'x-api-key': apiKey ?? '',
				'anthropic-version': '2023-06-01',
			},
			data: JSON.stringify(body),
			callSite: 'compyleBrain.chat',
		}, token);

		const json = await asJson<{ content?: Array<{ text?: string }>; error?: { message?: string } }>(context);
		if (json?.error) {
			throw new Error(json.error.message ?? 'Anthropic request failed.');
		}
		return json?.content?.map(part => part.text ?? '').join('') ?? '';
	}

	private async _chatOpenAICompatible(config: CompyleBrainProviderConfig, apiKey: string | undefined, messages: ICompyleChatMessage[], options: ICompyleChatOptions, token: CancellationToken): Promise<string> {
		const fullMessages = options.system
			? [{ role: 'system', content: options.system }, ...messages]
			: messages;
		const body = {
			model: config.model,
			messages: fullMessages,
			max_tokens: options.maxTokens ?? 1024,
		};
		const headers: Record<string, string> = { 'content-type': 'application/json' };
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}
		const context = await this._requestService.request({
			type: 'POST',
			url: `${this._endpoint(config)}/chat/completions`,
			headers,
			data: JSON.stringify(body),
			callSite: 'compyleBrain.chat',
		}, token);

		const json = await asJson<{ choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }>(context);
		if (json?.error) {
			throw new Error(json.error.message ?? 'Request failed.');
		}
		return json?.choices?.[0]?.message?.content ?? '';
	}

	async testConnection(): Promise<{ ok: boolean; message: string }> {
		if (!this.isConfigured()) {
			return { ok: false, message: localize('compyle.brain.test.notConfigured', "Enable Compyle Brain and select a provider first.") };
		}
		try {
			const reply = await this.chat(
				[{ role: 'user', content: 'Reply with the single word: OK' }],
				{ maxTokens: 16, silent: true },
			);
			return reply.trim().length > 0
				? { ok: true, message: localize('compyle.brain.test.ok', "Connected. Model replied successfully.") }
				: { ok: false, message: localize('compyle.brain.test.empty', "Connected, but the model returned an empty response.") };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	}
}

registerSingleton(ICompyleBrainService, CompyleBrainService, InstantiationType.Delayed);
