/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';

/**
 * Compyle Spec — Spec-Driven Development Mode
 *
 * Flow:
 *  1. User enters rough idea → Compyle Brain generates REQUIREMENTS.md, DESIGN.md, TASKS.md
 *  2. Specs live in .compyle/specs/<feature-name>/
 *  3. "Implement Next Task" sends the first unchecked task to Compyle Brain
 *
 * Status badges: Draft | Approved | In Progress | Done
 */

export const enum SpecStatus {
	Draft = 'draft',
	Approved = 'approved',
	InProgress = 'in-progress',
	Done = 'done',
}

export interface CompyleSpec {
	readonly name: string;
	readonly directory: string;
	readonly status: SpecStatus;
	readonly files: {
		requirements?: string;
		design?: string;
		tasks?: string;
		decisions?: string;
		testPlan?: string;
	};
}

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };
const SPEC_ENABLED_SETTING = 'compyle.spec.enabled';
const SPECS_DIR = '.compyle/specs';

// Delimiters the model is asked to emit so one reply yields all three documents.
const REQ_MARK = '===REQUIREMENTS===';
const DESIGN_MARK = '===DESIGN===';
const TASKS_MARK = '===TASKS===';

const SPEC_SYSTEM_PROMPT = `You are a senior software architect creating a development spec.
Given a feature idea, produce THREE markdown documents separated by exact delimiter lines.
Output format — emit each delimiter on its own line, nothing before the first one:

${REQ_MARK}
# Requirements: <feature>
## Problem Statement
...
## User Stories
...
## Acceptance Criteria
- [ ] ...
## Out of Scope
...

${DESIGN_MARK}
# Design: <feature>
## Architecture
...
## Data Model
...
## API / Interface
...
## Risks
...

${TASKS_MARK}
# Tasks: <feature>
## Implementation Checklist
- [ ] Task 1: ...
- [ ] Task 2: ...
- [ ] Tests: ...
- [ ] Docs: ...

Keep it concrete and specific to the idea. Use real, actionable checklist items.`;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[SPEC_ENABLED_SETTING]: {
			type: 'boolean',
			default: true,
			description: localize('compyle.spec.enabled', "Enable Compyle Spec — spec-driven development that turns an idea into REQUIREMENTS, DESIGN, and TASKS documents."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
	return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'feature';
}

function workspaceRoot(contextService: IWorkspaceContextService): URI | undefined {
	return contextService.getWorkspace().folders[0]?.uri;
}

function splitSpecReply(reply: string, featureName: string): { requirements: string; design: string; tasks: string } {
	const reqIdx = reply.indexOf(REQ_MARK);
	const designIdx = reply.indexOf(DESIGN_MARK);
	const tasksIdx = reply.indexOf(TASKS_MARK);

	// If the model ignored the delimiters, keep the whole reply as requirements
	// and seed sensible empty design/tasks so the flow still works.
	if (reqIdx === -1 || designIdx === -1 || tasksIdx === -1) {
		return {
			requirements: reply.trim() || `# Requirements: ${featureName}\n`,
			design: `# Design: ${featureName}\n\n## Architecture\n`,
			tasks: `# Tasks: ${featureName}\n\n## Implementation Checklist\n\n- [ ] Define first task\n`,
		};
	}

	const requirements = reply.slice(reqIdx + REQ_MARK.length, designIdx).trim();
	const design = reply.slice(designIdx + DESIGN_MARK.length, tasksIdx).trim();
	const tasks = reply.slice(tasksIdx + TASKS_MARK.length).trim();
	return { requirements, design, tasks };
}

async function listSpecFolders(fileService: IFileService, root: URI): Promise<URI[]> {
	const dir = joinPath(root, SPECS_DIR);
	if (!(await fileService.exists(dir))) {
		return [];
	}
	const stat = await fileService.resolve(dir);
	return (stat.children ?? []).filter(c => c.isDirectory).map(c => c.resource);
}

function firstUncheckedTask(tasksMarkdown: string): string | undefined {
	for (const line of tasksMarkdown.split(/\r?\n/)) {
		const match = line.match(/^\s*-\s*\[\s\]\s*(.+)$/);
		if (match) {
			return match[1].trim();
		}
	}
	return undefined;
}

function specEnabled(configurationService: IConfigurationService, notificationService: INotificationService): boolean {
	if (configurationService.getValue<boolean>(SPEC_ENABLED_SETTING) === false) {
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.disabled', "Compyle Spec is turned off. Enable it in Settings ({0}).", SPEC_ENABLED_SETTING) });
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

class NewFromIdeaAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.spec.newFromIdea',
			title: { value: localize('compyle.spec.newFromIdea', "Build From Idea..."), original: 'Build From Idea...' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		const quickInputService = accessor.get(IQuickInputService);
		const brainService = accessor.get(ICompyleBrainService);
		const progressService = accessor.get(IProgressService);
		const fileService = accessor.get(IFileService);
		const contextService = accessor.get(IWorkspaceContextService);
		const editorService = accessor.get(IEditorService);

		if (!specEnabled(configurationService, notificationService)) {
			return;
		}

		const root = workspaceRoot(contextService);
		if (!root) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.noFolder', "Open a folder first to create a spec.") });
			return;
		}
		if (!brainService.isConfigured()) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.noBrain', "Configure Compyle Brain (an AI provider) to build specs from an idea.") });
			return;
		}

		const name = await quickInputService.input({
			prompt: localize('compyle.spec.namePrompt', "Feature name"),
			placeHolder: localize('compyle.spec.namePlaceholder', "e.g. User Authentication"),
		});
		if (!name) {
			return;
		}
		const idea = await quickInputService.input({
			prompt: localize('compyle.spec.ideaPrompt', "Describe the idea in a sentence or two"),
			placeHolder: localize('compyle.spec.ideaPlaceholder', "What should it do?"),
		});
		if (!idea) {
			return;
		}

		const slug = slugify(name);
		const specDir = joinPath(root, SPECS_DIR, slug);

		try {
			const reply = await progressService.withProgress(
				{ location: ProgressLocation.Notification, title: localize('compyle.spec.generating', "Compyle is drafting your spec...") },
				() => brainService.chat(
					[{ role: 'user', content: `Feature name: ${name}\n\nIdea: ${idea}` }],
					{ system: SPEC_SYSTEM_PROMPT, maxTokens: 4000 },
				),
			);

			const { requirements, design, tasks } = splitSpecReply(reply, name);
			await fileService.writeFile(joinPath(specDir, 'REQUIREMENTS.md'), VSBuffer.fromString(requirements + '\n'));
			await fileService.writeFile(joinPath(specDir, 'DESIGN.md'), VSBuffer.fromString(design + '\n'));
			const tasksUri = joinPath(specDir, 'TASKS.md');
			await fileService.writeFile(tasksUri, VSBuffer.fromString(tasks + '\n'));

			await editorService.openEditor({ resource: tasksUri, options: { pinned: true } });
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.created', "Created spec \"{0}\" in {1}.", name, `${SPECS_DIR}/${slug}`) });
		} catch (error) {
			notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}
}

class ViewSpecsAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.spec.viewSpecs',
			title: { value: localize('compyle.spec.viewSpecs', "View All Specs"), original: 'View All Specs' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		const quickInputService = accessor.get(IQuickInputService);
		const fileService = accessor.get(IFileService);
		const contextService = accessor.get(IWorkspaceContextService);
		const editorService = accessor.get(IEditorService);

		if (!specEnabled(configurationService, notificationService)) {
			return;
		}
		const root = workspaceRoot(contextService);
		if (!root) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.noFolder', "Open a folder first to create a spec.") });
			return;
		}

		const folders = await listSpecFolders(fileService, root);
		if (folders.length === 0) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.none', "No specs yet. Run \"Compyle: Build From Idea...\" to create one.") });
			return;
		}

		const picked = await quickInputService.pick(
			folders.map(uri => ({ label: uri.path.split('/').pop() ?? uri.path, uri })),
			{ placeHolder: localize('compyle.spec.pick', "Open a spec") },
		);
		if (!picked) {
			return;
		}
		await editorService.openEditor({ resource: joinPath(picked.uri, 'TASKS.md'), options: { pinned: true } });
	}
}

class ImplementNextTaskAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.spec.implementNextTask',
			title: { value: localize('compyle.spec.implementNextTask', "Implement Next Task"), original: 'Implement Next Task' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		const brainService = accessor.get(ICompyleBrainService);
		const progressService = accessor.get(IProgressService);
		const fileService = accessor.get(IFileService);
		const contextService = accessor.get(IWorkspaceContextService);
		const editorService = accessor.get(IEditorService);

		if (!specEnabled(configurationService, notificationService)) {
			return;
		}
		const root = workspaceRoot(contextService);
		if (!root) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.noFolder', "Open a folder first to create a spec.") });
			return;
		}
		if (!brainService.isConfigured()) {
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.noBrain', "Configure Compyle Brain (an AI provider) to build specs from an idea.") });
			return;
		}

		const folders = await listSpecFolders(fileService, root);
		for (const folder of folders) {
			const tasksUri = joinPath(folder, 'TASKS.md');
			if (!(await fileService.exists(tasksUri))) {
				continue;
			}
			const tasksMarkdown = (await fileService.readFile(tasksUri)).value.toString();
			const task = firstUncheckedTask(tasksMarkdown);
			if (!task) {
				continue;
			}

			const featureName = folder.path.split('/').pop() ?? 'feature';
			let context = '';
			const designUri = joinPath(folder, 'DESIGN.md');
			if (await fileService.exists(designUri)) {
				context = (await fileService.readFile(designUri)).value.toString().slice(0, 4000);
			}

			try {
				const reply = await progressService.withProgress(
					{ location: ProgressLocation.Notification, title: localize('compyle.spec.implementing', "Compyle is working on the next task...") },
					() => brainService.chat(
						[{ role: 'user', content: `Feature: ${featureName}\n\nDesign context:\n${context}\n\nImplement this task:\n${task}` }],
						{ system: localize('compyle.spec.implementSystem', "You are a senior engineer. Implement the requested task. Show the code and explain where each file goes. Be concrete."), maxTokens: 4000 },
					),
				);
				await editorService.openEditor({
					resource: URI.from({ scheme: 'untitled', path: `Task — ${task.slice(0, 40)}.md` }),
					contents: `# Task: ${task}\n\n${reply}\n`,
					languageId: 'markdown',
					options: { pinned: true },
				});
			} catch (error) {
				notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
			}
			return;
		}

		notificationService.notify({ severity: Severity.Info, message: localize('compyle.spec.allDone', "No unchecked tasks found in any spec.") });
	}
}

registerAction2(NewFromIdeaAction);
registerAction2(ViewSpecsAction);
registerAction2(ImplementNextTaskAction);
