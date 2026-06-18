/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';
import { localize } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

const CompyleExplorerMenu = new MenuId('CompyleExplorerMenu');

const FILE_WHEN = ContextKeyExpr.and(
	ContextKeyExpr.equals('explorerResourceIsFolder', false),
	ContextKeyExpr.has('resourceSet'),
);

MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
	submenu: CompyleExplorerMenu,
	// allow-any-unicode-next-line
	title: localize('compyle.explorerSubmenu', "Compyle ✦"),
	group: 'compyle',
	order: 1,
	when: FILE_WHEN,
});

async function readFileText(fileService: IFileService, notificationService: INotificationService, resource: URI): Promise<string | undefined> {
	try {
		const content = await fileService.readFile(resource);
		return content.value.toString();
	} catch {
		notificationService.notify({ severity: Severity.Error, message: localize('compyle.explorer.readError', "Could not read file.") });
		return undefined;
	}
}

async function openScratch(editorService: IEditorService, name: string, contents: string, languageId: string): Promise<void> {
	await editorService.openEditor({
		resource: URI.from({ scheme: Schemas.untitled, path: name }),
		contents,
		languageId,
		options: { pinned: true },
	});
}

async function askBrainAboutFile(
	brainService: ICompyleBrainService,
	notificationService: INotificationService,
	progressService: IProgressService,
	fileService: IFileService,
	resource: URI,
	system: string,
	progressTitle: string,
	maxTokens: number,
): Promise<string | undefined> {
	if (!brainService.isConfigured()) {
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.explorer.noBrain', "Configure Compyle Brain to use AI file actions.") });
		return undefined;
	}

	const text = await readFileText(fileService, notificationService, resource);
	if (!text) { return undefined; }

	const filename = resource.path.split('/').pop() ?? resource.path;

	try {
		return await progressService.withProgress(
			{ location: ProgressLocation.Notification, title: progressTitle },
			() => brainService.chat(
				[{ role: 'user', content: `File: ${filename}\n\n${text}` }],
				{ system, maxTokens },
			),
		);
	} catch (error) {
		notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		return undefined;
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.explorer.explainFile',
			title: { value: localize('compyle.explorer.explainFile', "Explain This File"), original: 'Explain This File' },
			category: COMPYLE_CATEGORY,
			menu: { id: CompyleExplorerMenu, group: '1_read', order: 1, when: FILE_WHEN },
			f1: false,
		});
	}
	override async run(accessor: ServicesAccessor, resource: URI): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const reply = await askBrainAboutFile(
			brainService, notificationService, progressService, fileService, resource,
			'Explain this file clearly and concisely in Markdown. Cover its purpose, key logic, public API or exports, and any gotchas. Structure with headers.',
			localize('compyle.explorer.explaining', "Explaining file…"),
			3072,
		);
		if (reply) {
			await openScratch(editorService, 'Compyle File Explanation.md', reply.trim(), 'markdown');
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.explorer.findIssues',
			title: { value: localize('compyle.explorer.findIssues', "Find Issues"), original: 'Find Issues' },
			category: COMPYLE_CATEGORY,
			menu: { id: CompyleExplorerMenu, group: '1_read', order: 2, when: FILE_WHEN },
			f1: false,
		});
	}
	override async run(accessor: ServicesAccessor, resource: URI): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const reply = await askBrainAboutFile(
			brainService, notificationService, progressService, fileService, resource,
			'Analyze this file for bugs, security issues, logic errors, and bad practices. Return a Markdown bullet-point list of specific issues with line references where possible. If no issues are found, return exactly: "No issues found."',
			localize('compyle.explorer.findingIssues', "Finding issues…"),
			2048,
		);
		if (reply) {
			await openScratch(editorService, 'Compyle File Issues.md', reply.trim(), 'markdown');
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.explorer.generateTests',
			title: { value: localize('compyle.explorer.generateTests', "Generate Tests"), original: 'Generate Tests' },
			category: COMPYLE_CATEGORY,
			menu: { id: CompyleExplorerMenu, group: '2_modify', order: 1, when: FILE_WHEN },
			f1: false,
		});
	}
	override async run(accessor: ServicesAccessor, resource: URI): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const filename = resource.path.split('/').pop() ?? resource.path;
		const ext = filename.includes('.') ? filename.split('.').pop() ?? '' : '';
		const reply = await askBrainAboutFile(
			brainService, notificationService, progressService, fileService, resource,
			'Write thorough unit tests for this file using the conventional test framework for the language. Cover happy paths, edge cases, and error cases. Return ONLY the test file contents. No explanations, no markdown fences.',
			localize('compyle.explorer.generatingTests', "Generating tests…"),
			6144,
		);
		if (reply) {
			const testName = ext ? filename.replace(`.${ext}`, `.test.${ext}`) : `${filename}.test`;
			await openScratch(editorService, testName, reply.trim(), ext);
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.explorer.suggestRename',
			title: { value: localize('compyle.explorer.suggestRename', "Suggest Rename"), original: 'Suggest Rename' },
			category: COMPYLE_CATEGORY,
			menu: { id: CompyleExplorerMenu, group: '2_modify', order: 2, when: FILE_WHEN },
			f1: false,
		});
	}
	override async run(accessor: ServicesAccessor, resource: URI): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const filename = resource.path.split('/').pop() ?? resource.path;
		const reply = await askBrainAboutFile(
			brainService, notificationService, progressService, fileService, resource,
			`The current filename is "${filename}". Suggest 3 alternative filenames that better describe this file's purpose and follow the project's naming conventions. Return ONLY a numbered list of suggestions, one per line. No explanations.`,
			localize('compyle.explorer.suggestingRename', "Suggesting rename…"),
			256,
		);
		if (reply) {
			notificationService.prompt(
				Severity.Info,
				localize('compyle.explorer.renameSuggestions', "Rename suggestions for {0}:", filename),
				[{
					label: localize('compyle.explorer.viewSuggestions', "View Suggestions"),
					run: () => openScratch(editorService, 'Compyle Rename Suggestions.md', `# Rename Suggestions for \`${filename}\`\n\n${reply.trim()}`, 'markdown'),
				}],
			);
		}
	}
});
