/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

/**
 * Compyle Performance Control Center
 *
 * Surfaces startup time, extension activation times, and memory info.
 * Provides quick actions: Safe Mode, Disable Heavy Extensions, Restart LS, etc.
 *
 * Data sources (when implemented):
 * - ILifecycleService — startup phase timings
 * - IExtensionService — extension activation timings
 * - process.memoryUsage() — memory info
 * - ITimerService — detailed startup breakdown
 */

class OpenPerformancePanelAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.performance.openPanel',
			title: { value: localize('compyle.performance.openPanel', "Open Performance Panel"), original: 'Open Performance Panel' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		// Falls back to built-in startup performance view until Compyle panel is implemented
		await commandService.executeCommand('workbench.action.startupPerformance');
	}
}

class DisableHeavyExtensionsAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.performance.disableHeavyExtensions',
			title: { value: localize('compyle.performance.disableHeavyExtensions', "Disable Slow Extensions"), original: 'Disable Slow Extensions' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: query IExtensionService for slow activations and prompt user
	}
}

class PauseAIIndexingAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.performance.pauseAIIndexing',
			title: { value: localize('compyle.performance.pauseAIIndexing', "Pause Compyle Brain Indexing"), original: 'Pause Compyle Brain Indexing' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: signal CompyleBrainIndexer to pause
	}
}

class ExportPerformanceReportAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.performance.exportReport',
			title: { value: localize('compyle.performance.exportReport', "Export Performance Report"), original: 'Export Performance Report' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.saveAndRunExtensionProfileSample');
	}
}

registerAction2(OpenPerformancePanelAction);
registerAction2(DisableHeavyExtensionsAction);
registerAction2(PauseAIIndexingAction);
registerAction2(ExportPerformanceReportAction);
