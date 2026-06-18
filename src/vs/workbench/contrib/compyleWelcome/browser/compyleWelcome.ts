/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleWelcome.css';
import { $, append, addDisposableListener, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ICompyleVibrancyService } from '../../compyleThemes/browser/compyleVibrancyService.js';
import { CompyleAppearanceMode, CompyleVibrancyStyle } from '../../compyleThemes/common/compyleVibrancy.js';
import { CompyleWelcomeInput, COMPYLE_WELCOME_COMPLETED_KEY } from './compyleWelcomeInput.js';

interface ILookChoice {
	readonly id: string;
	readonly name: string;
	readonly subtitle: string;
	readonly mode: CompyleAppearanceMode;
	readonly style: CompyleVibrancyStyle;
	readonly swatch: string;
}

const LOOKS: ILookChoice[] = [
	{ id: 'standard', name: localize("compyleWelcome.look.standard.name", "Standard"), subtitle: localize("compyleWelcome.look.standard", "Clean, calm, fully opaque. Maximum focus."), mode: 'standard', style: 'frost', swatch: '#1c1d28' },
	{ id: 'frost', name: localize("compyleWelcome.look.frost.name", "Frosted Glass"), subtitle: localize("compyleWelcome.look.frost", "Translucent panels with soft blur and depth."), mode: 'vibrancy', style: 'frost', swatch: '#9aa0ff' },
	{ id: 'acrylic', name: localize("compyleWelcome.look.acrylic.name", "Acrylic"), subtitle: localize("compyleWelcome.look.acrylic", "Saturated, tinted glass. The most distinctive look."), mode: 'vibrancy', style: 'acrylic', swatch: '#7E81FF' },
];

export class CompyleWelcomeEditor extends EditorPane {

	static readonly ID = 'compyleWelcome';

	private _group: IEditorGroup;
	private _welcomeInput: CompyleWelcomeInput | undefined;
	private _looksEl!: HTMLElement;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService private readonly _storageService: IStorageService,
		@ICommandService private readonly _commandService: ICommandService,
		@IProductService private readonly _productService: IProductService,
		@ICompyleVibrancyService private readonly _vibrancyService: ICompyleVibrancyService,
	) {
		super(CompyleWelcomeEditor.ID, group, telemetryService, themeService, _storageService);
		this._group = group;
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.cw-root.compyle-panel'));
		const scroll = append(root, $('.cw-scroll'));

		// Hero
		const hero = append(scroll, $('.cw-hero'));
		append(hero, $('.cw-logo.codicon.codicon-sparkle'));
		append(hero, $('h1.compyle-h1.cw-title', undefined, localize("compyleWelcome.hero", "Welcome to {0}", this._productService.nameLong || 'Compyle Code')));
		append(hero, $('.compyle-sub.cw-tagline', undefined, localize("compyleWelcome.heroSub", "Two quick choices and you're ready. You can change everything later.")));

		// Step 1 — look
		const lookSection = append(scroll, $('.cw-section'));
		append(lookSection, $('.compyle-label', undefined, localize("compyleWelcome.step1", "1 · Choose your look")));
		this._looksEl = append(lookSection, $('.cw-looks'));
		for (const look of LOOKS) {
			this._renderLook(look);
		}

		// Step 2 — AI
		const aiSection = append(scroll, $('.cw-section'));
		append(aiSection, $('.compyle-label', undefined, localize("compyleWelcome.step2", "2 · Bring your AI (optional)")));
		const aiCard = append(aiSection, $('.cw-ai'));
		append(aiCard, $('.cw-ai-text', undefined, localize("compyleWelcome.aiText", "Compyle Brain powers inline edits, fixes, and explanations. Bring your own key (Anthropic, OpenAI, OpenRouter) or point it at a local model — your code stays under your control.")));
		const aiBtn = append(aiCard, $('button.compyle-btn.primary', undefined, localize("compyleWelcome.aiButton", "Set Up Compyle Brain"))) as HTMLButtonElement;
		this._register(addDisposableListener(aiBtn, 'click', () => this._commandService.executeCommand('compyle.brain.setApiKey')));

		// Footer
		const footer = append(scroll, $('.cw-footer'));
		const skip = append(footer, $('button.compyle-btn', undefined, localize("compyleWelcome.skip", "Skip"))) as HTMLButtonElement;
		this._register(addDisposableListener(skip, 'click', () => this._finish()));
		const start = append(footer, $('button.compyle-btn.primary.cw-start', undefined, localize("compyleWelcome.start", "Start Coding"))) as HTMLButtonElement;
		this._register(addDisposableListener(start, 'click', () => this._finish()));
	}

	private _renderLook(look: ILookChoice): void {
		const card = append(this._looksEl, $('.compyle-card.cw-look', { 'data-look': look.id }));
		if (this._isSelected(look)) {
			card.classList.add('selected');
		}
		const swatch = append(card, $('.cw-look-swatch'));
		swatch.style.background = look.swatch;
		const info = append(card, $('.cw-look-info'));
		append(info, $('.cw-look-name', undefined, look.name));
		append(info, $('.cw-look-sub', undefined, look.subtitle));
		this._register(addDisposableListener(card, 'click', () => this._chooseLook(look)));
	}

	private _isSelected(look: ILookChoice): boolean {
		const mode = this._vibrancyService.getMode();
		if (look.mode === 'standard') {
			return mode === 'standard';
		}
		return mode === 'vibrancy' && this._vibrancyService.getStyle() === look.style;
	}

	private async _chooseLook(look: ILookChoice): Promise<void> {
		if (look.mode === 'vibrancy') {
			await this._vibrancyService.setStyle(look.style);
		}
		await this._vibrancyService.setMode(look.mode);
		for (const child of this._looksEl.children) {
			child.classList.toggle('selected', child.getAttribute('data-look') === look.id);
		}
	}

	private async _finish(): Promise<void> {
		this._storageService.store(COMPYLE_WELCOME_COMPLETED_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
		if (this._welcomeInput) {
			await this._group.closeEditor(this._welcomeInput);
		}
	}

	override async setInput(input: CompyleWelcomeInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		this._welcomeInput = input;
		await super.setInput(input, options, context, token);
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
