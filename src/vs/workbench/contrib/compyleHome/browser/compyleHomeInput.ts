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

export class CompyleHomeInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleHome';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'home' });

	override get typeId(): string {
		return CompyleHomeInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleHomeInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleHomeInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleHome.title", "Compyle Home");
	}

	override getIcon(): ThemeIcon {
		return Codicon.home;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleHomeInput.RESOURCE,
			options: {
				override: CompyleHomeInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleHomeInput;
	}
}

export class CompyleHomeInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleHomeInput {
		return instantiationService.createInstance(CompyleHomeInput);
	}
}
