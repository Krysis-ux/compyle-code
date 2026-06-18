/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { CompyleChatInput } from './compyleChatInput.js';
import { CompyleChatWidget } from './compyleChatWidget.js';

/**
 * Full-tab host for the Compyle AI chat. The auxiliary-bar view is the primary
 * surface (see {@link CompyleChatViewPane}); this editor exists so the chat can
 * also be opened as a normal editor tab. Both share {@link CompyleChatWidget}.
 */
export class CompyleChatEditor extends EditorPane {

	static readonly ID = 'workbench.editors.compyleChat';

	private _widget: CompyleChatWidget | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super(CompyleChatEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		const container = append(parent, $('.cpc-host'));
		this._widget = this._register(this._instantiationService.createInstance(CompyleChatWidget));
		this._widget.render(container);
	}

	override async setInput(input: CompyleChatInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		await this._widget?.show();
	}

	override focus(): void {
		super.focus();
		this._widget?.focusInput();
	}

	layout(_dimension: Dimension): void {
		// CSS handles layout.
	}
}
