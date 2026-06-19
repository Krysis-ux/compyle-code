/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

export const ICompyleMemoryService = createDecorator<ICompyleMemoryService>('compyleMemoryService');

export interface ICompyleMemoryService {
	readonly _serviceBrand: undefined;
	/** Read the long-term memory file, or '' when it does not exist / no workspace. */
	read(): Promise<string>;
	/** Append a timestamped fact to the long-term memory file, creating it if needed. */
	append(fact: string): Promise<void>;
}

const MEMORY_RELATIVE_PATH = '.compyle/MEMORY.md';
const MEMORY_HEADER = [
	'# Compyle Long-Term Memory',
	'',
	'Facts and lessons Compyle AI should remember across chats. Each bullet is injected as context.',
	'',
].join('\n');

export class CompyleMemoryService extends Disposable implements ICompyleMemoryService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
	) {
		super();
	}

	private _uri(): URI | undefined {
		const root = this._contextService.getWorkspace().folders[0]?.uri;
		return root ? joinPath(root, MEMORY_RELATIVE_PATH) : undefined;
	}

	async read(): Promise<string> {
		const uri = this._uri();
		if (!uri) {
			return '';
		}
		try {
			if (!(await this._fileService.exists(uri))) {
				return '';
			}
			return (await this._fileService.readFile(uri)).value.toString();
		} catch {
			return '';
		}
	}

	async append(fact: string): Promise<void> {
		const uri = this._uri();
		if (!uri) {
			return;
		}
		const trimmed = fact.trim().replace(/\s+/g, ' ');
		if (!trimmed) {
			return;
		}
		const existing = (await this.read()) || MEMORY_HEADER;
		const date = new Date().toISOString().slice(0, 10);
		const next = `${existing.replace(/\s*$/, '')}\n- [${date}] ${trimmed}\n`;
		await this._fileService.writeFile(uri, VSBuffer.fromString(next));
	}
}

registerSingleton(ICompyleMemoryService, CompyleMemoryService, InstantiationType.Delayed);
