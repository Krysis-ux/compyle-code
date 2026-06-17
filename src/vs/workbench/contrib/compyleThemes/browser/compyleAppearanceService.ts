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
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import {
	CompyleAppearanceCustomizations,
	COMPYLE_ACTIVE_PACK_SETTING,
	COMPYLE_CUSTOMIZATIONS_SETTING,
	COMPYLE_LIQUID_GLASS_FULL_MODE_SETTING,
	COMPYLE_MINIMAL_MODE_SETTING,
	COMPYLE_PACK_NONE,
	COMPYLE_SAFE_MODE_SETTING,
	ICompyleAppearanceTokens,
	ICompyleUIPack,
} from '../common/compyleUIPacks.js';
import { getUIPack } from '../common/compyleUIPacksRegistry.js';

export const ICompyleAppearanceService = createDecorator<ICompyleAppearanceService>('compyleAppearanceService');

export interface ICompyleAppearanceService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeAppearance: Event<void>;

	/** Currently applied pack id, or 'none'. */
	getActivePackId(): string;
	getCustomizations(): CompyleAppearanceCustomizations;
	getEffectiveTokens(): ICompyleAppearanceTokens;

	/** Whether Minimal mode (reduced chrome) is on. */
	isMinimalMode(): boolean;
	/** Turn Minimal mode on or off and persist it. */
	setMinimalMode(enabled: boolean): Promise<void>;
	/** Whether Liquid Glass Full Mode is on. */
	isLiquidGlassFullMode(): boolean;
	/** Turn Liquid Glass Full Mode on or off and persist it. */
	setLiquidGlassFullMode(enabled: boolean): Promise<void>;

	/** Apply a pack permanently: persists, swaps the paired color theme, restyles the UI. */
	applyPack(packId: string): Promise<void>;
	/** Restyle the UI for a pack without persisting (live preview); also previews the color theme. */
	previewPack(packId: string): Promise<void>;
	/** Re-apply the persisted pack, discarding any unsaved preview. */
	cancelPreview(): Promise<void>;
	/** Layer user adjustments on top of the active pack and persist them. */
	customize(changes: CompyleAppearanceCustomizations): Promise<void>;
	/** Remove all appearance styling and clear persisted state. */
	reset(): Promise<void>;
}

const DEFAULT_TOKENS: ICompyleAppearanceTokens = {
	accent: '#7E81FF', radius: 6, blur: 0, shadow: 1, glass: false, transparency: 1, density: 'comfortable', animation: 'normal',
};

/** --vscode-* variables overridden by the pack accent. Curated to stay readable. */
const ACCENT_VSCODE_VARS = [
	'--vscode-focusBorder',
	'--vscode-button-background',
	'--vscode-button-hoverBackground',
	'--vscode-progressBar-background',
	'--vscode-activityBarBadge-background',
	'--vscode-textLink-foreground',
	'--vscode-textLink-activeForeground',
	'--vscode-activityBar-activeBorder',
	'--vscode-panelTitle-activeBorder',
	'--vscode-tab-activeBorderTop',
];

function shadowCss(strength: number): string {
	switch (Math.round(strength)) {
		case 0: return 'none';
		case 1: return '0 1px 3px rgba(0, 0, 0, 0.24)';
		case 2: return '0 6px 18px rgba(0, 0, 0, 0.32)';
		default: return '0 14px 38px rgba(0, 0, 0, 0.46)';
	}
}

function densityFactor(density: ICompyleAppearanceTokens['density']): string {
	switch (density) {
		case 'compact': return '0.88';
		case 'airy': return '1.18';
		default: return '1';
	}
}

