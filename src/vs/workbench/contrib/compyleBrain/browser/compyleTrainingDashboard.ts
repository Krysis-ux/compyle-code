/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleTraining.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { CompyleRouterDifficulty } from '../../compyleRouter/common/compyleRouter.js';
import { ICompyleRouterService } from '../../compyleRouter/browser/compyleRouterService.js';
import { ICompyleBrainService } from './compyleBrainService.js';
import { ICompyleRouterTrainingService, ICompyleTrainingOptions, ICompyleTrainingProgress } from './compyleRouterTrainingService.js';
import { CompyleTrainingInput } from './compyleTrainingInput.js';
import { COMPYLE_TRAINING_DIFFICULTIES } from '../common/compyleRouterTraining.js';

const DIFFICULTY_LABELS: Record<CompyleRouterDifficulty, string> = {
	line: localize('compyleTraining.diff.line', "Single lines"),
	function: localize('compyleTraining.diff.function', "Functions"),
	feature: localize('compyleTraining.diff.feature', "Small features"),
	project: localize('compyleTraining.diff.project', "Full projects"),
};

export class CompyleTrainingDashboard extends EditorPane {

	static readonly ID = 'compyleTraining';

	private _root!: HTMLElement;
	private _log!: HTMLElement;
	private _logEmpty: HTMLElement | undefined;
	private _counters!: HTMLElement;
	private _startBtn!: HTMLButtonElement;
	private _stopBtn!: HTMLButtonElement;
	private _routerValue!: HTMLElement;
	private _solverSelect!: HTMLSelectElement;
	private _challengerRow!: HTMLElement;
	private _challengerSelect!: HTMLSelectElement;

	private _mode: 'auto' | 'dual' = 'auto';
	private _purpose: 'general' | 'web' = 'general';
	private _difficulty: CompyleRouterDifficulty = 'function';
	private _count = 5;
	private _retries = 2;
	private _routerName = '';
	private _models: string[] = [];
	private _running = false;
	private _cts: CancellationTokenSource | undefined;

