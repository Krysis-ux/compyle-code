/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { timeout } from '../../../../base/common/async.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { ITerminalService, ITerminalGroupService, ITerminalInstance } from '../../terminal/browser/terminal.js';
import { ICompyleBrainService, ICompyleChatMessage } from './compyleBrainService.js';
import { CompyleAgentAction, COMPYLE_AGENT_SYSTEM_PROMPT, parseAgentActions } from '../common/compyleAgentProtocol.js';

export const ICompyleAgentService = createDecorator<ICompyleAgentService>('compyleAgentService');

/** Events the agent loop emits to drive the chat UI. */
export type ICompyleAgentEvent =
	| { readonly type: 'token'; readonly delta: string }
	| { readonly type: 'assistant-done'; readonly text: string }
	| { readonly type: 'diff'; readonly path: string; readonly original: string; readonly modified: string; readonly accept: () => void; readonly reject: () => void }
	| { readonly type: 'applied'; readonly path: string }
	| { readonly type: 'rejected'; readonly path: string }
	| { readonly type: 'run-output'; readonly command: string; readonly output: string }
	| { readonly type: 'status'; readonly message: string }
	| { readonly type: 'error'; readonly message: string };

export interface ICompyleAgentResult {
	/** The final plain-text assistant summary. */
	readonly finalText: string;
	/** Assistant + tool-result messages produced during the loop, for the caller to persist as context. */
	readonly transcriptAdditions: ICompyleChatMessage[];
}

export interface ICompyleAgentService {
	readonly _serviceBrand: undefined;
	/**
	 * Run one agent turn: stream the model, parse and execute its actions (reading files,
	 * running commands, and applying edits — with diff approval unless full-control is on),
	 * feeding results back until the model finishes or the step budget is reached.
	 */
	run(messages: ICompyleChatMessage[], onEvent: (e: ICompyleAgentEvent) => void, token: CancellationToken): Promise<ICompyleAgentResult>;
}

/** Output sentinel: the echoed input keeps the quotes, the output does not, so we match only real output. */
const RUN_MARKER = 'COMPYLEDONE7Z';
const RUN_MARKER_CMD = 'echo COMPYLE""DONE7Z';
const RUN_TIMEOUT_MS = 30000;

export class CompyleAgentService extends Disposable implements ICompyleAgentService {
	declare readonly _serviceBrand: undefined;

	private _agentTerminal: ITerminalInstance | undefined;

	constructor(
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IFileService private readonly _fileService: IFileService,
		@ITextFileService private readonly _textFileService: ITextFileService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
	) {
		super();
	}

	async run(messages: ICompyleChatMessage[], onEvent: (e: ICompyleAgentEvent) => void, token: CancellationToken): Promise<ICompyleAgentResult> {
		const working = [...messages];
		const additions: ICompyleChatMessage[] = [];
		const maxSteps = this._configurationService.getValue<number>('compyle.brain.maxAgentSteps') ?? 12;
		const allowRun = this._configurationService.getValue<boolean>('compyle.brain.allowRunCommands') !== false;
		const autoApply = this._configurationService.getValue<string>('compyle.brain.agentEditing') === 'auto';

		let finalText = '';

		for (let step = 0; step < maxSteps; step++) {
			if (token.isCancellationRequested) {
				break;
			}

			const assistantText = await this._brainService.chatStream(
				working,
				delta => onEvent({ type: 'token', delta }),
				{ system: COMPYLE_AGENT_SYSTEM_PROMPT, silent: true },
				token,
			);
			onEvent({ type: 'assistant-done', text: assistantText });
			working.push({ role: 'assistant', content: assistantText });
			additions.push({ role: 'assistant', content: assistantText });
			finalText = assistantText;

			const actions = parseAgentActions(assistantText);
			if (actions.length === 0) {
				break; // final answer
			}

			const results: string[] = [];
			for (const action of actions) {
				if (token.isCancellationRequested) {
					break;
				}
				results.push(await this._execute(action, allowRun, autoApply, onEvent, token));
			}

			const toolMessage = results.join('\n\n');
			working.push({ role: 'user', content: toolMessage });
			additions.push({ role: 'user', content: toolMessage });
		}

		return { finalText, transcriptAdditions: additions };
	}

	private async _execute(action: CompyleAgentAction, allowRun: boolean, autoApply: boolean, onEvent: (e: ICompyleAgentEvent) => void, token: CancellationToken): Promise<string> {
		switch (action.kind) {
			case 'read':
				return this._executeRead(action.path);
			case 'run':
				if (!allowRun) {
					return localize('compyleAgent.runBlocked', "Result of `{0}`: skipped (running commands is disabled in Settings).", action.command);
				}
				return this._executeRun(action.command, onEvent, token);
			case 'create':
				return this._executeWrite(action.path, '', action.content, autoApply, onEvent);
			case 'edit':
				return this._executeEdit(action, autoApply, onEvent);
		}
	}

