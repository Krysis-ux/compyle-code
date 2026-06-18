/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { COMPYLE_SKILLS_DEFAULT_DIR, COMPYLE_SKILLS_DIR_SETTING, ICompyleSkill, parseSkill, serializeSkill, skillFileSlug } from '../common/compyleSkills.js';

export interface ICompyleSkillFile {
	readonly uri: URI;
	readonly skill: ICompyleSkill;
}

export const ICompyleSkillService = createDecorator<ICompyleSkillService>('compyleSkillService');

export interface ICompyleSkillService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeSkills: Event<void>;

	/** Directory where skills live, or undefined when no folder is open. */
	skillsDir(): URI | undefined;
	listSkills(): Promise<ICompyleSkillFile[]>;
	readSkill(uri: URI): Promise<ICompyleSkill>;
	/** Write a skill. Returns the file URI. Renames when the name's slug changed. */
	saveSkill(skill: ICompyleSkill, existing?: URI): Promise<URI>;
	deleteSkill(uri: URI): Promise<void>;
}

export class CompyleSkillService extends Disposable implements ICompyleSkillService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeSkills = this._register(new Emitter<void>());
	readonly onDidChangeSkills = this._onDidChangeSkills.event;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
	) {
		super();
	}

	skillsDir(): URI | undefined {
		const root = this._contextService.getWorkspace().folders[0]?.uri;
		if (!root) {
			return undefined;
		}
		const rel = this._configurationService.getValue<string>(COMPYLE_SKILLS_DIR_SETTING) || COMPYLE_SKILLS_DEFAULT_DIR;
		return joinPath(root, rel);
	}

	async listSkills(): Promise<ICompyleSkillFile[]> {
		const dir = this.skillsDir();
		if (!dir || !(await this._fileService.exists(dir))) {
			return [];
		}
		const stat = await this._fileService.resolve(dir);
		const files = (stat.children ?? []).filter(c => !c.isDirectory && c.resource.path.endsWith('.md'));
		const result: ICompyleSkillFile[] = [];
		for (const file of files) {
			try {
				const skill = await this.readSkill(file.resource);
				result.push({ uri: file.resource, skill });
			} catch {
				// Skip unreadable files rather than failing the whole list.
			}
		}
		return result.sort((a, b) => (a.skill.name || '').localeCompare(b.skill.name || ''));
	}

	async readSkill(uri: URI): Promise<ICompyleSkill> {
		const content = (await this._fileService.readFile(uri)).value.toString();
		const skill = parseSkill(content);
		if (!skill.name) {
			// Fall back to the file name (without extension) when no name is set.
			skill.name = uri.path.split('/').pop()?.replace(/\.md$/, '') ?? 'skill';
		}
		return skill;
	}

	async saveSkill(skill: ICompyleSkill, existing?: URI): Promise<URI> {
		const dir = this.skillsDir();
		if (!dir) {
			throw new Error('Open a folder before saving a skill.');
		}
		const target = joinPath(dir, `${skillFileSlug(skill.name)}.md`);
		await this._fileService.writeFile(target, VSBuffer.fromString(serializeSkill(skill)));
		// If the slug changed, remove the old file so there are no duplicates.
		if (existing && existing.toString() !== target.toString() && await this._fileService.exists(existing)) {
			await this._fileService.del(existing);
		}
		this._onDidChangeSkills.fire();
		return target;
	}

	async deleteSkill(uri: URI): Promise<void> {
		if (await this._fileService.exists(uri)) {
			await this._fileService.del(uri);
		}
		this._onDidChangeSkills.fire();
	}
}

registerSingleton(ICompyleSkillService, CompyleSkillService, InstantiationType.Delayed);
