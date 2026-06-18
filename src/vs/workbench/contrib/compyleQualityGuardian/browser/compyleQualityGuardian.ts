/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleQualityGuardian.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { computeRisk, IQualityCheck, QualityCheckStatus } from '../common/compyleQualityChecks.js';
import { CompyleQualityGuardianInput } from './compyleQualityGuardianInput.js';
import { ICompyleQualityGuardianService } from './compyleQualityGuardianService.js';

export class CompyleQualityGuardianEditor extends EditorPane {

	static readonly ID = 'compyleQualityGuardian';

	private _root!: HTMLElement;
	private _riskBadge!: HTMLElement;
	private _list!: HTMLElement;
	private _runAllButton!: HTMLButtonElement;

	private readonly _rowDisposables = this._register(new DisposableStore());
	private _checks: IQualityCheck[] = [];
	private readonly _statuses = new Map<string, QualityCheckStatus>();
	private readonly _rows = new Map<string, HTMLElement>();

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleQualityGuardianService private readonly _guardianService: ICompyleQualityGuardianService,
	) {
		super(CompyleQualityGuardianEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.cqg-root'));

		const header = append(this._root, $('.cqg-header'));
		const titleBox = append(header, $('.cqg-title-box'));
		append(titleBox, $('h2.cqg-title', undefined, localize("compyleQualityGuardian.heading", "Quality Guardian")));
		append(titleBox, $('.cqg-subtitle', undefined, localize("compyleQualityGuardian.subheading", "Run lint, type, test, and build checks to keep the project healthy.")));

		this._riskBadge = append(header, $('.cqg-risk'));

		const actions = append(header, $('.cqg-actions'));
		this._runAllButton = append(actions, $('button.cqg-runall', undefined, localize("compyleQualityGuardian.runAll", "Run All Checks"))) as HTMLButtonElement;
		this._register(addDisposableListener(this._runAllButton, 'click', () => this._runAll()));

		this._list = append(this._root, $('.cqg-list'));
	}

	override async setInput(input: CompyleQualityGuardianInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		await this._load();
	}

	private async _load(): Promise<void> {
		this._checks = await this._guardianService.getChecks();
		this._statuses.clear();
		for (const check of this._checks) {
			this._statuses.set(check.id, 'idle');
		}
		this._render();
	}

	private _render(): void {
		this._rowDisposables.clear();
		this._rows.clear();
		clearNode(this._list);

		if (!this._guardianService.hasWorkspace()) {
			append(this._list, $('.cqg-empty', undefined, localize("compyleQualityGuardian.noWorkspace", "Open a project folder to run quality checks.")));
			this._runAllButton.disabled = true;
			this._updateRisk();
			return;
		}
		if (this._checks.length === 0) {
			append(this._list, $('.cqg-empty', undefined, localize("compyleQualityGuardian.noChecks", "No quality checks were detected for this project.")));
			this._runAllButton.disabled = true;
			this._updateRisk();
			return;
		}

		this._runAllButton.disabled = false;
		for (const check of this._checks) {
			this._renderRow(check);
		}
		this._updateRisk();
	}

	private _renderRow(check: IQualityCheck): void {
		const row = append(this._list, $('.cqg-row'));
		this._rows.set(check.id, row);

		const status = append(row, $('.cqg-status'));
		status.classList.add(`status-${this._statuses.get(check.id) ?? 'idle'}`);

		const info = append(row, $('.cqg-info'));
		const labelLine = append(info, $('.cqg-label-line'));
		append(labelLine, $('span.cqg-label', undefined, check.label));
		if (check.critical) {
			append(labelLine, $('span.cqg-critical', undefined, localize("compyleQualityGuardian.critical", "Critical")));
		}
		append(info, $('code.cqg-command', undefined, check.command));

		const statusText = append(row, $('.cqg-status-text', undefined, this._statusLabel(this._statuses.get(check.id) ?? 'idle')));
		statusText.classList.add(`text-${this._statuses.get(check.id) ?? 'idle'}`);

		const runButton = append(row, $('button.cqg-run', undefined, localize("compyleQualityGuardian.run", "Run"))) as HTMLButtonElement;
		this._rowDisposables.add(addDisposableListener(runButton, 'click', () => this._runOne(check)));
	}

	private async _runOne(check: IQualityCheck): Promise<void> {
		this._setStatus(check.id, 'running');
		const result = await this._guardianService.runCheck(check);
		this._setStatus(check.id, result);
	}

	private async _runAll(): Promise<void> {
		for (const check of this._checks) {
			await this._runOne(check);
		}
	}

	private _setStatus(id: string, status: QualityCheckStatus): void {
		this._statuses.set(id, status);
		const row = this._rows.get(id);
		if (row) {
			const dot = row.querySelector('.cqg-status');
			if (dot) {
				dot.className = `cqg-status status-${status}`;
			}
			const text = row.querySelector('.cqg-status-text');
			if (text) {
				text.className = `cqg-status-text text-${status}`;
				text.textContent = this._statusLabel(status);
			}
		}
		this._updateRisk();
	}

	private _updateRisk(): void {
		const ran = Array.from(this._statuses.values()).some(s => s === 'passed' || s === 'failed');
		if (!ran || this._checks.length === 0) {
			this._riskBadge.className = 'cqg-risk';
			this._riskBadge.textContent = '';
			return;
		}
		const risk = computeRisk(this._checks, this._statuses);
		this._riskBadge.className = `cqg-risk risk-${risk}`;
		this._riskBadge.textContent = localize("compyleQualityGuardian.riskLabel", "Risk: {0}", this._riskLabel(risk));
	}

	private _statusLabel(status: QualityCheckStatus): string {
		switch (status) {
			case 'running': return localize("compyleQualityGuardian.status.running", "Running…");
			case 'passed': return localize("compyleQualityGuardian.status.passed", "Passed");
			case 'failed': return localize("compyleQualityGuardian.status.failed", "Failed");
			case 'unknown': return localize("compyleQualityGuardian.status.unknown", "Done — review terminal");
			default: return localize("compyleQualityGuardian.status.idle", "Not run");
		}
	}

	private _riskLabel(risk: 'low' | 'medium' | 'high'): string {
		switch (risk) {
			case 'high': return localize("compyleQualityGuardian.risk.high", "High");
			case 'medium': return localize("compyleQualityGuardian.risk.medium", "Medium");
			default: return localize("compyleQualityGuardian.risk.low", "Low");
		}
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
