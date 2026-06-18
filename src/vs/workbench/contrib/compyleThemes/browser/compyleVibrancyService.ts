/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import {
	clampBlur,
	clampOpacity,
	CompyleAppearanceMode,
	CompyleVibrancyStyle,
	COMPYLE_APPEARANCE_MODE_SETTING,
	COMPYLE_COMPACT_MODE_SETTING,
	COMPYLE_MINIMAL_MODE_SETTING,
	COMPYLE_REDUCED_MOTION_SETTING,
	COMPYLE_VIBRANCY_BLUR_SETTING,
	COMPYLE_VIBRANCY_DEFAULTS,
	COMPYLE_VIBRANCY_OPACITY_SETTING,
	COMPYLE_VIBRANCY_STYLE_SETTING,
	COMPYLE_VIBRANCY_STYLES,
	COMPYLE_VIBRANCY_TINT_SETTING,
	ICompyleVibrancyTokens,
} from '../common/compyleVibrancy.js';

export const ICompyleVibrancyService = createDecorator<ICompyleVibrancyService>('compyleVibrancyService');

export interface ICompyleVibrancyService {
	readonly _serviceBrand: undefined;
	/** Fires whenever applied appearance changes (settings or live preview). */
	readonly onDidChangeAppearance: Event<void>;

	/** Effective tokens after clamping and accessibility overrides. */
	getTokens(): ICompyleVibrancyTokens;

	getMode(): CompyleAppearanceMode;
	/** Persist the appearance mode and restyle. */
	setMode(mode: CompyleAppearanceMode): Promise<void>;

	getStyle(): CompyleVibrancyStyle;
	setStyle(style: CompyleVibrancyStyle): Promise<void>;

	setOpacity(opacity: number): Promise<void>;
	setBlur(blur: number): Promise<void>;
	setTint(tint: string): Promise<void>;

	isReducedMotion(): boolean;
	setReducedMotion(enabled: boolean): Promise<void>;

	isCompactMode(): boolean;
	setCompactMode(enabled: boolean): Promise<void>;

	isMinimalMode(): boolean;
	setMinimalMode(enabled: boolean): Promise<void>;

	/** Restyle for a mode/style without persisting (live preview in the studio). */
	preview(mode: CompyleAppearanceMode, style: CompyleVibrancyStyle): void;
	/** Re-apply persisted settings, discarding any preview. */
	cancelPreview(): void;

	/** Reset all appearance settings back to the standard defaults. */
	reset(): Promise<void>;
}

