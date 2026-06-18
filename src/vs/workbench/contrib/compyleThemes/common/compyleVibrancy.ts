/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compyle appearance is a small, honest vibrancy system. Two modes:
 *
 *  - "standard": the plain, fully opaque workbench (no extra effects).
 *  - "vibrancy": frosted-glass surfaces — translucent chrome over a soft
 *    theme-derived depth background, with backdrop blur on floating widgets so
 *    the code shows through. Cross-platform, runtime-toggleable, no native
 *    window transparency required.
 *
 * Settings are projected onto `--compyle-*` CSS custom properties and a handful
 * of body classes by the CompyleVibrancyService. Nothing here patches files or
 * touches the Electron window, so it is safe and reversible.
 */

export type CompyleAppearanceMode = 'standard' | 'vibrancy';

/**
 * Visual flavor of the frosted glass. These are CSS interpretations of familiar
 * desktop materials — they do not call native OS APIs.
 */
export type CompyleVibrancyStyle = 'frost' | 'acrylic' | 'mica' | 'tint';

export interface ICompyleVibrancyTokens {
	readonly mode: CompyleAppearanceMode;
	readonly style: CompyleVibrancyStyle;
	/** Surface opacity, 0.3 (very see-through) to 1.0 (solid). */
	readonly opacity: number;
	/** Backdrop blur radius in px, 0 to 40. */
	readonly blur: number;
	/** Accent tint (hex) layered into the glass and the depth background. */
	readonly tint: string;
	readonly reducedMotion: boolean;
	readonly compactMode: boolean;
}

export const COMPYLE_DEFAULT_TINT = '#7E81FF';

export const COMPYLE_VIBRANCY_DEFAULTS: ICompyleVibrancyTokens = {
	mode: 'standard',
	style: 'frost',
	opacity: 0.85,
	blur: 20,
	tint: COMPYLE_DEFAULT_TINT,
	reducedMotion: false,
	compactMode: false,
};

// Setting keys (kept stable so user config survives the rebuild where it overlaps).
export const COMPYLE_APPEARANCE_MODE_SETTING = 'compyle.appearance.mode';
export const COMPYLE_VIBRANCY_STYLE_SETTING = 'compyle.appearance.vibrancyStyle';
export const COMPYLE_VIBRANCY_OPACITY_SETTING = 'compyle.appearance.opacity';
export const COMPYLE_VIBRANCY_BLUR_SETTING = 'compyle.appearance.blurRadius';
export const COMPYLE_VIBRANCY_TINT_SETTING = 'compyle.appearance.tint';
export const COMPYLE_REDUCED_MOTION_SETTING = 'compyle.appearance.reducedMotion';
export const COMPYLE_COMPACT_MODE_SETTING = 'compyle.appearance.compactMode';
export const COMPYLE_MINIMAL_MODE_SETTING = 'compyle.minimalMode.enabled';

export const COMPYLE_VIBRANCY_STYLES: readonly CompyleVibrancyStyle[] = ['frost', 'acrylic', 'mica', 'tint'];

export interface ICompyleVibrancyStyleInfo {
	readonly id: CompyleVibrancyStyle;
	readonly name: string;
	readonly description: string;
}

/** Clamp a raw setting value into the supported numeric range. */
export function clampOpacity(value: number): number {
	if (Number.isNaN(value)) {
		return COMPYLE_VIBRANCY_DEFAULTS.opacity;
	}
	return Math.min(1, Math.max(0.3, value));
}

export function clampBlur(value: number): number {
	if (Number.isNaN(value)) {
		return COMPYLE_VIBRANCY_DEFAULTS.blur;
	}
	return Math.min(40, Math.max(0, Math.round(value)));
}
