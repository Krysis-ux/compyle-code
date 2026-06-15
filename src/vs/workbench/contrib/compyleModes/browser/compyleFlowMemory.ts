/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { COMPYLE_PROJECT_DIR } from '../common/compyleModes.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';

// ---------------------------------------------------------------------------
// Secret scanning — never store credentials in memory files
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
	/sk-[A-Za-z0-9]{20,}/,           // OpenAI API keys
	/ghp_[A-Za-z0-9]{36}/,           // GitHub personal access tokens
	/gho_[A-Za-z0-9]{36}/,           // GitHub OAuth tokens
	/AKIA[0-9A-Z]{16}/,               // AWS access key IDs
	/[A-Za-z0-9_-]{20,}=[A-Za-z0-9+/]{20,}/, // Generic base64-encoded secrets
	/-----BEGIN\s+(RSA|EC|OPENSSH|PRIVATE)\s+KEY/,  // Private keys
	/password\s*=\s*["'][^"']{6,}["']/i,
	/api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/i,
	/secret\s*[:=]\s*["'][^"']{8,}["']/i,
	/token\s*[:=]\s*["'][^"']{8,}["']/i,
];

function containsSecret(content: string): boolean {
	return SECRET_PATTERNS.some(p => p.test(content));
}

// ---------------------------------------------------------------------------
// Memory file templates
// ---------------------------------------------------------------------------

function getProjectMemoryTemplate(projectName: string): string {
	const date = new Date().toISOString().slice(0, 10);
	return `# Project Memory

> Created by Compyle Flow on ${date}. Edit freely — this file is yours.

## Goal

<!-- What is this project trying to accomplish? -->

## Tech Stack

<!-- Languages, frameworks, key libraries, runtime versions -->

## Preferences

<!-- Coding style, naming conventions, patterns to follow or avoid -->

## Current State

<!-- What is working, what is in progress, what is broken -->

## Important Notes

<!-- Architecture decisions, known issues, things to remember -->
`;
}

function getRulesTemplate(): string {
	return `# Project Rules

> Rules for AI assistants and developers working on this project.
> Keep this file short and specific.

## Coding Style

- <!-- e.g., Use single quotes in JS/TS -->
- <!-- e.g., 2-space indentation -->
- <!-- e.g., Functional components only in React -->

## AI Behavior

- Always explain what you are about to change before making changes
- Do not modify files outside the project directory
- Ask before creating new files or directories
- Prefer small, reversible changes over large rewrites

## Files and Folders to Avoid

- <!-- List files the AI should not modify -->
- \`node_modules/\`, \`.git/\`, \`.env\`

## Privacy Rules

- Never include API keys, passwords, or secrets in memory files
- Do not send private file contents to cloud AI without user confirmation
`;
}

function getArchitectureTemplate(): string {
	return `# Architecture

> Overview of how this project is structured.

## Folder Structure

\`\`\`
/
├── src/         # Source code
├── tests/       # Tests
└── docs/        # Documentation
\`\`\`

<!-- Fill in your actual folder structure above -->

## Major Components

<!-- List the main modules, services, or layers -->

## Data Flow

<!-- How does data move through the system? -->

## Build and Run Commands

\`\`\`bash
# Install dependencies
# npm install

# Run in development
# npm run dev

# Run tests
# npm test

# Build for production
# npm run build
\`\`\`

<!-- Fill in your actual commands above -->

## Important Files

<!-- List key files and what they do -->
`;
}

function getChangelogTemplate(): string {
	const date = new Date().toISOString().slice(0, 10);
	return `# Changelog

> Human-readable change history. Most recent first.

---

## ${date} — Project initialized

- Created Compyle Flow project memory
- Added .compyle/ configuration directory

`;
}

function getTodoTemplate(): string {
	return `# TODO

> Current tasks, bugs, and improvements.

## High Priority

- [ ] <!-- Add your most important tasks here -->

## In Progress

- [ ] <!-- Tasks currently being worked on -->

## Backlog

- [ ] <!-- Future improvements -->

## Known Bugs

- [ ] <!-- Issues to fix -->
`;
}

