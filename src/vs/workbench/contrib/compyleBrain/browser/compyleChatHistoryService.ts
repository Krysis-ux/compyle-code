/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

export const ICompyleChatHistoryService = createDecorator<ICompyleChatHistoryService>('compyleChatHistoryService');

export interface ICompyleStoredMessage {
	readonly role: 'user' | 'assistant';
	readonly content: string;
	readonly images?: readonly string[];
}

export interface ICompyleChatSessionMeta {
	readonly id: string;
	readonly title: string;
	readonly createdAt: number;
	readonly updatedAt: number;
}

export interface ICompyleChatSession extends ICompyleChatSessionMeta {
	/** Full model context (user inputs, assistant replies, tool results). */
	readonly context: ICompyleStoredMessage[];
	/** User-visible turns (real user inputs + assistant replies), for re-render. */
	readonly visible: ICompyleStoredMessage[];
}

export interface ICompyleChatHistoryService {
	readonly _serviceBrand: undefined;
	/** Saved sessions for the current workspace, newest first. */
	list(): ICompyleChatSessionMeta[];
	load(id: string): ICompyleChatSession | undefined;
	save(session: ICompyleChatSession): void;
	remove(id: string): void;
}

const STORAGE_KEY = 'compyle.brain.chatSessions';
const MAX_SESSIONS = 50;

export class CompyleChatHistoryService extends Disposable implements ICompyleChatHistoryService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
	}

	private _read(): ICompyleChatSession[] {
		const raw = this._storageService.get(STORAGE_KEY, StorageScope.WORKSPACE);
		if (!raw) {
			return [];
		}
		try {
			const parsed = JSON.parse(raw) as ICompyleChatSession[];
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	private _write(sessions: ICompyleChatSession[]): void {
		const trimmed = sessions
			.slice()
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, MAX_SESSIONS);
		this._storageService.store(STORAGE_KEY, JSON.stringify(trimmed), StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	list(): ICompyleChatSessionMeta[] {
		return this._read()
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map(s => ({ id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt }));
	}

	load(id: string): ICompyleChatSession | undefined {
		return this._read().find(s => s.id === id);
	}

	save(session: ICompyleChatSession): void {
		const sessions = this._read().filter(s => s.id !== session.id);
		sessions.push(session);
		this._write(sessions);
	}

	remove(id: string): void {
		this._write(this._read().filter(s => s.id !== id));
	}
}

registerSingleton(ICompyleChatHistoryService, CompyleChatHistoryService, InstantiationType.Delayed);