	private readonly _renderDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleRouterTrainingService private readonly _trainingService: ICompyleRouterTrainingService,
		@ICompyleRouterService private readonly _routerService: ICompyleRouterService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IDialogService private readonly _dialogService: IDialogService,
	) {
		super(CompyleTrainingDashboard.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.crt-root.compyle-panel'));
	}

	override async setInput(input: CompyleTrainingInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this._routerName = this._configurationService.getValue<string>('compyle.router.trainingTarget') || this._routerName;
		const model = this._brainService.getConfig().model || '';
		try {
			this._models = (await this._brainService.listLocalModels()).map(m => m.name);
		} catch {
			this._models = [];
		}
		if (!this._models.length && model) {
			this._models = [model];
		}
		this._render();
	}

	private _render(): void {
		this._renderDisposables.clear();
		clearNode(this._root);

		const header = append(this._root, $('.crt-header'));
		append(header, $('h2.crt-title', undefined, localize('compyleTraining.heading', "Router Training")));
		append(header, $('.crt-subtitle', undefined, localize('compyleTraining.subheading', "Let Compyle AI invent coding challenges, attempt them, judge the results, and turn its mistakes into routing rules.")));

		// Mode cards
		const modes = append(this._root, $('.crt-modes'));
		this._modeCard(modes, 'auto', localize('compyleTraining.auto', "Autonomous"), localize('compyleTraining.autoDesc', "One model invents, solves, and judges challenges. Lighter on your machine."));
		this._modeCard(modes, 'dual', localize('compyleTraining.dual', "Super (dual model)"), localize('compyleTraining.dualDesc', "A challenger model judges a separate solver model in a recursive loop. GPU/CPU intensive."));

		// Form
		const form = append(this._root, $('.crt-form'));
		this._routerRow(form);
		this._selectRow(form, localize('compyleTraining.purpose', "Purpose"), [
			{ value: 'general', label: localize('compyleTraining.general', "General coding") },
			{ value: 'web', label: localize('compyleTraining.web', "Apps & websites") },
		], this._purpose, v => { this._purpose = v as 'general' | 'web'; });
		this._selectRow(form, localize('compyleTraining.difficulty', "Difficulty"),
			COMPYLE_TRAINING_DIFFICULTIES.map(d => ({ value: d, label: DIFFICULTY_LABELS[d] })),
			this._difficulty, v => { this._difficulty = v as CompyleRouterDifficulty; });
		this._numberRow(form, localize('compyleTraining.count', "Challenges"), this._count, 1, 50, v => { this._count = v; });
		this._numberRow(form, localize('compyleTraining.retries', "Attempts per challenge"), this._retries, 1, 6, v => { this._retries = v; });

		this._solverSelect = this._modelRow(form, localize('compyleTraining.solverModel', "Solver model"), this._brainService.getConfig().model || '');
		this._challengerRow = append(form, $('.crt-row'));
		append(this._challengerRow, $('label.crt-label', undefined, localize('compyleTraining.challengerModel', "Challenger model")));
		this._challengerSelect = append(this._challengerRow, $('select.crt-select')) as HTMLSelectElement;
		this._fillModelSelect(this._challengerSelect, this._brainService.getConfig().model || '');
		this._challengerRow.style.display = this._mode === 'dual' ? 'flex' : 'none';

		// Actions
		const actions = append(this._root, $('.crt-actions'));
		this._startBtn = append(actions, $('button.crt-btn.primary', undefined, localize('compyleTraining.start', "Start Training"))) as HTMLButtonElement;
		this._stopBtn = append(actions, $('button.crt-btn', undefined, localize('compyleTraining.stop', "Stop"))) as HTMLButtonElement;
		this._stopBtn.disabled = true;
		this._renderDisposables.add(addDisposableListener(this._startBtn, 'click', () => this._start()));
		this._renderDisposables.add(addDisposableListener(this._stopBtn, 'click', () => this._stop()));

		// Counters + log
		this._counters = append(this._root, $('.crt-counters'));
		this._updateCounters(0, 0);
		this._log = append(this._root, $('.crt-log'));
		this._logEmpty = append(this._log, $('.crt-log-empty', undefined, localize('compyleTraining.logEmpty', "Training output appears here.")));
	}

	private _modeCard(parent: HTMLElement, mode: 'auto' | 'dual', title: string, desc: string): void {
		const card = append(parent, $('.crt-mode-card'));
		card.classList.toggle('active', this._mode === mode);
		append(card, $('.crt-mode-name', undefined, title));
		append(card, $('.crt-mode-desc', undefined, desc));
		this._renderDisposables.add(addDisposableListener(card, 'click', () => {
			if (this._running) {
				return;
			}
			this._mode = mode;
			this._render();
		}));
	}

	private _routerRow(parent: HTMLElement): void {
		const row = append(parent, $('.crt-row'));
		append(row, $('label.crt-label', undefined, localize('compyleTraining.router', "Router")));
		this._routerValue = append(row, $('.crt-router-value', undefined, this._routerName || localize('compyleTraining.noRouter', "(choose a router)")));
		const pickBtn = append(row, $('button.crt-btn.small', undefined, localize('compyleTraining.chooseRouter', "Choose…"))) as HTMLButtonElement;
		this._renderDisposables.add(addDisposableListener(pickBtn, 'click', () => this._pickRouter()));
	}

	private _selectRow(parent: HTMLElement, label: string, options: { value: string; label: string }[], current: string, onChange: (v: string) => void): void {
		const row = append(parent, $('.crt-row'));
		append(row, $('label.crt-label', undefined, label));
		const select = append(row, $('select.crt-select')) as HTMLSelectElement;
		for (const opt of options) {
			const o = append(select, $('option')) as HTMLOptionElement;
			o.value = opt.value;
			o.textContent = opt.label;
		}
		select.value = current;
		this._renderDisposables.add(addDisposableListener(select, 'change', () => onChange(select.value)));
	}

	private _numberRow(parent: HTMLElement, label: string, current: number, min: number, max: number, onChange: (v: number) => void): void {
		const row = append(parent, $('.crt-row'));
		append(row, $('label.crt-label', undefined, label));
		const input = append(row, $('input.crt-number')) as HTMLInputElement;
		input.type = 'number';
		input.min = String(min);
		input.max = String(max);
		input.value = String(current);
		this._renderDisposables.add(addDisposableListener(input, 'change', () => {
			const v = Math.max(min, Math.min(max, parseInt(input.value, 10) || min));
			input.value = String(v);
			onChange(v);
		}));
	}

	private _modelRow(parent: HTMLElement, label: string, current: string): HTMLSelectElement {
		const row = append(parent, $('.crt-row'));
		append(row, $('label.crt-label', undefined, label));
		const select = append(row, $('select.crt-select')) as HTMLSelectElement;
		this._fillModelSelect(select, current);
		return select;
	}

	private _fillModelSelect(select: HTMLSelectElement, current: string): void {
		clearNode(select);
		const models = this._models.length ? this._models : (current ? [current] : []);
		if (models.length === 0) {
			const o = append(select, $('option')) as HTMLOptionElement;
			o.value = '';
			o.textContent = localize('compyleTraining.noModels', "No local models found");
			o.disabled = true;
			return;
		}
		for (const m of models) {
			const o = append(select, $('option')) as HTMLOptionElement;
			o.value = m;
			o.textContent = m;
		}
		select.value = current && models.includes(current) ? current : models[0];
	}

	private async _pickRouter(): Promise<void> {
		const routers = await this._routerService.listRouters();
		type RouterPick = IQuickPickItem & { newRouter?: boolean; routerName?: string };
		const items: (RouterPick | IQuickPickSeparator)[] = [{ label: localize('compyleTraining.newRouter', "Create new router…"), newRouter: true }];
		if (routers.length) {
			items.push({ type: 'separator', label: localize('compyleTraining.existing', "Existing routers") });
			for (const r of routers) {
				items.push({ label: r, routerName: r });
			}
		}
		const picked = await this._quickInputService.pick(items, { placeHolder: localize('compyleTraining.pickRouter', "Which router should training grow?") });
		if (!picked) {
			return;
		}
		let name = picked.routerName;
		if (picked.newRouter) {
			name = await this._quickInputService.input({ title: localize('compyleTraining.routerName', "New router name"), placeHolder: localize('compyleTraining.routerNamePh', "e.g. general-coding") });
			if (!name) {
				return;
			}
			await this._routerService.createRouter(name);
		}
		if (name) {
			this._routerName = name;
			this._routerValue.textContent = name;
			await this._configurationService.updateValue('compyle.router.trainingTarget', name);
		}
	}

	private async _start(): Promise<void> {
		if (this._running) {
			return;
		}
		if (!this._routerName) {
			this._notificationService.warn(localize('compyleTraining.needRouter', "Choose a router to train into first."));
			return;
		}
		if (this._mode === 'dual') {
			const confirmed = await this._dialogService.confirm({
				message: localize('compyleTraining.gpuWarn', "Super (dual-model) training is GPU/CPU intensive"),
				detail: localize('compyleTraining.gpuWarnDetail', "Two local models will run in a loop — generating, solving, and judging challenges — until you stop it. This can heavily load your machine. Continue?"),
				primaryButton: localize('compyleTraining.startAnyway', "Start"),
			});
			if (!confirmed.confirmed) {
				return;
			}
		}

		this._running = true;
		this._startBtn.disabled = true;
		this._stopBtn.disabled = false;
		clearNode(this._log);
		this._updateCounters(0, 0);
		this._cts = new CancellationTokenSource();

		const opts: ICompyleTrainingOptions = {
			routerName: this._routerName,
			purpose: this._purpose,
			difficulty: this._difficulty,
			count: this._count,
			maxRetries: this._retries,
			model: this._solverSelect.value || undefined,
			challengerModel: this._challengerSelect.value || undefined,
		};
		const onProgress = (p: ICompyleTrainingProgress) => this._onProgress(p);

		try {
			if (this._mode === 'dual') {
				await this._trainingService.runDualModel(opts, onProgress, this._cts.token);
			} else {
				await this._trainingService.runAutonomous(opts, onProgress, this._cts.token);
			}
		} catch (err) {
			this._appendLog('error', err instanceof Error ? err.message : String(err));
		} finally {
			this._running = false;
			this._cts?.dispose();
			this._cts = undefined;
			this._startBtn.disabled = false;
			this._stopBtn.disabled = true;
		}
	}

	private _stop(): void {
		this._cts?.cancel();
		this._appendLog('status', localize('compyleTraining.stopping', "Stopping…"));
	}

	private _onProgress(p: ICompyleTrainingProgress): void {
		this._updateCounters(p.correct, p.failed);
		this._appendLog(p.kind, p.message);
	}

	private _updateCounters(correct: number, failed: number): void {
		clearNode(this._counters);
		const pass = append(this._counters, $('.crt-counter.pass'));
		append(pass, $('span.codicon.codicon-check'));
		append(pass, $('span', undefined, localize('compyleTraining.passed', "{0} passed", correct)));
		const fail = append(this._counters, $('.crt-counter.fail'));
		append(fail, $('span.codicon.codicon-error'));
		append(fail, $('span', undefined, localize('compyleTraining.failedCount', "{0} failed", failed)));
	}

	private _appendLog(kind: string, message: string): void {
		this._logEmpty?.remove();
		this._logEmpty = undefined;
		const row = append(this._log, $(`.crt-log-row.${kind}`));
		append(row, $('span', undefined, message));
		this._log.scrollTop = this._log.scrollHeight;
	}

	override dispose(): void {
		this._cts?.cancel();
		this._cts?.dispose();
		super.dispose();
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
