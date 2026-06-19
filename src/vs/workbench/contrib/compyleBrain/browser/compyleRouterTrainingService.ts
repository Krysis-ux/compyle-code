/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ICompyleRouterRule } from '../../compyleRouter/common/compyleRouter.js';
import { ICompyleRouterService } from '../../compyleRouter/browser/compyleRouterService.js';
import { ICompyleBrainService } from './compyleBrainService.js';
import { buildSynthesisPrompt, parseSynthesizedRule } from '../common/compyleRouterTraining.js';

export const ICompyleRouterTrainingService = createDecorator<ICompyleRouterTrainingService>('compyleRouterTrainingService');

export interface ICompyleSynthesizeParams {
	readonly prompt: string;
	readonly output: string;
	readonly reason?: string;
	readonly routerName: string;
}

export interface ICompyleRouterTrainingService {
	readonly _serviceBrand: undefined;
	/**
	 * Turn a failure into a routing rule and append it to the named router.
	 * Returns the stored rule, or undefined if the model could not synthesize one.
	 */
	synthesizeFromFailure(params: ICompyleSynthesizeParams): Promise<ICompyleRouterRule | undefined>;
}

export class CompyleRouterTrainingService extends Disposable implements ICompyleRouterTrainingService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@ICompyleRouterService private readonly _routerService: ICompyleRouterService,
	) {
		super();
	}

	async synthesizeFromFailure(params: ICompyleSynthesizeParams): Promise<ICompyleRouterRule | undefined> {
		const prompt = buildSynthesisPrompt(params.prompt, params.output, params.reason);
		let reply: string;
		try {
			reply = await this._brainService.chat([{ role: 'user', content: prompt }], { maxTokens: 400, silent: true });
		} catch {
			return undefined;
		}
		const rule = parseSynthesizedRule(reply);
		if (!rule) {
			return undefined;
		}
		const stored: ICompyleRouterRule = { ...rule, source: 'synth', errors: 1, examples: [params.prompt.slice(0, 200)] };
		await this._routerService.appendRule(params.routerName, stored);
		return stored;
	}
}

registerSingleton(ICompyleRouterTrainingService, CompyleRouterTrainingService, InstantiationType.Delayed);
