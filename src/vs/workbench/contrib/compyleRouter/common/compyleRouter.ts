/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compyle Router sits between a request and Compyle Brain. It detects the kind
 * of task being asked, steers the model with a task-specific system prefix, and
 * runs a lightweight quality gate over the model's output (flagging likely
 * secrets and dangerous shell commands). It never changes the provider behind
 * the user's back — it only adds guidance and warnings.
 *
 * Three modes:
 *  - none:    pass requests straight through, no routing or gate.
 *  - default: the built-in Compyle routing table + quality gate.
 *  - custom:  user-defined keyword rules loaded from a JSON file.
 */

export type CompyleRouterMode = 'none' | 'default' | 'custom';

export const COMPYLE_ROUTER_MODE_SETTING = 'compyle.router.mode';
export const COMPYLE_ROUTER_CUSTOM_PATH_SETTING = 'compyle.router.customConfigPath';
export const COMPYLE_ROUTER_QUALITY_GATE_SETTING = 'compyle.router.enableQualityGate';
export const COMPYLE_ROUTER_LOG_SETTING = 'compyle.router.logRouting';

/** Challenge size band a synthesized rule was learned from. */
export type CompyleRouterDifficulty = 'line' | 'function' | 'feature' | 'project';

export interface ICompyleRouterRule {
	readonly name: string;
	readonly keywords: readonly string[];
	readonly systemPromptPrefix?: string;
	/** Informational suggestion only — the router never switches models silently. */
	readonly suggestedModel?: string;
	/** Training stats: times this rule's guidance led to a correct result. */
	readonly correct?: number;
	/** Training stats: times this rule was synthesized/refined from a failure. */
	readonly errors?: number;
	/** A few example prompts that this rule should steer. */
	readonly examples?: readonly string[];
	/** Where the rule came from. */
	readonly source?: 'manual' | 'synth';
	/** Difficulty band the rule was learned at. */
	readonly difficulty?: CompyleRouterDifficulty;
}

export interface ICompyleRouterConfig {
	readonly rules: readonly ICompyleRouterRule[];
}

function normalizeRouterRule(obj: Partial<ICompyleRouterRule>): ICompyleRouterRule | undefined {
	const keywords = Array.isArray(obj.keywords)
		? obj.keywords.map(String).map(k => k.trim()).filter(Boolean)
		: [];
	const name = obj.name ? String(obj.name).trim() : '';
	if (!name || keywords.length === 0) {
		return undefined;
	}
	const difficulty = obj.difficulty === 'line' || obj.difficulty === 'function' || obj.difficulty === 'feature' || obj.difficulty === 'project'
		? obj.difficulty
		: undefined;
	const examples = Array.isArray(obj.examples) ? obj.examples.map(String).filter(Boolean).slice(0, 5) : undefined;
	return {
		name,
		keywords,
		...(typeof obj.systemPromptPrefix === 'string' ? { systemPromptPrefix: obj.systemPromptPrefix } : {}),
		...(typeof obj.suggestedModel === 'string' ? { suggestedModel: obj.suggestedModel } : {}),
		...(typeof obj.correct === 'number' ? { correct: obj.correct } : {}),
		...(typeof obj.errors === 'number' ? { errors: obj.errors } : {}),
		...(examples?.length ? { examples } : {}),
		...(obj.source === 'manual' || obj.source === 'synth' ? { source: obj.source } : {}),
		...(difficulty ? { difficulty } : {}),
	};
}

/** Parse a `.jsonl` router file (one rule object per line). Malformed lines are skipped. */
export function parseRouterRulesJsonl(text: string): ICompyleRouterRule[] {
	const rules: ICompyleRouterRule[] = [];
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		try {
			const obj = JSON.parse(trimmed) as Partial<ICompyleRouterRule>;
			const rule = normalizeRouterRule(obj);
			if (rule) {
				rules.push(rule);
			}
		} catch {
			// Skip malformed lines rather than throwing.
		}
	}
	return rules;
}

