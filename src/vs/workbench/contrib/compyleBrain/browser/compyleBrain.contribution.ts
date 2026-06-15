/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { COMPYLE_BRAIN_COMMANDS, CompyleBrainProvider } from '../common/compyleBrain.js';

// ---------------------------------------------------------------------------
// Settings registration
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	order: 200,
	properties: {
		'compyle.brain.enabled': {
			type: 'boolean',
			default: false,
			description: localize('compyle.brain.enabled', "Enable Compyle Brain AI assistant. Requires provider configuration."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.provider': {
			type: 'string',
			default: CompyleBrainProvider.None,
			enum: [
				CompyleBrainProvider.None,
				CompyleBrainProvider.Anthropic,
				CompyleBrainProvider.OpenAICompatible,
				CompyleBrainProvider.OpenRouter,
				CompyleBrainProvider.Ollama,
				CompyleBrainProvider.LMStudio,
				CompyleBrainProvider.Local,
			],
			enumDescriptions: [
				localize('provider.none', "No AI provider — AI features disabled"),
				localize('provider.anthropic', "Anthropic Claude — bring your own API key"),
				localize('provider.openai', "OpenAI-compatible endpoint — works with OpenAI, Azure OpenAI, local models, etc."),
				localize('provider.openrouter', "OpenRouter — access many models with one key"),
				localize('provider.ollama', "Ollama — run models locally"),
				localize('provider.lmstudio', "LM Studio — local model server"),
				localize('provider.local', "Custom local endpoint"),
			],
			description: localize('compyle.brain.provider', "AI provider for Compyle Brain. Compyle does not operate a mandatory cloud backend — you bring your own key."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.endpoint': {
			type: 'string',
			default: '',
			description: localize('compyle.brain.endpoint', "API endpoint URL for OpenAI-compatible or custom providers. Leave empty to use provider default."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.model': {
			type: 'string',
			default: '',
			description: localize('compyle.brain.model', "Model name/ID to use with the selected provider (e.g. claude-sonnet-4-6, gpt-4o, llama3)."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.localOnly': {
			type: 'boolean',
			default: false,
			description: localize('compyle.brain.localOnly', "When enabled, Compyle Brain will only use local/self-hosted models. No code is sent to cloud providers."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.confirmBeforeCloudSend': {
			type: 'boolean',
			default: true,
			description: localize('compyle.brain.confirmBeforeCloudSend', "Show a confirmation dialog with context preview before sending code to any cloud AI provider."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.respectGitignore': {
			type: 'boolean',
			default: true,
			description: localize('compyle.brain.respectGitignore', "Exclude .gitignore'd files from AI context."),
			scope: ConfigurationScope.RESOURCE,
		},
		'compyle.brain.excludePatterns': {
			type: 'array',
			items: { type: 'string' },
			default: ['**/.env', '**/.env.*', '**/node_modules/**', '**/dist/**', '**/build/**', '**/*.lock'],
			description: localize('compyle.brain.excludePatterns', "Glob patterns to exclude from Compyle Brain context. Secrets and lock files are excluded by default."),
			scope: ConfigurationScope.RESOURCE,
		},
	}
});

// ---------------------------------------------------------------------------
// Command registrations
// ---------------------------------------------------------------------------

class OpenCompyleBrainAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.open,
			title: { value: localize('compyle.brain.open', "Open Compyle Brain"), original: 'Open Compyle Brain' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
			menu: [{ id: MenuId.CommandPalette }],
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: open Compyle Brain panel
		// For now, open settings to configure the provider
		const commandService = _accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.openSettings', 'compyle.brain');
	}
}

class GenerateProjectMemoryAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.generateProjectMemory,
			title: { value: localize('compyle.brain.generateProjectMemory', "Generate Project Memory"), original: 'Generate Project Memory' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: implement via CompyleBrainService
		// Creates .compyle/PROJECT_MEMORY.md from workspace analysis
	}
}

class ExplainCodebaseAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.explainCodebase,
			title: { value: localize('compyle.brain.explainCodebase', "Explain Codebase"), original: 'Explain Codebase' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: implement via CompyleBrainService
	}
}

class ExplainErrorAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.explainError,
			title: { value: localize('compyle.brain.explainError', "Explain Error"), original: 'Explain Error' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: implement via CompyleBrainService
	}
}

class ReviewDiffAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.reviewDiff,
			title: { value: localize('compyle.brain.reviewDiff', "Review Current Diff"), original: 'Review Current Diff' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: implement via CompyleBrainService
	}
}

class CreatePlanAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.createPlan,
			title: { value: localize('compyle.brain.createPlan', "Create Implementation Plan"), original: 'Create Implementation Plan' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: implement via CompyleBrainService
	}
}

class GenerateTestsAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.generateTests,
			title: { value: localize('compyle.brain.generateTests', "Generate Tests"), original: 'Generate Tests' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: implement via CompyleBrainService
	}
}

class OpenCompyleBrainSettingsAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.openSettings,
			title: { value: localize('compyle.brain.openSettings', "Configure Compyle Brain"), original: 'Configure Compyle Brain' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.openSettings', 'compyle.brain');
	}
}

registerAction2(OpenCompyleBrainAction);
registerAction2(GenerateProjectMemoryAction);
registerAction2(ExplainCodebaseAction);
registerAction2(ExplainErrorAction);
registerAction2(ReviewDiffAction);
registerAction2(CreatePlanAction);
registerAction2(GenerateTestsAction);
registerAction2(OpenCompyleBrainSettingsAction);
