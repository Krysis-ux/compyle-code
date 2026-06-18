/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';

/**
 * Compyle Sound Settings
 *
 * All sound triggering goes through CompyleSoundService — never call audio APIs directly.
 * Sounds are off by default. Users opt in. Volume and pack are configurable.
 *
 * Sound packs:
 *   minimal   — subtle, barely-there audio cues
 *   soft      — gentle non-distracting sounds
 *   mechanical — satisfying mechanical keyboard feel
 *   futuristic — sci-fi / cyberpunk aesthetic
 *   retro     — 8-bit terminal nostalgic sounds
 *   silent    — no sounds (same as disabled)
 */

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		'compyle.sounds.enabled': {
			type: 'boolean',
			default: false,
			description: localize('compyle.sounds.enabled', "Enable Compyle Code sound effects. All sounds are off by default."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.masterVolume': {
			type: 'number',
			default: 50,
			minimum: 0,
			maximum: 100,
			// allow-any-unicode-next-line
				description: localize('compyle.sounds.masterVolume', "Master volume for Compyle sound effects (0–100)."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.pack': {
			type: 'string',
			default: 'minimal',
			enum: ['minimal', 'soft', 'mechanical', 'futuristic', 'retro', 'silent'],
			enumDescriptions: [
				localize('soundPack.minimal', "Subtle, barely-there audio cues"),
				localize('soundPack.soft', "Gentle, non-distracting sounds"),
				localize('soundPack.mechanical', "Satisfying mechanical keyboard feel"),
				localize('soundPack.futuristic', "Sci-fi / cyberpunk aesthetic"),
				localize('soundPack.retro', "8-bit terminal nostalgic sounds"),
				localize('soundPack.silent', "No sounds (same as disabled)"),
			],
			description: localize('compyle.sounds.pack', "Sound pack to use for Compyle sound effects."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.typing': {
			type: 'boolean',
			default: false,
			description: localize('compyle.sounds.typing', "Play a sound while typing in the editor."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.save': {
			type: 'boolean',
			default: true,
			description: localize('compyle.sounds.save', "Play a sound when a file is saved."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.buildSuccess': {
			type: 'boolean',
			default: true,
			description: localize('compyle.sounds.buildSuccess', "Play a sound when a build completes successfully."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.buildError': {
			type: 'boolean',
			default: true,
			description: localize('compyle.sounds.buildError', "Play a sound when a build fails."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.terminalDone': {
			type: 'boolean',
			default: false,
			description: localize('compyle.sounds.terminalDone', "Play a sound when a terminal command finishes."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.aiComplete': {
			type: 'boolean',
			default: true,
			description: localize('compyle.sounds.aiComplete', "Play a sound when Compyle Brain finishes a response."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.notification': {
			type: 'boolean',
			default: false,
			description: localize('compyle.sounds.notification', "Play a sound for Compyle notifications."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.respectReduceMotion': {
			type: 'boolean',
			default: true,
			description: localize('compyle.sounds.respectReduceMotion', "Disable sounds when OS 'Reduce Motion' is enabled."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.sounds.disableWhileRecording': {
			type: 'boolean',
			default: true,
			description: localize('compyle.sounds.disableWhileRecording', "Automatically disable sounds when screen recording is detected."),
			scope: ConfigurationScope.APPLICATION,
		},
	}
});
