/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/compyleThemeGallery.css';
import { $, append, clearNode, addDisposableListener, getWindow, Dimension } from '../../../../base/browser/dom.js';
import { Color } from '../../../../base/common/color.js';
import { Delayer } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IExtensionResourceLoaderService } from '../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchColorTheme, IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { CompyleThemeGalleryInput } from './compyleThemeGalleryInput.js';

const FAVORITES_SETTING = 'compyle.themes.favorites';

/** Colors sampled from each theme to build its swatch palette. */
const SWATCH_COLOR_IDS = ['editor.background', 'sideBar.background', 'editor.foreground', 'focusBorder'];
const ACCENT_FALLBACKS = ['focusBorder', 'button.background', 'activityBarBadge.background', 'editorCursor.foreground'];

interface IGalleryFilter {
	readonly id: string;
	readonly label: string;
	readonly match: (theme: IWorkbenchColorTheme, favorites: Set<string>) => boolean;
}

const FILTERS: IGalleryFilter[] = [
	{ id: 'all', label: localize("compyleThemeGallery.filter.all", "All"), match: () => true },
	{ id: 'favorites', label: localize("compyleThemeGallery.filter.favorites", "Favorites"), match: (t, favs) => favs.has(t.settingsId) },
	{ id: 'dark', label: localize("compyleThemeGallery.filter.dark", "Dark"), match: t => t.type === ColorScheme.DARK },
	{ id: 'light', label: localize("compyleThemeGallery.filter.light", "Light"), match: t => t.type === ColorScheme.LIGHT },
	{ id: 'hc', label: localize("compyleThemeGallery.filter.hc", "High Contrast"), match: t => t.type === ColorScheme.HIGH_CONTRAST_DARK || t.type === ColorScheme.HIGH_CONTRAST_LIGHT },
];

export class CompyleThemeGalleryEditor extends EditorPane {

	static readonly ID = 'compyleThemeGallery';

	private _list!: HTMLElement;
	private _countLabel!: HTMLElement;
	private _searchInput!: HTMLInputElement;

	private readonly _rowDisposables = this._register(new DisposableStore());
	private readonly _swatchCache = new Map<string, string[]>();
	private readonly _previewDelayer = this._register(new Delayer<void>(70));

