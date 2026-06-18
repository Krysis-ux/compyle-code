/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IMarkerService, IMarkerData, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { CodeAction, CodeActionContext, CodeActionList, CodeActionProvider } from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Range } from '../../../../editor/common/core/range.js';
import { Selection } from '../../../../editor/common/core/selection.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

const FIX_COMMAND_ID = 'compyle.brain.fixDiagnostic';

const FIX_SYSTEM = [
	'You are Compyle\'s automated code fixer.',
	'You receive a source file and its current diagnostics (errors and warnings).',
	'Return the COMPLETE corrected file that resolves the diagnostics with the smallest reasonable change.',
	'Rules:',
	'- Return ONLY the full file contents. Nothing else.',
	'- No explanations, no commentary, no markdown code fences.',
	'- Do not introduce unrelated changes.',
].join('\n');

function buildFixPrompt(languageId: string, diagnostics: string, fileText: string): string {
	return [
		`Language: ${languageId}`,
		'Diagnostics to fix:',
		diagnostics,
		'',
		'Current file:',
		fileText,
	].join('\n');
}

function stripFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
	return fenced ? fenced[1] : trimmed;
}

CommandsRegistry.registerCommand(FIX_COMMAND_ID, async (accessor: ServicesAccessor, resource: UriComponents, markers: IMarkerData[]) => {
	const brainService = accessor.get(ICompyleBrainService);
	const modelService = accessor.get(IModelService);
	const fileService = accessor.get(IFileService);
	const notificationService = accessor.get(INotificationService);
	const progressService = accessor.get(IProgressService);

	if (!brainService.isConfigured()) {
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.fix.noBrain', "Configure Compyle Brain (an AI provider) to fix problems with AI.") });
		return;
	}

	const uri = URI.revive(resource);
	const model = modelService.getModel(uri);
	let fileText: string;
	let languageId = 'plaintext';
	if (model) {
		fileText = model.getValue();
		languageId = model.getLanguageId();
	} else {
		try {
			fileText = (await fileService.readFile(uri)).value.toString();
		} catch (error) {
			notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
			return;
		}
	}

	const diagnostics = (markers ?? []).map(m => `- [line ${m.startLineNumber}] ${m.message}`).join('\n');

	try {
		const reply = await progressService.withProgress(
			{ location: ProgressLocation.Notification, title: localize('compyle.fix.working', "Compyle Brain is fixing the problem…") },
			() => brainService.chat([{ role: 'user', content: buildFixPrompt(languageId, diagnostics, fileText) }], { system: FIX_SYSTEM, maxTokens: 8192 }),
		);
		const result = stripFences(reply);
		if (!result.trim()) {
			notificationService.notify({ severity: Severity.Warning, message: localize('compyle.fix.empty', "Compyle Brain returned an empty response.") });
			return;
		}

		if (model) {
			model.pushStackElement();
			model.pushEditOperations([], [{ range: model.getFullModelRange(), text: result }], () => null);
			model.pushStackElement();
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.fix.applied', "Applied a fix from Compyle Brain. Press Ctrl+Z to undo.") });
		} else {
			await fileService.writeFile(uri, VSBuffer.fromString(result));
			notificationService.notify({ severity: Severity.Info, message: localize('compyle.fix.appliedFile', "Applied a fix from Compyle Brain to {0}.", uri.path.split('/').pop() ?? uri.path) });
		}
	} catch (error) {
		notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
	}
});

/**
 * Offers a "Fix with Compyle Brain" quick fix on any line that has an error or
 * warning. Only appears when an AI provider is configured.
 */
class CompyleFixCodeActionProvider implements CodeActionProvider {

	readonly displayName = 'Compyle Brain';

	constructor(
		@IMarkerService private readonly _markerService: IMarkerService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
	) { }

	provideCodeActions(model: ITextModel, range: Range | Selection, _context: CodeActionContext): CodeActionList {
		const empty: CodeActionList = { actions: [], dispose: () => { } };
		if (!this._brainService.isConfigured()) {
			return empty;
		}

		const markers = this._markerService.read({ resource: model.uri })
			.filter(m => m.severity >= MarkerSeverity.Warning
				&& Range.areIntersectingOrTouching(range, new Range(m.startLineNumber, m.startColumn, m.endLineNumber, m.endColumn)));

		if (markers.length === 0) {
			return empty;
		}

		const action: CodeAction = {
			title: markers.length > 1
				? localize('compyle.fix.titleMany', "Fix {0} problems with Compyle Brain", markers.length)
				: localize('compyle.fix.title', "Fix with Compyle Brain"),
			kind: 'quickfix',
			diagnostics: markers,
			isAI: true,
			command: {
				id: FIX_COMMAND_ID,
				title: localize('compyle.fix.command', "Fix with Compyle Brain"),
				arguments: [model.uri, markers],
			},
		};

		return { actions: [action], dispose: () => { } };
	}
}

class CompyleFixWithBrainContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleFixWithBrain';

	constructor(
		@ILanguageFeaturesService languageFeaturesService: ILanguageFeaturesService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		const provider = instantiationService.createInstance(CompyleFixCodeActionProvider);
		this._register(languageFeaturesService.codeActionProvider.register('*', provider));
	}
}

registerWorkbenchContribution2(
	CompyleFixWithBrainContribution.ID,
	CompyleFixWithBrainContribution,
	WorkbenchPhase.AfterRestored,
);
