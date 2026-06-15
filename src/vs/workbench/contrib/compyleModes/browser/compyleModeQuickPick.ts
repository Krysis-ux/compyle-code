/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { getAllModes } from '../common/compyleModesRegistry.js';
import { CompyleModeId, COMPYLE_ACTIVE_MODE_SETTING } from '../common/compyleModes.js';

interface ICompyleModePickItem extends IQuickPickItem {
	modeId: CompyleModeId;
}

const MODE_ICONS: Record<CompyleModeId, string> = {
	flow: '$(zap)',
	focus: '$(target)',
	tutor: '$(book)',
	resolve: '$(debug)',
};

export async function openCompyleModeQuickPick(accessor: ServicesAccessor): Promise<void> {
	const quickInputService = accessor.get(IQuickInputService);
	const configService = accessor.get(IConfigurationService);
	const notificationService = accessor.get(INotificationService);
	const commandService = accessor.get(ICommandService);
	const contextService = accessor.get(IWorkspaceContextService);

	const currentMode = configService.getValue<string>(COMPYLE_ACTIVE_MODE_SETTING);

	const picks: ICompyleModePickItem[] = getAllModes().map(mode => ({
		modeId: mode.id,
		label: `${MODE_ICONS[mode.id]} ${mode.displayName}`,
		description: mode.tagline,
		detail: [
			`Best for: ${mode.bestFor.slice(0, 3).join(' · ')}`,
			mode.privacyNote ? `  Privacy: ${mode.privacyNote}` : '',
		].filter(Boolean).join('\n'),
		picked: mode.id === currentMode,
	}));

	const picked = await quickInputService.pick<ICompyleModePickItem>(picks, {
		placeHolder: 'Choose your workspace experience — you can switch anytime',
		matchOnDescription: true,
		matchOnDetail: true,
	});

	if (!picked) { return; }

	const modeId = picked.modeId;

	await configService.updateValue(COMPYLE_ACTIVE_MODE_SETTING, modeId, ConfigurationTarget.USER);

	const hasWorkspace = contextService.getWorkbenchState() !== WorkbenchState.EMPTY;

	switch (modeId) {
		case 'flow':
			if (hasWorkspace) {
				notificationService.prompt(
					Severity.Info,
					'Compyle Flow is active. Set up project memory to keep context across sessions.',
					[{
						label: 'Initialize Project Memory',
						run: () => commandService.executeCommand('compyle.modes.initMemory'),
					}],
				);
			} else {
				notificationService.notify({
					severity: Severity.Info,
					message: 'Compyle Flow is active. Open a folder to enable project memory.',
				});
			}
			break;

		case 'focus':
			notificationService.notify({
				severity: Severity.Info,
				message: 'Compyle Focus is active. AI popups and memory prompts are off. Switch anytime from the status bar.',
			});
			break;

		case 'tutor':
			notificationService.notify({
				severity: Severity.Info,
				message: 'Compyle Tutor is active. Select code and use "Compyle: Explain Selected Code" to learn about what you are writing.',
			});
			break;

		case 'resolve':
			await commandService.executeCommand('compyle.modes.startResolve');
			break;
	}
}
