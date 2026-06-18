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

export interface ICompyleRouterRule {
	readonly name: string;
	readonly keywords: readonly string[];
	readonly systemPromptPrefix?: string;
	/** Informational suggestion only — the router never switches models silently. */
	readonly suggestedModel?: string;
}

export interface ICompyleRouterConfig {
	readonly rules: readonly ICompyleRouterRule[];
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
		label: 'Debug',
		keywords: ['error', 'bug', 'crash', 'stack trace', 'traceback', 'exception', 'fails', 'broken', 'not working'],
		systemPrefix: 'Treat this as debugging. Form hypotheses and isolate the root cause before proposing a fix.',
	},
	{
		label: 'Architecture',
		keywords: ['architect', 'design', 'structure', 'refactor', 'scalab', 'trade-off', 'tradeoff', 'pattern'],
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