function getHandoffTemplate(projectName: string): string {
	const date = new Date().toISOString().slice(0, 10);
	return `# Handoff

> Concise summary for Claude Code, Codex, or another AI assistant.
> Update this before starting an AI session.

**Date**: ${date}
**Project**: ${projectName}

## Current State

<!-- One paragraph: what exists and works right now -->

## Recent Changes

<!-- What was last changed, added, or removed -->

## What to Do Next

<!-- The specific task or goal for the next session -->
1. <!-- Step 1 -->
2. <!-- Step 2 -->

## Warnings and Constraints

<!-- Anything the AI must not change or must be careful about -->

## Files Most Relevant to the Current Task

<!-- List the key files the AI should read first -->
`;
}

function getSettingsTemplate(activeMode: string): string {
	return JSON.stringify({
		activeMode,
		memoryBehavior: 'ask',
		lastMemoryUpdate: new Date().toISOString(),
		excludedFiles: ['.env', '*.pem', '*.key', 'secrets.*'],
		aiTutorBehavior: 'ask',
		explanationLevel: 'normal',
	}, null, '\t');
}

// ---------------------------------------------------------------------------
// Core memory operations
// ---------------------------------------------------------------------------

function getWorkspaceRoot(contextService: IWorkspaceContextService): URI | undefined {
	const folders = contextService.getWorkspace().folders;
	if (!folders.length) { return undefined; }
	return folders[0].uri;
}

function getProjectName(contextService: IWorkspaceContextService): string {
	const folders = contextService.getWorkspace().folders;
	if (!folders.length) { return 'Project'; }
	return folders[0].name || 'Project';
}

export async function initProjectMemory(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);

	if (contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
		notificationService.notify({
			severity: Severity.Warning,
			message: 'Open a folder first before initializing project memory.',
		});
		return;
	}

	const root = getWorkspaceRoot(contextService);
	if (!root) { return; }

	const settingsUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'settings.json');
	const alreadyExists = await fileService.exists(settingsUri);

	if (alreadyExists) {
		notificationService.prompt(
			Severity.Info,
			'Project memory is already initialized in .compyle/',
			[{
				label: 'Open Memory Files',
				run: () => {
					const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
					editorService.openEditor({ resource: memoryUri });
				},
			}],
		);
		return;
	}

	notificationService.prompt(
		Severity.Info,
		'Set up project memory? Compyle will create a .compyle/ folder with structured notes to help AI sessions understand your project.',
		[
			{
				label: 'Create Project Memory',
				run: () => createMemoryFiles(fileService, contextService, notificationService, editorService, root),
			},
			{
				label: 'Learn More',
				run: () => {
					notificationService.notify({
						severity: Severity.Info,
						message: 'Project memory is stored locally in .compyle/. It keeps your project goal, architecture, rules, and handoff docs. It is never sent to cloud AI without your approval.',
					});
				},
			},
		],
	);
}

async function createMemoryFiles(
	fileService: IFileService,
	contextService: IWorkspaceContextService,
	notificationService: INotificationService,
	editorService: IEditorService,
	root: URI,
): Promise<void> {
	const projectName = getProjectName(contextService);

	const files: Array<{ path: string; content: string }> = [
		{ path: 'PROJECT_MEMORY.md', content: getProjectMemoryTemplate(projectName) },
		{ path: 'RULES.md', content: getRulesTemplate() },
		{ path: 'ARCHITECTURE.md', content: getArchitectureTemplate() },
		{ path: 'CHANGELOG.md', content: getChangelogTemplate() },
		{ path: 'TODO.md', content: getTodoTemplate() },
		{ path: 'HANDOFF.md', content: getHandoffTemplate(projectName) },
		{ path: 'settings.json', content: getSettingsTemplate('flow') },
	];

	try {
		for (const file of files) {
			const uri = URI.joinPath(root, COMPYLE_PROJECT_DIR, file.path);
			const exists = await fileService.exists(uri);
			if (!exists) {
				await fileService.writeFile(uri, VSBuffer.fromString(file.content));
			}
		}

		const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
		await editorService.openEditor({ resource: memoryUri });

		notificationService.notify({
			severity: Severity.Info,
			message: 'Project memory created in .compyle/. Edit PROJECT_MEMORY.md to describe your project.',
		});
	} catch (err) {
		notificationService.notify({
			severity: Severity.Error,
			message: `Failed to create project memory: ${err instanceof Error ? err.message : String(err)}`,
		});
	}
}