	private async _executeRead(path: string): Promise<string> {
		const uri = this._resolvePath(path);
		if (!uri) {
			return localize('compyleAgent.noWorkspace', "Could not resolve `{0}` — no workspace folder is open.", path);
		}
		try {
			const content = (await this._fileService.readFile(uri)).value.toString();
			return localize('compyleAgent.readResult', "Contents of `{0}`:\n```\n{1}\n```", path, content);
		} catch {
			return localize('compyleAgent.readFailed', "Could not read `{0}` (it may not exist).", path);
		}
	}

	private async _executeEdit(action: { path: string; search: string; replace: string }, autoApply: boolean, onEvent: (e: ICompyleAgentEvent) => void): Promise<string> {
		const uri = this._resolvePath(action.path);
		if (!uri) {
			return localize('compyleAgent.noWorkspace', "Could not resolve `{0}` — no workspace folder is open.", action.path);
		}
		let original: string;
		try {
			original = (await this._fileService.readFile(uri)).value.toString();
		} catch {
			return localize('compyleAgent.editMissing', "Cannot edit `{0}` — it does not exist. Use compyle:create instead.", action.path);
		}
		if (!original.includes(action.search)) {
			return localize('compyleAgent.searchNotFound', "Edit to `{0}` failed: the SEARCH text was not found in the file.", action.path);
		}
		const modified = original.replace(action.search, action.replace);
		return this._applyOrApprove(uri, action.path, original, modified, autoApply, onEvent);
	}

	private async _executeWrite(path: string, original: string, modified: string, autoApply: boolean, onEvent: (e: ICompyleAgentEvent) => void): Promise<string> {
		const uri = this._resolvePath(path);
		if (!uri) {
			return localize('compyleAgent.noWorkspace', "Could not resolve `{0}` — no workspace folder is open.", path);
		}
		// A create over an existing file should show its real prior contents in the diff.
		let prior = original;
		try {
			prior = (await this._fileService.readFile(uri)).value.toString();
		} catch {
			prior = '';
		}
		return this._applyOrApprove(uri, path, prior, modified, autoApply, onEvent);
	}

	private async _applyOrApprove(uri: URI, path: string, original: string, modified: string, autoApply: boolean, onEvent: (e: ICompyleAgentEvent) => void): Promise<string> {
		if (!autoApply) {
			const approved = await new Promise<boolean>(resolve => {
				onEvent({ type: 'diff', path, original, modified, accept: () => resolve(true), reject: () => resolve(false) });
			});
			if (!approved) {
				onEvent({ type: 'rejected', path });
				return localize('compyleAgent.rejected', "The user rejected the edit to `{0}`.", path);
			}
		}
		try {
			await this._textFileService.create([{ resource: uri, value: modified, options: { overwrite: true } }]);
			onEvent({ type: 'applied', path });
			return localize('compyleAgent.applied', "Applied the edit to `{0}`.", path);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			onEvent({ type: 'error', message });
			return localize('compyleAgent.applyFailed', "Failed to write `{0}`: {1}", path, message);
		}
	}

	private async _executeRun(command: string, onEvent: (e: ICompyleAgentEvent) => void, token: CancellationToken): Promise<string> {
		if (!this._agentTerminal || this._agentTerminal.isDisposed) {
			this._agentTerminal = await this._terminalService.createTerminal({ config: { name: 'Compyle Agent' } });
		}
		const terminal = this._agentTerminal;
		this._terminalGroupService.showPanel(false);

		const lines: string[] = [];
		const store = new DisposableStore();
		const done = new Promise<void>(resolve => {
			store.add(terminal.onLineData(line => {
				if (line.includes(RUN_MARKER)) {
					resolve();
					return;
				}
				lines.push(line);
			}));
			store.add(token.onCancellationRequested(() => resolve()));
		});

		terminal.sendText(command, true);
		terminal.sendText(RUN_MARKER_CMD, true);
		await Promise.race([done, timeout(RUN_TIMEOUT_MS)]);
		store.dispose();

		const output = lines.join('\n').trim();
		onEvent({ type: 'run-output', command, output });
		return localize('compyleAgent.runResult', "Output of `{0}`:\n```\n{1}\n```", command, output || '(no output captured)');
	}

	/** Resolve a model-provided path (relative to the workspace, or absolute) to a URI. */
	private _resolvePath(path: string): URI | undefined {
		if (/^(?:[a-zA-Z]:[\\/]|\/)/.test(path)) {
			return URI.file(path);
		}
		const root = this._workspaceContextService.getWorkspace().folders[0]?.uri;
		return root ? joinPath(root, path) : undefined;
	}
}

registerSingleton(ICompyleAgentService, CompyleAgentService, InstantiationType.Delayed);
