/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleShip.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IShipPlan, IShipStep, ShipStepStatus } from '../common/compyleShip.js';
import { CompyleShipInput } from './compyleShipInput.js';
import { ICompyleShipService } from './compyleShipService.js';

export class CompyleShipEditor extends EditorPane {

	static readonly ID = 'compyleShip';

	private _content!: HTMLElement;
	private readonly _renderDisposables = this._register(new DisposableStore());
	private readonly _statuses = new Map<string, ShipStepStatus>();

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleShipService private readonly _shipService: ICompyleShipService,
		@IOpenerService private readonly _openerService: IOpenerService,
	) {
		super(CompyleShipEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.csh-root'));
		const header = append(root, $('.csh-header'));
		const titleBox = append(header, $('.csh-title-box'));
		append(titleBox, $('h2.csh-title', undefined, localize("compyleShip.heading", "Ship Center")));
		append(titleBox, $('.csh-subtitle', undefined, localize("compyleShip.subheading", "Prepare, build, and deploy your project with confidence.")));
		const refresh = append(header, $('button.csh-refresh', undefined, localize("compyleShip.refresh", "Re-scan"))) as HTMLButtonElement;
		this._register(addDisposableListener(refresh, 'click', () => this._load()));

		this._content = append(root, $('.csh-content'));
	}

	override async setInput(input: CompyleShipInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		await this._load();
	}

	private async _load(): Promise<void> {
		this._renderDisposables.clear();
		clearNode(this._content);
		append(this._content, $('.csh-loading', undefined, localize("compyleShip.scanning", "Scanning project…")));
		const plan = await this._shipService.getPlan();
		this._statuses.clear();
		this._render(plan);
	}

	private _render(plan: IShipPlan): void {
		this._renderDisposables.clear();
		clearNode(this._content);

		if (!plan.detected) {
			append(this._content, $('.csh-empty', undefined, plan.warnings[0] ?? localize("compyleShip.noProject", "Open a project folder to prepare a deployment.")));
			return;
		}

		// Summary
		const summary = append(this._content, $('.csh-summary'));
		append(summary, $('span.csh-chip', undefined, plan.projectType));
		append(summary, $('span.csh-chip', undefined, plan.language));
		if (plan.framework) { append(summary, $('span.csh-chip', undefined, plan.framework)); }

		// Workflow
		const flow = append(this._content, $('.csh-section'));
		append(flow, $('h3.csh-section-title', undefined, localize("compyleShip.workflow", "Workflow")));
		for (const step of plan.steps) {
			this._renderStep(flow, step);
		}

		// Env checklist
		if (plan.envKeys.length) {
			const env = append(this._content, $('.csh-section'));
			append(env, $('h3.csh-section-title', undefined, localize("compyleShip.env", "Environment checklist")));
			append(env, $('.csh-env-note', undefined, localize("compyleShip.envNote", "Set these on your hosting provider (do not commit them):")));
			const list = append(env, $('.csh-env-list'));
			for (const key of plan.envKeys) {
				append(list, $('code.csh-env-key', undefined, key));
			}
		}

		// Targets
		const targets = append(this._content, $('.csh-section'));
		append(targets, $('h3.csh-section-title', undefined, localize("compyleShip.targets", "Deployment targets")));
		const grid = append(targets, $('.csh-targets'));
		for (const target of plan.targets) {
			const card = append(grid, $('.csh-target'));
			append(card, $('.csh-target-name', undefined, target.name));
			append(card, $('.csh-target-desc', undefined, target.description));
			const docs = append(card, $('a.csh-target-docs', undefined, localize("compyleShip.docs", "Open guide"))) as HTMLElement;
			this._renderDisposables.add(addDisposableListener(docs, 'click', () => this._openerService.open(URI.parse(target.docsUrl))));
		}

		// Warnings
		if (plan.warnings.length) {
			const warn = append(this._content, $('.csh-section'));
			append(warn, $('h3.csh-section-title', undefined, localize("compyleShip.safety", "Safety checks")));
			for (const warning of plan.warnings) {
				const row = append(warn, $('.csh-warning'));
				append(row, $('span.codicon.codicon-shield.csh-warning-icon'));
				append(row, $('span', undefined, warning));
			}
		}
	}

	private _renderStep(parent: HTMLElement, step: IShipStep): void {
		const row = append(parent, $('.csh-step'));
		const status = this._statuses.get(step.id) ?? 'idle';

		const dot = append(row, $(`.csh-step-dot.status-${status}`));
		dot.setAttribute('data-step', step.id);

		const info = append(row, $('.csh-step-info'));
		append(info, $('.csh-step-label', undefined, step.label));
		append(info, $('.csh-step-desc', undefined, step.description));
		if (step.command) {
			append(info, $('code.csh-step-cmd', undefined, step.command));
		}

		if (step.command) {
			const run = append(row, $('button.csh-run', undefined, localize("compyleShip.run", "Run"))) as HTMLButtonElement;
			this._renderDisposables.add(addDisposableListener(run, 'click', () => this._runStep(step, dot)));
		}
	}

	private async _runStep(step: IShipStep, dot: HTMLElement): Promise<void> {
		this._statuses.set(step.id, 'running');
		dot.className = 'csh-step-dot status-running';
		const result = await this._shipService.runStep(step);
		this._statuses.set(step.id, result);
		dot.className = `csh-step-dot status-${result}`;
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
