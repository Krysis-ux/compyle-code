/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleRouter.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { CompyleRouterInput } from './compyleRouterInput.js';
import { ICompyleRouterService } from './compyleRouterService.js';
import {
	COMPYLE_DEFAULT_ROUTES,
	COMPYLE_ROUTER_LOG_SETTING,
	COMPYLE_ROUTER_MODE_SETTING,
	COMPYLE_ROUTER_QUALITY_GATE_SETTING,
	CompyleRouterMode,
	ICompyleRouterRule,
} from '../common/compyleRouter.js';

const MODE_LABELS: Record<CompyleRouterMode, string> = {
	none: localize('compyleRouter.mode.none', "None"),
	default: localize('compyleRouter.mode.default', "Default"),
	custom: localize('compyleRouter.mode.custom', "Custom"),
};

const MODE_DESCRIPTIONS: Record<CompyleRouterMode, string> = {
	none: localize('compyleRouter.mode.none.desc', "Send requests straight to your provider — no routing or quality gate."),
	default: localize('compyleRouter.mode.default.desc', "Built-in routing table plus the quality gate. Recommended."),
	custom: localize('compyleRouter.mode.custom.desc', "Your own keyword rules from a JSON config file."),
};

export class CompyleRouterEditor extends EditorPane {

	static readonly ID = 'compyleRouter';

	private _root!: HTMLElement;
	private _ruleFormEl: HTMLElement | undefined;

