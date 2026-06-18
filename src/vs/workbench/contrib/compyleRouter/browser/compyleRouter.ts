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
		const box = append(this._root, $('.cr-custom'));
		const path = this._configurationService.getValue<string>('compyle.router.customConfigPath') || localize('compyleRouter.noPath', "(not set)");
		append(box, $('.cr-custom-path', undefined, localize('compyleRouter.configPath', "Config file: {0}", path)));

		const actions = append(box, $('.cr-actions'));
		this._button(actions, localize('compyleRouter.createTemplate', "Create Template"), () => this._commandService.executeCommand('compyle.router.createTemplate'));
		this._button(actions, localize('compyleRouter.importConfig', "Import Config..."), () => this._commandService.executeCommand('compyle.router.importConfig'));
		this._button(actions, localize('compyleRouter.openConfigFile', "Open Config File"), () => this._commandService.executeCommand('compyle.router.openConfigFile'));
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
