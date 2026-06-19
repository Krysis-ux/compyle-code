/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { simpleLineDiff } from '../../common/compyleDiff.js';

suite('CompyleDiff', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('treats a brand-new file as all added', () => {
		assert.deepStrictEqual(simpleLineDiff('', 'a\nb\nc'), { removed: [], added: ['a', 'b', 'c'] });
	});

	test('trims common prefix and suffix to the changed region', () => {
		const before = 'line1\nconst x = 1;\nline3';
		const after = 'line1\nconst x = 2;\nline3';
		assert.deepStrictEqual(simpleLineDiff(before, after), { removed: ['const x = 1;'], added: ['const x = 2;'] });
	});

	test('reports pure insertions with no removals', () => {
		assert.deepStrictEqual(simpleLineDiff('a\nb', 'a\nNEW\nb'), { removed: [], added: ['NEW'] });
	});

	test('reports pure deletions with no additions', () => {
		assert.deepStrictEqual(simpleLineDiff('a\nGONE\nb', 'a\nb'), { removed: ['GONE'], added: [] });
	});

	test('returns empty diff for identical input', () => {
		assert.deepStrictEqual(simpleLineDiff('same\ntext', 'same\ntext'), { removed: [], added: [] });
	});
});
