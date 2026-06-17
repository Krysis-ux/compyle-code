/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { localize } from '../../../../nls.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { COMPYLE_PROJECT_DIR } from '../common/compyleModes.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

// ---------------------------------------------------------------------------
// Secret scanning - never store credentials in memory files
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

> Created by Compyle Flow on ${date}. Edit freely - this file is yours.

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
|-- src/         # Source code
|-- tests/       # Tests
+-- docs/        # Documentation
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

## ${date} - Project initialized

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

function getTestPlanTemplate(): string {
	return `# Test Plan

> Verification notes for the current project.

## Required Checks

- [ ] <!-- Add build, lint, test, or smoke checks here -->

## Manual Scenarios

- [ ] <!-- Add user workflows to verify here -->

## Known Gaps

- <!-- Tests or environments not covered yet -->
`;
}

function getSecurityNotesTemplate(): string {
	return `# Security Notes

> Security, privacy, and network notes for this project.

## Data and Secrets

- Do not store API keys, tokens, passwords, or private keys in this folder.
- Keep secret values in your OS keychain, environment variables, or a secret manager.

## Network Behavior

<!-- List external services this project intentionally contacts -->

## Review Notes

<!-- Add security-sensitive decisions or open concerns -->
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

export interface IEnsureFlowMemoryOptions {
	readonly openProjectMemory?: boolean;
	readonly projectKind?: string;
	readonly stack?: readonly string[];
	readonly runInstructions?: string;
	readonly addOns?: readonly string[];
	readonly source?: string;
}

export interface IFlowMemoryAction {
	readonly title: string;
	readonly detail?: string;
	readonly files?: readonly string[];
	readonly status?: string;
}

const MANAGED_SECTION_START = '<!-- COMPYLE:FLOW-AUTO:START -->';
const MANAGED_SECTION_END = '<!-- COMPYLE:FLOW-AUTO:END -->';

function getMemoryFiles(projectName: string): Array<{ path: string; content: string }> {
	return [
		{ path: 'PROJECT_MEMORY.md', content: getProjectMemoryTemplate(projectName) },
		{ path: 'RULES.md', content: getRulesTemplate() },
		{ path: 'ARCHITECTURE.md', content: getArchitectureTemplate() },
		{ path: 'CHANGELOG.md', content: getChangelogTemplate() },
		{ path: 'TODO.md', content: getTodoTemplate() },
		{ path: 'HANDOFF.md', content: getHandoffTemplate(projectName) },
		{ path: 'TEST_PLAN.md', content: getTestPlanTemplate() },
		{ path: 'SECURITY_NOTES.md', content: getSecurityNotesTemplate() },
		{ path: 'settings.json', content: getSettingsTemplate('flow') },
	];
}

function buildProjectSeed(options: IEnsureFlowMemoryOptions): string | undefined {
	const rows: string[] = [];
	if (options.projectKind) {
		rows.push(`- Project kind: ${options.projectKind}`);
	}
	if (options.stack?.length) {
		rows.push(`- Stack: ${options.stack.join(', ')}`);
	}
	if (options.runInstructions) {
		rows.push(`- Launch: ${options.runInstructions}`);
	}
	if (options.addOns?.length) {
		rows.push(`- Selected tools: ${options.addOns.join(', ')}`);
	}
	if (options.source) {
		rows.push(`- Source: ${options.source}`);
	}
	return rows.length ? rows.join('\n') : undefined;
}

function upsertManagedSection(content: string, body: string): string {
	const section = `${MANAGED_SECTION_START}\n## Compyle Auto Updates\n\n${body.trim()}\n${MANAGED_SECTION_END}\n`;
	const start = content.indexOf(MANAGED_SECTION_START);
	const end = content.indexOf(MANAGED_SECTION_END);
	if (start >= 0 && end > start) {
		return `${content.slice(0, start)}${section}${content.slice(end + MANAGED_SECTION_END.length).replace(/^\s*/, '\n')}`;
	}
	return `${content.trimEnd()}\n\n${section}`;
}

