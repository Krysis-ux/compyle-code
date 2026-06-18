/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';

/**
 * Compyle fill-in-the-middle (FIM) autocomplete client.
 *
 * A dedicated FIM endpoint completes code at the cursor far faster than a chat
 * round-trip. This client speaks the request shapes of common local servers —
 * Tabby, Ollama, LM Studio, and any OpenAI-compatible /v1/completions server —
 * none of which require copying their code; we only call their documented APIs.
 *
 * When the backend is 'brain', this client reports no backend and the provider
 * falls back to the chat-based completion path.
 */

export type CompyleFimBackend = 'brain' | 'tabby' | 'ollama' | 'lmstudio' | 'openai-compat';

export const FIM_BACKEND_SETTING = 'compyle.autocomplete.backend';
export const FIM_ENDPOINT_SETTING = 'compyle.autocomplete.endpoint';
export const FIM_MODEL_SETTING = 'compyle.autocomplete.model';
export const FIM_MAX_TOKENS_SETTING = 'compyle.autocomplete.maxTokens';
export const FIM_TEMPERATURE_SETTING = 'compyle.autocomplete.temperature';

const FIM_BACKENDS: readonly CompyleFimBackend[] = ['brain', 'tabby', 'ollama', 'lmstudio', 'openai-compat'];

export const ICompyleFimService = createDecorator<ICompyleFimService>('compyleFimService');

export interface ICompyleFimService {
	readonly _serviceBrand: undefined;
	/** True when a dedicated FIM backend is selected (anything other than 'brain'). */
	hasBackend(): boolean;
	/** Complete the code at the cursor given the surrounding prefix and suffix. */
	complete(prefix: string, suffix: string, languageId: string, token: CancellationToken): Promise<string>;
}

export class CompyleFimService extends Disposable implements ICompyleFimService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IRequestService private readonly _requestService: IRequestService,
	) {
		super();
	}

	private _backend(): CompyleFimBackend {
		const raw = this._configurationService.getValue<CompyleFimBackend>(FIM_BACKEND_SETTING);
		return FIM_BACKENDS.includes(raw) ? raw : 'brain';
	}

	private _endpoint(): string {
		const raw = this._configurationService.getValue<string>(FIM_ENDPOINT_SETTING) || 'http://localhost:11434';
		return raw.replace(/\/+$/, '');
	}

	private _model(): string {
		return this._configurationService.getValue<string>(FIM_MODEL_SETTING) || 'qwen2.5-coder:1.5b';
	}

	private _maxTokens(): number {
		return this._configurationService.getValue<number>(FIM_MAX_TOKENS_SETTING) ?? 128;
	}

	private _temperature(): number {
		return this._configurationService.getValue<number>(FIM_TEMPERATURE_SETTING) ?? 0.1;
	}

	hasBackend(): boolean {
		return this._backend() !== 'brain';
	}

	async complete(prefix: string, suffix: string, languageId: string, token: CancellationToken): Promise<string> {
		switch (this._backend()) {
			case 'tabby':
				return this._completeTabby(prefix, suffix, languageId, token);
			case 'ollama':
				return this._completeOllama(prefix, suffix, token);
			case 'lmstudio':
			case 'openai-compat':
				return this._completeOpenAICompletions(prefix, suffix, token);
			default:
				return '';
		}
	}

	/** Tabby: POST /v1/completions with { language, segments: { prefix, suffix } }. */
	private async _completeTabby(prefix: string, suffix: string, languageId: string, token: CancellationToken): Promise<string> {
		const body = {
			language: languageId,
			segments: { prefix, suffix },
		};
		const context = await this._requestService.request({
			type: 'POST',
			url: `${this._endpoint()}/v1/completions`,
			headers: { 'content-type': 'application/json' },
			data: JSON.stringify(body),
			callSite: 'compyleFim.tabby',
		}, token);
		const json = await asJson<{ choices?: Array<{ text?: string }> }>(context);
		return json?.choices?.[0]?.text ?? '';
	}

	/** Ollama: POST /api/generate with prompt + suffix for FIM-capable models. */
	private async _completeOllama(prefix: string, suffix: string, token: CancellationToken): Promise<string> {
		const body = {
			model: this._model(),
			prompt: prefix,
			suffix,
			stream: false,
			options: {
				num_predict: this._maxTokens(),
				temperature: this._temperature(),
				stop: ['\n\n'],
			},
		};
		const context = await this._requestService.request({
			type: 'POST',
			url: `${this._endpoint()}/api/generate`,
			headers: { 'content-type': 'application/json' },
			data: JSON.stringify(body),
			callSite: 'compyleFim.ollama',
		}, token);
		const json = await asJson<{ response?: string; error?: string }>(context);
		if (json?.error) {
			throw new Error(json.error);
		}
		return json?.response ?? '';
	}

	/** LM Studio / OpenAI-compatible legacy completions with a `suffix` field for FIM. */
	private async _completeOpenAICompletions(prefix: string, suffix: string, token: CancellationToken): Promise<string> {
		const body = {
			model: this._model(),
			prompt: prefix,
			suffix,
			max_tokens: this._maxTokens(),
			temperature: this._temperature(),
			stream: false,
		};
		const context = await this._requestService.request({
			type: 'POST',
			url: `${this._endpoint()}/v1/completions`,
			headers: { 'content-type': 'application/json' },
			data: JSON.stringify(body),
			callSite: 'compyleFim.openai',
		}, token);
		const json = await asJson<{ choices?: Array<{ text?: string }>; error?: { message?: string } }>(context);
		if (json?.error) {
			throw new Error(json.error.message ?? 'FIM request failed.');
		}
		return json?.choices?.[0]?.text ?? '';
	}
}

registerSingleton(ICompyleFimService, CompyleFimService, InstantiationType.Delayed);