/** Parse a router config from either JSON (`{ rules: [...] }`) or JSONL (one rule per line). */
export function parseRouterConfigText(text: string): ICompyleRouterConfig {
	const trimmed = text.trim();
	if (!trimmed) {
		return { rules: [] };
	}
	try {
		const parsed = JSON.parse(trimmed) as Partial<ICompyleRouterConfig>;
		if (Array.isArray(parsed?.rules)) {
			return {
				rules: parsed.rules
					.map(rule => normalizeRouterRule(rule as Partial<ICompyleRouterRule>))
					.filter((rule): rule is ICompyleRouterRule => !!rule),
			};
		}
	} catch {
		// Fall through to JSONL parsing.
	}
	return { rules: parseRouterRulesJsonl(text) };
}

/** Serialize rules to `.jsonl` (one compact JSON object per line). Append-only friendly, tiny on disk. */
export function serializeRouterRulesJsonl(rules: readonly ICompyleRouterRule[]): string {
	return rules.map(r => JSON.stringify(r)).join('\n') + (rules.length ? '\n' : '');
}

/**
 * Merge rules that share a keyword-set: sum correct/errors, union examples, keep the
 * first name/prefix. This keeps a trained router from growing without bound.
 */
export function dedupeRouterRules(rules: readonly ICompyleRouterRule[]): ICompyleRouterRule[] {
	const byKey = new Map<string, ICompyleRouterRule>();
	for (const rule of rules) {
		const key = [...rule.keywords].map(k => k.toLowerCase().trim()).sort().join('|');
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, rule);
			continue;
		}
		byKey.set(key, {
			name: existing.name,
			keywords: existing.keywords,
			systemPromptPrefix: existing.systemPromptPrefix || rule.systemPromptPrefix,
			suggestedModel: existing.suggestedModel || rule.suggestedModel,
			correct: (existing.correct ?? 0) + (rule.correct ?? 0),
			errors: (existing.errors ?? 0) + (rule.errors ?? 0),
			examples: [...new Set([...(existing.examples ?? []), ...(rule.examples ?? [])])].slice(0, 5),
			source: existing.source ?? rule.source,
			difficulty: existing.difficulty ?? rule.difficulty,
		});
	}
	return [...byKey.values()];
}

export interface ICompyleRoutingDecision {
	/** Human-readable label of the matched route (e.g. "Security"). */
	readonly label: string;
	/** Prefix prepended to the system prompt, or '' when no route matched. */
	readonly systemPrefix: string;
	/** Suggested model from a custom rule, surfaced to the user (never auto-applied). */
	readonly suggestedModel?: string;
}

/** Built-in routing table used in 'default' mode. Order matters — first match wins. */
export const COMPYLE_DEFAULT_ROUTES: readonly { label: string; keywords: readonly string[]; systemPrefix: string }[] = [
	{
		label: 'Security',
		keywords: ['security', 'vulnerab', 'cve', 'exploit', 'injection', 'xss', 'csrf', 'auth bypass'],
		systemPrefix: 'Treat this as a security-sensitive task. Watch for injection, secrets, unsafe input handling, and auth flaws. Recommend minimal, concrete fixes.',
	},
	{
		label: 'Code Review',
		keywords: ['review', 'audit', 'code quality', 'what\'s wrong', 'improve this code', 'check this'],
		systemPrefix: 'You are a senior code reviewer. Focus on correctness, security, performance, and maintainability. Be specific about issues and always suggest concrete improvements.',
	},
	{
		label: 'Research',
		keywords: ['research', 'find', 'look up', 'compare', 'survey', 'best library', 'which library', 'what is', 'how does'],
		systemPrefix: 'You are a research assistant. Gather facts, compare options objectively, and summarize findings with clear trade-offs. Cite specific reasons for recommendations.',
	},
	{
		label: 'Debug',
		keywords: ['error', 'bug', 'crash', 'stack trace', 'traceback', 'exception', 'fails', 'broken', 'not working'],
		systemPrefix: 'Treat this as debugging. Form hypotheses and isolate the root cause before proposing a fix.',
	},
	{
		label: 'Refactor',
		keywords: ['refactor', 'clean up', 'reorganize', 'improve structure', 'simplify', 'restructure', 'rewrite'],
		systemPrefix: 'You are a refactoring specialist. Preserve existing behavior while improving readability, reducing complexity, and improving structure. Show before/after diffs.',
	},
	{
		label: 'Architecture',
		keywords: ['architect', 'design', 'structure', 'scalab', 'trade-off', 'tradeoff', 'pattern'],
		systemPrefix: 'Treat this as a design task. Weigh trade-offs and prefer clear structure over premature code.',
	},
	{
		label: 'Tests',
		keywords: ['test', 'spec', 'coverage', 'unit test', 'integration test'],
		systemPrefix: 'Treat this as a testing task. Prefer focused tests that capture behavior and cover edge cases.',
	},
	{
		label: 'Docs',
		keywords: ['document', 'readme', 'docs', 'explain', 'comment', 'changelog'],
		systemPrefix: 'Treat this as a documentation task. Produce clear, accurate prose with runnable examples.',
	},
];

