/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { match } from '../../../../base/common/glob.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { buildAgentSystemPrompt, buildAgentUserPrompt, getAgentRole } from '../common/compyleAgents.js';

export const ICompyleAgentService = createDecorator<ICompyleAgentService>('compyleAgentService');

export interface IAgentProposal {
	readonly id: string;
	readonly roleId: string;
	readonly roleName: string;
	readonly instruction: string;
	readonly uri: URI;
	readonly fileName: string;
	readonly languageId: string;
	readonly original: string;
	readonly proposed: string;
}

export interface ICompyleAgentService {
	readonly _serviceBrand: undefined;
	/** Ask the role's agent to propose a rewrite of the target file (or the active editor). */
	proposeEdit(roleId: string, instruction: string, uri?: URI): Promise<IAgentProposal>;
	/** Apply a proposal to disk, snapshotting the previous contents for undo. */
	applyProposal(proposal: IAgentProposal): Promise<void>;
	/** Restore the file to its pre-apply contents. */
	undo(proposalId: string): Promise<void>;
}

const EXCLUDE_SETTING = 'compyle.brain.excludePatterns';
const SCOPE_SETTING = 'compyle.agent.scopeFolder';

export class CompyleAgentService implements ICompyleAgentService {
	declare readonly _serviceBrand: undefined;

	private readonly _snapshots = new Map<string, { uri: URI; content: string }>();

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@ICodeEditorService private readonly _codeEditorService: ICodeEditorService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
	) { }

	private _assertAllowed(uri: URI): void {
		const root = this._contextService.getWorkspace().folders[0]?.uri;
		const path = uri.path;

		const excludes = this._configurationService.getValue<string[]>(EXCLUDE_SETTING) ?? [];
		for (const pattern of excludes) {
			if (match(pattern, path)) {
				throw new Error(localize('compyle.agent.excluded', "\"{0}\" is excluded from agent edits (matches {1}).", uri.path.split('/').pop() ?? uri.path, pattern));
			}
		}

		const scope = (this._configurationService.getValue<string>(SCOPE_SETTING) ?? '').trim();
		if (scope && root) {
			const scopeUri = URI.joinPath(root, scope);
			if (!path.startsWith(scopeUri.path.replace(/\/?$/, '/'))) {
				throw new Error(localize('compyle.agent.outOfScope', "Agent edits are restricted to \"{0}\". This file is outside that folder.", scope));
			}
		}
	}

	async proposeEdit(roleId: string, instruction: string, uri?: URI): Promise<IAgentProposal> {
		if (!this._brainService.isConfigured()) {
			throw new Error(localize('compyle.agent.noBrain', "Configure Compyle Brain (an AI provider) before running agents."));
		}
		const role = getAgentRole(roleId);
		if (!role) {
			throw new Error(localize('compyle.agent.noRole', "Unknown agent role."));
		}

		const editor = this._codeEditorService.getActiveCodeEditor();
		const model = uri
			? undefined
			: editor?.getModel() ?? undefined;
		const targetUri = uri ?? model?.uri;
		if (!targetUri) {
			throw new Error(localize('compyle.agent.noTarget', "Open a file in the editor, then run the agent on it."));
		}

		this._assertAllowed(targetUri);

		let original: string;
		let languageId = 'plaintext';
		if (model && model.uri.toString() === targetUri.toString()) {
			original = model.getValue();
			languageId = model.getLanguageId();
		} else {
			original = (await this._fileService.readFile(targetUri)).value.toString();
		}

		const fileName = targetUri.path.split('/').pop() ?? targetUri.path;
		const system = buildAgentSystemPrompt(role);
		const userPrompt = buildAgentUserPrompt(instruction || role.instruction, languageId, fileName, original);

		const reply = await this._brainService.chat([{ role: 'user', content: userPrompt }], { system, maxTokens: 8192 });
		const proposed = this._stripFences(reply);

		return {
			id: generateUuid(),
			roleId,
			roleName: role.name,
			instruction: instruction || role.instruction,
			uri: targetUri,
			fileName,
			languageId,
			original,
			proposed,
		};
	}

	async applyProposal(proposal: IAgentProposal): Promise<void> {
		this._assertAllowed(proposal.uri);
		// Snapshot the current on-disk contents (not the cached original) for an accurate undo.
		let current = proposal.original;
		try {
			current = (await this._fileService.readFile(proposal.uri)).value.toString();
		} catch {
			// file may be new/unsaved — fall back to the captured original
		}
		this._snapshots.set(proposal.id, { uri: proposal.uri, content: current });
		await this._fileService.writeFile(proposal.uri, VSBuffer.fromString(proposal.proposed));
	}

	async undo(proposalId: string): Promise<void> {
		const snapshot = this._snapshots.get(proposalId);
		if (!snapshot) {
			throw new Error(localize('compyle.agent.noSnapshot', "No snapshot is available to undo this change."));
		}
		await this._fileService.writeFile(snapshot.uri, VSBuffer.fromString(snapshot.content));
		this._snapshots.delete(proposalId);
	}

	private _stripFences(text: string): string {
		const trimmed = text.trim();
		const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
		return fenced ? fenced[1] : trimmed;
	}
}

registerSingleton(ICompyleAgentService, CompyleAgentService, InstantiationType.Delayed);
