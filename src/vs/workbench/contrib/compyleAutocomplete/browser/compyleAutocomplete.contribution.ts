/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { timeout } from '../../../../base/common/async.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStatusbarService, IStatusbarEntry, IStatusbarEntryAccessor, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { InlineCompletion, InlineCompletions, InlineCompletionContext, InlineCompletionsProvider } from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';

const ENABLED_SETTING = 'compyle.autocomplete.enabled';
const DEBOUNCE_SETTING = 'compyle.autocomplete.debounce';

const MAX_PREFIX = 2000;
const MAX_SUFFIX = 800;

const AUTOCOMPLETE_SYSTEM = [
	'You are Compyle\'s code autocomplete.',
	'Given the code before and after the cursor, output the single most likely continuation to insert at the cursor.',
	'Rules:',
	'- Output ONLY the raw text to insert at the cursor.',
	'- No explanations, no markdown code fences, no repetition of the existing code.',
	'- Keep it short — a few lines at most.',
	'- If nothing should be inserted, output nothing.',
].join('\n');

function stripFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
	return fenced ? fenced[1] : text;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'compyle',
	title: localize('compyle', "Compyle"),
	properties: {
		[ENABLED_SETTING]: {
			type: 'boolean',
			default: false,
			description: localize('compyle.autocomplete.enabled', "Show AI ghost-text completions as you type, accepted with Tab. Powered by Compyle Brain — each completion calls your configured AI provider, so this is off by default. Toggle it from the status bar."),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
		[DEBOUNCE_SETTING]: {
			type: 'number',
			default: 350,
			minimum: 100,
			maximum: 3000,
			description: localize('compyle.autocomplete.debounce', "How long to wait after you stop typing (in milliseconds) before requesting an AI completion."),
			scope: ConfigurationScope.APPLICATION,
		},
	},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

class CompyleInlineCompletionsProvider implements InlineCompletionsProvider {

	readonly displayName = 'Compyle Brain';

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
	) { }

	async provideInlineCompletions(model: ITextModel, position: Position, context: InlineCompletionContext, token: CancellationToken): Promise<InlineCompletions | undefined> {
		if (this._configurationService.getValue<boolean>(ENABLED_SETTING, { resource: model.uri }) !== true) {
			return undefined;
		}
		if (!this._brainService.isConfigured()) {
			return undefined;
		}
		if (this._configurationService.getValue<string>('compyle.modes.activeMode') === 'focus') {
			return undefined;
		}
		// Don't fight IntelliSense, and only complete at the end of a line.
		if (context.selectedSuggestionInfo) {
			return undefined;
		}
		if (position.column !== model.getLineMaxColumn(position.lineNumber)) {
			return undefined;
		}

		// Debounce: wait for a typing pause; the editor cancels the token when more is typed.
		const debounce = this._configurationService.getValue<number>(DEBOUNCE_SETTING) ?? 350;
		try {
			await timeout(debounce, token);
		} catch {
			return undefined;
		}
		if (token.isCancellationRequested) {
			return undefined;
		}

		let prefix = model.getValueInRange(new Range(1, 1, position.lineNumber, position.column));
		if (!prefix.trim()) {
			return undefined;
		}
		if (prefix.length > MAX_PREFIX) {
			prefix = prefix.slice(prefix.length - MAX_PREFIX);
		}
		const lastLine = model.getLineCount();
		let suffix = model.getValueInRange(new Range(position.lineNumber, position.column, lastLine, model.getLineMaxColumn(lastLine)));
		if (suffix.length > MAX_SUFFIX) {
			suffix = suffix.slice(0, MAX_SUFFIX);
		}

		const user = [
			`Language: ${model.getLanguageId()}`,
			'',
			'--- code before cursor ---',
			prefix,
			'--- code after cursor ---',
			suffix,
			'',
			'Text to insert at the cursor:',
		].join('\n');

		let reply: string;
		try {
			reply = await this._brainService.chat(
				[{ role: 'user', content: user }],
				{ system: AUTOCOMPLETE_SYSTEM, maxTokens: 256, silent: true },
				token,
			);
		} catch {
			return undefined; // network error, local-only block, cancellation — just show nothing
		}

		const insertText = stripFences(reply).replace(/\s+$/, '');
		if (!insertText || token.isCancellationRequested) {
			return undefined;
		}

		const item: InlineCompletion = {
			insertText,
			range: new Range(position.lineNumber, position.column, position.lineNumber, position.column),
		};
		return { items: [item] };
	}

	disposeInlineCompletions(): void {
		// nothing to clean up
	}
}

class CompyleAutocompleteContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleAutocomplete';

	constructor(
		@ILanguageFeaturesService languageFeaturesService: ILanguageFeaturesService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		const provider = instantiationService.createInstance(CompyleInlineCompletionsProvider);
		this._register(languageFeaturesService.inlineCompletionsProvider.register('*', provider));
	}
}

registerWorkbenchContribution2(
	CompyleAutocompleteContribution.ID,
	CompyleAutocompleteContribution,
	WorkbenchPhase.AfterRestored,
);

// ---------------------------------------------------------------------------
// Toggle command + status bar pill
// ---------------------------------------------------------------------------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.autocomplete.toggle',
			title: { value: localize('compyle.autocomplete.toggle', "Toggle AI Autocomplete"), original: 'Toggle AI Autocomplete' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const enabled = configurationService.getValue<boolean>(ENABLED_SETTING) === true;
		await configurationService.updateValue(ENABLED_SETTING, !enabled);
	}
});

class CompyleAutocompleteStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.compyleAutocompleteStatusBar';

	private readonly _entryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super();
		this._update();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(ENABLED_SETTING)) {
				this._update();
			}
		}));
	}

	private _update(): void {
		const on = this._configurationService.getValue<boolean>(ENABLED_SETTING) === true;
		const entry: IStatusbarEntry = {
			name: localize('compyle.autocomplete.statusBar.name', "Compyle AI Autocomplete"),
			text: on ? '$(sparkle) AI' : '$(sparkle)',
			ariaLabel: on
				? localize('compyle.autocomplete.statusBar.ariaOn', "AI autocomplete is on. Click to turn it off.")
				: localize('compyle.autocomplete.statusBar.ariaOff', "AI autocomplete is off. Click to turn it on."),
			tooltip: on
				? localize('compyle.autocomplete.statusBar.tooltipOn', "AI autocomplete on — click to turn off")
				: localize('compyle.autocomplete.statusBar.tooltipOff', "AI autocomplete off — click to turn on"),
			command: 'compyle.autocomplete.toggle',
		};

		if (this._entryAccessor.value) {
			this._entryAccessor.value.update(entry);
		} else {
			this._entryAccessor.value = this._statusbarService.addEntry(entry, 'status.compyle.autocomplete', StatusbarAlignment.RIGHT, 98);
		}
	}
}

registerWorkbenchContribution2(
	CompyleAutocompleteStatusBarContribution.ID,
	CompyleAutocompleteStatusBarContribution,
	WorkbenchPhase.AfterRestored,
);
