/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleAgent.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { recordFlowActionForRoot } from '../../compyleModes/browser/compyleFlowMemory.js';
import { AgentTaskStatus, COMPYLE_AGENT_ROLES } from '../common/compyleAgents.js';
import { CompyleAgentInput } from './compyleAgentInput.js';
import { IAgentProposal, ICompyleAgentService } from './compyleAgentService.js';

interface ITaskEntry {
	proposal: IAgentProposal;
	status: AgentTaskStatus;
}

export class CompyleAgentEditor extends EditorPane {

	static readonly ID = 'compyleAgent';

	private _roleList!: HTMLElement;
	private _taskInput!: HTMLTextAreaElement;
	private _historyList!: HTMLElement;
	private _runButton!: HTMLButtonElement;

	private readonly _historyDisposables = this._register(new DisposableStore());
	private _activeRoleId = COMPYLE_AGENT_ROLES[0].id;
	private readonly _tasks: ITaskEntry[] = [];

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleAgentService private readonly _agentService: ICompyleAgentService,
		@IEditorService private readonly _editorService: IEditorService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IProgressService private readonly _progressService: IProgressService,
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super(CompyleAgentEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.cag-root'));

		const header = append(root, $('.cag-header'));
		append(header, $('h2.cag-title', undefined, localize("compyleAgent.heading", "Agent Workspace")));
		append(header, $('.cag-subtitle', undefined, localize("compyleAgent.subheading", "Plan a focused single-file change, review the diff, then apply, reject, or undo with Flow memory tracking.")));

		const body = append(root, $('.cag-body'));

		// Roles column
		const rolesCol = append(body, $('.cag-roles'));
		append(rolesCol, $('.cag-col-label', undefined, localize("compyleAgent.agents", "Agents")));
		this._roleList = append(rolesCol, $('.cag-role-list'));
		for (const role of COMPYLE_AGENT_ROLES) {
			const card = append(this._roleList, $('.cag-role', { 'data-role': role.id }));
			if (role.id === this._activeRoleId) {
				card.classList.add('active');
			}
			append(card, $(`span.cag-role-icon.codicon.codicon-${role.icon}`));
			const info = append(card, $('.cag-role-info'));
			append(info, $('.cag-role-name', undefined, role.name));
			append(info, $('.cag-role-desc', undefined, role.description));
			this._register(addDisposableListener(card, 'click', () => this._selectRole(role.id)));
		}

		// Main column
		const main = append(body, $('.cag-main'));
		const form = append(main, $('.cag-form'));
		this._taskInput = append(form, $('textarea.cag-task')) as HTMLTextAreaElement;
		this._taskInput.placeholder = localize("compyleAgent.taskPlaceholder", "Describe the change for the active file… e.g. \"add input validation to the form\"");
		this._taskInput.spellcheck = false;

		const formBar = append(form, $('.cag-form-bar'));
		append(formBar, $('.cag-target-note', undefined, localize("compyleAgent.targetNote", "Runs on the active editor file.")));
		this._runButton = append(formBar, $('button.cag-run', undefined, localize("compyleAgent.run", "Run Agent"))) as HTMLButtonElement;
		this._register(addDisposableListener(this._runButton, 'click', () => this._run()));

		append(main, $('.cag-guard', undefined, localize("compyleAgent.guard", "Guardrails: edits are single-file and reviewable. Excluded files are blocked, commands never run, and every apply keeps an undo snapshot.")));

		append(main, $('.cag-col-label', undefined, localize("compyleAgent.history", "Task History")));
		this._historyList = append(main, $('.cag-history'));
		this._renderHistory();
	}

	private _selectRole(id: string): void {
		this._activeRoleId = id;
		for (const card of this._roleList.children) {
			card.classList.toggle('active', card.getAttribute('data-role') === id);
		}
	}

	private async _run(): Promise<void> {
		const instruction = this._taskInput.value.trim();
		this._runButton.disabled = true;
		try {
			const proposal = await this._progressService.withProgress(
				{ location: ProgressLocation.Notification, title: localize("compyleAgent.working", "Agent is drafting changes…") },
				() => this._agentService.proposeEdit(this._activeRoleId, instruction),
			);
			this._tasks.unshift({ proposal, status: 'proposed' });
			this._renderHistory();
			void this._openDiff(proposal);
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		} finally {
			this._runButton.disabled = false;
		}
	}

