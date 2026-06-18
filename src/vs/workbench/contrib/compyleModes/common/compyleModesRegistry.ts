/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompyleModeId, ICompyleMode } from './compyleModes.js';

const FLOW: ICompyleMode = {
	id: 'flow',
	displayName: 'Compyle Flow',
	shortName: 'Flow',
	tagline: 'Build with memory.',
	description: 'Compyle Flow helps you move fast without losing context. It keeps structured project memory, tracks decisions, summarizes changes, and creates handoff docs for future AI sessions.',
	bestFor: [
		'AI-assisted building',
		'fast prototyping',
		'large project changes',
		'Claude Code and Codex handoffs',
		'keeping project context organized',
	],
	icon: 'zap',
	recommendedThemes: ['Compyle Dark', 'Carbon', 'Tokyo Night'],
	memoryBehavior: 'ask',
	aiBehavior: 'ask',
	soundBehavior: 'subtle',
	motionBehavior: 'normal',
	privacyNote: 'Project memory is stored locally in your .compyle/ folder. Code is never sent to cloud AI without your approval.',
};

const FOCUS: ICompyleMode = {
	id: 'focus',
	displayName: 'Compyle Focus',
	shortName: 'Focus',
	tagline: 'Cut the noise.',
	description: 'Compyle Focus creates a clean workspace for deep coding. It reduces motion, hides distractions, quiets sounds, and keeps the editor fast and minimal.',
	bestFor: [
		'serious coding sessions',
		'writing and documentation',
		'performance-critical work',
		'distraction-free environments',
		'users who do not want AI interruptions',
	],
	icon: 'target',
	recommendedThemes: ['OLED Black', 'Obsidian', 'Graphite', 'Monochrome'],
	memoryBehavior: 'off',
	aiBehavior: 'off',
	soundBehavior: 'off',
	motionBehavior: 'reduced',
};

const TUTOR: ICompyleMode = {
	id: 'tutor',
	displayName: 'Compyle Tutor',
	shortName: 'Tutor',
	tagline: 'Learn while you build.',
	description: 'Compyle Tutor adapts explanations to the code you are writing. It detects concepts, explains errors, creates mini-lessons, and helps you practice without leaving the editor.',
	bestFor: [
		'beginners and students',
		'learning a new language',
		'understanding error messages',
		'turning real project code into lessons',
		'guided skill building',
	],
	icon: 'book',
	recommendedThemes: ['Daylight', 'Paper', 'Nord', 'Compyle Light'],
	memoryBehavior: 'off',
	aiBehavior: 'ask',
	soundBehavior: 'subtle',
	motionBehavior: 'normal',
	privacyNote: 'Explanations use built-in lesson cards first. Code is only sent to AI when you explicitly ask.',
};

const RESOLVE: ICompyleMode = {
	id: 'resolve',
	displayName: 'Compyle Resolve',
	shortName: 'Resolve',
	tagline: 'Find the break. Fix with confidence.',
	description: 'Compyle Resolve opens the tools you need when a project breaks. It surfaces errors, recent changes, likely causes, safe fix steps, and retest commands.',
	bestFor: [
		'debugging broken builds',
		'diagnosing runtime errors',
		'dependency and install problems',
		'stack trace analysis',
		'creating structured bug reports',
	],
	icon: 'debug',
	recommendedThemes: ['Compyle Dark', 'Ember', 'Carbon', 'Neon Midnight'],
	memoryBehavior: 'ask',
	aiBehavior: 'errors',
	soundBehavior: 'off',
	motionBehavior: 'normal',
};

export const COMPYLE_MODES = new Map<CompyleModeId, ICompyleMode>([
	['flow', FLOW],
	['focus', FOCUS],
	['tutor', TUTOR],
	['resolve', RESOLVE],
]);

export function getMode(id: CompyleModeId): ICompyleMode {
	const mode = COMPYLE_MODES.get(id);
	if (!mode) {
		throw new Error(`Unknown Compyle mode: ${id}`);
	}
	return mode;
}

export function getAllModes(): ICompyleMode[] {
	return Array.from(COMPYLE_MODES.values());
}
