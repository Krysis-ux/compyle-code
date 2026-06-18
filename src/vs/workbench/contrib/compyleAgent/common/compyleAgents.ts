/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Agent Workspace roles. Each role is a lens that shapes how the agent
 * rewrites a file. The v1 capability is a bounded, reviewable single-file edit:
 * propose -> diff -> approve -> apply (with snapshot) -> undo. Autonomous
 * multi-file orchestration and command execution are intentionally out of scope.
 */

export type AgentTaskStatus = 'idle' | 'planning' | 'proposed' | 'applied' | 'rejected' | 'failed';

export interface ICompyleAgentRole {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly icon: string;
	readonly instruction: string;
}

const BASE_SYSTEM = [
	'You are a precise coding agent operating on a SINGLE file.',
	'Return ONLY the full, updated contents of the file.',
	'Do NOT include explanations, comments about your changes, or Markdown code fences.',
	'Preserve unrelated code, the existing style, and the indentation character (tabs or spaces).',
	'If the request cannot be done safely, return the file unchanged.',
].join(' ');

export const COMPYLE_AGENT_ROLES: ICompyleAgentRole[] = [
	{ id: 'builder', name: 'Builder', description: 'Implement a feature or change.', icon: 'tools', instruction: 'Implement the requested change in this file.' },
	{ id: 'debugger', name: 'Debugger', description: 'Find and fix a bug.', icon: 'debug', instruction: 'Find and fix the described bug in this file.' },
	{ id: 'refactor', name: 'Refactor', description: 'Clean up without changing behavior.', icon: 'wand', instruction: 'Refactor this file to be cleaner and simpler WITHOUT changing its behavior.' },
	{ id: 'test', name: 'Test Writer', description: 'Add or improve tests.', icon: 'beaker', instruction: 'Add or improve tests in this file for the described target.' },
	{ id: 'docs', name: 'Documenter', description: 'Improve comments and docs.', icon: 'book', instruction: 'Improve the comments and documentation in this file. Do not change behavior.' },
	{ id: 'security', name: 'Security', description: 'Fix risky patterns.', icon: 'shield', instruction: 'Fix risky or insecure patterns in this file. Do not change unrelated behavior.' },
];

export function getAgentRole(id: string): ICompyleAgentRole | undefined {
	return COMPYLE_AGENT_ROLES.find(r => r.id === id);
}

export function buildAgentSystemPrompt(role: ICompyleAgentRole): string {
	return `${BASE_SYSTEM} Role focus: ${role.instruction}`;
}

export function buildAgentUserPrompt(instruction: string, languageId: string, fileName: string, content: string): string {
	return [
		`File: ${fileName} (${languageId})`,
		`Task: ${instruction}`,
		'',
		'Current file contents:',
		content,
	].join('\n');
}
