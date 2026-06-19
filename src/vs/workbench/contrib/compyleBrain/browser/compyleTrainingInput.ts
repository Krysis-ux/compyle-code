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

export class CompyleTrainingInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleTraining';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'router-training' });

	override get typeId(): string {
		return CompyleTrainingInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleTrainingInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleTrainingInput.RESOURCE;
	}

	override getName(): string {
		return localize('compyleTraining.title', "Router Training");
	}

	override getIcon(): ThemeIcon {
		return Codicon.beaker;
	}

	override toUntyped(): IUntypedEditorInput {
		return { resource: CompyleTrainingInput.RESOURCE, options: { override: CompyleTrainingInput.ID, pinned: false } };
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		return super.matches(other) || other instanceof CompyleTrainingInput;
	}
}

export class CompyleTrainingInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleTrainingInput {
		return instantiationService.createInstance(CompyleTrainingInput);
	}
}
