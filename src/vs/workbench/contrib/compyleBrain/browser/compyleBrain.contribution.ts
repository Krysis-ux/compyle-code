/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IViewContainersRegistry, IViewsRegistry, IViewDescriptor, ViewContainer, ViewContainerLocation, Extensions as ViewExtensions } from '../../../common/views.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { COMPYLE_BRAIN_COMMANDS, CompyleBrainProvider } from '../common/compyleBrain.js';
import { ICompyleBrainService } from './compyleBrainService.js';
import { CompyleLocalModelsEditor } from './compyleLocalModels.js';
import { CompyleLocalModelsInput, CompyleLocalModelsInputSerializer } from './compyleLocalModelsInput.js';
import { CompyleChatEditor } from './compyleChat.js';
import { CompyleChatInput, CompyleChatInputSerializer } from './compyleChatInput.js';
import { CompyleChatViewPane } from './compyleChatViewPane.js';
import './compyleAgentService.js';
import './compyleChatHistoryService.js';

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
		'compyle.brain.temperature': {
			type: 'number',
			default: 0.7,
			minimum: 0,
			maximum: 2,
			description: localize('compyle.brain.temperature', "Sampling temperature for Compyle Brain. Lower is more focused, higher is more creative (0-2)."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.maxTokens': {
			type: 'number',
			default: 1024,
			minimum: 1,
			description: localize('compyle.brain.maxTokens', "Maximum number of tokens Compyle Brain may generate in a single reply."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.contextLength': {
			type: 'number',
			default: 0,
			minimum: 0,
			description: localize('compyle.brain.contextLength', "Context window size for Ollama models (num_ctx). 0 uses the model's default. Larger values use more VRAM."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.keepAlive': {
			type: 'string',
			default: '5m',
			description: localize('compyle.brain.keepAlive', "How long Ollama keeps a model loaded in memory after a request (e.g. \"5m\", \"1h\", or \"-1\" to keep it loaded indefinitely)."),
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
		'compyle.brain.agentEditing': {
			type: 'string',
			enum: ['approve', 'auto'],
			default: 'approve',
			enumDescriptions: [
				localize('agentEditing.approve', "Show a diff and require approval before applying edits."),
				localize('agentEditing.auto', "Full control: apply edits and run commands automatically."),
			],
			description: localize('compyle.brain.agentEditing', "How Compyle AI applies file edits and runs commands."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.allowRunCommands': {
			type: 'boolean',
			default: true,
			description: localize('compyle.brain.allowRunCommands', "Let Compyle AI run terminal commands to build and test your code."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.maxAgentSteps': {
			type: 'number',
			default: 12,
			minimum: 1,
			maximum: 50,
			description: localize('compyle.brain.maxAgentSteps', "Maximum number of tool-use iterations Compyle AI may take per request."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.brain.skillPresets': {
			type: 'object',
			default: {},
			description: localize('compyle.brain.skillPresets', "Named sets of skills to enable together in Compyle AI."),
			scope: ConfigurationScope.APPLICATION,
		},
	}
});

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleLocalModelsEditor,
		CompyleLocalModelsEditor.ID,
		localize('compyleLocalModels', "Local Models"),
	),
	[new SyncDescriptor(CompyleLocalModelsInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleLocalModelsInput.ID, CompyleLocalModelsInputSerializer);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CompyleChatEditor,
		CompyleChatEditor.ID,
		localize('compyleChat', "Compyle AI"),
	),
	[new SyncDescriptor(CompyleChatInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
	.registerEditorSerializer(CompyleChatInput.ID, CompyleChatInputSerializer);

// ---------------------------------------------------------------------------
// Compyle AI view — lives in the auxiliary bar (right side panel), like Copilot
// ---------------------------------------------------------------------------

const COMPYLE_CHAT_CONTAINER_ID = 'workbench.viewContainer.compyleChat';
const compyleChatIcon = registerIcon('compyle-chat-icon', Codicon.robot, localize('compyleChat.viewIcon', "Icon for the Compyle AI view."));

const compyleChatViewContainer: ViewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: COMPYLE_CHAT_CONTAINER_ID,
	title: localize2('compyleChat.viewContainer', "Compyle AI"),
	icon: compyleChatIcon,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [COMPYLE_CHAT_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: COMPYLE_CHAT_CONTAINER_ID,
	hideIfEmpty: false,
	order: 2,
}, ViewContainerLocation.AuxiliaryBar, { doNotRegisterOpenCommand: true });

const compyleChatViewDescriptor: IViewDescriptor = {
	id: CompyleChatViewPane.ID,
	name: localize2('compyleChat.viewName', "Compyle AI"),
	containerIcon: compyleChatViewContainer.icon,
	containerTitle: compyleChatViewContainer.title.value,
	singleViewPaneContainerTitle: compyleChatViewContainer.title.value,
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(CompyleChatViewPane),
};
Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([compyleChatViewDescriptor], compyleChatViewContainer);

// ---------------------------------------------------------------------------
// Command registrations
// ---------------------------------------------------------------------------

class OpenCompyleBrainAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.open,
			title: { value: localize('compyle.brain.open', "Open Compyle AI"), original: 'Open Compyle AI' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
			menu: [{ id: MenuId.CommandPalette }],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(CompyleChatViewPane.ID, true);
	}
}

/**
 * Title-bar toggle button (top-right, in the layout control cluster) that opens
 * or closes the Compyle AI panel on the right — the same gesture as Copilot.
 */
class ToggleCompyleChatViewAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.brain.toggleView',
			title: localize2('compyle.brain.toggleView', "Compyle AI"),
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			icon: Codicon.robot,
			f1: true,
			menu: [
				{ id: MenuId.LayoutControlMenu, group: 'navigation', order: 0 },
				{ id: MenuId.CommandPalette },
			],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		if (viewsService.isViewVisible(CompyleChatViewPane.ID)) {
			viewsService.closeView(CompyleChatViewPane.ID);
		} else {
			await viewsService.openView(CompyleChatViewPane.ID, true);
		}
	}
}

class OpenLocalModelsAction extends Action2 {
	constructor() {
		super({
			id: COMPYLE_BRAIN_COMMANDS.openLocalModels,
			title: { value: localize('compyle.brain.openLocalModels', "Open Local Models"), original: 'Open Local Models' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
			menu: [{ id: MenuId.CommandPalette }],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);
		const input = instantiationService.createInstance(CompyleLocalModelsInput);
		await editorService.openEditor(input, { pinned: false });
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

class SetApiKeyAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.brain.setApiKey',
			title: { value: localize('compyle.brain.setApiKey', "Set API Key"), original: 'Set API Key' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const commandService = accessor.get(ICommandService);

		const config = brainService.getConfig();
		if (config.provider === CompyleBrainProvider.None) {
			// commandService is captured here because the accessor is invalid once the button is clicked.
			notificationService.prompt(Severity.Info, localize('compyle.brain.pickProviderFirst', "Select an AI provider in Settings before setting an API key."), [
				{ label: localize('compyle.brain.openSettings.btn', "Open Settings"), run: () => { void commandService.executeCommand('workbench.action.openSettings', 'compyle.brain.provider'); } },
			]);
			return;
		}

		const key = await quickInputService.input({
			title: localize('compyle.brain.apiKeyTitle', "API Key for {0}", config.provider),
			password: true,
			placeHolder: localize('compyle.brain.apiKeyPlaceholder', "Paste your API key (stored securely, never in settings)"),
			ignoreFocusLost: true,
		});
		if (key === undefined) {
			return;
		}
		if (key.trim() === '') {
			await brainService.clearApiKey();
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.brain.keyCleared', "API key cleared.") });
			return;
		}
		await brainService.setApiKey(key.trim());
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.brain.keySaved', "API key saved securely.") });
	}
}

class TestConnectionAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.brain.testConnection',
			title: { value: localize('compyle.brain.testConnection', "Test Connection"), original: 'Test Connection' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);

		const result = await progressService.withProgress(
			{ location: ProgressLocation.Notification, title: localize('compyle.brain.testing', "Testing Compyle Brain connection…") },
			() => brainService.testConnection(),
		);
		notificationService.notify({ severity: result.ok ? Severity.Info : Severity.Error, message: result.message });
	}
}

class AskCompyleBrainAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.brain.ask',
			title: { value: localize('compyle.brain.ask', "Ask Compyle Brain"), original: 'Ask Compyle Brain' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const brainService = accessor.get(ICompyleBrainService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const editorService = accessor.get(IEditorService);
		const commandService = accessor.get(ICommandService);

		if (!brainService.isConfigured()) {
			// commandService is captured here because the accessor is invalid once a button is clicked.
			notificationService.prompt(Severity.Info, localize('compyle.brain.configurePrompt', "Compyle Brain is not configured yet."), [
				{ label: localize('compyle.brain.configure.btn', "Configure"), run: () => { void commandService.executeCommand('workbench.action.openSettings', 'compyle.brain'); } },
				{ label: localize('compyle.brain.localModels.btn', "Local Models"), run: () => { void commandService.executeCommand(COMPYLE_BRAIN_COMMANDS.openLocalModels); } },
			]);
			return;
		}

		const question = await quickInputService.input({
			title: localize('compyle.brain.askTitle', "Ask Compyle Brain"),
			placeHolder: localize('compyle.brain.askPlaceholder', "Ask anything about coding, errors, or your project…"),
			ignoreFocusLost: true,
		});
		if (!question) {
			return;
		}

		try {
			const answer = await progressService.withProgress(
				{ location: ProgressLocation.Notification, title: localize('compyle.brain.thinking', "Compyle Brain is thinking…") },
				() => brainService.chat([{ role: 'user', content: question }], { maxTokens: 2048 }),
			);
			await editorService.openEditor({
				resource: undefined,
				contents: `# ${question}\n\n${answer}\n`,
				languageId: 'markdown',
			});
		} catch (error) {
			notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}
}

registerAction2(OpenCompyleBrainAction);
registerAction2(ToggleCompyleChatViewAction);
registerAction2(OpenLocalModelsAction);
registerAction2(GenerateProjectMemoryAction);
registerAction2(ExplainCodebaseAction);
registerAction2(ExplainErrorAction);
registerAction2(ReviewDiffAction);
registerAction2(CreatePlanAction);
registerAction2(GenerateTestsAction);
registerAction2(OpenCompyleBrainSettingsAction);
registerAction2(SetApiKeyAction);
registerAction2(TestConnectionAction);
registerAction2(AskCompyleBrainAction);
