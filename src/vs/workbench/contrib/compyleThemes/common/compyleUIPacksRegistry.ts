/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompyleUIPackBadge, ICompyleUIPack } from './compyleUIPacks.js';

const QUIET: ICompyleUIPack = {
	id: 'quiet',
	name: 'Quiet',
	shortName: 'Quiet',
	tagline: 'Premium minimal. Code is the hero.',
	description: 'The signature Compyle look. Flat monochrome surfaces, no busy borders, generous breathing room, and a single warm accent. Calm, focused, and fast — chrome melts away so the code stands out.',
	badges: [CompyleUIPackBadge.BeginnerFriendly],
	colorThemeId: 'Compyle Dark',
	tokens: { accent: '#E8A33D', radius: 6, blur: 0, shadow: 1, glass: false, transparency: 1, density: 'comfortable', animation: 'normal' },
};

const EDITORIAL: ICompyleUIPack = {
	id: 'editorial',
	name: 'Editorial',
	shortName: 'Editorial',
	tagline: 'Crisp, sharp, expensive.',
	description: 'Linear / Vercel energy. Crisp near-black surfaces, hairline borders, tight corners, refined type, and one electric accent. Looks high-end with zero GPU cost.',
	badges: [],
	colorThemeId: 'Carbon',
	tokens: { accent: '#635BFF', radius: 6, blur: 0, shadow: 1, glass: false, transparency: 1, density: 'comfortable', animation: 'normal' },
};

const LIQUID_GLASS: ICompyleUIPack = {
	id: 'liquid-glass',
	name: 'Liquid Glass',
	shortName: 'Liquid Glass',
	tagline: 'Translucent, premium, calm.',
	description: 'Apple-like glass interface. Translucent panels, blurred backdrops, soft highlights, and smooth rounded surfaces with gentle depth.',
	badges: [CompyleUIPackBadge.Glass, CompyleUIPackBadge.PerformanceHeavy],
	colorThemeId: 'Compyle Dark',
	tokens: { accent: '#7E81FF', radius: 12, blur: 12, shadow: 2, glass: true, transparency: 0.22, density: 'comfortable', animation: 'normal' },
};

const AURORA_GLASS: ICompyleUIPack = {
	id: 'aurora-glass',
	name: 'Aurora Glass',
	shortName: 'Aurora',
	tagline: 'Glass with a colorful glow.',
	description: 'Glass surfaces with soft aurora accents and depth. Colorful but still polished and professional.',
	badges: [CompyleUIPackBadge.Glass, CompyleUIPackBadge.PerformanceHeavy],
	colorThemeId: 'Tokyo Night',
	tokens: { accent: '#5AD1C8', radius: 14, blur: 12, shadow: 2, glass: true, transparency: 0.22, density: 'comfortable', animation: 'normal' },
};

const DARK_PRO: ICompyleUIPack = {
	id: 'dark-pro',
	name: 'Dark Pro',
	shortName: 'Dark Pro',
	tagline: 'Serious, clean, focused.',
	description: 'Professional dark interface for serious developers. Strong contrast, minimal distraction, polished tabs and panels.',
	badges: [],
	colorThemeId: 'Carbon',
	tokens: { accent: '#3B9EFF', radius: 6, blur: 0, shadow: 1, glass: false, transparency: 1, density: 'comfortable', animation: 'normal' },
};

const MINIMAL_ZEN: ICompyleUIPack = {
	id: 'minimal-zen',
	name: 'Minimal Zen',
	shortName: 'Zen',
	tagline: 'Cut the chrome.',
	description: 'Distraction-free interface. Reduced chrome, calm surfaces, airy spacing, and a keyboard-first feel.',
	badges: [CompyleUIPackBadge.ReducedMotion],
	colorThemeId: 'Graphite',
	tokens: { accent: '#8A8F98', radius: 4, blur: 0, shadow: 0, glass: false, transparency: 1, density: 'airy', animation: 'reduced' },
};

const CYBER_GRID: ICompyleUIPack = {
	id: 'cyber-grid',
	name: 'Cyber Grid',
	shortName: 'Cyber',
	tagline: 'Futuristic and sharp.',
	description: 'Futuristic interface with dark surfaces, sharp edges, and neon accents. Energetic but still readable.',
	badges: [CompyleUIPackBadge.Glass],
	colorThemeId: 'Cyber',
	tokens: { accent: '#00E5FF', radius: 2, blur: 14, shadow: 2, glass: true, transparency: 0.78, density: 'compact', animation: 'normal' },
};

const NEON_TERMINAL: ICompyleUIPack = {
	id: 'neon-terminal',
	name: 'Neon Terminal',
	shortName: 'Neon',
	tagline: 'Terminal-first, glowing.',
	description: 'Hacker-style command-focused interface with glowing accents, sharp corners, and a strong terminal presence.',
	badges: [],
	colorThemeId: 'Matrix',
	tokens: { accent: '#39FF14', radius: 2, blur: 0, shadow: 1, glass: false, transparency: 1, density: 'compact', animation: 'normal' },
};

const MATERIAL_DEPTH: ICompyleUIPack = {
	id: 'material-depth',
	name: 'Material Depth',
	shortName: 'Material',
	tagline: 'Layered cards and shadow.',
	description: 'Card-based modern interface with layered surfaces, clear hierarchy, and clean rounded elements.',
	badges: [],
	colorThemeId: 'Obsidian',
	tokens: { accent: '#42A5F5', radius: 8, blur: 0, shadow: 3, glass: false, transparency: 1, density: 'comfortable', animation: 'normal' },
};

const SOFT_STUDIO: ICompyleUIPack = {
	id: 'soft-studio',
	name: 'Soft Studio',
	shortName: 'Soft',
	tagline: 'Friendly and rounded.',
	description: 'Gentle interface for students and new developers. Soft corners, calm colors, and a less intimidating layout.',
	badges: [CompyleUIPackBadge.BeginnerFriendly],
	colorThemeId: 'Paper',
	tokens: { accent: '#7C6FF0', radius: 16, blur: 0, shadow: 1, glass: false, transparency: 1, density: 'airy', animation: 'normal' },
};

const HIGH_CONTRAST_PRO: ICompyleUIPack = {
	id: 'high-contrast-pro',
	name: 'High Contrast Pro',
	shortName: 'High Contrast',
	tagline: 'Accessibility first.',
	description: 'Accessibility-focused interface. Strong contrast, clear focus outlines, no blur, obvious borders, and reduced motion.',
	badges: [CompyleUIPackBadge.HighContrast, CompyleUIPackBadge.ReducedMotion],
	colorThemeId: 'Default High Contrast',
	tokens: { accent: '#FFFF00', radius: 0, blur: 0, shadow: 0, glass: false, transparency: 1, density: 'comfortable', animation: 'reduced' },
};

export const COMPYLE_UI_PACKS = new Map<string, ICompyleUIPack>([
	QUIET,
	EDITORIAL,
	LIQUID_GLASS,
	AURORA_GLASS,
	DARK_PRO,
	MINIMAL_ZEN,
	CYBER_GRID,
	NEON_TERMINAL,
	MATERIAL_DEPTH,
	SOFT_STUDIO,
	HIGH_CONTRAST_PRO,
].map(pack => [pack.id, pack]));

export function getUIPack(id: string): ICompyleUIPack | undefined {
	return COMPYLE_UI_PACKS.get(id);
}

export function getAllUIPacks(): ICompyleUIPack[] {
	return Array.from(COMPYLE_UI_PACKS.values());
}
