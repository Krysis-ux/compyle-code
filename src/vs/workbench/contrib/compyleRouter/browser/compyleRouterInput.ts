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

export class CompyleRouterInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleRouter';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'router' });

	override get typeId(): string {
		return CompyleRouterInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleRouterInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleRouterInput.RESOURCE;
	}

	override getName(): string {
		return localize('compyleRouter.title', "Compyle Router");
	}

	override getIcon(): ThemeIcon {
		return Codicon.gitMerge;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleRouterInput.RESOURCE,
			options: { override: CompyleRouterInput.ID, pinned: false },
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleRouterInput;
	}
}

export class CompyleRouterInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleRouterInput {
		return instantiationService.createInstance(CompyleRouterInput);
	}
}