	private async _openDiff(proposal: IAgentProposal): Promise<void> {
		await this._editorService.openEditor({
			original: { resource: proposal.uri },
			modified: {
				resource: URI.from({ scheme: 'untitled', path: `${proposal.fileName} (proposed)` }),
				contents: proposal.proposed,
				languageId: proposal.languageId,
			},
			label: localize("compyleAgent.diffLabel", "Agent: {0}", proposal.fileName),
		});
	}

	private _renderHistory(): void {
		this._historyDisposables.clear();
		clearNode(this._historyList);

		if (this._tasks.length === 0) {
			append(this._historyList, $('.cag-empty', undefined, localize("compyleAgent.noTasks", "No tasks yet. Pick an agent, describe a change, and run it.")));
			return;
		}

		for (const task of this._tasks) {
			this._renderTask(task);
		}
	}

	private _renderTask(task: ITaskEntry): void {
		const row = append(this._historyList, $('.cag-task-row'));

		const top = append(row, $('.cag-task-top'));
		append(top, $('span.cag-task-role', undefined, task.proposal.roleName));
		append(top, $('span.cag-task-file', undefined, task.proposal.fileName));
		append(top, $(`span.cag-task-status.status-${task.status}`, undefined, this._statusLabel(task.status)));

		append(row, $('.cag-task-instruction', undefined, task.proposal.instruction));

		const actions = append(row, $('.cag-task-actions'));
		this._addAction(actions, localize("compyleAgent.reviewDiff", "Review Diff"), () => this._openDiff(task.proposal));

		if (task.status === 'proposed') {
			this._addAction(actions, localize("compyleAgent.apply", "Apply"), () => this._apply(task), true);
			this._addAction(actions, localize("compyleAgent.reject", "Reject"), () => this._reject(task));
		} else if (task.status === 'applied') {
			this._addAction(actions, localize("compyleAgent.undo", "Undo"), () => this._undo(task));
		}
	}

	private _addAction(parent: HTMLElement, label: string, run: () => void, primary = false): void {
		const button = append(parent, $(`button.cag-action${primary ? '.primary' : ''}`, undefined, label)) as HTMLButtonElement;
		this._historyDisposables.add(addDisposableListener(button, 'click', run));
	}

	private async _apply(task: ITaskEntry): Promise<void> {
		try {
			await this._agentService.applyProposal(task.proposal);
			this._setStatus(task, 'applied');
			await this._recordFlowAction('Applied Agent Proposal', task, 'applied');
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	private async _reject(task: ITaskEntry): Promise<void> {
		this._setStatus(task, 'rejected');
		await this._recordFlowAction('Rejected Agent Proposal', task, 'rejected');
	}

	private async _undo(task: ITaskEntry): Promise<void> {
		try {
			await this._agentService.undo(task.proposal.id);
			this._setStatus(task, 'rejected');
			await this._recordFlowAction('Undid Agent Proposal', task, 'undone');
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	private _setStatus(task: ITaskEntry, status: AgentTaskStatus): void {
		task.status = status;
		this._renderHistory();
	}

	private _statusLabel(status: AgentTaskStatus): string {
		switch (status) {
			case 'proposed': return localize("compyleAgent.status.proposed", "Proposed");
			case 'applied': return localize("compyleAgent.status.applied", "Applied");
			case 'rejected': return localize("compyleAgent.status.rejected", "Reverted");
			case 'failed': return localize("compyleAgent.status.failed", "Failed");
			default: return localize("compyleAgent.status.idle", "Idle");
		}
	}

	private async _recordFlowAction(title: string, task: ITaskEntry, status: string): Promise<void> {
		if (this._configurationService.getValue<string>('compyle.modes.activeMode') !== 'flow') {
			return;
		}
		if (this._configurationService.getValue<boolean>('compyle.modes.memory.enabled') === false) {
			return;
		}
		const folder = this._contextService.getWorkspace().folders[0];
		if (!folder) {
			return;
		}
		await recordFlowActionForRoot(this._fileService, folder.uri, folder.name || 'Project', {
			title,
			detail: `${task.proposal.roleName}: ${task.proposal.instruction}`,
			status,
			files: [task.proposal.fileName],
		});
	}

	override async setInput(input: CompyleAgentInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