	private readonly _renderDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ICommandService private readonly _commandService: ICommandService,
		@ICompyleRouterService private readonly _routerService: ICompyleRouterService,
	) {
		super(CompyleRouterEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.cr-root.compyle-panel'));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('compyle.router')) {
				this._render();
			}
		}));
		this._register(this._routerService.onDidChangeLog(() => this._render()));
	}

	override async setInput(input: CompyleRouterInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this._render();
	}

	private _render(): void {
		if (!this._root) {
			return;
		}
		this._renderDisposables.clear();
		clearNode(this._root);

		const header = append(this._root, $('.cr-header'));
		append(header, $('h2.cr-title', undefined, localize('compyleRouter.heading', "Compyle Router")));
		append(header, $('.cr-subtitle', undefined, localize('compyleRouter.subheading', "Steer requests by task and screen AI output for risky content.")));

		this._renderModes();

		const mode = this._routerService.getMode();
		if (mode === 'default') {
			this._renderDefaultRoutes();
		} else if (mode === 'custom') {
			this._renderCustom();
		}

		this._renderToggles();
		this._renderLog();
	}

	private _renderModes(): void {
		const row = append(this._root, $('.cr-modes'));
		const current = this._routerService.getMode();
		for (const mode of ['none', 'default', 'custom'] as CompyleRouterMode[]) {
			const card = append(row, $('.cr-mode-card'));
			card.classList.toggle('active', mode === current);
			append(card, $('.cr-mode-name', undefined, MODE_LABELS[mode]));
			append(card, $('.cr-mode-desc', undefined, MODE_DESCRIPTIONS[mode]));
			this._renderDisposables.add(addDisposableListener(card, 'click', () => {
				this._configurationService.updateValue(COMPYLE_ROUTER_MODE_SETTING, mode);
			}));
		}
	}

	private _renderDefaultRoutes(): void {
		append(this._root, $('h3.cr-section', undefined, localize('compyleRouter.routes', "Routing Table")));
		const table = append(this._root, $('.cr-table'));
		for (const route of COMPYLE_DEFAULT_ROUTES) {
			const line = append(table, $('.cr-route'));
			append(line, $('.cr-route-label', undefined, route.label));
			append(line, $('.cr-route-keywords', undefined, route.keywords.join(', ')));
		}
		const note = append(table, $('.cr-route'));
		append(note, $('.cr-route-label', undefined, localize('compyleRouter.routes.code', "Code")));
		append(note, $('.cr-route-keywords', undefined, localize('compyleRouter.routes.codeDesc', "Everything else (no special steering).")));
	}

	private _renderCustom(): void {
		append(this._root, $('h3.cr-section', undefined, localize('compyleRouter.custom', "Custom Rules")));

		// Template chips
		const templateBar = append(this._root, $('.cr-template-bar'));
		append(templateBar, $('.cr-template-label', undefined, localize('compyleRouter.templates', "Templates:")));
		const TEMPLATES: Array<{ name: string; keywords: string; systemPromptPrefix: string }> = [
			{ name: 'Code Review', keywords: 'review, audit, check, improve', systemPromptPrefix: 'You are a senior code reviewer. Focus on correctness, security, and maintainability. Suggest concrete improvements.' },
			{ name: 'Research', keywords: 'research, find, compare, best library', systemPromptPrefix: 'You are a research assistant. Compare options and summarize findings with clear trade-offs.' },
			{ name: 'Refactor', keywords: 'refactor, clean up, simplify', systemPromptPrefix: 'You are a refactoring specialist. Preserve behavior while improving readability and structure.' },
			{ name: 'Security Audit', keywords: 'security, vulnerability, exploit, injection', systemPromptPrefix: 'You are a security expert. Perform a thorough vulnerability review and recommend minimal, safe fixes.' },
			{ name: 'Planning', keywords: 'plan, roadmap, steps, how to', systemPromptPrefix: 'You are a project planner. Break the task into clear, ordered steps with estimated complexity for each.' },
		];
		for (const tpl of TEMPLATES) {
			const chip = append(templateBar, $('button.cr-template-chip', undefined, tpl.name)) as HTMLButtonElement;
			this._renderDisposables.add(addDisposableListener(chip, 'click', () => {
				this._openRuleForm(null, tpl);
			}));
		}

		// Rule list
		const rules = this._routerService.getCustomConfig().rules;
		const listSection = append(this._root, $('.cr-rule-list'));

		if (rules.length === 0) {
			append(listSection, $('.cr-rule-empty', undefined, localize('compyleRouter.noRules', "No custom rules yet. Use a template above or click \"+ Add Rule\" to create one.")));
		} else {
			for (let i = 0; i < rules.length; i++) {
				const rule = rules[i];
				const row = append(listSection, $('.cr-rule-row'));
				const info = append(row, $('.cr-rule-info'));
				append(info, $('span.cr-rule-name', undefined, rule.name));
				append(info, $('span.cr-rule-kw', undefined, rule.keywords.join(', ')));
				const btns = append(row, $('.cr-rule-btns'));
				const editBtn = append(btns, $('button.cr-btn', undefined, localize('compyleRouter.editRule', "Edit"))) as HTMLButtonElement;
				const delBtn = append(btns, $('button.cr-btn.danger', undefined, localize('compyleRouter.deleteRule', "Delete"))) as HTMLButtonElement;
				const idx = i;
				this._renderDisposables.add(addDisposableListener(editBtn, 'click', () => {
					this._openRuleForm(idx, { name: rule.name, keywords: rule.keywords.join(', '), systemPromptPrefix: rule.systemPromptPrefix ?? '' });
				}));
				this._renderDisposables.add(addDisposableListener(delBtn, 'click', async () => {
					const updated = [...rules.slice(0, idx), ...rules.slice(idx + 1)];
					await this._routerService.saveCustomConfig({ rules: updated });
					this._render();
				}));
			}
		}

		// Add rule button
		const addRow = append(this._root, $('.cr-add-row'));
		this._button(addRow, localize('compyleRouter.addRule', "+ Add Rule"), () => this._openRuleForm(null, { name: '', keywords: '', systemPromptPrefix: '' }));
		this._button(addRow, localize('compyleRouter.openConfigFile', "Open JSON"), () => this._commandService.executeCommand('compyle.router.openConfigFile'));
	}

	private _openRuleForm(editIndex: number | null, prefill: { name: string; keywords: string; systemPromptPrefix: string }): void {
		this._ruleFormEl?.remove();
		this._ruleFormEl = undefined;

		const form = append(this._root, $('.cr-rule-form'));
		this._ruleFormEl = form;
		append(form, $('h4.cr-form-title', undefined, editIndex !== null
			? localize('compyleRouter.editRuleTitle', "Edit Rule")
			: localize('compyleRouter.newRuleTitle', "New Rule")));

		const nameInput = append(form, $('input.cr-form-input')) as HTMLInputElement;
		nameInput.placeholder = localize('compyleRouter.ruleName', "Rule name (e.g. \"Quick Edit\")");
		nameInput.value = prefill.name;

		const kwInput = append(form, $('input.cr-form-input')) as HTMLInputElement;
		kwInput.placeholder = localize('compyleRouter.ruleKeywords', "Keywords — comma separated (e.g. rename, typo, fix)");
		kwInput.value = prefill.keywords;

		const promptInput = append(form, $('textarea.cr-form-textarea')) as HTMLTextAreaElement;
		promptInput.placeholder = localize('compyleRouter.rulePrompt', "System prompt prefix — how should the AI approach requests matching these keywords?");
		promptInput.rows = 3;
		promptInput.value = prefill.systemPromptPrefix;

		const btns = append(form, $('.cr-form-actions'));
		const saveBtn = append(btns, $('button.cr-btn.primary', undefined, localize('compyleRouter.saveRule', "Save Rule"))) as HTMLButtonElement;
		const cancelBtn = append(btns, $('button.cr-btn', undefined, localize('compyleRouter.cancelRule', "Cancel"))) as HTMLButtonElement;

		this._renderDisposables.add(addDisposableListener(cancelBtn, 'click', () => {
			form.remove();
			this._ruleFormEl = undefined;
		}));

		this._renderDisposables.add(addDisposableListener(saveBtn, 'click', async () => {
			const name = nameInput.value.trim();
			const keywords = kwInput.value.split(',').map(k => k.trim()).filter(Boolean);
			const systemPromptPrefix = promptInput.value.trim();
			if (!name || keywords.length === 0) {
				nameInput.style.borderColor = !name ? 'var(--vscode-inputValidation-errorBorder)' : '';
				kwInput.style.borderColor = keywords.length === 0 ? 'var(--vscode-inputValidation-errorBorder)' : '';
				return;
			}
			const newRule: ICompyleRouterRule = { name, keywords, systemPromptPrefix };
			const existing = [...this._routerService.getCustomConfig().rules];
			if (editIndex !== null) {
				existing[editIndex] = newRule;
			} else {
				existing.push(newRule);
			}
			await this._routerService.saveCustomConfig({ rules: existing });
			this._render();
		}));

		form.scrollIntoView({ behavior: 'smooth', block: 'start' });
		nameInput.focus();
	}

	private _renderToggles(): void {
		append(this._root, $('h3.cr-section', undefined, localize('compyleRouter.options', "Options")));
		const box = append(this._root, $('.cr-toggles'));
		this._toggle(box, localize('compyleRouter.qualityGate', "Quality gate (flag secrets & dangerous commands in AI output)"), COMPYLE_ROUTER_QUALITY_GATE_SETTING, true);
		this._toggle(box, localize('compyleRouter.logging', "Log routing decisions"), COMPYLE_ROUTER_LOG_SETTING, false);
	}

	private _renderLog(): void {
		const entries = this._routerService.getLog();
		const head = append(this._root, $('.cr-log-head'));
		append(head, $('h3.cr-section', undefined, localize('compyleRouter.log', "Routing Log")));
		if (entries.length) {
			this._button(head, localize('compyleRouter.clearLog', "Clear"), () => this._routerService.clearLog());
		}

		const box = append(this._root, $('.cr-log'));
		if (!entries.length) {
			append(box, $('.cr-log-empty', undefined, localize('compyleRouter.log.empty', "No routing decisions recorded yet. Enable logging to track them.")));
			return;
		}
		for (const entry of entries) {
			const row = append(box, $('.cr-log-row'));
			append(row, $('.cr-log-time', undefined, new Date(entry.timestamp).toLocaleTimeString()));
			append(row, $('.cr-log-mode', undefined, entry.mode));
			append(row, $('.cr-log-label', undefined, entry.label));
			append(row, $('.cr-log-findings', undefined, entry.findings ? localize('compyleRouter.log.flagged', "{0} flag(s)", entry.findings) : localize('compyleRouter.log.clean', "clean")));
		}
	}

	private _button(parent: HTMLElement, label: string, run: () => void): void {
		const button = append(parent, $('button.cr-btn', undefined, label)) as HTMLButtonElement;
		this._renderDisposables.add(addDisposableListener(button, 'click', run));
	}

	private _toggle(parent: HTMLElement, label: string, setting: string, defaultValue: boolean): void {
		const row = append(parent, $('label.cr-toggle')) as HTMLLabelElement;
		const input = append(row, $('input')) as HTMLInputElement;
		input.type = 'checkbox';
		input.checked = this._configurationService.getValue<boolean>(setting) ?? defaultValue;
		append(row, label);
		this._renderDisposables.add(addDisposableListener(input, 'change', () => {
			this._configurationService.updateValue(setting, input.checked);
		}));
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
