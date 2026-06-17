/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
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
	/** Sampling temperature (0-2). */
	readonly temperature: number;
	/** Maximum tokens to generate in a reply. */
	readonly maxTokens: number;
	/** Ollama context window (num_ctx). 0 = use the model default. */
	readonly contextLength: number;
	/** How long Ollama keeps the model loaded in VRAM (e.g. "5m", "-1" for always). */
	readonly keepAlive: string;
}

/** A locally installed model reported by Ollama (/api/tags) or LM Studio (/v1/models). */
export interface ILocalModelInfo {
	readonly name: string;
	readonly sizeBytes?: number;
	readonly parameterSize?: string;
	readonly quantization?: string;
	readonly family?: string;
}

/** A curated catalog entry the user can browse and download in the Local Models UI. */
export interface IOllamaCatalogEntry {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly size: string;
}

/** A small, hand-picked set of popular coding models for the "browse" experience. */
export const OLLAMA_CATALOG: readonly IOllamaCatalogEntry[] = [
	{ name: 'qwen2.5-coder:7b', label: 'Qwen2.5 Coder 7B', description: 'Strong all-round coding model. Great default for an 8-12 GB GPU.', size: '~4.7 GB' },
	{ name: 'qwen2.5-coder:1.5b', label: 'Qwen2.5 Coder 1.5B', description: 'Tiny, fast coding model for low-VRAM machines and autocomplete.', size: '~1.0 GB' },
	{ name: 'qwen2.5-coder:14b', label: 'Qwen2.5 Coder 14B', description: 'Higher-quality coding model for 16 GB+ GPUs.', size: '~9.0 GB' },
	{ name: 'llama3.1:8b', label: 'Llama 3.1 8B', description: 'Well-rounded general model from Meta.', size: '~4.9 GB' },
	{ name: 'deepseek-coder-v2:16b', label: 'DeepSeek Coder V2 16B', description: 'Powerful MoE coding model; needs a roomy GPU.', size: '~8.9 GB' },
	{ name: 'codellama:7b', label: 'Code Llama 7B', description: 'Meta\'s classic code model. Reliable and widely supported.', size: '~3.8 GB' },
	{ name: 'codegemma:7b', label: 'CodeGemma 7B', description: 'Google\'s code-tuned Gemma. Good at completion and generation.', size: '~5.0 GB' },
	{ name: 'starcoder2:3b', label: 'StarCoder2 3B', description: 'Lightweight code model trained on a large code corpus.', size: '~1.7 GB' },
	{ name: 'phi3:mini', label: 'Phi-3 Mini', description: 'Compact, capable general model from Microsoft.', size: '~2.3 GB' },
	{ name: 'gemma2:9b', label: 'Gemma 2 9B', description: 'Strong general-purpose model from Google.', size: '~5.4 GB' },
	{ name: 'mistral:7b', label: 'Mistral 7B', description: 'Fast, capable general model. A dependable baseline.', size: '~4.1 GB' },
];

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
	openLocalModels: 'compyle.brain.openLocalModels',
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
