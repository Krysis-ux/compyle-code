/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { CompyleExtensionRisk, getExtensionPolicy, isMicrosoftPublishedExtension } from '../../../../platform/compyleExtensionPolicy/common/compyleExtensionPolicy.js';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		'compyle.extensionShield.enabled': {
			type: 'boolean',
			default: true,
			description: localize('compyle.extensionShield.enabled', "Enable Compyle Extension Shield — risk classification and warnings for extensions."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.extensionShield.warnOnMicrosoftPublisher': {
			type: 'boolean',
			default: true,
			description: localize('compyle.extensionShield.warnOnMicrosoftPublisher', "Show a warning when installing extensions published by Microsoft, GitHub, or using ms-* IDs."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.extensionShield.warnOnMissingLicense': {
			type: 'boolean',
			default: true,
			description: localize('compyle.extensionShield.warnOnMissingLicense', "Warn before installing extensions with no license specified."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.extensionShield.blockBlocked': {
			type: 'boolean',
			default: true,
			description: localize('compyle.extensionShield.blockBlocked', "Block installation of extensions in the Compyle blocked list."),
			scope: ConfigurationScope.APPLICATION,
		},
		'compyle.extensionShield.warnOnVsixInstall': {
			type: 'boolean',
			default: true,
			description: localize('compyle.extensionShield.warnOnVsixInstall', "Show a security warning before installing extensions from local .vsix files."),
			scope: ConfigurationScope.APPLICATION,
		},
	}
});

// ---------------------------------------------------------------------------
// Helper — get badge label for UI display
// ---------------------------------------------------------------------------

export function getExtensionRiskBadge(extensionId: string): { label: string; color: string } {
	const policy = getExtensionPolicy(extensionId);
	switch (policy.risk) {
		case CompyleExtensionRisk.Safe:
			return { label: 'Safe', color: '#4ade80' };
		case CompyleExtensionRisk.Warning:
			return { label: 'Needs Review', color: '#fbbf24' };
		case CompyleExtensionRisk.Restricted:
			return { label: 'Restricted', color: '#fb923c' };
		case CompyleExtensionRisk.Blocked:
			return { label: 'Blocked', color: '#f87171' };
		case CompyleExtensionRisk.Unknown:
		default:
			return { label: 'Unknown', color: '#9d9bbd' };
	}
}

export function shouldWarnOnExtension(extensionId: string): boolean {
	const policy = getExtensionPolicy(extensionId);
	if (policy.risk === CompyleExtensionRisk.Blocked || policy.risk === CompyleExtensionRisk.Restricted) {
		return true;
	}
	if (isMicrosoftPublishedExtension(extensionId)) {
		return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

class ViewExtensionPolicyAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.extensionShield.viewPolicy',
			title: { value: localize('compyle.extensionShield.viewPolicy', "View Extension Policy"), original: 'View Extension Policy' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.openSettings', 'compyle.extensionShield');
	}
}

class SafeModeAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.extensionShield.safeMode',
			title: { value: localize('compyle.extensionShield.safeMode', "Start in Safe Mode (Disable All Extensions)"), original: 'Start in Safe Mode (Disable All Extensions)' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.relaunchWithExtensionsDisabled');
	}
}

registerAction2(ViewExtensionPolicyAction);
registerAction2(SafeModeAction);
