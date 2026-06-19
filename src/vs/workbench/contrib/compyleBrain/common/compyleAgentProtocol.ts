/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The Compyle agent "action protocol". Local models cannot be relied on to emit
 * native tool/function calls, so the agent instead writes fenced action blocks
 * in its reply. We parse the completed reply into structured actions, execute
 * them (with the user's approval for edits), and feed the results back so the
 * model can continue. This is model-agnostic: any chat model that can follow
 * the prompt below can drive the agent.
 */

export type CompyleAgentAction =
	| { readonly kind: 'create'; readonly path: string; readonly content: string }
	| { readonly kind: 'edit'; readonly path: string; readonly search: string; readonly replace: string }
	| { readonly kind: 'run'; readonly command: string }
	| { readonly kind: 'read'; readonly path: string };

const ACTION_FENCE = /```compyle:(create|edit|run|read)([^\n]*)\n([\s\S]*?)```/g;
const PATH_IN_HEADER = /path=(\S+)/;
const SEARCH_REPLACE = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/;

/** Remove a single trailing newline (the one before the closing fence). */
function trimFenceBody(body: string): string {
	return body.replace(/\n$/, '');
}

/**
 * Parse a completed assistant reply into the list of actions it requested.
 * Lenient: malformed blocks (e.g. an edit missing its REPLACE marker, or a
 * create/read with no `path=`) are skipped rather than throwing.
 */
export function parseAgentActions(text: string): CompyleAgentAction[] {
	const normalized = text.replace(/\r\n/g, '\n');
	const actions: CompyleAgentAction[] = [];

	ACTION_FENCE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = ACTION_FENCE.exec(normalized)) !== null) {
		const kind = match[1];
		const header = match[2];
		const body = trimFenceBody(match[3]);
		const path = header.match(PATH_IN_HEADER)?.[1];

		switch (kind) {
			case 'create':
				if (path) {
					actions.push({ kind: 'create', path, content: body });
				}
				break;
			case 'edit': {
				const sr = body.match(SEARCH_REPLACE);
				if (path && sr) {
					actions.push({ kind: 'edit', path, search: sr[1], replace: sr[2] });
				}
				break;
			}
			case 'run': {
				const command = body.trim();
				if (command) {
					actions.push({ kind: 'run', command });
				}
				break;
			}
			case 'read':
				if (path) {
					actions.push({ kind: 'read', path });
				}
				break;
		}
	}

	return actions;
}

/**
 * The system prompt that teaches a model the action protocol. Prepended to the
 * agent's system message by {@link CompyleAgentService}.
 */
export const COMPYLE_AGENT_SYSTEM_PROMPT = [
	'You are Compyle AI, a coding agent running inside the user\'s editor. You can read and change files and run commands by writing fenced action blocks. Use these exact formats, one action per block:',
	'',
	'Create a new file:',
	'```compyle:create path=relative/path.ext',
	'<full file contents>',
	'```',
	'',
	'Edit an existing file (exact search/replace; the SEARCH text must match the file exactly):',
	'```compyle:edit path=relative/path.ext',
	'<<<<<<< SEARCH',
	'<text to find>',
	'=======',
	'<replacement text>',
	'>>>>>>> REPLACE',
	'```',
	'',
	'Run a shell command (e.g. to build or test):',
	'```compyle:run',
	'<command>',
	'```',
	'',
	'Read a file before changing it:',
	'```compyle:read path=relative/path.ext',
	'```',
	'',
	'After your action blocks you will receive the results (file contents, command output, or whether an edit was applied or rejected), and you may continue with more actions. When the task is complete, reply with a short plain-text summary and NO action blocks. Prefer small, verifiable steps. Only edit files the user is working in.',
].join('\n');