async function readText(fileService: IFileService, uri: URI): Promise<string> {
	try {
		return (await fileService.readFile(uri)).value.toString();
	} catch {
		return '';
	}
}

async function writeManagedSection(fileService: IFileService, uri: URI, body: string): Promise<void> {
	const current = await readText(fileService, uri);
	if (containsSecret(body)) {
		return;
	}
	await fileService.writeFile(uri, VSBuffer.fromString(upsertManagedSection(current, body)));
}

// ---------------------------------------------------------------------------
// Core memory operations
// ---------------------------------------------------------------------------

export function getWorkspaceRoot(contextService: IWorkspaceContextService): URI | undefined {
	const folders = contextService.getWorkspace().folders;
	if (!folders.length) { return undefined; }
	return folders[0].uri;
}

export function getProjectName(contextService: IWorkspaceContextService): string {
	const folders = contextService.getWorkspace().folders;
	if (!folders.length) { return 'Project'; }
	return folders[0].name || 'Project';
}

export async function ensureFlowMemoryForRoot(fileService: IFileService, root: URI, projectName: string, options: IEnsureFlowMemoryOptions = {}): Promise<void> {
	for (const file of getMemoryFiles(projectName)) {
		const uri = URI.joinPath(root, COMPYLE_PROJECT_DIR, file.path);
		const exists = await fileService.exists(uri);
		if (!exists) {
			await fileService.writeFile(uri, VSBuffer.fromString(file.content));
		}
	}

	const seed = buildProjectSeed(options);
	if (seed) {
		const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
		const handoffUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'HANDOFF.md');
		await writeManagedSection(fileService, memoryUri, seed);
		await writeManagedSection(fileService, handoffUri, seed);
	}
}

export async function ensureFlowMemory(accessor: ServicesAccessor, options: IEnsureFlowMemoryOptions = {}): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);

	if (contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
		notificationService.notify({ severity: Severity.Warning, message: localize('compyle.flow.noFolder', "Open a folder before using Compyle Flow memory.") });
		return;
	}

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		return;
	}

	await ensureFlowMemoryForRoot(fileService, root, getProjectName(contextService), options);

	if (options.openProjectMemory) {
		await editorService.openEditor({ resource: URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md') });
	}
}

function buildActionBody(action: IFlowMemoryAction): string {
	const stamp = new Date().toISOString();
	const lines = [`- ${stamp}: ${action.title}`];
	if (action.status) {
		lines.push(`  - Status: ${action.status}`);
	}
	if (action.detail) {
		lines.push(`  - Detail: ${action.detail}`);
	}
	if (action.files?.length) {
		lines.push(`  - Files: ${action.files.join(', ')}`);
	}
	return lines.join('\n');
}

export async function recordFlowActionForRoot(fileService: IFileService, root: URI, projectName: string, action: IFlowMemoryAction): Promise<void> {
	await ensureFlowMemoryForRoot(fileService, root, projectName);
	const body = buildActionBody(action);
	const changelogUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'CHANGELOG.md');
	const currentChangelog = await readText(fileService, changelogUri);
	await fileService.writeFile(changelogUri, VSBuffer.fromString(`${currentChangelog.trimEnd()}\n\n${body}\n`));

	await writeManagedSection(fileService, URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md'), body);
	await writeManagedSection(fileService, URI.joinPath(root, COMPYLE_PROJECT_DIR, 'HANDOFF.md'), body);
	await writeManagedSection(fileService, URI.joinPath(root, COMPYLE_PROJECT_DIR, 'TODO.md'), body);
	await writeManagedSection(fileService, URI.joinPath(root, COMPYLE_PROJECT_DIR, 'TEST_PLAN.md'), body);
}

/**
 * Records a Flow action using already-resolved services. Safe to call after an await
 * because it does not touch the (by-then invalid) ServicesAccessor.
 */
export async function recordFlowActionWithServices(configurationService: IConfigurationService, fileService: IFileService, contextService: IWorkspaceContextService, action: IFlowMemoryAction): Promise<void> {
	if (configurationService.getValue<string>('compyle.modes.activeMode') !== 'flow') {
		return;
	}
	if (configurationService.getValue<boolean>('compyle.modes.memory.enabled') === false) {
		return;
	}
	const root = getWorkspaceRoot(contextService);
	if (!root) {
		return;
	}
	await recordFlowActionForRoot(fileService, root, getProjectName(contextService), action);
}

export async function recordFlowAction(accessor: ServicesAccessor, action: IFlowMemoryAction): Promise<void> {
	await recordFlowActionWithServices(
		accessor.get(IConfigurationService),
		accessor.get(IFileService),
		accessor.get(IWorkspaceContextService),
		action,
	);
}

export async function initProjectMemory(accessor: ServicesAccessor): Promise<void> {
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);

	if (contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
		notificationService.notify({
			severity: Severity.Warning,
			message: 'Open a folder first before initializing project memory.',
		});
		return;
	}

	await ensureFlowMemory(accessor, { openProjectMemory: true, source: 'Initialize Project Memory' });
	notificationService.notify({
		severity: Severity.Info,
		message: localize('compyle.flow.memoryReady', "Project memory is ready in .compyle/."),
	});
}