export class CompyleAppearanceService extends Disposable implements ICompyleAppearanceService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeAppearance = this._register(new Emitter<void>());
	readonly onDidChangeAppearance = this._onDidChangeAppearance.event;

	private readonly _containers = new Set<HTMLElement>();

	constructor(
		@ILayoutService private readonly _layoutService: ILayoutService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IWorkbenchThemeService private readonly _themeService: IWorkbenchThemeService,
	) {
		super();

		this._containers.add(this._layoutService.mainContainer);
		this._register(this._layoutService.onDidAddContainer(({ container, disposables }) => {
			this._containers.add(container);
			this._applyToContainer(container, this.getEffectiveTokens(), this.getActivePackId(), this.isLiquidGlassFullMode());
			disposables.add({ dispose: () => this._containers.delete(container) });
		}));

		// Re-apply when accessibility-related settings or minimal mode change.
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('compyle.themes.reduceTransparency')
				|| e.affectsConfiguration('compyle.themes.reduceMotion')
				|| e.affectsConfiguration(COMPYLE_SAFE_MODE_SETTING)
				|| e.affectsConfiguration(COMPYLE_LIQUID_GLASS_FULL_MODE_SETTING)
				|| e.affectsConfiguration(COMPYLE_MINIMAL_MODE_SETTING)) {
				this._applyAll();
			}
		}));

		// Restore persisted appearance tokens only; leave the user's color theme intact on startup.
		this._applyAll();
	}

	getActivePackId(): string {
		return this._configurationService.getValue<string>(COMPYLE_ACTIVE_PACK_SETTING) || COMPYLE_PACK_NONE;
	}

	getCustomizations(): CompyleAppearanceCustomizations {
		return this._configurationService.getValue<CompyleAppearanceCustomizations>(COMPYLE_CUSTOMIZATIONS_SETTING) ?? {};
	}

	isMinimalMode(): boolean {
		return this._configurationService.getValue<boolean>(COMPYLE_MINIMAL_MODE_SETTING) === true;
	}

	async setMinimalMode(enabled: boolean): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_MINIMAL_MODE_SETTING, enabled);
		this._applyAll();
	}

	isLiquidGlassFullMode(): boolean {
		return this._configurationService.getValue<boolean>(COMPYLE_LIQUID_GLASS_FULL_MODE_SETTING) === true;
	}

	async setLiquidGlassFullMode(enabled: boolean): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_LIQUID_GLASS_FULL_MODE_SETTING, enabled);
		this._applyAll();
	}

	getEffectiveTokens(): ICompyleAppearanceTokens {
		const pack = getUIPack(this.getActivePackId());
		return this._computeTokens(pack, this.getCustomizations());
	}

	private _computeTokens(pack: ICompyleUIPack | undefined, customizations: CompyleAppearanceCustomizations): ICompyleAppearanceTokens {
		let tokens: ICompyleAppearanceTokens = { ...(pack ? pack.tokens : DEFAULT_TOKENS), ...customizations };

		const reduceTransparency = this._configurationService.getValue<boolean>('compyle.themes.reduceTransparency') === true;
		const safeMode = this._configurationService.getValue<boolean>(COMPYLE_SAFE_MODE_SETTING) === true;
		const reduceMotion = this._configurationService.getValue<string>('compyle.themes.reduceMotion');

		if (reduceTransparency || safeMode) {
			tokens = { ...tokens, glass: false, blur: 0, transparency: 1 };
		}
		if (safeMode) {
			tokens = { ...tokens, shadow: Math.min(tokens.shadow, 1), radius: Math.min(tokens.radius, 6), animation: 'reduced' };
		}
		if (reduceMotion === 'on') {
			tokens = { ...tokens, animation: 'reduced' };
		}
		return tokens;
	}

	private _applyAll(): void {
		const tokens = this.getEffectiveTokens();
		const packId = this.getActivePackId();
		const liquidGlassFull = this.isLiquidGlassFullMode();
		for (const container of this._containers) {
			this._applyToContainer(container, tokens, packId, liquidGlassFull);
		}
		this._onDidChangeAppearance.fire();
	}

	private _applyToContainer(el: HTMLElement, tokens: ICompyleAppearanceTokens, packId: string, liquidGlassFull: boolean): void {
		const style = el.style;
		style.setProperty('--compyle-radius', `${tokens.radius}px`);
		style.setProperty('--compyle-blur', `${tokens.blur}px`);
		style.setProperty('--compyle-shadow', shadowCss(tokens.shadow));
		style.setProperty('--compyle-glass-opacity', `${tokens.transparency}`);
		style.setProperty('--compyle-density', densityFactor(tokens.density));
		style.setProperty('--compyle-accent', tokens.accent);

		const active = packId !== COMPYLE_PACK_NONE;
		for (const cssVar of ACCENT_VSCODE_VARS) {
			if (active) {
				style.setProperty(cssVar, tokens.accent);
			} else {
				style.removeProperty(cssVar);
			}
		}

		for (const cls of Array.from(el.classList)) {
			if (cls.startsWith('compyle-pack-')) {
				el.classList.remove(cls);
			}
		}
		el.classList.toggle('compyle-appearance-active', active);
		if (active) {
			el.classList.add(`compyle-pack-${packId}`);
		}
		const glassEnabled = active && tokens.glass && tokens.blur > 0;
		el.classList.toggle('compyle-glass', glassEnabled);
		el.classList.toggle('compyle-liquid-glass-full', glassEnabled && liquidGlassFull);
		el.classList.toggle('compyle-reduce-motion', active && tokens.animation === 'reduced');
		el.classList.toggle('compyle-minimal', this.isMinimalMode());
	}

	async applyPack(packId: string): Promise<void> {
		const pack = getUIPack(packId);
		// Applying a pack starts from its defaults — drop any prior customizations.
		await this._configurationService.updateValue(COMPYLE_CUSTOMIZATIONS_SETTING, {});
		await this._configurationService.updateValue(COMPYLE_ACTIVE_PACK_SETTING, packId);
		// A glass pack only delivers its signature full-surface look with Full Mode on, so turn it
		// on automatically when a glass pack is chosen and off for flat packs. Users can still
		// override the toggle afterwards from the Appearance Studio.
		await this._configurationService.updateValue(COMPYLE_LIQUID_GLASS_FULL_MODE_SETTING, !!pack?.tokens.glass);
		if (pack) {
			await this._setColorTheme(pack.colorThemeId, 'auto');
		}
		this._applyAll();
	}

	async previewPack(packId: string): Promise<void> {
		const pack = getUIPack(packId);
		const tokens = this._computeTokens(pack, {});
		// Preview a glass pack with the full-surface look so the user sees what they will get.
		const liquidGlassFull = !!pack?.tokens.glass || this.isLiquidGlassFullMode();
		for (const container of this._containers) {
			this._applyToContainer(container, tokens, packId, liquidGlassFull);
		}
		if (pack) {
			await this._setColorTheme(pack.colorThemeId, 'preview');
		}
		this._onDidChangeAppearance.fire();
	}

	async cancelPreview(): Promise<void> {
		const pack = getUIPack(this.getActivePackId());
		this._applyAll();
		if (pack) {
			await this._setColorTheme(pack.colorThemeId, 'preview');
		}
	}

	async customize(changes: CompyleAppearanceCustomizations): Promise<void> {
		const merged = { ...this.getCustomizations(), ...changes };
		await this._configurationService.updateValue(COMPYLE_CUSTOMIZATIONS_SETTING, merged);
		this._applyAll();
	}

	async reset(): Promise<void> {
		await this._configurationService.updateValue(COMPYLE_ACTIVE_PACK_SETTING, COMPYLE_PACK_NONE);
		await this._configurationService.updateValue(COMPYLE_CUSTOMIZATIONS_SETTING, {});
		await this._configurationService.updateValue(COMPYLE_SAFE_MODE_SETTING, false);
		await this._configurationService.updateValue(COMPYLE_LIQUID_GLASS_FULL_MODE_SETTING, false);
		this._applyAll();
	}

	private async _setColorTheme(settingsId: string, target: 'auto' | 'preview'): Promise<void> {
		const themes = await this._themeService.getColorThemes();
		const theme = themes.find(t => t.settingsId === settingsId);
		if (theme) {
			await this._themeService.setColorTheme(theme.id, target);
		}
	}
}

registerSingleton(ICompyleAppearanceService, CompyleAppearanceService, InstantiationType.Delayed);
