/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { createDecorator, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IRunPlan } from '../../compyleRunDoctor/common/compyleRunDoctor.js';
import { ICompyleRunDoctorService } from '../../compyleRunDoctor/browser/compyleRunDoctorService.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';

export const ICompyleExplainService = createDecorator<ICompyleExplainService>('compyleExplainService');

export type ExplainDepth = 'overview' | 'beginner' | 'architecture' | 'run';

export interface ICompyleExplainService {
	readonly _serviceBrand: undefined;
	explain(depth: ExplainDepth): Promise<void>;
}

interface IProjectContext {
	readonly tree: string;
	readonly readme?: string;
	readonly scripts: Record<string, string>;
	readonly dependencies: string[];
}

const DEPTH_PROMPTS: Record<ExplainDepth, string> = {
	overview: 'Explain what this project does, its tech stack, and how the code is organized. Cover the main entry points.',
	beginner: 'Explain this project to a beginner in plain, friendly language, step by step. Avoid jargon where possible.',
	architecture: 'Explain the architecture: the layers, how data flows, the key modules and their responsibilities, and the main entry points.',
	run: 'Explain exactly how to install, run, build, and test this project, what local URL to open, and what a newcomer should edit first.',
};

export class CompyleExplainService implements ICompyleExplainService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
		@IFileService private readonly _fileService: IFileService,
		@ICompyleRunDoctorService private readonly _runDoctorService: ICompyleRunDoctorService,
		@ICompyleBrainService private readonly _brainService: ICompyleBrainService,
		@IEditorService private readonly _editorService: IEditorService,
		@IProgressService private readonly _progressService: IProgressService,
		@INotificationService private readonly _notificationService: INotificationService,
	) { }

	async explain(depth: ExplainDepth): Promise<void> {
		const root = this._contextService.getWorkspace().folders[0]?.uri;
		if (!root) {
			this._notificationService.notify({ severity: Severity.Info, message: localize('compyle.explain.noWorkspace', "Open a project folder first.") });
			return;
		}

		const plan = await this._runDoctorService.diagnose();
		const context = await this._gatherContext(root);

		if (!this._brainService.isConfigured()) {
			await this._openMarkdown(localize('compyle.explain.title', "Project Overview"), this._deterministicSummary(plan, context));
			this._notificationService.prompt(Severity.Info, localize('compyle.explain.configureForMore', "Configure Compyle Brain for a full AI explanation of this project."), [
				{ label: localize('compyle.explain.ask', "Ask Compyle Brain"), run: () => { void this.explain(depth); } },
			]);
			return;
		}

		const prompt = this._buildPrompt(depth, plan, context);
		try {
			const answer = await this._progressService.withProgress(
				{ location: ProgressLocation.Notification, title: localize('compyle.explain.thinking', "Compyle Brain is reading your project…") },
				() => this._brainService.chat([{ role: 'user', content: prompt }], { maxTokens: 2048 }),
			);
			await this._openMarkdown(localize('compyle.explain.title', "Project Overview"), answer);
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: error instanceof Error ? error.message : String(error) });
		}
	}

	private async _gatherContext(root: URI): Promise<IProjectContext> {
		let names: string[] = [];
		try {
			const stat = await this._fileService.resolve(root);
			names = (stat.children ?? []).map(c => `${c.name}${c.isDirectory ? '/' : ''}`).sort();
		} catch {
			// empty
		}

		let tree = names.join('\n');
		// Expand src/ one level deeper for a better structural picture.
		const srcDir = names.find(n => n === 'src/' || n === 'app/' || n === 'lib/');
		if (srcDir) {
			try {
				const sub = await this._fileService.resolve(URI.joinPath(root, srcDir.replace(/\/$/, '')));
				const subNames = (sub.children ?? []).map(c => `  ${srcDir}${c.name}${c.isDirectory ? '/' : ''}`).sort();
				tree += '\n' + subNames.join('\n');
			} catch {
				// ignore
			}
		}

		const readme = await this._readText(root, names, ['readme.md', 'readme.markdown', 'readme.txt', 'readme']);
		let scripts: Record<string, string> = {};
		let dependencies: string[] = [];
		if (names.includes('package.json')) {
			const pkgText = await this._readRaw(URI.joinPath(root, 'package.json'));
			if (pkgText) {
				try {
					const pkg = JSON.parse(pkgText);
					scripts = pkg.scripts ?? {};
					dependencies = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
				} catch {
					// ignore malformed
				}
			}
		}

		return { tree, readme: readme?.slice(0, 3000), scripts, dependencies };
	}

	private async _readRaw(uri: URI): Promise<string | undefined> {
		try {
			return (await this._fileService.readFile(uri)).value.toString();
		} catch {
			return undefined;
		}
	}

	private async _readText(root: URI, names: string[], candidates: string[]): Promise<string | undefined> {
		const match = names.find(n => candidates.includes(n.replace(/\/$/, '').toLowerCase()));
		return match ? this._readRaw(URI.joinPath(root, match.replace(/\/$/, ''))) : undefined;
	}

	private _buildPrompt(depth: ExplainDepth, plan: IRunPlan, context: IProjectContext): string {
		const parts: string[] = [
			'You are helping a developer understand a project they just opened. Be concise, accurate, and use Markdown headings.',
			DEPTH_PROMPTS[depth],
			'',
			'## Detected',
			`Type: ${plan.projectType}; Language: ${plan.language}${plan.framework ? `; Framework: ${plan.framework}` : ''}.`,
			'',
			'## File structure',
			context.tree || '(empty)',
		];
		if (Object.keys(context.scripts).length) {
			parts.push('', '## package.json scripts', JSON.stringify(context.scripts, null, 2));
		}
		if (context.dependencies.length) {
			parts.push('', '## Dependencies', context.dependencies.slice(0, 60).join(', '));
		}
		if (context.readme) {
			parts.push('', '## README (excerpt)', context.readme);
		}
		return parts.join('\n');
	}

	private _deterministicSummary(plan: IRunPlan, context: IProjectContext): string {
		const lines: string[] = [
			'# Project Overview', '',
			'_A quick structural summary. Configure Compyle Brain for a full AI explanation._', '',
			'## Detected',
			`- **Type:** ${plan.projectType}`,
			`- **Language:** ${plan.language}`,
		];
		if (plan.framework) { lines.push(`- **Framework:** ${plan.framework}`); }
		if (plan.runtime) { lines.push(`- **Runtime:** ${plan.runtime}`); }
		lines.push('', '## File structure', '```', context.tree || '(empty)', '```');
		if (Object.keys(context.scripts).length) {
			lines.push('', '## Scripts');
			for (const [name, cmd] of Object.entries(context.scripts)) {
				lines.push(`- **${name}:** \`${cmd}\``);
			}
		}
		const cmds = [plan.install, plan.dev, plan.build, plan.test].filter(Boolean);
		if (cmds.length) {
			lines.push('', '## How to run');
			for (const cmd of cmds) {
				lines.push(`- **${cmd!.label}:** \`${cmd!.command}\``);
			}
		}
		return lines.join('\n');
	}

	private async _openMarkdown(title: string, body: string): Promise<void> {
		await this._editorService.openEditor({
			resource: undefined,
			contents: `# ${title}\n\n${body}\n`,
			languageId: 'markdown',
		});
	}
}

registerSingleton(ICompyleExplainService, CompyleExplainService, InstantiationType.Delayed);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.explain.project',
			title: { value: localize('compyle.explain.project', "Explain My Project"), original: 'Explain My Project' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}
	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const explainService = accessor.get(ICompyleExplainService);

		const pick = await quickInputService.pick(
			[
				{ label: localize('compyle.explain.pick.overview', "Overview"), description: localize('compyle.explain.pick.overview.desc', "What it does, stack, structure"), id: 'overview' },
				{ label: localize('compyle.explain.pick.beginner', "Explain Like I'm New"), description: localize('compyle.explain.pick.beginner.desc', "Plain-language walkthrough"), id: 'beginner' },
				{ label: localize('compyle.explain.pick.architecture', "Architecture"), description: localize('compyle.explain.pick.architecture.desc', "Layers, data flow, key modules"), id: 'architecture' },
				{ label: localize('compyle.explain.pick.run', "How Do I Run This?"), description: localize('compyle.explain.pick.run.desc', "Install, run, build, test"), id: 'run' },
			],
			{ placeHolder: localize('compyle.explain.pickPlaceholder', "What would you like explained?") },
		);
		if (pick) {
			await explainService.explain(pick.id as ExplainDepth);
		}
	}
});
