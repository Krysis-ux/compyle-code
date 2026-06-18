/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type CompyleModeId = 'flow' | 'focus' | 'tutor' | 'resolve';

export interface ICompyleMode {
	readonly id: CompyleModeId;
	readonly displayName: string;
	readonly shortName: string;
	readonly tagline: string;
	readonly description: string;
	readonly bestFor: readonly string[];
	readonly icon: string;
	readonly recommendedThemes: readonly string[];
	readonly memoryBehavior: 'off' | 'ask' | 'auto';
	readonly aiBehavior: 'off' | 'ask' | 'errors' | 'full';
	readonly soundBehavior: 'off' | 'subtle' | 'normal';
	readonly motionBehavior: 'off' | 'reduced' | 'normal';
	readonly privacyNote?: string;
}

export const COMPYLE_MODES_STORAGE_KEY = 'compyle.modes.selectionShown';
export const COMPYLE_ACTIVE_MODE_SETTING = 'compyle.modes.activeMode';
export const COMPYLE_PROJECT_SETTINGS_PATH = '.compyle/settings.json';
export const COMPYLE_PROJECT_DIR = '.compyle';
