/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import {
	COMPYLE_ROUTER_CUSTOM_PATH_SETTING,
	COMPYLE_ROUTER_LOG_SETTING,
	COMPYLE_ROUTER_MODE_SETTING,
	COMPYLE_ROUTER_QUALITY_GATE_SETTING,
	CompyleRouterMode,
	dedupeRouterRules,
	ICompyleQualityFinding,
	ICompyleRouterConfig,
	ICompyleRouterRule,
	ICompyleRoutingDecision,
	matchCustomRule,
	matchDefaultRoute,
	parseRouterRulesJsonl,
	scanQuality,
	serializeRouterRulesJsonl,
} from '../common/compyleRouter.js';

export const ICompyleRouterService = createDecorator<ICompyleRouterService>('compyleRouterService');

export interface ICompyleRoutingLogEntry {
	readonly timestamp: number;
	readonly mode: CompyleRouterMode;
	readonly label: string;
	readonly findings: number;
}

export interface ICompyleRouterReview {
	readonly findings: readonly ICompyleQualityFinding[];
}

export interface ICompyleRouterService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeLog: Event<void>;

	getMode(): CompyleRouterMode;
	/** Decide the route for a request. Returns an empty prefix in 'none' mode. */
	route(promptText: string): ICompyleRoutingDecision;
	/** Run the quality gate over model output. Returns findings (empty if gate off). */
	review(output: string): ICompyleRouterReview;
	/** Record a routing decision for the log viewer. */
	log(decision: ICompyleRoutingDecision, findings: number): void;
	getLog(): readonly ICompyleRoutingLogEntry[];
	clearLog(): void;
	/** Return the currently loaded custom rule config (empty when no file configured). */
	getCustomConfig(): ICompyleRouterConfig;
	/** Persist new custom rules to the configured JSON file. Creates it if missing. */
	saveCustomConfig(config: ICompyleRouterConfig): Promise<void>;

	/** List saved training routers (file names without extension) under .compyle/routers/. */
	listRouters(): Promise<string[]>;
	/** Read a training router's rules (deduped). Empty when it does not exist. */
	getRouter(name: string): Promise<ICompyleRouterConfig>;
	/** Create an empty training router file if it does not already exist. */
	createRouter(name: string): Promise<void>;
	/** Append a rule to a training router, merging by keyword-set to keep it compact. */
	appendRule(name: string, rule: ICompyleRouterRule): Promise<void>;
}

const LOG_LIMIT = 20;

