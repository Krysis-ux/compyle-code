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

export class CompyleRunDoctorInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleRunDoctor';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'run-doctor' });

	override get typeId(): string {
		return CompyleRunDoctorInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleRunDoctorInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleRunDoctorInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleRunDoctor.title", "Run Doctor");
	}

	override getIcon(): ThemeIcon {
		return Codicon.rocket;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleRunDoctorInput.RESOURCE,
			options: {
				override: CompyleRunDoctorInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleRunDoctorInput;
	}
}

export class CompyleRunDoctorInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleRunDoctorInput {
		return instantiationService.createInstance(CompyleRunDoctorInput);
	}
}
