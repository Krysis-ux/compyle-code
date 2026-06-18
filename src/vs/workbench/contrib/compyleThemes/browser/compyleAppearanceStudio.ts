/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleAppearanceStudio.css';
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
import { CompyleAppearanceMode, CompyleVibrancyStyle, ICompyleVibrancyStyleInfo } from '../common/compyleVibrancy.js';
import { CompyleAppearanceStudioInput } from './compyleAppearanceStudioInput.js';
import { ICompyleVibrancyService } from './compyleVibrancyService.js';

interface IModeChoice {
	readonly mode: CompyleAppearanceMode;
	readonly name: string;
	readonly tagline: string;
}

const MODE_CHOICES: IModeChoice[] = [
	{ mode: 'standard', name: localize("cas.mode.standard", "Standard"), tagline: localize("cas.mode.standard.sub", "Clean, fully opaque. Maximum focus and performance.") },
	{ mode: 'vibrancy', name: localize("cas.mode.vibrancy", "Vibrancy"), tagline: localize("cas.mode.vibrancy.sub", "Frosted-glass surfaces with depth and blur.") },
];

function styleInfos(): ICompyleVibrancyStyleInfo[] {
	return [
		{ id: 'frost', name: localize("cas.style.frost", "Frost"), description: localize("cas.style.frost.desc", "Light, neutral frosted glass.") },
		{ id: 'acrylic', name: localize("cas.style.acrylic", "Acrylic"), description: localize("cas.style.acrylic.desc", "Saturated, tinted, lively depth.") },
		{ id: 'mica', name: localize("cas.style.mica", "Mica"), description: localize("cas.style.mica.desc", "Subtle, quiet material tint.") },
		{ id: 'tint', name: localize("cas.style.tint", "Tint"), description: localize("cas.style.tint.desc", "Translucent accent wash.") },
	];
}

export class CompyleAppearanceStudioEditor extends EditorPane {

	static readonly ID = 'compyleAppearanceStudio';

	private _root!: HTMLElement;
	private _body!: HTMLElement;