export class CompyleRouterService extends Disposable implements ICompyleRouterService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeLog = this._register(new Emitter<void>());
	readonly onDidChangeLog = this._onDidChangeLog.event;

	private _customConfig: ICompyleRouterConfig = { rules: [] };
	private _log: ICompyleRoutingLogEntry[] = [];

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
	) {
		super();
		void this._loadCustomConfig();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(COMPYLE_ROUTER_CUSTOM_PATH_SETTING) || e.affectsConfiguration(COMPYLE_ROUTER_MODE_SETTING)) {
				void this._loadCustomConfig();
			}
		}));
	}

	getMode(): CompyleRouterMode {
		const raw = this._configurationService.getValue<string>(COMPYLE_ROUTER_MODE_SETTING);
		return raw === 'none' || raw === 'custom' ? raw : 'default';
	}

	route(promptText: string): ICompyleRoutingDecision {
		switch (this.getMode()) {
			case 'none':
				return { label: 'Off', systemPrefix: '' };
			case 'custom':
				return matchCustomRule(promptText, this._customConfig);
			default:
				return matchDefaultRoute(promptText);
		}
	}

	review(output: string): ICompyleRouterReview {
		if (this.getMode() === 'none' || this._configurationService.getValue<boolean>(COMPYLE_ROUTER_QUALITY_GATE_SETTING) === false) {
			return { findings: [] };
		}
		return { findings: scanQuality(output) };
	}

	log(decision: ICompyleRoutingDecision, findings: number): void {
		if (this._configurationService.getValue<boolean>(COMPYLE_ROUTER_LOG_SETTING) !== true) {
			return;
		}
		this._log.unshift({ timestamp: Date.now(), mode: this.getMode(), label: decision.label, findings });
		if (this._log.length > LOG_LIMIT) {
			this._log.length = LOG_LIMIT;
		}
		this._onDidChangeLog.fire();
	}

	getLog(): readonly ICompyleRoutingLogEntry[] {
		return this._log;
	}

	clearLog(): void {
		this._log = [];
		this._onDidChangeLog.fire();
	}

	private _resolveConfigPath(): URI | undefined {
		const raw = this._configurationService.getValue<string>(COMPYLE_ROUTER_CUSTOM_PATH_SETTING);
		if (!raw) {
			return undefined;
		}
		// Absolute (posix or windows) → use as a file URI; otherwise resolve against the workspace.
		if (/^(?:[a-zA-Z]:[\\/]|\/)/.test(raw)) {
			return URI.file(raw);
		}
		const root = this._contextService.getWorkspace().folders[0]?.uri;
		return root ? joinPath(root, raw) : undefined;
	}

	getCustomConfig(): ICompyleRouterConfig {
		return this._customConfig;
	}

	async saveCustomConfig(config: ICompyleRouterConfig): Promise<void> {
		let uri = this._resolveConfigPath();
		if (!uri) {
			// No path configured — save to workspace root as compyle-router.json
			const root = this._contextService.getWorkspace().folders[0]?.uri;
			if (!root) {
				return;
			}
			uri = joinPath(root, 'compyle-router.json');
			await this._configurationService.updateValue(COMPYLE_ROUTER_CUSTOM_PATH_SETTING, 'compyle-router.json');
		}
		const json = JSON.stringify(config, undefined, '\t');
		await this._fileService.writeFile(uri, VSBuffer.fromString(json));
		this._customConfig = config;
	}

	// ---- Training routers (.compyle/routers/<name>.jsonl) -----------------

	private _routersDir(): URI | undefined {
		const root = this._contextService.getWorkspace().folders[0]?.uri;
		return root ? joinPath(root, '.compyle', 'routers') : undefined;
	}

	private _routerUri(name: string): URI | undefined {
		const dir = this._routersDir();
		const safe = name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'router';
		return dir ? joinPath(dir, `${safe}.jsonl`) : undefined;
	}

	async listRouters(): Promise<string[]> {
		const dir = this._routersDir();
		if (!dir) {
			return [];
		}
		try {
			if (!(await this._fileService.exists(dir))) {
				return [];
			}
			const stat = await this._fileService.resolve(dir);
			return (stat.children ?? [])
				.filter(c => !c.isDirectory && c.name.endsWith('.jsonl'))
				.map(c => c.name.replace(/\.jsonl$/, ''));
		} catch {
			return [];
		}
	}

	async getRouter(name: string): Promise<ICompyleRouterConfig> {
		const uri = this._routerUri(name);
		if (!uri) {
			return { rules: [] };
		}
		try {
			if (!(await this._fileService.exists(uri))) {
				return { rules: [] };
			}
			const raw = (await this._fileService.readFile(uri)).value.toString();
			return { rules: dedupeRouterRules(parseRouterRulesJsonl(raw)) };
		} catch {
			return { rules: [] };
		}
	}

	async createRouter(name: string): Promise<void> {
		const uri = this._routerUri(name);
		if (!uri) {
			return;
		}
		if (!(await this._fileService.exists(uri))) {
			await this._fileService.writeFile(uri, VSBuffer.fromString(''));
		}
	}

	async appendRule(name: string, rule: ICompyleRouterRule): Promise<void> {
		const uri = this._routerUri(name);
		if (!uri) {
			return;
		}
		const current = await this.getRouter(name);
		const merged = dedupeRouterRules([...current.rules, rule]);
		await this._fileService.writeFile(uri, VSBuffer.fromString(serializeRouterRulesJsonl(merged)));
	}

	private async _loadCustomConfig(): Promise<void> {
		const uri = this._resolveConfigPath();
		if (!uri) {
			this._customConfig = { rules: [] };
			return;
		}
		try {
			if (!(await this._fileService.exists(uri))) {
				this._customConfig = { rules: [] };
				return;
			}
			const raw = (await this._fileService.readFile(uri)).value.toString();
			const parsed = JSON.parse(raw) as ICompyleRouterConfig;
			this._customConfig = { rules: Array.isArray(parsed?.rules) ? parsed.rules : [] };
		} catch {
			// Invalid JSON or read error: fall back to no rules rather than throwing.
			this._customConfig = { rules: [] };
		}
	}
}

registerSingleton(ICompyleRouterService, CompyleRouterService, InstantiationType.Delayed);