	private _themes: IWorkbenchColorTheme[] = [];
	private _activeFilter = 'all';
	private _searchTerm = '';
	private _previousThemeId: string | undefined;
	private _baselineThemeId: string | undefined;
	private _committed = false;
	private _intersectionObserver: IntersectionObserver | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchThemeService private readonly _workbenchThemeService: IWorkbenchThemeService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IExtensionResourceLoaderService private readonly _extensionResourceLoaderService: IExtensionResourceLoaderService,
	) {
		super(CompyleThemeGalleryEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.tg-root'));

		const header = append(root, $('.tg-header'));
		const headerInner = append(header, $('.tg-header-inner'));

		const titleRow = append(headerInner, $('.tg-title-row'));
		append(titleRow, $('h1.tg-title', undefined, localize("compyleThemeGallery.heading", "Theme Gallery")));
		this._countLabel = append(titleRow, $('span.tg-count'));

		const searchWrap = append(headerInner, $('.tg-search-wrap'));
		append(searchWrap, $('span.tg-search-icon.codicon.codicon-search'));
		this._searchInput = append(searchWrap, $('input.tg-search')) as HTMLInputElement;
		this._searchInput.type = 'text';
		this._searchInput.placeholder = localize("compyleThemeGallery.searchPlaceholder", "Search themes…");
		this._register(addDisposableListener(this._searchInput, 'input', () => {
			this._searchTerm = this._searchInput.value.trim().toLowerCase();
			this._renderRows();
		}));

		const tabs = append(headerInner, $('.tg-tabs'));
		for (const filter of FILTERS) {
			const tab = append(tabs, $('.tg-tab', { 'data-filter': filter.id }, filter.label));
			if (filter.id === this._activeFilter) {
				tab.classList.add('active');
			}
			this._register(addDisposableListener(tab, 'click', () => this._setFilter(filter.id, tabs)));
		}

		const scroll = append(root, $('.tg-scroll'));
		this._list = append(scroll, $('.tg-list'));

		// Reverting a hover-preview when the pointer leaves the whole list.
		this._register(addDisposableListener(this._list, 'mouseleave', () => this._cancelPreview()));
	}

	override async setInput(input: CompyleThemeGalleryInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		this._committed = false;
		this._previousThemeId = this._workbenchThemeService.getColorTheme().settingsId;
		this._baselineThemeId = this._previousThemeId;
		this._themes = await this._workbenchThemeService.getColorThemes();
		if (token.isCancellationRequested) {
			return;
		}
		this._renderRows();
	}

	private _setFilter(id: string, tabsContainer: HTMLElement): void {
		this._activeFilter = id;
		for (const tab of tabsContainer.children) {
			tab.classList.toggle('active', tab.getAttribute('data-filter') === id);
		}
		this._renderRows();
	}

	private _getFavorites(): Set<string> {
		return new Set(this._configurationService.getValue<string[]>(FAVORITES_SETTING) ?? []);
	}

	private _visibleThemes(favorites: Set<string>): IWorkbenchColorTheme[] {
		const filter = FILTERS.find(f => f.id === this._activeFilter) ?? FILTERS[0];
		return this._themes.filter(theme => {
			if (!filter.match(theme, favorites)) {
				return false;
			}
			if (this._searchTerm && !theme.label.toLowerCase().includes(this._searchTerm)) {
				return false;
			}
			return true;
		});
	}

	private _renderRows(): void {
		if (!this._list) {
			return;
		}
		this._rowDisposables.clear();
		this._disposeObserver();
		clearNode(this._list);

		const favorites = this._getFavorites();
		const themes = this._visibleThemes(favorites);
		const activeId = this._workbenchThemeService.getColorTheme().settingsId;

		this._countLabel.textContent = localize("compyleThemeGallery.count", "{0} themes", themes.length);

		if (themes.length === 0) {
			append(this._list, $('.tg-empty', undefined, localize("compyleThemeGallery.empty", "No themes match your search.")));
			return;
		}

		const targetWindow = getWindow(this._list);
		this._intersectionObserver = new targetWindow.IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					const row = entry.target as HTMLElement;
					this._intersectionObserver?.unobserve(row);
					const theme = themes.find(t => t.id === row.getAttribute('data-theme-id'));
					if (theme) {
						void this._fillSwatches(row, theme);
					}
				}
			}
		}, { rootMargin: '300px' });

		for (const theme of themes) {
			this._renderRow(theme, favorites, activeId);
		}
	}

	private _renderRow(theme: IWorkbenchColorTheme, favorites: Set<string>, activeId: string): void {
		const row = append(this._list, $('.tg-row', { 'data-theme-id': theme.id }));
		if (theme.settingsId === activeId) {
			row.classList.add('active');
		}

		const left = append(row, $('.tg-row-left'));
		append(left, $('span.tg-check.codicon.codicon-check'));
		append(left, $('span.tg-name', { title: theme.label }, theme.label));

		const right = append(row, $('.tg-row-right'));
		const favButton = append(right, $('span.tg-fav.codicon')) as HTMLElement;
		favButton.classList.add(favorites.has(theme.settingsId) ? 'codicon-star-full' : 'codicon-star-empty');
		if (favorites.has(theme.settingsId)) {
			favButton.classList.add('on');
		}
		const swatches = append(right, $('.tg-swatches'));
		for (let i = 0; i < SWATCH_COLOR_IDS.length; i++) {
			append(swatches, $('span.tg-dot'));
		}

		this._rowDisposables.add(addDisposableListener(row, 'mouseenter', () => this._queuePreview(theme)));
		this._rowDisposables.add(addDisposableListener(row, 'click', () => this._applyTheme(theme)));
		this._rowDisposables.add(addDisposableListener(favButton, 'click', e => {
			e.stopPropagation();
			void this._toggleFavorite(theme, favButton);
		}));

		this._intersectionObserver?.observe(row);

		// Paint immediately if colors are already cached.
		const cached = this._swatchCache.get(theme.id);
		if (cached) {
			this._paintSwatches(row, cached);
		}
	}

	private async _fillSwatches(row: HTMLElement, theme: IWorkbenchColorTheme): Promise<void> {
		const colors = await this._resolveSwatchColors(theme);
		this._paintSwatches(row, colors);
	}

	private _paintSwatches(row: HTMLElement, colors: string[]): void {
		const dots = row.querySelectorAll<HTMLElement>('.tg-dot');
		dots.forEach((dot, i) => {
			if (colors[i]) {
				dot.style.background = colors[i];
			}
		});
	}

	private async _resolveSwatchColors(theme: IWorkbenchColorTheme): Promise<string[]> {
		const cached = this._swatchCache.get(theme.id);
		if (cached) {
			return cached;
		}

		// ensureLoaded lives on ColorThemeData but not on the interface — call structurally.
		const loadable = theme as unknown as { ensureLoaded?: (svc: IExtensionResourceLoaderService) => Promise<void> };
		if (typeof loadable.ensureLoaded === 'function') {
			try {
				await loadable.ensureLoaded(this._extensionResourceLoaderService);
			} catch {
				// Fall through — getColor with defaults still yields something usable.
			}
		}

		const format = (id: string): string | undefined => {
			const color = theme.getColor(id, true);
			return color ? Color.Format.CSS.formatHexA(color) : undefined;
		};

		const colors = SWATCH_COLOR_IDS.map((id, index) => {
			let value = format(id);
			if (!value && id === 'focusBorder') {
				for (const fallback of ACCENT_FALLBACKS) {
					value = format(fallback);
					if (value) { break; }
				}
			}
			return value ?? (index === 0 ? '#1e1e1e' : '#888888');
		});

		this._swatchCache.set(theme.id, colors);
		return colors;
	}

	private _queuePreview(theme: IWorkbenchColorTheme): void {
		this._previewDelayer.trigger(async () => {
			await this._workbenchThemeService.setColorTheme(theme.id, 'preview');
		});
	}

	private _cancelPreview(): void {
		this._previewDelayer.cancel();
		if (this._baselineThemeId && this._baselineThemeId !== this._workbenchThemeService.getColorTheme().settingsId) {
			void this._workbenchThemeService.setColorTheme(this._baselineThemeId, 'preview');
		}
	}

	private async _applyTheme(theme: IWorkbenchColorTheme): Promise<void> {
		this._previewDelayer.cancel();
		this._committed = true;
		this._baselineThemeId = theme.settingsId;
		await this._workbenchThemeService.setColorTheme(theme.id, 'auto');
		for (const row of this._list.children) {
			row.classList.toggle('active', row.getAttribute('data-theme-id') === theme.id);
		}
	}

	private async _toggleFavorite(theme: IWorkbenchColorTheme, button: HTMLElement): Promise<void> {
		const favorites = this._getFavorites();
		const isFav = favorites.has(theme.settingsId);
		if (isFav) {
			favorites.delete(theme.settingsId);
		} else {
			favorites.add(theme.settingsId);
		}
		await this._configurationService.updateValue(FAVORITES_SETTING, Array.from(favorites));

		button.classList.toggle('on', !isFav);
		button.classList.toggle('codicon-star-full', !isFav);
		button.classList.toggle('codicon-star-empty', isFav);

		if (this._activeFilter === 'favorites') {
			this._renderRows();
		}
	}

	override clearInput(): void {
		this._restorePreviousTheme();
		super.clearInput();
	}

	private _restorePreviousTheme(): void {
		this._previewDelayer.cancel();
		if (!this._committed && this._previousThemeId && this._previousThemeId !== this._workbenchThemeService.getColorTheme().settingsId) {
			void this._workbenchThemeService.setColorTheme(this._previousThemeId, 'preview');
		}
	}

	private _disposeObserver(): void {
		this._intersectionObserver?.disconnect();
		this._intersectionObserver = undefined;
	}

	layout(_dimension: Dimension): void {
		// CSS handles responsive layout.
	}

	override dispose(): void {
		this._restorePreviousTheme();
		this._disposeObserver();
		super.dispose();
	}
}