	private readonly _renderDisposables = this._register(new DisposableStore());
	private _committed = false;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICompyleVibrancyService private readonly _vibrancy: ICompyleVibrancyService,
	) {
		super(CompyleAppearanceStudioEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._root = append(parent, $('.cas-root.compyle-panel'));

		const header = append(this._root, $('.cas-header'));
		const titleBox = append(header, $('.cas-title-box'));
		append(titleBox, $('h2.cas-title', undefined, localize("cas.heading", "Appearance Studio")));
		append(titleBox, $('.cas-subtitle', undefined, localize("cas.subheading", "Choose how the interface feels, then fine-tune the glass.")));

		const resetButton = append(header, $('button.cas-reset', undefined, localize("cas.reset", "Reset to Standard"))) as HTMLButtonElement;
		this._register(addDisposableListener(resetButton, 'click', async () => {
			this._committed = true;
			await this._vibrancy.reset();
			this._render();
		}));

		this._body = append(this._root, $('.cas-body'));
	}

	override async setInput(input: CompyleAppearanceStudioInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this._committed = false;
		this._render();
	}

	private _render(): void {
		if (!this._body) {
			return;
		}
		this._renderDisposables.clear();
		clearNode(this._body);

		const tokens = this._vibrancy.getTokens();

		// Mode cards
		const modes = append(this._body, $('.cas-modes'));
		for (const choice of MODE_CHOICES) {
			this._renderModeCard(modes, choice, tokens.mode);
		}

		if (tokens.mode !== 'vibrancy') {
			this._renderMisc();
			return;
		}

		// Style cards
		append(this._body, $('h3.cas-section', undefined, localize("cas.styleHeading", "Glass Style")));
		const styles = append(this._body, $('.cas-styles'));
		for (const info of styleInfos()) {
			this._renderStyleCard(styles, info, tokens.style);
		}

		// Sliders
		append(this._body, $('h3.cas-section', undefined, localize("cas.tuneHeading", "Fine Tune")));
		const tune = append(this._body, $('.cas-tune'));
		this._addRange(tune, localize("cas.opacity", "Surface Opacity"), 30, 100, 1, Math.round(tokens.opacity * 100), value => this._vibrancy.setOpacity(value / 100));
		this._addRange(tune, localize("cas.blur", "Blur Radius"), 0, 40, 1, tokens.blur, value => this._vibrancy.setBlur(value));
		this._addColor(tune, localize("cas.tint", "Accent Tint"), tokens.tint, value => this._vibrancy.setTint(value));

		this._renderMisc();
	}

	private _renderMisc(): void {
		append(this._body, $('h3.cas-section', undefined, localize("cas.modesHeading", "Modes")));
		const misc = append(this._body, $('.cas-misc'));
		this._addCheck(misc, localize("cas.reducedMotion", "Reduced Motion"), this._vibrancy.isReducedMotion(), value => this._vibrancy.setReducedMotion(value));
		this._addCheck(misc, localize("cas.compact", "Compact Mode"), this._vibrancy.isCompactMode(), value => this._vibrancy.setCompactMode(value));
		this._addCheck(misc, localize("cas.minimal", "Minimal Mode"), this._vibrancy.isMinimalMode(), async value => {
			await this._vibrancy.setMinimalMode(value);
			this._render();
		});
	}

	private _renderModeCard(parent: HTMLElement, choice: IModeChoice, activeMode: CompyleAppearanceMode): void {
		const card = append(parent, $('.cas-card.cas-mode-card'));
		card.classList.toggle('active', choice.mode === activeMode);
		const preview = append(card, $(`.cas-preview.cas-preview-${choice.mode}`));
		append(preview, $('.cas-pv-bar'));
		append(preview, $('.cas-pv-side'));
		append(preview, $('.cas-pv-editor'));
		const info = append(card, $('.cas-info'));
		append(info, $('.cas-name', undefined, choice.name));
		append(info, $('.cas-tagline', undefined, choice.tagline));
		this._renderDisposables.add(addDisposableListener(card, 'mouseenter', () => this._vibrancy.preview(choice.mode, this._vibrancy.getStyle())));
		this._renderDisposables.add(addDisposableListener(card, 'mouseleave', () => this._vibrancy.cancelPreview()));
		this._renderDisposables.add(addDisposableListener(card, 'click', async () => {
			this._committed = true;
			await this._vibrancy.setMode(choice.mode);
			this._render();
		}));
	}

	private _renderStyleCard(parent: HTMLElement, info: ICompyleVibrancyStyleInfo, activeStyle: CompyleVibrancyStyle): void {
		const card = append(parent, $('.cas-card.cas-style-card'));
		card.classList.toggle('active', info.id === activeStyle);
		append(card, $(`.cas-swatch.cas-swatch-${info.id}`));
		const text = append(card, $('.cas-info'));
		append(text, $('.cas-name', undefined, info.name));
		append(text, $('.cas-tagline', undefined, info.description));
		this._renderDisposables.add(addDisposableListener(card, 'mouseenter', () => this._vibrancy.preview('vibrancy', info.id)));
		this._renderDisposables.add(addDisposableListener(card, 'mouseleave', () => this._vibrancy.cancelPreview()));
		this._renderDisposables.add(addDisposableListener(card, 'click', async () => {
			this._committed = true;
			await this._vibrancy.setStyle(info.id);
			this._render();
		}));
	}

	private _addRange(parent: HTMLElement, label: string, min: number, max: number, step: number, value: number, onChange: (value: number) => void): void {
		const row = append(parent, $('.cas-row'));
		const labelEl = append(row, $('label.cas-label', undefined, label));
		const valueEl = append(labelEl, $('span.cas-value', undefined, `${value}`));
		const input = append(row, $('input.cas-range')) as HTMLInputElement;
		input.type = 'range';
		input.min = `${min}`;
		input.max = `${max}`;
		input.step = `${step}`;
		input.value = `${value}`;
		this._renderDisposables.add(addDisposableListener(input, 'input', () => {
			valueEl.textContent = input.value;
			onChange(Number(input.value));
		}));
	}

	private _addColor(parent: HTMLElement, label: string, value: string, onChange: (value: string) => void): void {
		const row = append(parent, $('.cas-row'));
		append(row, $('label.cas-label', undefined, label));
		const input = append(row, $('input.cas-color')) as HTMLInputElement;
		input.type = 'color';
		input.value = value;
		this._renderDisposables.add(addDisposableListener(input, 'input', () => onChange(input.value)));
	}

	private _addCheck(parent: HTMLElement, label: string, checked: boolean, onChange: (value: boolean) => void): void {
		const row = append(parent, $('.cas-row'));
		const labelEl = append(row, $('label.cas-label.cas-check')) as HTMLLabelElement;
		const input = append(labelEl, $('input')) as HTMLInputElement;
		input.type = 'checkbox';
		input.checked = checked;
		append(labelEl, label);
		this._renderDisposables.add(addDisposableListener(input, 'change', () => onChange(input.checked)));
	}

	override clearInput(): void {
		this._cancelPreview();
		super.clearInput();
	}

	private _cancelPreview(): void {
		if (!this._committed) {
			this._vibrancy.cancelPreview();
		}
	}

	layout(_dimension: Dimension): void {
		// CSS handles responsive layout.
	}

	override dispose(): void {
		this._cancelPreview();
		super.dispose();
	}
}
