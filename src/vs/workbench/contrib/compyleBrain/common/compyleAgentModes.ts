/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compyle agent modes shape how Compyle Brain responds. The active mode prepends
 * a system-prompt prefix to every brain request, steering the model toward a
 * role (architecture, debugging, security review, etc.) without changing the
 * provider or model. This is distinct from the workspace "experiences" in
 * compyleModes (flow/focus/tutor/resolve), which reshape the editor.
 */

export type CompyleAgentMode = 'code' | 'architect' | 'debug' | 'ask' | 'security' | 'test' | 'docs';

export const COMPYLE_AGENT_MODE_SETTING = 'compyle.agent.mode';

export interface ICompyleAgentModeInfo {
	readonly id: CompyleAgentMode;
	readonly name: string;
	/** Codicon id (without the `$(...)` wrapper). */
	readonly icon: string;
	readonly description: string;
	/** Prepended to the system prompt of every brain request in this mode. */
	readonly systemPrefix: string;
}

export const COMPYLE_AGENT_MODES: readonly ICompyleAgentModeInfo[] = [
	{
		id: 'code',
		name: 'Code',
		icon: 'code',
		description: 'General coding, edits, and file operations.',
		systemPrefix: 'You are a senior software engineer. Write correct, idiomatic, well-structured code and make focused changes.',
	},
	{
		id: 'architect',
		name: 'Architect',
		icon: 'circuit-board',
		description: 'System design, patterns, and trade-offs.',
		systemPrefix: 'You are a software architect. Focus on system design, patterns, and trade-offs. Prefer clear explanations and diagrams in text; do not write large amounts of code unless asked.',
	},
	{
		id: 'debug',
		name: 'Debug',
		icon: 'debug',
		description: 'Trace issues and isolate root causes.',
		systemPrefix: 'You are a debugging expert. Trace problems systematically, form hypotheses, and isolate the root cause before proposing a fix. Reason about errors and stack traces step by step.',
	},
	{
		id: 'ask',
		name: 'Ask',
		icon: 'comment-discussion',
		description: 'Answer questions without editing files.',
		systemPrefix: 'You are answering questions about the codebase. Explain clearly and concisely. Do not modify files unless explicitly asked.',
	},
	{
		id: 'security',
		name: 'Security',
		icon: 'shield',
		description: 'Find vulnerabilities and harden code.',
		systemPrefix: 'You are a security reviewer. Identify vulnerabilities (OWASP Top 10, injection, secrets, unsafe input handling) and recommend concrete, minimal fixes. Be precise about severity.',
	},
	{
		id: 'test',
		name: 'Test',
		icon: 'beaker',
		description: 'Write tests first, then implementation.',
		systemPrefix: 'You are a test-driven development specialist. Write focused tests first that capture the desired behavior, then the minimal implementation to pass them. Cover edge cases.',
	},
	{
		id: 'docs',
		name: 'Docs',
		icon: 'book',
		description: 'Generate clear documentation.',
		systemPrefix: 'You are a technical writer. Produce clear, accurate documentation and README updates. Use concise prose, good headings, and runnable examples.',
	},
];

export function getAgentMode(value: string | undefined): CompyleAgentMode {
	const found = COMPYLE_AGENT_MODES.find(m => m.id === value);
	return found ? found.id : 'code';
}

export function getAgentModeInfo(value: string | undefined): ICompyleAgentModeInfo {
	return COMPYLE_AGENT_MODES.find(m => m.id === value) ?? COMPYLE_AGENT_MODES[0];
}

/** System-prompt prefix for the given mode, or '' for plain Code mode. */
export function getAgentModeSystemPrompt(value: string | undefined): string {
	const mode = getAgentModeInfo(value);
	return mode.id === 'code' ? '' : mode.systemPrefix;
}
