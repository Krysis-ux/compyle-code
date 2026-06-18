/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { basename } from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorInputCapabilities, IUntypedEditorInput, IEditorSerializer } from '../../../common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';

export class CompyleConverterInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleConverter';

	constructor(readonly source: URI) {
		super();
	}

	override get typeId(): string {
		return CompyleConverterInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleConverterInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly;
	}

	override get resource(): URI {
		return URI.from({ scheme: 'compyle', path: 'converter', query: this.source.toString() });
	}

	override getName(): string {
		return localize('compyleConverter.title', "Convert: {0}", basename(this.source));
	}

	override getIcon(): ThemeIcon {
		return Codicon.arrowSwap;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: this.resource,
			options: { override: CompyleConverterInput.ID, pinned: true },
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleConverterInput && other.source.toString() === this.source.toString();
	}
}

interface ISerializedConverterInput {
	readonly source: string;
}

export class CompyleConverterInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(input: EditorInput): string {
		const converterInput = input as CompyleConverterInput;
		const data: ISerializedConverterInput = { source: converterInput.source.toString() };
		return JSON.stringify(data);
	}

	deserialize(instantiationService: IInstantiationService, raw: string): CompyleConverterInput | undefined {
		try {
			const data = JSON.parse(raw) as ISerializedConverterInput;
			return instantiationService.createInstance(CompyleConverterInput, URI.parse(data.source));
		} catch {
			return undefined;
		}
	}
}
