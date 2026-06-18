/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleRunDoctor.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IRunCommand, IRunPlan } from '../common/compyleRunDoctor.js';
import { CompyleRunDoctorInput } from './compyleRunDoctorInput.js';
import { ICompyleRunDoctorService } from './compyleRunDoctorService.js';

export class CompyleRunDoctorEditor extends EditorPane {

	static readonly ID = 'compyleRunDoctor';

	private _root!: HTMLElement;
	private _content!: HTMLElement;

	private readonly _renderDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleRunDoctorService private readonly _runDoctorService: ICompyleRunDoctorService,
		@IEditorService private readonly _editorService: IEditorService,
	) {
		super(CompyleRunDoctorEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.crd-root'));

		const header = append(this._root, $('.crd-header'));
		const titleBox = append(header, $('.crd-title-box'));
		append(titleBox, $('h2.crd-title', undefined, localize("compyleRunDoctor.heading", "Run Doctor")));
		append(titleBox, $('.crd-subtitle', undefined, localize("compyleRunDoctor.subheading", "Figure out how to install, run, build, and test this project.")));

		const refresh = append(header, $('button.crd-refresh', undefined, localize("compyleRunDoctor.refresh", "Re-scan"))) as HTMLButtonElement;
		this._register(addDisposableListener(refresh, 'click', () => this._diagnose()));

		this._content = append(this._root, $('.crd-content'));
	}

	override async setInput(input: CompyleRunDoctorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		await this._diagnose();
	}

	private async _diagnose(): Promise<void> {
		this._renderLoading();
		const plan = await this._runDoctorService.diagnose();
		this._renderPlan(plan);
	}

	private _renderLoading(): void {
		this._renderDisposables.clear();
		clearNode(this._content);
		append(this._content, $('.crd-loading', undefined, localize("compyleRunDoctor.scanning", "Scanning project…")));
	}

	private _renderPlan(plan: IRunPlan): void {
		this._renderDisposables.clear();
		clearNode(this._content);

		if (!plan.detected) {
			const empty = append(this._content, $('.crd-empty'));
			append(empty, $('.crd-empty-title', undefined, localize("compyleRunDoctor.notDetected", "No project detected")));
			append(empty, $('.crd-empty-body', undefined, plan.warnings[0] ?? localize("compyleRunDoctor.openFolder", "Open a project folder to get started.")));
			return;
		}

		// Summary card
		const summary = append(this._content, $('.crd-summary'));
		this._addSummaryItem(summary, localize("compyleRunDoctor.type", "Type"), plan.projectType);
		this._addSummaryItem(summary, localize("compyleRunDoctor.language", "Language"), plan.language);
		if (plan.framework) { this._addSummaryItem(summary, localize("compyleRunDoctor.framework", "Framework"), plan.framework); }
		if (plan.packageManager) { this._addSummaryItem(summary, localize("compyleRunDoctor.packageManager", "Package manager"), plan.packageManager); }
		if (plan.runtime) { this._addSummaryItem(summary, localize("compyleRunDoctor.runtime", "Runtime"), plan.runtime); }
		if (plan.url) { this._addSummaryItem(summary, localize("compyleRunDoctor.url", "Local URL"), plan.url); }

		// Warnings
		if (plan.warnings.length) {
			const warnBox = append(this._content, $('.crd-warnings'));
			for (const warning of plan.warnings) {
				const row = append(warnBox, $('.crd-warning'));
				append(row, $('span.crd-warning-icon.codicon.codicon-warning'));
				append(row, $('span', undefined, warning));
			}
		}

		// Commands
		const commands = [plan.install, plan.dev, plan.build, plan.test].filter((c): c is IRunCommand => !!c);
		if (commands.length) {
			const section = append(this._content, $('.crd-section'));
			append(section, $('h3.crd-section-title', undefined, localize("compyleRunDoctor.commands", "Commands")));
			for (const cmd of commands) {
				const row = append(section, $('.crd-cmd'));
				const info = append(row, $('.crd-cmd-info'));
				append(info, $('.crd-cmd-label', undefined, cmd.label));
				append(info, $('code.crd-cmd-text', undefined, cmd.command));
				const run = append(row, $('button.crd-run', undefined, localize("compyleRunDoctor.run", "Run"))) as HTMLButtonElement;
				this._renderDisposables.add(addDisposableListener(run, 'click', () => this._runDoctorService.runCommand(cmd.command)));
			}
		}

		// Env checklist
		if (plan.envKeys.length) {
			const section = append(this._content, $('.crd-section'));
			append(section, $('h3.crd-section-title', undefined, localize("compyleRunDoctor.env", "Environment variables")));
			append(section, $('.crd-env-note', undefined, localize("compyleRunDoctor.envNote", "Create a .env file with these keys:")));
			const list = append(section, $('.crd-env-list'));
			for (const key of plan.envKeys) {
				append(list, $('code.crd-env-key', undefined, key));
			}
		}

		// Explanation
		const explainSection = append(this._content, $('.crd-section'));
		append(explainSection, $('h3.crd-section-title', undefined, localize("compyleRunDoctor.explanation", "How this project works")));
		append(explainSection, $('.crd-explain', undefined, plan.explanation));

		// Action bar
		const actions = append(this._content, $('.crd-actions'));
		if (plan.dev) {
			this._addAction(actions, localize("compyleRunDoctor.startDev", "Start Dev Server"), true, () => this._runDoctorService.runCommand(plan.dev!.command));
		}
		if (plan.install) {
			this._addAction(actions, localize("compyleRunDoctor.installDeps", "Install Dependencies"), false, () => this._runDoctorService.runCommand(plan.install!.command));
		}
		if (plan.url) {
			this._addAction(actions, localize("compyleRunDoctor.openPreview", "Open Preview"), false, () => this._runDoctorService.openPreview(plan.url!));
		}
		this._addAction(actions, localize("compyleRunDoctor.createDocs", "Create Run Docs"), false, async () => {
			const uri = await this._runDoctorService.writeRunDocs(plan);
			await this._editorService.openEditor({ resource: uri });
		});
	}

	private _addSummaryItem(parent: HTMLElement, label: string, value: string): void {
		const item = append(parent, $('.crd-summary-item'));
		append(item, $('.crd-summary-label', undefined, label));
		append(item, $('.crd-summary-value', undefined, value));
	}

	private _addAction(parent: HTMLElement, label: string, primary: boolean, run: () => void): void {
		const button = append(parent, $(`button.crd-action${primary ? '.primary' : ''}`, undefined, label)) as HTMLButtonElement;
		this._renderDisposables.add(addDisposableListener(button, 'click', run));
	}

	layout(_dimension: Dimension): void {
		// CSS handles responsive layout.
	}
}
