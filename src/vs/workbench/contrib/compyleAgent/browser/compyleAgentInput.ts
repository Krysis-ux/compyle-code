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

export class CompyleAgentInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleAgent';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'agent-workspace' });

	override get typeId(): string {
		return CompyleAgentInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleAgentInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleAgentInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleAgent.title", "Agent Workspace");
	}

	override getIcon(): ThemeIcon {
		return Codicon.robot;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleAgentInput.RESOURCE,
			options: {
				override: CompyleAgentInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleAgentInput;
	}
}

export class CompyleAgentInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleAgentInput {
		return instantiationService.createInstance(CompyleAgentInput);
	}
}