export const COMPYLE_ROUTER_CUSTOM_TEMPLATE: ICompyleRouterConfig = {
	rules: [
		{
			name: 'security-deep-review',
			keywords: ['security', 'vulnerability', 'audit'],
			systemPromptPrefix: 'You are a security expert. Perform a thorough vulnerability review.',
			suggestedModel: 'claude-opus-4-8',
		},
		{
			name: 'quick-edits',
			keywords: ['rename', 'typo', 'format'],
			systemPromptPrefix: 'Make the smallest correct change.',
		},
	],
};

/** Patterns the quality gate flags in model output. Advisory only — never blocks. */
export interface ICompyleQualityFinding {
	readonly kind: 'secret' | 'dangerous-command';
	readonly message: string;
}

const SECRET_PATTERNS: readonly { re: RegExp; message: string }[] = [
	{ re: /\bsk-[A-Za-z0-9]{16,}\b/, message: 'Possible API key (sk-...)' },
	{ re: /\bAKIA[0-9A-Z]{16}\b/, message: 'Possible AWS access key (AKIA...)' },
	{ re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, message: 'Embedded private key' },
	{ re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, message: 'Possible GitHub token' },
	{ re: /(password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"]{6,}['"]/i, message: 'Hardcoded credential literal' },
];

const DANGEROUS_COMMAND_PATTERNS: readonly { re: RegExp; message: string }[] = [
	{ re: /\brm\s+-rf\s+(?:\/|~|\$HOME)\b/, message: 'Recursive delete of a root/home path (rm -rf)' },
	{ re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash)\b/, message: 'Piping a download straight into a shell' },
	{ re: /\bmkfs\.[a-z0-9]+\b/, message: 'Filesystem format command (mkfs)' },
	{ re: /\bdd\s+if=.*\bof=\/dev\//, message: 'Raw write to a device with dd' },
	{ re: /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, message: 'Fork-bomb pattern' },
	{ re: /\bchmod\s+-R?\s*777\b/, message: 'World-writable permissions (chmod 777)' },
];

/** Scan model output for likely secrets and dangerous shell commands. */
export function scanQuality(output: string): ICompyleQualityFinding[] {
	const findings: ICompyleQualityFinding[] = [];
	for (const { re, message } of SECRET_PATTERNS) {
		if (re.test(output)) {
			findings.push({ kind: 'secret', message });
		}
	}
	for (const { re, message } of DANGEROUS_COMMAND_PATTERNS) {
		if (re.test(output)) {
			findings.push({ kind: 'dangerous-command', message });
		}
	}
	return findings;
}

/** Find the first default route whose keywords appear in the text. */
export function matchDefaultRoute(text: string): ICompyleRoutingDecision {
	const lower = text.toLowerCase();
	for (const route of COMPYLE_DEFAULT_ROUTES) {
		if (route.keywords.some(k => lower.includes(k))) {
			return { label: route.label, systemPrefix: route.systemPrefix };
		}
	}
	return { label: 'Code', systemPrefix: '' };
}

/** Find the first custom rule whose keywords appear in the text. */
export function matchCustomRule(text: string, config: ICompyleRouterConfig): ICompyleRoutingDecision {
	const lower = text.toLowerCase();
	for (const rule of config.rules) {
		if (rule.keywords.some(k => lower.includes(k.toLowerCase()))) {
			return { label: rule.name, systemPrefix: rule.systemPromptPrefix ?? '', suggestedModel: rule.suggestedModel };
		}
	}
	return { label: 'Code', systemPrefix: '' };
}