export async function openProjectMemory(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);
	const commandService = accessor.get(ICommandService);

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		notificationService.notify({ severity: Severity.Warning, message: 'No folder is open.' });
		return;
	}

	const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
	const exists = await fileService.exists(memoryUri);

	if (!exists) {
		// The accessor is invalid by the time this button is clicked, so dispatch via the
		// pre-resolved command service instead of capturing the accessor.
		notificationService.prompt(
			Severity.Info,
			'Project memory has not been set up yet.',
			[{ label: 'Initialize Now', run: () => { void commandService.executeCommand('compyle.modes.initMemory'); } }],
		);
		return;
	}

	await editorService.openEditor({ resource: memoryUri });
}

export async function updateProjectMemory(accessor: ServicesAccessor): Promise<void> {
	// Resolve all services synchronously: the accessor is invalid after the first await.
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);
	const commandService = accessor.get(ICommandService);
	const configurationService = accessor.get(IConfigurationService);

	const root = getWorkspaceRoot(contextService);
	if (!root) {
		notificationService.notify({ severity: Severity.Warning, message: 'No folder is open.' });
		return;
	}

	const memoryUri = URI.joinPath(root, COMPYLE_PROJECT_DIR, 'PROJECT_MEMORY.md');
	const exists = await fileService.exists(memoryUri);

	if (!exists) {
		await commandService.executeCommand('compyle.modes.initMemory');
		return;
	}

	await editorService.openEditor({ resource: memoryUri });

	await recordFlowActionWithServices(configurationService, fileService, contextService, {
		title: 'Updated Project Memory',
		detail: 'Opened PROJECT_MEMORY.md for the latest Flow context update.',
		status: 'opened',
		files: ['.compyle/PROJECT_MEMORY.md'],
	});

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
	const configurationService = accessor.get(IConfigurationService);

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

	await recordFlowActionWithServices(configurationService, fileService, contextService, {
		title: 'Generated Handoff',
		detail: 'Created a fresh handoff document for the current project state.',
		status: 'created',
		files: ['.compyle/HANDOFF.md'],
	});
}

export async function generateBugReport(accessor: ServicesAccessor): Promise<void> {
	const fileService = accessor.get(IFileService);
	const contextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const editorService = accessor.get(IEditorService);
	const markerService = accessor.get(IMarkerService);
	const configurationService = accessor.get(IConfigurationService);

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
		errorLines.push(`- [${severity}] ${file}:${marker.startLineNumber} - ${marker.message}`);
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

	await recordFlowActionWithServices(configurationService, fileService, contextService, {
		title: 'Generated Bug Report',
		detail: `Captured ${allMarkers.length} diagnostic item${allMarkers.length === 1 ? '' : 's'}.`,
		status: 'created',
		files: ['.compyle/BUG_REPORT.md'],
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
