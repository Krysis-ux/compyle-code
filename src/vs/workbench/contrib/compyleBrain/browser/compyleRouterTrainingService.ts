/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { CompyleRouterDifficulty, ICompyleRouterRule } from '../../compyleRouter/common/compyleRouter.js';
import { ICompyleRouterService } from '../../compyleRouter/browser/compyleRouterService.js';
import { ICompyleBrainService } from './compyleBrainService.js';
import { buildChallengePrompt, buildJudgePrompt, buildSynthesisPrompt, ICompyleChallenge, parseChallenges, parseJudgement, parseSynthesizedRule } from '../common/compyleRouterTraining.js';

export const ICompyleRouterTrainingService = createDecorator<ICompyleRouterTrainingService>('compyleRouterTrainingService');

export interface ICompyleSynthesizeParams {
	readonly prompt: string;
	readonly output: string;
	readonly reason?: string;
	readonly routerName: string;
}

export interface ICompyleTrainingOptions {
	readonly routerName: string;
	readonly purpose: 'general' | 'web';
	readonly difficulty: CompyleRouterDifficulty;
	/** Number of challenges to generate and attempt. */
	readonly count: number;
	/** Solver attempts per challenge before recording a failure. */
	readonly maxRetries: number;
	/** Solver model (defaults to the configured model). */
	readonly model?: string;
	/** Challenger/judge model for the dual-model loop. */
	readonly challengerModel?: string;
}

export interface ICompyleTrainingProgress {
	readonly kind: 'status' | 'challenge' | 'attempt' | 'pass' | 'fail' | 'rule' | 'done';
	readonly message: string;
	readonly correct: number;
	readonly failed: number;
}

export interface ICompyleRouterTrainingService {
	readonly _serviceBrand: undefined;
	/**
	 * Turn a failure into a routing rule and append it to the named router.
	 * Returns the stored rule, or undefined if the model could not synthesize one.
	 */
	synthesizeFromFailure(params: ICompyleSynthesizeParams): Promise<ICompyleRouterRule | undefined>;
	/** Single-model self-play: generate challenges, solve+retry, judge, learn rules from failures. */
	runAutonomous(opts: ICompyleTrainingOptions, onProgress: (p: ICompyleTrainingProgress) => void, token: CancellationToken): Promise<void>;
	/** Dual-model self-play: a challenger model judges a separate solver model in a loop. GPU/CPU intensive. */
	runDualModel(opts: ICompyleTrainingOptions, onProgress: (p: ICompyleTrainingProgress) => void, token: CancellationToken): Promise<void>;
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

	async runAutonomous(opts: ICompyleTrainingOptions, onProgress: (p: ICompyleTrainingProgress) => void, token: CancellationToken): Promise<void> {
		const model = opts.model || this._brainService.getConfig().model || '';
		await this._runLoop(opts, model, model, onProgress, token);
	}

	async runDualModel(opts: ICompyleTrainingOptions, onProgress: (p: ICompyleTrainingProgress) => void, token: CancellationToken): Promise<void> {
		const challenger = opts.challengerModel || this._brainService.getConfig().model || '';
		const solver = opts.model || this._brainService.getConfig().model || '';
		await this._runLoop(opts, challenger, solver, onProgress, token);
	}

	/**
	 * The shared self-play loop. The challenger model generates challenges and judges
	 * results; the solver model attempts each challenge (retrying on the judge's
	 * feedback). Failures are turned into router rules, growing the router over time.
	 */
	private async _runLoop(opts: ICompyleTrainingOptions, challengerModel: string, solverModel: string, onProgress: (p: ICompyleTrainingProgress) => void, token: CancellationToken): Promise<void> {
		let correct = 0;
		let failed = 0;
		const emit = (kind: ICompyleTrainingProgress['kind'], message: string) => onProgress({ kind, message, correct, failed });

		emit('status', `Generating ${opts.count} ${opts.difficulty} challenges…`);
		let challenges: ICompyleChallenge[] = [];
		try {
			const reply = await this._brainService.chat(
				[{ role: 'user', content: buildChallengePrompt(opts.purpose, opts.difficulty, opts.count) }],
				{ maxTokens: 1400, silent: true, model: challengerModel },
				token,
			);
			challenges = parseChallenges(reply).slice(0, opts.count);
		} catch {
			emit('done', 'Could not generate challenges. Check the model and try again.');
			return;
		}
		if (challenges.length === 0) {
			emit('done', 'The model returned no usable challenges.');
			return;
		}

		for (const ch of challenges) {
			if (token.isCancellationRequested) {
				break;
			}
			emit('challenge', `Challenge: ${ch.title}`);
			let passed = false;
			let lastReason = '';
			let solverSummary = '';
			const attempts = Math.max(1, opts.maxRetries);
			for (let attempt = 1; attempt <= attempts && !passed; attempt++) {
				if (token.isCancellationRequested) {
					break;
				}
				emit('attempt', `Attempt ${attempt} of ${attempts}…`);
				const solvePrompt = attempt === 1
					? `Solve this coding challenge. Provide the complete solution code.\n\n${ch.prompt}`
					: `Your previous attempt did not meet the goal: ${lastReason}\nFix it and provide the corrected complete solution.\n\n${ch.prompt}`;
				try {
					solverSummary = await this._brainService.chat([{ role: 'user', content: solvePrompt }], { maxTokens: 1400, silent: true, model: solverModel }, token);
				} catch {
					lastReason = 'the solver model errored';
					continue;
				}
				try {
					const judgeReply = await this._brainService.chat([{ role: 'user', content: buildJudgePrompt(ch, solverSummary, '') }], { maxTokens: 200, silent: true, model: challengerModel }, token);
					const judgement = parseJudgement(judgeReply);
					if (judgement.pass) {
						passed = true;
					} else {
						lastReason = judgement.reason || 'the result did not match the expectation';
					}
				} catch {
					lastReason = 'the judge model errored';
				}
			}
			if (passed) {
				correct++;
				emit('pass', `Passed: ${ch.title}`);
			} else {
				failed++;
				emit('fail', `Failed: ${ch.title} — ${lastReason}`);
				const rule = await this.synthesizeFromFailure({ prompt: ch.prompt, output: solverSummary, reason: lastReason, routerName: opts.routerName });
				if (rule) {
					emit('rule', `Learned rule "${rule.name}" → ${opts.routerName}`);
				}
			}
		}
		emit('done', `Done — ${correct} passed, ${failed} failed. Router "${opts.routerName}" updated.`);
	}
}

registerSingleton(ICompyleRouterTrainingService, CompyleRouterTrainingService, InstantiationType.Delayed);
