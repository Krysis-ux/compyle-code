/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compyle Brain — AI/project intelligence layer.
 *
 * Shared types and constants used across browser, node, and common layers.
 */

export const COMPYLE_BRAIN_EXTENSION_ID = 'compyle.brain';

export const enum CompyleBrainProvider {
	None = 'none',
	OpenAICompatible = 'openai-compatible',
	Anthropic = 'anthropic',
	OpenRouter = 'openrouter',
	Ollama = 'ollama',
	LMStudio = 'lmstudio',
	Local = 'local',
}

export const enum CompyleBrainMode {
	/** Answer questions without editing files */
	Ask = 'ask',
	/** Propose focused edits with diff preview */
	Edit = 'edit',
	/** Multi-file changes with explicit permission checkpoints */
	Agent = 'agent',
	/** Generate plan/spec/tasks before implementation */
	Plan = 'plan',
	/** Explain code changes like a tutor */
	Learn = 'learn',
}

export interface CompyleBrainProviderConfig {
	readonly provider: CompyleBrainProvider;
	readonly endpoint?: string;
	readonly model?: string;
	readonly apiKey?: string;
	readonly localOnly: boolean;
	readonly confirmBeforeCloudSend: boolean;
}

export interface CompyleBrainContextItem {
	readonly type: 'file' | 'folder' | 'selection' | 'workspace';
	readonly path: string;
	readonly included: boolean;
}

export interface CompyleBrainContext {
	readonly items: CompyleBrainContextItem[];
	readonly totalTokenEstimate: number;
}

export const PROJECT_MEMORY_FILES = {
	projectMemory: '.compyle/PROJECT_MEMORY.md',
	rules: '.compyle/RULES.md',
	architecture: '.compyle/ARCHITECTURE.md',
	todo: '.compyle/TODO.md',
	changelog: '.compyle/CHANGELOG.md',
	testPlan: '.compyle/TEST_PLAN.md',
	securityNotes: '.compyle/SECURITY_NOTES.md',
} as const;

export const COMPYLE_BRAIN_COMMANDS = {
	open: 'compyle.brain.open',
	generateProjectMemory: 'compyle.brain.generateProjectMemory',
	updateProjectMemory: 'compyle.brain.updateProjectMemory',
	explainCodebase: 'compyle.brain.explainCodebase',
	findWhereUsed: 'compyle.brain.findWhereUsed',
	explainError: 'compyle.brain.explainError',
	reviewDiff: 'compyle.brain.reviewDiff',
	createPlan: 'compyle.brain.createPlan',
	generateTests: 'compyle.brain.generateTests',
	fixBuildError: 'compyle.brain.fixBuildError',
	openSettings: 'compyle.brain.openSettings',
} as const;

export const PROJECT_MEMORY_TEMPLATE = `# Project Memory

## What This Project Does
<!-- Describe the project in 1-3 sentences -->

## Tech Stack
<!-- Languages, frameworks, build tools -->

## Architecture Overview
<!-- Key directories and their purpose -->

## Important Conventions
<!-- Naming, code style, patterns used -->

## Known Gotchas
<!-- Tricky areas, TODOs, watch-outs -->

## Recent Changes
<!-- Last updated by Compyle Brain on -->
`;

export const RULES_TEMPLATE = `# Compyle Rules

These rules guide Compyle Brain when working in this project.

## Coding Style
<!-- E.g. "Always use TypeScript strict mode" -->

## Testing
<!-- E.g. "Every new function needs a unit test" -->

## File Organization
<!-- E.g. "Components go in src/components/" -->

## Do Not Touch
<!-- Files or patterns Compyle Brain should avoid editing -->

## Before Committing
<!-- Checklist Compyle Brain must complete before suggesting a commit -->
`;
