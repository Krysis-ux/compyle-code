/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compyle Extension Policy — risk classification and blocklist for extensions.
 *
 * Compyle Code uses Open VSX as its default registry. This module classifies
 * extensions by risk level so the Extension Shield can warn users before install.
 */

export const enum CompyleExtensionRisk {
	/** Open source, reviewed, safe to use */
	Safe = 'safe',
	/** May be fine but license or source hasn't been verified */
	Unknown = 'unknown',
	/** Has warnings — e.g. telemetry, broad permissions, unclear license */
	Warning = 'warning',
	/** Restricted — license limits use to certain products/platforms */
	Restricted = 'restricted',
	/** Blocked — must not be installed or distributed via Compyle Code */
	Blocked = 'blocked',
}

export interface CompyleExtensionPolicy {
	readonly extensionId: string;
	readonly risk: CompyleExtensionRisk;
	readonly reason: string;
	readonly licenseNote?: string;
	readonly sourceRegistry?: 'open-vsx' | 'local-vsix' | 'compyle-verified' | 'unknown';
	readonly alternativeExtensionId?: string;
}

/**
 * Extensions that must not be installed or shipped with Compyle Code.
 * Reasons: license restricts use to Microsoft/Visual Studio family products,
 * or the extension calls proprietary Microsoft-only backend services.
 */
const BLOCKED_EXTENSIONS: readonly CompyleExtensionPolicy[] = [
	{
		extensionId: 'GitHub.copilot',
		risk: CompyleExtensionRisk.Blocked,
		reason: 'GitHub Copilot license restricts use to Microsoft/GitHub products. Use Compyle Brain instead.',
		licenseNote: 'Subject to GitHub Copilot terms of service — Visual Studio family restriction. Needs lawyer verification.',
	},
	{
		extensionId: 'GitHub.copilot-chat',
		risk: CompyleExtensionRisk.Blocked,
		reason: 'GitHub Copilot Chat license restricts use to Microsoft/GitHub products.',
		licenseNote: 'Subject to GitHub Copilot terms of service.',
	},
	{
		extensionId: 'ms-vscode-remote.remote-ssh',
		risk: CompyleExtensionRisk.Restricted,
		reason: 'Microsoft Remote SSH — license may restrict use to Visual Studio family. Needs legal review before distributing.',
		licenseNote: 'Verify Microsoft Remote Development license terms.',
	},
	{
		extensionId: 'ms-vscode-remote.remote-wsl',
		risk: CompyleExtensionRisk.Restricted,
		reason: 'Microsoft Remote WSL — license may restrict use to Visual Studio family. Needs legal review.',
		licenseNote: 'Verify Microsoft Remote Development license terms.',
	},
	{
		extensionId: 'ms-vscode-remote.remote-containers',
		risk: CompyleExtensionRisk.Restricted,
		reason: 'Microsoft Dev Containers — license may restrict use to Visual Studio family. Needs legal review.',
		licenseNote: 'Verify Microsoft Remote Development license terms.',
	},
	{
		extensionId: 'ms-vscode.remote-server',
		risk: CompyleExtensionRisk.Blocked,
		reason: 'VS Code Server is a proprietary Microsoft component. Compyle Code uses its own server architecture.',
	},
	{
		extensionId: 'ms-dotnettools.csdevkit',
		risk: CompyleExtensionRisk.Blocked,
		reason: 'C# Dev Kit is licensed for Visual Studio family products only.',
		licenseNote: 'Visual Studio family restriction in license.',
	},
	{
		extensionId: 'ms-dotnettools.vscodeintellicode-csharp',
		risk: CompyleExtensionRisk.Restricted,
		reason: 'IntelliCode C# — verify license for use outside Visual Studio family.',
	},
];

/**
 * Extensions that trigger a warning — not blocked, but user should be informed.
 */
const WARNING_EXTENSIONS: readonly CompyleExtensionPolicy[] = [
	{
		extensionId: 'ms-python.python',
		risk: CompyleExtensionRisk.Warning,
		reason: 'Published by Microsoft. Review license before use. Generally MIT/open-source but connects to Microsoft telemetry.',
		alternativeExtensionId: 'ms-python.python', // Same, available on Open VSX
	},
	{
		extensionId: 'ms-toolsai.jupyter',
		risk: CompyleExtensionRisk.Warning,
		reason: 'Jupyter extension by Microsoft — generally open-source but verify telemetry settings.',
	},
];

const BLOCKED_MAP = new Map<string, CompyleExtensionPolicy>(
	BLOCKED_EXTENSIONS.map(p => [p.extensionId.toLowerCase(), p])
);

const WARNING_MAP = new Map<string, CompyleExtensionPolicy>(
	WARNING_EXTENSIONS.map(p => [p.extensionId.toLowerCase(), p])
);

export function getExtensionPolicy(extensionId: string): CompyleExtensionPolicy {
	const id = extensionId.toLowerCase();
	return BLOCKED_MAP.get(id) ?? WARNING_MAP.get(id) ?? {
		extensionId,
		risk: CompyleExtensionRisk.Unknown,
		reason: 'Extension has not been reviewed by Compyle. Verify license before use.',
	};
}

export function isBlocked(extensionId: string): boolean {
	const policy = getExtensionPolicy(extensionId);
	return policy.risk === CompyleExtensionRisk.Blocked;
}

export function isRestricted(extensionId: string): boolean {
	const policy = getExtensionPolicy(extensionId);
	return policy.risk === CompyleExtensionRisk.Restricted || policy.risk === CompyleExtensionRisk.Blocked;
}

export function getWarningMessage(extensionId: string): string | undefined {
	const policy = getExtensionPolicy(extensionId);
	if (policy.risk === CompyleExtensionRisk.Safe) { return undefined; }
	if (policy.risk === CompyleExtensionRisk.Unknown) { return undefined; }
	return `[Compyle Extension Shield] ${policy.reason}${policy.licenseNote ? ` (${policy.licenseNote})` : ''}`;
}

export function isMicrosoftPublishedExtension(extensionId: string): boolean {
	const lower = extensionId.toLowerCase();
	return lower.startsWith('ms-') || lower.startsWith('microsoft.') || lower.startsWith('github.');
}

export function getSourceRegistryLabel(serviceUrl: string | undefined): string {
	if (!serviceUrl) { return 'Unknown'; }
	if (serviceUrl.includes('open-vsx.org')) { return 'Open VSX'; }
	if (serviceUrl.includes('marketplace.visualstudio.com')) { return 'Microsoft Marketplace (blocked)'; }
	return 'Unknown Registry';
}