export async function openProjectMemory(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		notificationService.notify({ severity: Severity.Warning, message: 'No folder is open.' });
		return;
	}

	const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
	const exists = await fileService.exists(memoryUri);

	if (!exists) {
		notificationService.prompt(
			Severity.Info,
			'Project memory has not been set up yet.',
			[{ label: 'Initialize Now', run: () => initProjectMemory(accessor) }],
		);
		return;
	}

	await editorService.openEditor({ resource: memoryUri });
}

export async function updateProjectMemory(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		notificationService.notify({ severity: Severity.Warning, message: 'No folder is open.' });
		return;
	}

	const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
	const exists = await fileService.exists(memoryUri);

	if (!exists) {
		await initProjectMemory(accessor);
		return;
	}

	await editorService.openEditor({ resource: memoryUri });

	notificationService.notify({
		severity: Severity.Info,
		message: 'PROJECT_MEMORY.md is open. Edit it, then save. The file stays private in your .compyle/ folder.',
	});
}

export async function generateHandoff(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		notificationService.notify({ severity: Severity.Warning, message: 'No folder is open.' });
		return;
	}

	const projectName = getProjectName(contextService);
	const handoffUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'HANDOFF.md');

	const template = getHandoffTemplate(projectName);

	if (containsSecret(template)) {
		notificationService.notify({
			severity: Severity.Warning,
			message: 'Potential secret detected. Handoff file not written. Review your content before saving.',
		});
		return;
	}

	await fileService.writeFile(handoffUri, VSBuffer.fromString(template));
	await editorService.openEditor({ resource: handoffUri });

	notificationService.notify({
		severity: Severity.Info,
		message: 'HANDOFF.md opened. Fill in the current state and next steps, then share the file path with your AI assistant.',
	});
}

export async function generateBugReport(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);
	const markerService = accessor.get(IMarkerService);

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		notificationService.notify({ severity: Severity.Warning, message: 'No folder is open.' });
		return;
	}

	const date = new Date().toISOString().slice(0, 10);

	// Collect current diagnostics
	const allMarkers = markerService.read({ severities: MarkerSeverity.Error | MarkerSeverity.Warning });
	const errorLines: string[] = [];

	for (const marker of allMarkers.slice(0, 20)) {
		const severity = marker.severity === MarkerSeverity.Error ? 'ERROR' : 'WARN';
		const file = marker.resource.path.split('/').pop() ?? marker.resource.path;
		errorLines.push(`- [${severity}] ${file}:${marker.startLineNumber} — ${marker.message}`);
	}

	const diagnosticsSection = errorLines.length
		? errorLines.join('\n')
		: '- No diagnostics recorded at time of report.';

	const bugReport = `# Bug Report

**Date**: ${date}
**Project**: ${getProjectName(contextService)}

## Error Message

<!-- Paste the exact error message here -->

## Steps to Reproduce

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->

## Expected Behavior

<!-- What should have happened? -->

## Actual Behavior

<!-- What happened instead? -->

## Current Diagnostics

${diagnosticsSection}

## Affected Files

<!-- List files that appear related to the issue -->

## Recent Changes

<!-- What changed just before this broke? -->

## Suspected Cause

<!-- Your best guess at what is causing the problem -->

## Attempted Fixes

<!-- What have you tried so far? -->

## Next Steps

<!-- What would you like help with? -->
`;

	const bugReportUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'BUG_REPORT.md');
	await fileService.writeFile(bugReportUri, VSBuffer.fromString(bugReport));
	await editorService.openEditor({ resource: bugReportUri });

	notificationService.notify({
		severity: Severity.Info,
		message: `Bug report created with ${allMarkers.length > 0 ? allMarkers.length + ' current diagnostics.' : 'diagnostic snapshot.'} Fill in the details, then share with your debugger or AI assistant.`,
	});
}

export async function cleanProjectMemory(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		notificationService.notify({ severity: Severity.Warning, message: 'No folder is open.' });
		return;
	}

	const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
	const exists = await fileService.exists(memoryUri);

	if (!exists) {
		notificationService.notify({ severity: Severity.Info, message: 'No project memory found in .compyle/.' });
		return;
	}

	notificationService.prompt(
		Severity.Warning,
		'Open PROJECT_MEMORY.md to manually remove any incorrect information. Compyle does not auto-delete memory content.',
		[{ label: 'Open Memory File', run: () => editorService.openEditor({ resource: memoryUri }) }],
	);
}
