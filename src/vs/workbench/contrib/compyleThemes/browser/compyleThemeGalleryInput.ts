/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorInputCapabilities, IUntypedEditorInput, IEditorSerializer } from '../../../common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';

export class CompyleThemeGalleryInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleThemeGallery';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'theme-gallery' });

	override get typeId(): string {
		return CompyleThemeGalleryInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleThemeGalleryInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleThemeGalleryInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleThemeGallery.title", "Theme Gallery");
	}

	override getIcon(): ThemeIcon {
		return Codicon.symbolColor;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleThemeGalleryInput.RESOURCE,
			options: {
				override: CompyleThemeGalleryInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleThemeGalleryInput;
	}
}

export class CompyleThemeGalleryInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleThemeGalleryInput {
		return instantiationService.createInstance(CompyleThemeGalleryInput);
	}
}
