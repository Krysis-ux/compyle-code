/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Emitter } from '../../../base/common/event.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { ConfigurationTarget, IConfigurationChangeEvent, IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { Parts } from '../../services/layout/browser/layoutService.js';
import { CompyleModeService } from '../../contrib/compyleModes/browser/compyleModeService.js';

/** Minimal config service that stores values and fires change events on updateValue. */
class ReactiveConfigService {
	declare readonly _serviceBrand: undefined;

	private readonly _store: Record<string, unknown>;
	private readonly _onDidChange = new Emitter<IConfigurationChangeEvent>();
	readonly onDidChangeConfiguration = this._onDidChange.event;

	constructor(initial: Record<string, unknown>) {
		this._store = { ...initial };
	}

	getValue<T>(key?: string): T | undefined {
		if (!key) { return this._store as unknown as T; }
		return (Object.prototype.hasOwnProperty.call(this._store, key) ? this._store[key] : undefined) as T;
	}

	async updateValue(key: string, value: unknown): Promise<void> {
		this._store[key] = value;
		const event: IConfigurationChangeEvent = {
			source: ConfigurationTarget.USER,
			affectedKeys: new Set([key]),
			change: { keys: [key], overrides: [] },
			affectsConfiguration: (k: string) => k === key,
		};
		this._onDidChange.fire(event);
	}

	// Stubs required by IConfigurationService
	inspect = (): any => ({ value: undefined });
	keys = (): any => ({ default: [], user: [], workspace: [], workspaceFolder: [], policy: [] });
	reloadConfiguration = (): any => Promise.resolve();
	onDidChangeConfigurationEmitter = this._onDidChange;
}

function makeConfig(overrides: Record<string, unknown> = {}): ReactiveConfigService {
	return new ReactiveConfigService({
		'compyle.modes.activeMode': 'none',
		'compyle.modes.focus.hideSidePanels': true,
		'compyle.modes.focus.reduceMotion': true,
		...overrides,
	});
}

function makeLayoutService(): { service: any; hiddenParts: Set<Parts>; container: HTMLElement } {
	const hiddenParts = new Set<Parts>();
	const container = document.createElement('div');
	const service = {
		setPartHidden: (hidden: boolean, part: Parts) => {
			if (hidden) { hiddenParts.add(part); } else { hiddenParts.delete(part); }
		},
		isVisible: (part: Parts) => !hiddenParts.has(part),
		mainContainer: container,
	};
	return { service, hiddenParts, container };
}

suite('CompyleModeService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function make(configOverrides: Record<string, unknown> = {}): {
		svc: CompyleModeService;
		config: ReactiveConfigService;
		hiddenParts: Set<Parts>;
		container: HTMLElement;
	} {
		const config = makeConfig(configOverrides);
		const { service: layout, hiddenParts, container } = makeLayoutService();
		const svc = new CompyleModeService(
			config as unknown as IConfigurationService,
			layout,
		);
		store.add(svc);
		return { svc, config, hiddenParts, container };
	}

	test('getActiveMode returns none by default', () => {
		const { svc } = make();
		assert.strictEqual(svc.getActiveMode(), 'none');
	});

	test('switchMode updates active mode', async () => {
		const { svc } = make();
		await svc.switchMode('focus');
		assert.strictEqual(svc.getActiveMode(), 'focus');
	});

	test('switching to focus hides sidebar and panel', async () => {
		const { svc, hiddenParts } = make();
		await svc.switchMode('focus');
		assert.ok(hiddenParts.has(Parts.SIDEBAR_PART), 'sidebar hidden in focus');
		assert.ok(hiddenParts.has(Parts.PANEL_PART), 'panel hidden in focus');
	});

	test('switching out of focus restores sidebar and panel', async () => {
		const { svc, hiddenParts } = make();
		await svc.switchMode('focus');
		await svc.switchMode('flow');
		assert.ok(!hiddenParts.has(Parts.SIDEBAR_PART), 'sidebar restored after leaving focus');
		assert.ok(!hiddenParts.has(Parts.PANEL_PART), 'panel restored after leaving focus');
	});

	test('switching to focus adds reduce-motion class', async () => {
		const { svc, container } = make();
		await svc.switchMode('focus');
		assert.ok(container.classList.contains('compyle-reduce-motion'));
	});

	test('switching out of focus removes reduce-motion class', async () => {
		const { svc, container } = make();
		await svc.switchMode('focus');
		await svc.switchMode('none');
		assert.ok(!container.classList.contains('compyle-reduce-motion'));
	});

	test('onDidChangeMode fires with new mode id', async () => {
		const { svc } = make();
		const fired: string[] = [];
		store.add(svc.onDidChangeMode(id => fired.push(id)));
		await svc.switchMode('focus');
		await svc.switchMode('tutor');
		assert.deepStrictEqual(fired, ['focus', 'tutor']);
	});

	test('focus does not hide panels when hideSidePanels is false', async () => {
		const { svc, hiddenParts } = make({ 'compyle.modes.focus.hideSidePanels': false });
		await svc.switchMode('focus');
		assert.ok(!hiddenParts.has(Parts.SIDEBAR_PART), 'sidebar not hidden when hideSidePanels=false');
	});

	test('does not restore panels that were already hidden before focus', async () => {
		const { service: layout, hiddenParts } = makeLayoutService();
		// Sidebar already hidden before we switch to focus
		hiddenParts.add(Parts.SIDEBAR_PART);
		const config = makeConfig();
		const disposables = new DisposableStore();
		store.add(disposables);
		const svc = disposables.add(new CompyleModeService(
			config as unknown as IConfigurationService,
			layout,
		));
		await svc.switchMode('focus');
		await svc.switchMode('none');
		// Sidebar was hidden before focus; it must stay hidden after leaving focus
		assert.ok(hiddenParts.has(Parts.SIDEBAR_PART), 'pre-hidden sidebar stays hidden');
	});
});