export class CompyleVibrancyService extends Disposable implements ICompyleVibrancyService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeAppearance = this._register(new Emitter<void>());
	readonly onDidChangeAppearance = this._onDidChangeAppearance.event;

	private readonly _containers = new Set<HTMLElement>();
	private _preview: { mode: CompyleAppearanceMode; style: CompyleVibrancyStyle } | undefined;

	constructor(
		@ILayoutService private readonly _layoutService: ILayoutService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super();

		this._containers.add(this._layoutService.mainContainer);
		this._register(this._layoutService.onDidAddContainer(({ container, disposables }) => {
			this._containers.add(container);
			this._applyToContainer(container, this.getTokens());
			disposables.add({ dispose: () => this._containers.delete(container) });
		}));

		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('compyle.appearance') || e.affectsConfiguration(COMPYLE_MINIMAL_MODE_SETTING)) {
				this._preview = undefined;
				this._applyAll();
			}
		}));

		this._applyAll();
	}

	getMode(): CompyleAppearanceMode {
		const raw = this._configurationService.getValue<string>(COMPYLE_APPEARANCE_MODE_SETTING);
		return raw === 'vibrancy' ? 'vibrancy' : 'standard';
	}

	getStyle(): CompyleVibrancyStyle {
		const raw = this._configurationService.getValue<CompyleVibrancyStyle>(COMPYLE_VIBRANCY_STYLE_SETTING);
		return COMPYLE_VIBRANCY_STYLES.includes(raw) ? raw : COMPYLE_VIBRANCY_DEFAULTS.style;
	}

	getTokens(): ICompyleVibrancyTokens {
		const opacity = clampOpacity(this._configurationService.getValue<number>(COMPYLE_VIBRANCY_OPACITY_SETTING) ?? COMPYLE_VIBRANCY_DEFAULTS.opacity);
		const blur = clampBlur(this._configurationService.getValue<number>(COMPYLE_VIBRANCY_BLUR_SETTING) ?? COMPYLE_VIBRANCY_DEFAULTS.blur);
		const tint = this._configurationService.getValue<string>(COMPYLE_VIBRANCY_TINT_SETTING) || COMPYLE_VIBRANCY_DEFAULTS.tint;
		const reducedMotion = this.isReducedMotion();
		return {
			mode: this._preview?.mode ?? this.getMode(),
			style: this._preview?.style ?? this.getStyle(),
			opacity,
			blur: reducedMotion ? Math.min(blur, 12) : blur,
			tint,
			reducedMotion,
			compactMode: this.isCompactMode(),
		};
	}

	async setMode(mode: CompyleAppearanceMode): Promise<void> {
		this._preview = undefined;
		await this._configurationService.updateValue(COMPYLE_APPEARANCE_MODE_SETTING, mode);
		this._applyAll();
	}

	async setStyle(style: CompyleVibrancyStyle): Promise<void> {
		this._preview = undefined;
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_STYLE_SETTING, style);
		this._applyAll();
	}

	async setOpacity(opacity: number): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_OPACITY_SETTING, clampOpacity(opacity));
		this._applyAll();
	}

	async setBlur(blur: number): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_BLUR_SETTING, clampBlur(blur));
		this._applyAll();
	}

	async setTint(tint: string): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_TINT_SETTING, tint);
		this._applyAll();
	}

	isReducedMotion(): boolean {
		return this._configurationService.getValue<boolean>(COMPYLE_REDUCED_MOTION_SETTING) === true;
	}

	async setReducedMotion(enabled: boolean): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_REDUCED_MOTION_SETTING, enabled);
		this._applyAll();
	}

	isCompactMode(): boolean {
		return this._configurationService.getValue<boolean>(COMPYLE_COMPACT_MODE_SETTING) === true;
	}

	async setCompactMode(enabled: boolean): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_COMPACT_MODE_SETTING, enabled);
		this._applyAll();
	}

	isMinimalMode(): boolean {
		return this._configurationService.getValue<boolean>(COMPYLE_MINIMAL_MODE_SETTING) === true;
	}

	async setMinimalMode(enabled: boolean): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_MINIMAL_MODE_SETTING, enabled);
		this._applyAll();
	}

	preview(mode: CompyleAppearanceMode, style: CompyleVibrancyStyle): void {
		this._preview = { mode, style };
		this._applyAll();
	}

	cancelPreview(): void {
		if (this._preview) {
			this._preview = undefined;
			this._applyAll();
		}
	}

	async reset(): Promise<void> {
		this._preview = undefined;
		await this._configurationService.updateValue(COMPYLE_APPEARANCE_MODE_SETTING, COMPYLE_VIBRANCY_DEFAULTS.mode);
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_STYLE_SETTING, COMPYLE_VIBRANCY_DEFAULTS.style);
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_OPACITY_SETTING, COMPYLE_VIBRANCY_DEFAULTS.opacity);
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_BLUR_SETTING, COMPYLE_VIBRANCY_DEFAULTS.blur);
		await this._configurationService.updateValue(COMPYLE_VIBRANCY_TINT_SETTING, COMPYLE_VIBRANCY_DEFAULTS.tint);
		await this._configurationService.updateValue(COMPYLE_REDUCED_MOTION_SETTING, false);
		await this._configurationService.updateValue(COMPYLE_COMPACT_MODE_SETTING, false);
		this._applyAll();
	}

	private _applyAll(): void {
		const tokens = this.getTokens();
		for (const container of this._containers) {
			this._applyToContainer(container, tokens);
		}
		this._onDidChangeAppearance.fire();
	}

	private _applyToContainer(el: HTMLElement, tokens: ICompyleVibrancyTokens): void {
		const style = el.style;
		style.setProperty('--compyle-opacity', `${tokens.opacity}`);
		style.setProperty('--compyle-blur', `${tokens.blur}px`);
		style.setProperty('--compyle-tint', tokens.tint);

		const vibrancy = tokens.mode === 'vibrancy';
		el.classList.toggle('compyle-vibrancy', vibrancy);

		for (const cls of Array.from(el.classList)) {
			if (cls.startsWith('compyle-vibrancy-style-')) {
				el.classList.remove(cls);
			}
		}
		if (vibrancy) {
			el.classList.add(`compyle-vibrancy-style-${tokens.style}`);
		}

		el.classList.toggle('compyle-reduce-motion', tokens.reducedMotion);
		el.classList.toggle('compyle-compact', tokens.compactMode);
		el.classList.toggle('compyle-minimal', this.isMinimalMode());
	}
}

registerSingleton(ICompyleVibrancyService, CompyleVibrancyService, InstantiationType.Delayed);
