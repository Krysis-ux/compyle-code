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

export class CompyleShipInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleShip';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'ship-center' });

	override get typeId(): string {
		return CompyleShipInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleShipInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleShipInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleShip.title", "Ship Center");
	}

	override getIcon(): ThemeIcon {
		return Codicon.cloudUpload;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleShipInput.RESOURCE,
			options: {
				override: CompyleShipInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleShipInput;
	}
}

export class CompyleShipInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleShipInput {
		return instantiationService.createInstance(CompyleShipInput);
	}
}
