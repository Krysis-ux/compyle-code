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

export class CompyleChatInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleChat';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'chat' });

	override get typeId(): string {
		return CompyleChatInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleChatInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleChatInput.RESOURCE;
	}

	override getName(): string {
		return localize('compyleChat.title', "Compyle AI");
	}

	override getIcon(): ThemeIcon {
		return Codicon.robot;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleChatInput.RESOURCE,
			options: {
				override: CompyleChatInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleChatInput;
	}
}

export class CompyleChatInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleChatInput {
		return instantiationService.createInstance(CompyleChatInput);
	}
}
