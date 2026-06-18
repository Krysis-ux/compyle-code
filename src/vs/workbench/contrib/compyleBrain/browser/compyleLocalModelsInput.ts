/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorInputCapabilities, IEditorSerializer, IUntypedEditorInput } from '../../../common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';

export class CompyleLocalModelsInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleLocalModels';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'local-models' });

	override get typeId(): string {
		return CompyleLocalModelsInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleLocalModelsInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleLocalModelsInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleLocalModels.title", "Local Models");
	}

	override getIcon(): ThemeIcon {
		return Codicon.serverProcess;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleLocalModelsInput.RESOURCE,
			options: {
				override: CompyleLocalModelsInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleLocalModelsInput;
	}
}

export class CompyleLocalModelsInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleLocalModelsInput {
		return instantiationService.createInstance(CompyleLocalModelsInput);
	}
}
