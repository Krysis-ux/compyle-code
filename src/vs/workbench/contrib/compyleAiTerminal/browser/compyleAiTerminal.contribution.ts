/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { createDecorator, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, IPromptChoice, Severity } from '../../../../platform/notification/common/notification.js';
import { TerminalCapability } from '../../../../platform/terminal/common/capabilities/capabilities.js';
import type { ITerminalCommand } from '../../../../platform/terminal/common/capabilities/capabilities.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ITerminalService, ITerminalInstance } from '../../terminal/browser/terminal.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { IResolvedTerminalFix, matchTerminalError } from '../common/compyleTerminalErrors.js';

const COMPYLE_CATEGORY = { value: localize('compyle', "Compyle"), original: 'Compyle' };
const ENABLED_SETTING = 'compyle.aiTerminal.enabled';
const AUTO_EXPLAIN_SETTING = 'compyle.aiTerminal.autoExplain';

export const ICompyleAiTerminalService = createDecorator<ICompyleAiTerminalService>('compyleAiTerminalService');

export interface ICompyleAiTerminalService {
	readonly _serviceBrand: undefined;
	/** Offer an explanation for the most recent diagnosed terminal error. */
	explainLast(): void;
	/** Run the suggested fix for the most recent diagnosed terminal error. */
	applyLastFix(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[ENABLED_SETTING]: {
			type: 'boolean',
			default: true,
			description: localize('compyle.aiTerminal.enabled', "Let Compyle watch the integrated terminal and explain failed commands."),
			scope: ConfigurationScope.APPLICATION,
		},
		[AUTO_EXPLAIN_SETTING]: {
			type: 'boolean',
			default: true,
			description: localize('compyle.aiTerminal.autoExplain', "Automatically offer an explanation when a terminal command fails. When off, use the status bar or the \"Explain Last Terminal Error\" command."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

interface ILastDiagnosis {
	readonly fix: IResolvedTerminalFix;
	readonly instance: ITerminalInstance;
}

export class CompyleAiTerminalService extends Disposable implements ICompyleAiTerminalService {
	declare readonly _serviceBrand: undefined;

	private readonly _instanceListeners = this._register(new DisposableMap<ITerminalInstance>());
	private readonly _statusEntry = this._register(new MutableDisposable<IStatusbarEntryAccessor>());
	private _lastDiagnosis: ILastDiagnosis | undefined;
	private _lastFailure: { command: string; output: string } | undefined;

	constructor(
		@ITerminalService private readonly _terminalService: ITerminalService,
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IProgressService private readonly _progressService: IProgressService,
		@IEditorService private readonly _editorService: IEditorService,
	) {
		super();

		for (const instance of this._terminalService.instances) {
			this._track(instance);
		}
		this._register(this._terminalService.onDidCreateInstance(instance => this._track(instance)));
		this._register(this._terminalService.onDidDisposeInstance(instance => this._instanceListeners.deleteAndDispose(instance)));
	}

	private get _enabled(): boolean {
		return this._configurationService.getValue<boolean>(ENABLED_SETTING) !== false;
	}

	private _track(instance: ITerminalInstance): void {
		const store = new DisposableStore();
		const existing = instance.capabilities.get(TerminalCapability.CommandDetection);
		if (existing) {
			store.add(existing.onCommandFinished(command => this._onCommandFinished(instance, command)));
		}
		store.add(instance.capabilities.onDidAddCommandDetectionCapability(capability => {
			store.add(capability.onCommandFinished(command => this._onCommandFinished(instance, command)));
		}));
		this._instanceListeners.set(instance, store);
	}

	private _onCommandFinished(instance: ITerminalInstance, command: ITerminalCommand): void {
		if (!this._enabled || command.exitCode === undefined || command.exitCode === 0) {
			return;
		}
		const output = command.getOutput() ?? '';
		this._lastFailure = { command: command.command, output };

		const fix = matchTerminalError(command.command, output, command.exitCode);
		const autoExplain = this._configurationService.getValue<boolean>(AUTO_EXPLAIN_SETTING) !== false;

		if (fix) {
			this._lastDiagnosis = { fix, instance };
			this._showStatus(localize('compyle.aiTerminal.status.matched', "{0} — click to explain", fix.title));
			if (autoExplain) {
				this._prompt(fix);
			}
		} else if (this._brainService.isConfigured()) {
			// No built-in match, but AI is available — offer to ask Compyle Brain.
			this._lastDiagnosis = undefined;
			this._showStatus(localize('compyle.aiTerminal.status.ask', "A command failed — ask Compyle Brain"));
			if (autoExplain) {
				this._notificationService.prompt(Severity.Warning, localize('compyle.aiTerminal.brainPrompt', "A terminal command failed. Ask Compyle Brain to explain it?"), [
					{ label: localize('compyle.aiTerminal.askBrain', "Ask Compyle Brain"), run: () => { void this._askBrain(); } },
				]);
			}
		}
	}

	private _showStatus(title: string): void {
		const entry: IStatusbarEntry = {
			name: localize('compyle.aiTerminal.status.name', "Compyle Terminal Helper"),
			text: `$(lightbulb) ${localize('compyle.aiTerminal.status.text', "Explain error")}`,
			ariaLabel: title,
			tooltip: title,
			command: 'compyle.aiTerminal.explainLast',
		};
		if (this._statusEntry.value) {
			this._statusEntry.value.update(entry);
		} else {
			this._statusEntry.value = this._statusbarService.addEntry(entry, 'status.compyle.aiTerminal', StatusbarAlignment.RIGHT, 95);
		}
	}

	private _prompt(fix: IResolvedTerminalFix): void {
		const message = localize('compyle.aiTerminal.prompt', "Command failed: {0}. {1}", fix.title, fix.cause);
		this._notificationService.prompt(Severity.Warning, message, this._buildChoices(fix));
	}

	explainLast(): void {
		if (this._lastDiagnosis) {
			this._prompt(this._lastDiagnosis.fix);
			return;
		}
		if (this._lastFailure && this._brainService.isConfigured()) {
			void this._askBrain();
			return;
		}
		this._notificationService.notify({ severity: Severity.Info, message: localize('compyle.aiTerminal.noError', "No recent terminal error to explain.") });
	}

	private async _askBrain(): Promise<void> {
		if (!this._lastFailure) {
			return;
		}
		const { command, output } = this._lastFailure;
		const prompt = [
			'A terminal command failed. Explain the likely cause in plain language and give the exact command(s) to fix it.',
			'',
			`Command: ${command}`,
			'',
			'Output:',
			output.slice(-4000),
		].join('\n');

		try {
			const answer = await this._progressService.withProgress(
				{ location: ProgressLocation.Notification, title: localize('compyle.aiTerminal.brainThinking', "Compyle Brain is analyzing the error…") },
				() => this._brainService.chat([{ role: 'user', content: prompt }], { maxTokens: 1024 }),
			);
			await this._editorService.openEditor({
				resource: undefined,
				contents: `# Terminal Error Help\n\n**Command:** \`${command}\`\n\n${answer}\n`,
				languageId: 'markdown',
			});
			this._statusEntry.clear();
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	async applyLastFix(): Promise<void> {
		if (this._lastDiagnosis?.fix.fixCommand) {
			await this._applyFix(this._lastDiagnosis.fix, this._lastDiagnosis.instance);
		}
	}

	private _buildChoices(fix: IResolvedTerminalFix): IPromptChoice[] {
		const choices: IPromptChoice[] = [];
		if (fix.fixCommand) {
			choices.push({
				label: localize('compyle.aiTerminal.applyFix', "Apply Fix: {0}", fix.fixCommand),
				run: () => { void this._applyFix(fix, this._lastDiagnosis?.instance); },
			});
		}
		choices.push({
			label: localize('compyle.aiTerminal.explainBeginner', "Explain Like I'm New"),
			run: () => this._notificationService.notify({ severity: Severity.Info, message: this._composeExplanation(fix, fix.explanationBeginner) }),
		});
		choices.push({
			label: localize('compyle.aiTerminal.explainAdvanced', "Show Advanced"),
			run: () => this._notificationService.notify({ severity: Severity.Info, message: this._composeExplanation(fix, fix.explanationAdvanced) }),
		});
		if (this._brainService.isConfigured()) {
			choices.push({
				label: localize('compyle.aiTerminal.askBrainDeep', "Ask Compyle Brain"),
				run: () => { void this._askBrain(); },
			});
		}
		return choices;
	}

	private _composeExplanation(fix: IResolvedTerminalFix, body: string): string {
		const parts = [`${fix.title}`, '', body];
		if (fix.saferFix) {
			parts.push('', localize('compyle.aiTerminal.saferFix', "Safer option: {0}", fix.saferFix));
		}
		if (fix.relatedFile) {
			parts.push('', localize('compyle.aiTerminal.relatedFile', "Check this file: {0}", fix.relatedFile));
		}
		return parts.join('\n');
	}

	private async _applyFix(fix: IResolvedTerminalFix, instance: ITerminalInstance | undefined): Promise<void> {
		if (!fix.fixCommand) {
			return;
		}
		const target = (instance && this._terminalService.instances.includes(instance))
			? instance
			: await this._terminalService.createTerminal({});
		this._terminalService.setActiveInstance(target);
		// Destructive fixes are typed but NOT auto-run — the user reviews and presses Enter.
		await target.sendText(fix.fixCommand, !fix.destructive);
		this._statusEntry.clear();
	}
}

registerSingleton(ICompyleAiTerminalService, CompyleAiTerminalService, InstantiationType.Delayed);

// Force the service to instantiate so it starts watching terminals.
class CompyleAiTerminalStarter implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleAiTerminalStarter';
	constructor(@ICompyleAiTerminalService _service: ICompyleAiTerminalService) { }
}

registerWorkbenchContribution2(
	CompyleAiTerminalStarter.ID,
	CompyleAiTerminalStarter,
	WorkbenchPhase.AfterRestored,
);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.aiTerminal.explainLast',
			title: { value: localize('compyle.aiTerminal.explainLast', "Explain Last Terminal Error"), original: 'Explain Last Terminal Error' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override run(accessor: ServicesAccessor): void {
		accessor.get(ICompyleAiTerminalService).explainLast();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.aiTerminal.applyFix',
			title: { value: localize('compyle.aiTerminal.applyFix.command', "Apply Suggested Terminal Fix"), original: 'Apply Suggested Terminal Fix' },
			category: COMPYLE_CATEGORY,
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(ICompyleAiTerminalService).applyLastFix();
	}
});
