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

export class CompyleTransformInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleTransform';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'transform-center' });

	override get typeId(): string {
		return CompyleTransformInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleTransformInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleTransformInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleTransform.title", "Transform Center");
	}

	override getIcon(): ThemeIcon {
		return Codicon.arrowSwap;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleTransformInput.RESOURCE,
			options: {
				override: CompyleTransformInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleTransformInput;
	}
}

export class CompyleTransformInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleTransformInput {
		return instantiationService.createInstance(CompyleTransformInput);
	}
}
