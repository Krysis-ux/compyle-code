/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompyleRouterDifficulty, ICompyleRouterRule } from '../../compyleRouter/common/compyleRouter.js';

/** Difficulty bands the autonomous trainers can target, smallest to largest. */
export const COMPYLE_TRAINING_DIFFICULTIES: readonly CompyleRouterDifficulty[] = ['line', 'function', 'feature', 'project'];

/**
 * Prompt that asks a model to turn a failure into a reusable routing rule. The
 * model replies with a single JSON object that {@link parseSynthesizedRule} reads.
 */
export function buildSynthesisPrompt(prompt: string, output: string, reason?: string): string {
	return [
		'A coding attempt failed. Create a routing rule that would steer the assistant to avoid this mistake next time.',
		'Respond with ONLY a JSON object and nothing else:',
		'{"name": "short label", "keywords": ["words that should trigger this rule"], "systemPromptPrefix": "a short instruction that prevents the mistake", "difficulty": "line|function|feature|project"}',
		'',
		`User request:\n${prompt.slice(0, 1000)}`,
		'',
		`What went wrong:\n${(reason || output).slice(0, 1500)}`,
	].join('\n');
}

/** Parse a synthesized routing rule out of a model reply. Returns undefined when invalid. */
export function parseSynthesizedRule(text: string): ICompyleRouterRule | undefined {
	const match = text.match(/\{[\s\S]*\}/);
	if (!match) {
		return undefined;
	}
	try {
		const obj = JSON.parse(match[0]) as Partial<ICompyleRouterRule>;
		const keywords = Array.isArray(obj.keywords) ? obj.keywords.map(String).map(k => k.trim()).filter(Boolean) : [];
		if (!obj.name || keywords.length === 0) {
			return undefined;
		}
		const difficulty = COMPYLE_TRAINING_DIFFICULTIES.includes(obj.difficulty as CompyleRouterDifficulty) ? obj.difficulty as CompyleRouterDifficulty : undefined;
		return {
			name: String(obj.name).slice(0, 60),
			keywords,
			systemPromptPrefix: obj.systemPromptPrefix ? String(obj.systemPromptPrefix) : undefined,
			difficulty,
		};
	} catch {
		return undefined;
	}
}

export interface ICompyleChallenge {
	readonly title: string;
	readonly prompt: string;
	readonly expected: string;
}

/** Prompt that asks a model to generate a batch of self-contained coding challenges. */
export function buildChallengePrompt(purpose: 'general' | 'web', difficulty: CompyleRouterDifficulty, count: number): string {
	const scope = difficulty === 'line' ? 'a single line or expression'
		: difficulty === 'function' ? 'one small function'
			: difficulty === 'feature' ? 'a small multi-file feature'
				: 'a small complete project';
	const domain = purpose === 'web' ? 'web pages or apps (HTML/CSS/JS that can run in a browser preview)' : 'general programming';
	return [
		`Generate ${count} small ${domain} coding challenges, each about ${scope}.`,
		'Respond with ONLY a JSON array, no prose:',
		'[{"title": "...", "prompt": "what to build", "expected": "how to tell it succeeded (a command, output, or observable result)"}]',
	].join('\n');
}

/** Parse the challenge batch produced by {@link buildChallengePrompt}. */
export function parseChallenges(text: string): ICompyleChallenge[] {
	const match = text.match(/\[[\s\S]*\]/);
	if (!match) {
		return [];
	}
	try {
		const arr = JSON.parse(match[0]) as Partial<ICompyleChallenge>[];
		if (!Array.isArray(arr)) {
			return [];
		}
		return arr
			.filter(c => c && typeof c.prompt === 'string')
			.map(c => ({ title: String(c.title ?? c.prompt).slice(0, 80), prompt: String(c.prompt), expected: String(c.expected ?? '') }));
	} catch {
		return [];
	}
}

/** Prompt for a judge model: did the solver's result meet the challenge's expectation? */
export function buildJudgePrompt(challenge: ICompyleChallenge, solverSummary: string, runOutput: string): string {
	return [
		'You are judging whether a coding attempt succeeded.',
		`Challenge: ${challenge.prompt}`,
		`Expected: ${challenge.expected}`,
		'',
		`What the solver did:\n${solverSummary.slice(0, 1500)}`,
		'',
		`Command/run output:\n${runOutput.slice(0, 1500)}`,
		'',
		'Respond with ONLY JSON: {"pass": true|false, "reason": "one sentence"}',
	].join('\n');
}

export interface ICompyleJudgement {
	readonly pass: boolean;
	readonly reason: string;
}

/** Parse a judge model's verdict. Defaults to a failed verdict when unparseable. */
export function parseJudgement(text: string): ICompyleJudgement {
	const match = text.match(/\{[\s\S]*\}/);
	if (match) {
		try {
			const obj = JSON.parse(match[0]) as Partial<ICompyleJudgement>;
			return { pass: obj.pass === true, reason: String(obj.reason ?? '') };
		} catch {
			// fall through
		}
	}
	// Heuristic fallback: treat an explicit "pass"/"success" with no error as a pass.
	const pass = /\b(pass|passed|success|correct)\b/i.test(text) && !/\b(fail|error|incorrect)\b/i.test(text);
	return { pass, reason: text.slice(0, 120) };
}
