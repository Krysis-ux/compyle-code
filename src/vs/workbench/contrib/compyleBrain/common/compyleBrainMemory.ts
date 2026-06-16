/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PROJECT_MEMORY_FILES, PROJECT_MEMORY_TEMPLATE, RULES_TEMPLATE } from './compyleBrain.js';

/**
 * Manages .compyle/ project memory files.
 * These are plain Markdown files in the workspace root that provide
 * context to Compyle Brain and to human developers.
 */

export interface ICompyleMemoryFile {
	readonly relativePath: string;
	readonly exists: boolean;
	readonly content?: string;
}

export function getDefaultContent(relativePath: string): string {
	switch (relativePath) {
		case PROJECT_MEMORY_FILES.projectMemory:
			return PROJECT_MEMORY_TEMPLATE;
		case PROJECT_MEMORY_FILES.rules:
			return RULES_TEMPLATE;
		case PROJECT_MEMORY_FILES.architecture:
			return `# Architecture\n\n<!-- Document key architectural decisions, diagrams, and trade-offs -->\n`;
		case PROJECT_MEMORY_FILES.todo:
			return `# TODO\n\n<!-- Outstanding tasks. Compyle Brain updates this after completing tasks. -->\n`;
		case PROJECT_MEMORY_FILES.changelog:
			return `# Changelog\n\n<!-- Changes made to this project. Compyle Brain appends entries here. -->\n`;
		case PROJECT_MEMORY_FILES.testPlan:
			return `# Test Plan\n\n<!-- How to test this project. Acceptance criteria. -->\n`;
		case PROJECT_MEMORY_FILES.securityNotes:
			return `# Security Notes\n\n<!-- Known security considerations, secrets management, threat model. -->\n`;
		default:
			return '';
	}
}

export function getAllMemoryFilePaths(): string[] {
	return Object.values(PROJECT_MEMORY_FILES);
}
