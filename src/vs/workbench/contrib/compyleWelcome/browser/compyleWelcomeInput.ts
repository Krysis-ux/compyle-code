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

/** Storage key marking that the first-run Welcome has been completed/dismissed. */
export const COMPYLE_WELCOME_COMPLETED_KEY = 'compyle.welcome.completed';

export class CompyleWelcomeInput extends EditorInput {

	static readonly ID = 'workbench.editors.compyleWelcome';
	static readonly RESOURCE = URI.from({ scheme: 'compyle', path: 'welcome' });

	override get typeId(): string {
		return CompyleWelcomeInput.ID;
	}

	override get editorId(): string | undefined {
		return CompyleWelcomeInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return CompyleWelcomeInput.RESOURCE;
	}

	override getName(): string {
		return localize("compyleWelcome.title", "Welcome to Compyle");
	}

	override getIcon(): ThemeIcon {
		return Codicon.sparkle;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: CompyleWelcomeInput.RESOURCE,
			options: {
				override: CompyleWelcomeInput.ID,
				pinned: false,
			},
		};
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof CompyleWelcomeInput;
	}
}

export class CompyleWelcomeInputSerializer implements IEditorSerializer {
	canSerialize(): boolean {
		return true;
	}

	serialize(): string {
		return '{}';
	}

	deserialize(instantiationService: IInstantiationService): CompyleWelcomeInput {
		return instantiationService.createInstance(CompyleWelcomeInput);
	}
}
