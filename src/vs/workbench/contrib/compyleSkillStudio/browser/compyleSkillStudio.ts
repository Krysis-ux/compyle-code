/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleSkillStudio.css';
import { $, append, clearNode, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { CompyleSkillStudioInput } from './compyleSkillStudioInput.js';
import { ICompyleSkillFile, ICompyleSkillService } from './compyleSkillService.js';
import { emptySkill, ICompyleSkill, serializeSkill } from '../common/compyleSkills.js';

export class CompyleSkillStudioEditor extends EditorPane {

	static readonly ID = 'compyleSkillStudio';

	private _root!: HTMLElement;
	private _listEl!: HTMLElement;
	private _formEl!: HTMLElement;

	private readonly _listDisposables = this._register(new DisposableStore());
	private readonly _formDisposables = this._register(new DisposableStore());

	private _current: ICompyleSkill = emptySkill();
	private _currentUri: URI | undefined;

	// Form field refs.
	private _nameInput!: HTMLInputElement;
	private _descInput!: HTMLInputElement;
	private _tagsInput!: HTMLInputElement;
	private _triggerInput!: HTMLInputElement;
	private _bodyInput!: HTMLTextAreaElement;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleSkillService private readonly _skillService: ICompyleSkillService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IProgressService private readonly _progressService: IProgressService,
		@IEditorService private readonly _editorService: IEditorService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IFileService private readonly _fileService: IFileService,
	) {
		super(CompyleSkillStudioEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.css-root.compyle-panel'));
		const header = append(this._root, $('.css-header'));
		append(header, $('h2.css-title', undefined, localize('compyleSkill.heading', "Skill Studio")));
		append(header, $('.css-subtitle', undefined, localize('compyleSkill.subheading', "Create reusable instruction sets for Compyle Brain.")));

		const columns = append(this._root, $('.css-columns'));
		this._listEl = append(columns, $('.css-list'));
		this._formEl = append(columns, $('.css-form'));

		this._register(this._skillService.onDidChangeSkills(() => this._renderList()));
	}

	override async setInput(input: CompyleSkillStudioInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this._renderForm();
		await this._renderList();
	}

	private async _renderList(): Promise<void> {
		if (!this._listEl) {
			return;
		}
		this._listDisposables.clear();
		clearNode(this._listEl);

		const head = append(this._listEl, $('.css-list-head'));
		append(head, $('.css-list-title', undefined, localize('compyleSkill.skills', "Skills")));
		const actions = append(head, $('.css-list-actions'));
		this._iconButton(this._listDisposables, actions, 'add', localize('compyleSkill.new', "New Skill"), () => this._newSkill());
		this._iconButton(this._listDisposables, actions, 'cloud-download', localize('compyleSkill.import', "Import"), () => this._import());

		if (!this._skillService.skillsDir()) {
			append(this._listEl, $('.css-empty', undefined, localize('compyleSkill.noFolder', "Open a folder to store skills.")));
			return;
		}

		const files = await this._skillService.listSkills();
		if (files.length === 0) {
			append(this._listEl, $('.css-empty', undefined, localize('compyleSkill.none', "No skills yet. Click \"New Skill\" to create one.")));
			return;
		}
		for (const file of files) {
			this._renderListRow(file);
		}
	}

	private _renderListRow(file: ICompyleSkillFile): void {
		const row = append(this._listEl, $('.css-row'));
		row.classList.toggle('active', this._currentUri?.toString() === file.uri.toString());
		const info = append(row, $('.css-row-info'));
		append(info, $('.css-row-name', undefined, file.skill.name));
		append(info, $('.css-row-desc', undefined, file.skill.description || localize('compyleSkill.noDesc', "No description")));
		const del = append(row, $('.css-row-del.codicon.codicon-trash')) as HTMLElement;
		del.title = localize('compyleSkill.delete', "Delete skill");
		this._listDisposables.add(addDisposableListener(info, 'click', () => this._editSkill(file)));
		this._listDisposables.add(addDisposableListener(del, 'click', async e => {
			e.stopPropagation();
			await this._skillService.deleteSkill(file.uri);
			if (this._currentUri?.toString() === file.uri.toString()) {
				this._newSkill();
			}
		}));
	}

	private _renderForm(): void {
		this._formDisposables.clear();
		clearNode(this._formEl);

		this._nameInput = this._field(localize('compyleSkill.name', "Name"), this._current.name);
		this._descInput = this._field(localize('compyleSkill.description', "Description"), this._current.description);
		this._tagsInput = this._field(localize('compyleSkill.tags', "Tags (comma separated)"), this._current.tags.join(', '));
		this._triggerInput = this._field(localize('compyleSkill.trigger', "Trigger words (comma separated)"), this._current.trigger.join(', '));

		const bodyLabel = append(this._formEl, $('label.css-label', undefined, localize('compyleSkill.body', "Instructions")));
		bodyLabel.appendChild($('.css-hint', undefined, localize('compyleSkill.bodyHint', "Used as the system prompt when the skill is applied.")));
		this._bodyInput = append(this._formEl, $('textarea.css-body')) as HTMLTextAreaElement;
		this._bodyInput.value = this._current.body;
		this._bodyInput.spellcheck = false;

		const actions = append(this._formEl, $('.css-form-actions'));
		this._textButton(this._formDisposables, actions, localize('compyleSkill.save', "Save"), true, () => this._save());
		this._textButton(this._formDisposables, actions, localize('compyleSkill.test', "Test Skill"), false, () => this._test());
		this._textButton(this._formDisposables, actions, localize('compyleSkill.export', "Export..."), false, () => this._export());
	}

	private _field(label: string, value: string): HTMLInputElement {
		append(this._formEl, $('label.css-label', undefined, label));
		const input = append(this._formEl, $('input.css-input')) as HTMLInputElement;
		input.type = 'text';
		input.value = value;
		return input;
	}

	private _gatherForm(): ICompyleSkill {
		return {
			name: this._nameInput.value.trim(),
			description: this._descInput.value.trim(),
			tags: this._tagsInput.value.split(',').map(s => s.trim()).filter(Boolean),
			trigger: this._triggerInput.value.split(',').map(s => s.trim()).filter(Boolean),
			body: this._bodyInput.value,
		};
	}

	private _newSkill(): void {
		this._current = emptySkill();
		this._currentUri = undefined;
		this._renderForm();
		void this._renderList();
	}

	private async _editSkill(file: ICompyleSkillFile): Promise<void> {
		this._current = file.skill;
		this._currentUri = file.uri;
		this._renderForm();
		void this._renderList();
	}

	private async _save(): Promise<void> {
		const skill = this._gatherForm();
		if (!skill.name) {
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyleSkill.needName', "Give the skill a name before saving.") });
			return;
		}
		try {
			const uri = await this._skillService.saveSkill(skill, this._currentUri);
			this._current = skill;
			this._currentUri = uri;
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyleSkill.saved', "Saved skill \"{0}\".", skill.name) });
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	private async _test(): Promise<void> {
		const skill = this._gatherForm();
		if (!skill.body.trim()) {
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyleSkill.needBody', "Add instructions before testing the skill.") });
			return;
		}
		if (!this._brainService.isConfigured()) {
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyleSkill.noBrain', "Configure Compyle Brain (an AI provider) to test a skill.") });
			return;
		}
		const prompt = await this._quickInputService.input({
			prompt: localize('compyleSkill.testPrompt', "Test prompt for \"{0}\"", skill.name || 'skill'),
			placeHolder: localize('compyleSkill.testPlaceholder', "Ask something this skill should handle"),
		});
		if (!prompt) {
			return;
		}
		try {
			const reply = await this._progressService.withProgress(
				{ location: ProgressLocation.Notification, title: localize('compyleSkill.testing', "Testing skill...") },
				() => this._brainService.chat([{ role: 'user', content: prompt }], { system: skill.body, maxTokens: 2000 }),
			);
			await this._editorService.openEditor({
				resource: URI.from({ scheme: 'untitled', path: `Skill Test — ${skill.name || 'skill'}.md` }),
				contents: `# Skill test: ${skill.name}\n\n**Prompt:** ${prompt}\n\n---\n\n${reply}\n`,
				languageId: 'markdown',
				options: { pinned: true },
			});
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	private async _import(): Promise<void> {
		const picked = await this._fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectMany: false,
			title: localize('compyleSkill.importTitle', "Select a skill Markdown file"),
			filters: [{ name: 'Markdown', extensions: ['md'] }],
		});
		if (!picked || picked.length === 0) {
			return;
		}
		try {
			const skill = await this._skillService.readSkill(picked[0]);
			await this._skillService.saveSkill(skill);
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyleSkill.imported', "Imported skill \"{0}\".", skill.name) });
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	private async _export(): Promise<void> {
		const skill = this._gatherForm();
		if (!skill.name) {
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyleSkill.needNameExport', "Give the skill a name before exporting.") });
			return;
		}
		const target = await this._fileDialogService.showSaveDialog({
			title: localize('compyleSkill.exportTitle', "Export skill"),
			filters: [{ name: 'Markdown', extensions: ['md'] }],
		});
		if (!target) {
			return;
		}
		try {
			await this._fileService.writeFile(target, VSBuffer.fromString(serializeSkill(skill)));
			await this._editorService.openEditor({ resource: target, options: { pinned: true } });
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyleSkill.exported', "Exported skill to {0}.", target.fsPath) });
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	private _iconButton(store: DisposableStore, parent: HTMLElement, icon: string, title: string, run: () => void): void {
		const button = append(parent, $(`.css-icon-btn.codicon.codicon-${icon}`)) as HTMLElement;
		button.title = title;
		store.add(addDisposableListener(button, 'click', run));
	}

	private _textButton(store: DisposableStore, parent: HTMLElement, label: string, primary: boolean, run: () => void): void {
		const button = append(parent, $(`button.css-btn${primary ? '.primary' : ''}`, undefined, label)) as HTMLButtonElement;
		store.add(addDisposableListener(button, 'click', run));
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
