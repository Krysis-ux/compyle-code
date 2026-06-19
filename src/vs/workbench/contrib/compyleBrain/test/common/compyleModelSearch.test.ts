/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildHfSearchUrl, buildOllamaHfPull, parseGgufQuants, parseHfModels } from '../../common/compyleModelSearch.js';

suite('CompyleModelSearch', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('buildHfSearchUrl encodes the query and filters to gguf', () => {
		const url = buildHfSearchUrl('qwen coder');
		assert.ok(url.includes('search=qwen%20coder'));
		assert.ok(url.includes('filter=gguf'));
		assert.ok(url.includes('limit=30'));
	});

	test('parseHfModels keeps entries with an id and defaults counts', () => {
		const json = [
			{ id: 'TheBloke/Qwen-GGUF', downloads: 1000, likes: 12 },
			{ id: 'no/counts' },
			{ notId: true },
		];
		assert.deepStrictEqual(parseHfModels(json), [
			{ id: 'TheBloke/Qwen-GGUF', downloads: 1000, likes: 12 },
			{ id: 'no/counts', downloads: 0, likes: 0 },
		]);
	});

	test('parseHfModels returns empty for non-arrays', () => {
		assert.deepStrictEqual(parseHfModels(null), []);
		assert.deepStrictEqual(parseHfModels({}), []);
	});

	test('parseGgufQuants extracts quantization tags from the file list', () => {
		const json = {
			siblings: [
				{ rfilename: 'model.Q4_K_M.gguf' },
				{ rfilename: 'mymodel-Q8_0.gguf' },
				{ rfilename: 'README.md' },
				{ rfilename: 'config.json' },
			],
		};
		assert.deepStrictEqual(parseGgufQuants(json), ['Q4_K_M', 'Q8_0']);
	});

	test('parseGgufQuants returns empty when there are no gguf files', () => {
		assert.deepStrictEqual(parseGgufQuants({ siblings: [{ rfilename: 'README.md' }] }), []);
		assert.deepStrictEqual(parseGgufQuants(null), []);
	});

	test('buildOllamaHfPull forms the hf.co pull target', () => {
		assert.strictEqual(buildOllamaHfPull('TheBloke/Qwen-GGUF', 'Q4_K_M'), 'hf.co/TheBloke/Qwen-GGUF:Q4_K_M');
		assert.strictEqual(buildOllamaHfPull('TheBloke/Qwen-GGUF'), 'hf.co/TheBloke/Qwen-GGUF');
	});
});
