/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';

// Side-effect imports for workbench contributions
import './compyleModeStatusBar.js';
import './compyleModeWelcome.js';

// Local imports
import { openCompyleModeQuickPick } from './compyleModeQuickPick.js';
import {
	initProjectMemory,
	openProjectMemory,
	updateProjectMemory,
	generateHandoff,
	generateBugReport,
	cleanProjectMemory,
} from './compyleFlowMemory.js';
import { detectConcepts, findConceptForError, ExplanationLevel, getExplanation } from './compyleTutorConcepts.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	order: 200,
	properties: {
		'compyle.modes.activeMode': {
			type: 'string',
			enum: ['flow', 'focus', 'tutor', 'resolve', 'none'],
			enumDescriptions: [
				localize('compyle.modes.flow', "Compyle Flow — AI-assisted building with project memory and handoff docs."),
				localize('compyle.modes.focus', "Compyle Focus — Distraction-free, minimal, fast coding."),
				localize('compyle.modes.tutor', "Compyle Tutor — Adaptive code explanations and concept detection."),
				localize('compyle.modes.resolve', "Compyle Resolve — Debugging tools, error diagnosis, and bug reports."),
				localize('compyle.modes.none', "No workspace experience selected."),
			],
			default: 'none',
			description: localize('compyle.modes.activeMode', "Active Compyle workspace experience. Controls which tools and behaviors are prominent."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.modes.askOnFolderOpen': {
			type: 'boolean',
			default: true,
			description: localize('compyle.modes.askOnFolderOpen', "Prompt to choose a workspace experience when opening a new folder for the first time."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.modes.askOnNewProject': {
			type: 'boolean',
			default: true,
			description: localize('compyle.modes.askOnNewProject', "Prompt to choose a workspace experience when creating a new project."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.modes.memory.enabled': {
			type: 'boolean',
			default: true,
			description: localize('compyle.modes.memory.enabled', "Enable Compyle Flow project memory. Creates and maintains .compyle/ files in your project."),
			scope: ConfigurationScope.RESOURCE,
		},
		'compyle.modes.memory.behavior': {
			type: 'string',
			enum: ['ask', 'auto', 'off'],
			enumDescriptions: [
				localize('compyle.modes.memory.ask', "Review proposed memory updates before saving."),
				localize('compyle.modes.memory.auto', "Automatically save memory updates without prompting."),
				localize('compyle.modes.memory.off', "Never auto-update memory. Use commands to update manually."),
			],
			default: 'ask',
			description: localize('compyle.modes.memory.behavior', "How Compyle handles project memory updates in Compyle Flow."),
			scope: ConfigurationScope.RESOURCE,
		},
		'compyle.modes.tutor.explanationLevel': {
			type: 'string',
			enum: ['beginner', 'normal', 'advanced'],
			enumDescriptions: [
				localize('compyle.modes.tutor.beginner', "Plain language explanations with step-by-step context."),
				localize('compyle.modes.tutor.normal', "Standard explanations with examples and caveats."),
				localize('compyle.modes.tutor.advanced', "Detailed technical explanations for experienced developers."),
			],
			default: 'normal',
			description: localize('compyle.modes.tutor.explanationLevel', "Explanation depth used by Compyle Tutor."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.modes.tutor.aiBehavior': {
			type: 'string',
			enum: ['off', 'ask', 'errors', 'full'],
			enumDescriptions: [
				localize('compyle.modes.tutor.ai.off', "Never use AI. Built-in lesson cards only."),
				localize('compyle.modes.tutor.ai.ask', "Ask before sending code to AI for explanations."),
				localize('compyle.modes.tutor.ai.errors', "Automatically use AI only for errors that have no built-in explanation."),
				localize('compyle.modes.tutor.ai.full', "Allow AI explanations without prompting."),
			],
			default: 'ask',
			description: localize('compyle.modes.tutor.aiBehavior', "When Compyle Tutor may use AI to explain code or errors."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.modes.focus.reduceMotion': {
			type: 'boolean',
			default: true,
			description: localize('compyle.modes.focus.reduceMotion', "Reduce animations and transitions in Compyle Focus mode."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.modes.focus.hideSidePanels': {
			type: 'boolean',
			default: false,
			description: localize('compyle.modes.focus.hideSidePanels', "Minimize side panels when switching to Compyle Focus mode."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.switch',
			title: { value: localize('compyle.modes.switch', "Switch Workspace Experience"), original: 'Switch Workspace Experience' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await openCompyleModeQuickPick(accessor);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.startFlow',
			title: { value: localize('compyle.modes.startFlow', "Start Flow Workspace"), original: 'Start Flow Workspace' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		await configService.updateValue('compyle.modes.activeMode', 'flow');
		notificationService.prompt(
			Severity.Info,
			'Compyle Flow is active. Set up project memory to keep context across AI sessions.',
			[{ label: 'Initialize Project Memory', run: () => initProjectMemory(accessor) }],
		);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.startFocus',
			title: { value: localize('compyle.modes.startFocus', "Start Focus Workspace"), original: 'Start Focus Workspace' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		await configService.updateValue('compyle.modes.activeMode', 'focus');
		notificationService.notify({
			severity: Severity.Info,
			message: 'Compyle Focus is active. AI popups and memory prompts are off. Switch anytime from the status bar.',
		});
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.startTutor',
			title: { value: localize('compyle.modes.startTutor', "Start Tutor Workspace"), original: 'Start Tutor Workspace' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configService = accessor.get(IConfigurationService);
		const notificationService = accessor.get(INotificationService);
		await configService.updateValue('compyle.modes.activeMode', 'tutor');
		notificationService.notify({
			severity: Severity.Info,
			message: 'Compyle Tutor is active. Select code and use "Compyle: Explain Selected Code" to learn about what you are writing.',
		});
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.startResolve',
			title: { value: localize('compyle.modes.startResolve', "Start Resolve Workspace"), original: 'Start Resolve Workspace' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configService = accessor.get(IConfigurationService);
		const viewsService = accessor.get(IViewsService);
		const notificationService = accessor.get(INotificationService);

		await configService.updateValue('compyle.modes.activeMode', 'resolve');

		// Open Problems panel
		try {
			await viewsService.openView('workbench.panel.markers.view', false);
		} catch {
			// Panel may not be available in all configurations
		}

		notificationService.notify({
			severity: Severity.Info,
			message: 'Compyle Resolve is active. Use the Problems panel and "Compyle: Generate Bug Report" to diagnose issues.',
		});
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.configure',
			title: { value: localize('compyle.modes.configure', "Configure Workspace Experiences"), original: 'Configure Workspace Experiences' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.openSettings', 'compyle.modes');
	}
});

// ---------------------------------------------------------------------------
// Memory commands
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.initMemory',
			title: { value: localize('compyle.modes.initMemory', "Initialize Project Memory"), original: 'Initialize Project Memory' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await initProjectMemory(accessor);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.updateMemory',
			title: { value: localize('compyle.modes.updateMemory', "Update Project Memory"), original: 'Update Project Memory' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await updateProjectMemory(accessor);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.openMemory',
			title: { value: localize('compyle.modes.openMemory', "Open Project Memory"), original: 'Open Project Memory' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await openProjectMemory(accessor);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.generateHandoff',
			title: { value: localize('compyle.modes.generateHandoff', "Generate Handoff"), original: 'Generate Handoff' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await generateHandoff(accessor);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.summarizeChanges',
			title: { value: localize('compyle.modes.summarizeChanges', "Summarize Recent Changes"), original: 'Summarize Recent Changes' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const contextService = accessor.get(IWorkspaceContextService);
		const notificationService = accessor.get(INotificationService);

		if (contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			notificationService.notify({ severity: Severity.Warning, message: 'Open a folder to summarize changes.' });
			return;
		}

		// Open CHANGELOG.md via the memory helper (initializes if needed)
		const folders = contextService.getWorkspace().folders;
		if (!folders.length) { return; }

		const { IFileService } = await import('../../../../platform/files/common/files.js');
		const { IEditorService } = await import('../../../services/editor/common/editorService.js');
		const { URI } = await import('../../../../base/common/uri.js');

		const changelogUri = URI.joinPath(folders[0].uri, '.compyle', 'CHANGELOG.md');
		const fileService = accessor.get(IFileService);
		const exists = await fileService.exists(changelogUri);

		if (!exists) {
			notificationService.prompt(
				Severity.Info,
				'No CHANGELOG.md found. Initialize project memory first.',
				[{ label: 'Initialize Memory', run: () => initProjectMemory(accessor) }],
			);
			return;
		}

		const editorService = accessor.get(IEditorService);
		await editorService.openEditor({ resource: changelogUri });

		notificationService.notify({
			severity: Severity.Info,
			message: 'CHANGELOG.md is open. Record your recent changes. Auto-summarization will be available when Compyle Brain is configured.',
		});
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.cleanMemory',
			title: { value: localize('compyle.modes.cleanMemory', "Clean Project Memory"), original: 'Clean Project Memory' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await cleanProjectMemory(accessor);
	}
});

// ---------------------------------------------------------------------------
// Tutor commands
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.explainSelectedCode',
			title: { value: localize('compyle.modes.explainSelectedCode', "Explain Selected Code"), original: 'Explain Selected Code' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		const configService = accessor.get(IConfigurationService);
		const codeEditorService = accessor.get(ICodeEditorService);

		const editor = codeEditorService.getActiveCodeEditor();
		if (!editor) {
			notificationService.notify({ severity: Severity.Info, message: 'Open a file and select some code first.' });
			return;
		}

		const selection = editor.getSelection();
		const model = editor.getModel();
		if (!selection || !model || selection.isEmpty()) {
			notificationService.notify({ severity: Severity.Info, message: 'Select some code first, then run "Explain Selected Code".' });
			return;
		}

		const selectedText = model.getValueInRange(selection);
		const languageId = model.getLanguageId();
		const level = (configService.getValue<string>('compyle.modes.tutor.explanationLevel') || 'normal') as ExplanationLevel;

		const concepts = detectConcepts(selectedText, languageId);

		if (concepts.length === 0) {
			notificationService.notify({
				severity: Severity.Info,
				message: `No built-in lesson found for this ${languageId} code. Use Compyle Brain for AI-powered explanations when it is configured.`,
			});
			return;
		}

		const top = concepts[0];
		const explanation = getExplanation(top, level);

		notificationService.notify({
			severity: Severity.Info,
			message: [
				`**${top.concept}** (${top.language})`,
				'',
				explanation,
				'',
				`Example: ${top.example}`,
				'',
				`Common mistake: ${top.commonMistake}`,
			].join('\n'),
		});
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.explainCurrentError',
			title: { value: localize('compyle.modes.explainCurrentError', "Explain Current Error"), original: 'Explain Current Error' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		const markerService = accessor.get(IMarkerService);
		const codeEditorService = accessor.get(ICodeEditorService);
		const configService = accessor.get(IConfigurationService);

		const editor = codeEditorService.getActiveCodeEditor();
		if (!editor) {
			notificationService.notify({ severity: Severity.Info, message: 'Open a file with errors to use this command.' });
			return;
		}

		const model = editor.getModel();
		if (!model) { return; }

		const position = editor.getPosition();
		const languageId = model.getLanguageId();
		const level = (configService.getValue<string>('compyle.modes.tutor.explanationLevel') || 'normal') as ExplanationLevel;

		// Get markers for the current file
		const markers = markerService.read({ resource: model.uri, severities: MarkerSeverity.Error | MarkerSeverity.Warning });

		if (markers.length === 0) {
			notificationService.notify({ severity: Severity.Info, message: 'No errors or warnings found in the current file.' });
			return;
		}

		// Prefer the marker nearest to the cursor
		let nearest = markers[0];
		if (position) {
			nearest = markers.reduce((prev, curr) => {
				const prevDist = Math.abs(prev.startLineNumber - position.lineNumber);
				const currDist = Math.abs(curr.startLineNumber - position.lineNumber);
				return currDist < prevDist ? curr : prev;
			}, markers[0]);
		}

		const concept = findConceptForError(nearest.message, languageId);
		if (concept) {
			const explanation = getExplanation(concept, level);
			notificationService.notify({
				severity: Severity.Info,
				message: [
					`**${concept.concept}**`,
					'',
					`Error: ${nearest.message}`,
					'',
					explanation,
					'',
					`Common mistake: ${concept.commonMistake}`,
				].join('\n'),
			});
		} else {
			notificationService.notify({
				severity: Severity.Info,
				message: [
					`Error on line ${nearest.startLineNumber}: ${nearest.message}`,
					'',
					'No built-in explanation found for this error. Configure Compyle Brain for AI-powered help.',
				].join('\n'),
			});
		}
	}
});

// ---------------------------------------------------------------------------
// Resolve command
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.modes.generateBugReport',
			title: { value: localize('compyle.modes.generateBugReport', "Generate Bug Report"), original: 'Generate Bug Report' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await generateBugReport(accessor);
	}
});
