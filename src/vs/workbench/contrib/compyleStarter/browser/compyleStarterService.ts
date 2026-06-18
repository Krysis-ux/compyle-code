/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { ensureFlowMemoryForRoot, recordFlowActionForRoot } from '../../compyleModes/browser/compyleFlowMemory.js';
import { IProjectAddOn, IProjectTemplate } from '../common/compyleTemplates.js';

export const ICompyleStarterService = createDecorator<ICompyleStarterService>('compyleStarterService');

export interface ICompyleStarterService {
	readonly _serviceBrand: undefined;
	/** Walk the user through scaffolding a template into a new folder and open it. */
	createProject(template: IProjectTemplate, addOns?: readonly IProjectAddOn[]): Promise<void>;
}

export class CompyleStarterService implements ICompyleStarterService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IHostService private readonly _hostService: IHostService,
	) { }

	async createProject(template: IProjectTemplate, addOns: readonly IProjectAddOn[] = []): Promise<void> {
		const defaultParent = await this._fileDialogService.defaultFolderPath();
		const picked = await this._fileDialogService.showOpenDialog({
			title: localize('compyleStarter.pickFolder', "Choose where to create your project"),
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			defaultUri: defaultParent,
			openLabel: localize('compyleStarter.selectParent', "Select Parent Folder"),
		});
		if (!picked || picked.length === 0) {
			return;
		}
		const parent = picked[0];

		const name = await this._quickInputService.input({
			title: localize('compyleStarter.projectName', "Project Name"),
			value: template.id,
			prompt: localize('compyleStarter.projectNamePrompt', "Folder name for your new {0} project", template.name),
			validateInput: async value => (value && /^[\w.-]+$/.test(value)) ? undefined : localize('compyleStarter.invalidName', "Use letters, numbers, dashes, dots, or underscores."),
		});
		if (!name) {
			return;
		}

		const target = URI.joinPath(parent, name);
		if (await this._fileService.exists(target)) {
			this._notificationService.notify({ severity: Severity.Error, message: localize('compyleStarter.exists', "A folder named \"{0}\" already exists here. Choose a different name.", name) });
			return;
		}

		try {
			for (const file of this._materializeFiles(template, addOns, name)) {
				await this._fileService.writeFile(URI.joinPath(target, file.path), VSBuffer.fromString(file.content));
			}
			await ensureFlowMemoryForRoot(this._fileService, target, name, {
				projectKind: template.kind,
				stack: template.stack,
				runInstructions: template.runInstructions,
				addOns: addOns.map(addOn => addOn.name),
				source: 'Create Project',
			});
			await recordFlowActionForRoot(this._fileService, target, name, {
				title: 'Created Project',
				detail: `${template.name} scaffolded with ${addOns.length ? addOns.map(addOn => addOn.name).join(', ') : 'no optional add-ons'}.`,
				status: 'created',
				files: ['.compyle/PROJECT_MEMORY.md', 'README.md'],
			});
		} catch (error) {
			this._notificationService.notify({ severity: Severity.Error, message: localize('compyleStarter.writeFailed', "Could not create the project: {0}", error instanceof Error ? error.message : String(error)) });
			return;
		}

		this._notificationService.prompt(
			Severity.Info,
			localize('compyleStarter.created', "Created {0}. {1}", template.name, template.runInstructions),
			[
				{ label: localize('compyleStarter.openHere', "Open Project"), run: () => this._hostService.openWindow([{ folderUri: target }], { forceNewWindow: false }) },
				{ label: localize('compyleStarter.openNewWindow', "Open in New Window"), run: () => this._hostService.openWindow([{ folderUri: target }], { forceNewWindow: true }) },
			],
		);
	}

	private _materializeFiles(template: IProjectTemplate, addOns: readonly IProjectAddOn[], projectName: string): Array<{ path: string; content: string }> {
		const files = new Map<string, string>();
		for (const file of template.files) {
			files.set(file.path, file.content.split(template.id).join(projectName));
		}

		const dependencies: Record<string, string> = {};
		const devDependencies: Record<string, string> = {};
		const scripts: Record<string, string> = {};
		const requirements: string[] = [];
		const selectedNames: string[] = [];

		for (const addOn of addOns) {
			selectedNames.push(addOn.name);
			Object.assign(dependencies, addOn.dependencies);
			Object.assign(devDependencies, addOn.devDependencies);
			Object.assign(scripts, addOn.scripts);
			if (addOn.pythonRequirements) {
				requirements.push(...addOn.pythonRequirements);
			}
			for (const file of addOn.files ?? []) {
				if (!files.has(file.path)) {
					files.set(file.path, file.content);
				}
			}
		}

		if (dependencies || devDependencies || scripts) {
			this._mergePackageJson(files, dependencies, devDependencies, scripts);
		}
		if (requirements.length) {
			this._mergeRequirements(files, requirements);
		}
		this._appendReadme(files, template, selectedNames);

		return Array.from(files, ([path, content]) => ({ path, content }));
	}

	private _mergePackageJson(files: Map<string, string>, dependencies: Record<string, string>, devDependencies: Record<string, string>, scripts: Record<string, string>): void {
		const current = files.get('package.json');
		if (!current) {
			return;
		}
		const parsed = JSON.parse(current) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			scripts?: Record<string, string>;
		};
		parsed.dependencies = { ...(parsed.dependencies ?? {}), ...dependencies };
		parsed.devDependencies = { ...(parsed.devDependencies ?? {}), ...devDependencies };
		parsed.scripts = { ...(parsed.scripts ?? {}), ...scripts };
		files.set('package.json', `${JSON.stringify(parsed, null, 2)}\n`);
	}

	private _mergeRequirements(files: Map<string, string>, requirements: readonly string[]): void {
		const current = files.get('requirements.txt') ?? '';
		const lines = new Set(current.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
		for (const requirement of requirements) {
			lines.add(requirement);
		}
		files.set('requirements.txt', `${Array.from(lines).join('\n')}\n`);
	}

	private _appendReadme(files: Map<string, string>, template: IProjectTemplate, selectedNames: readonly string[]): void {
		const current = files.get('README.md') ?? `# ${template.name}\n`;
		const tools = selectedNames.length ? selectedNames.join(', ') : 'None';
		files.set('README.md', `${current.trimEnd()}\n\n## Compyle Setup\n\n- Project kind: ${template.kind}\n- Launch profile: ${template.launchProfile}\n- Selected tools: ${tools}\n- Install commands are not run automatically. Review the files, then install dependencies when ready.\n`);
	}
}

registerSingleton(ICompyleStarterService, CompyleStarterService, InstantiationType.Delayed);
