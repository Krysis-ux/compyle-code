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

export class CompyleSkillStudioInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleSkillStudio';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'skill-studio' });

	override get typeId(): string {
		return CompyleSkillStudioInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleSkillStudioInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleSkillStudioInput.RESOURCE;
	}

	override getName(): string {
		return localize('compyleSkillStudio.title', "Skill Studio");
	}

	override getIcon(): ThemeIcon {
		return Codicon.lightbulb;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleSkillStudioInput.RESOURCE,
			options: { override: CompyleSkillStudioInput.ID, pinned: false },
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleSkillStudioInput;
	}
}

export class CompyleSkillStudioInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleSkillStudioInput {
		return instantiationService.createInstance(CompyleSkillStudioInput);
	}
}
