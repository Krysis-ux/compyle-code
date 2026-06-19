/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { dedupeRouterRules, ICompyleRouterRule, parseRouterRulesJsonl, serializeRouterRulesJsonl } from '../../common/compyleRouter.js';

suite('CompyleRouterRules', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('round-trips rules through jsonl', () => {
		const rules: ICompyleRouterRule[] = [
			{ name: 'A', keywords: ['x', 'y'], systemPromptPrefix: 'do x', source: 'synth', errors: 1 },
			{ name: 'B', keywords: ['z'] },
		];
		const text = serializeRouterRulesJsonl(rules);
		assert.strictEqual(text.split('\n').filter(l => l.trim()).length, 2);
		assert.deepStrictEqual(parseRouterRulesJsonl(text), rules);
	});

	test('parse skips blank and malformed lines', () => {
		const text = [
			'{"name":"A","keywords":["x"]}',
			'',
			'not json',
			'{"keywords":["no name"]}',
			'{"name":"B","keywords":["y"]}',
		].join('\n');
		assert.deepStrictEqual(parseRouterRulesJsonl(text), [
			{ name: 'A', keywords: ['x'] },
			{ name: 'B', keywords: ['y'] },
		]);
	});

	test('dedupe merges rules with the same keyword-set, summing stats', () => {
		const merged = dedupeRouterRules([
			{ name: 'first', keywords: ['fix', 'bug'], correct: 2, errors: 1, examples: ['a'], systemPromptPrefix: 'p1' },
			{ name: 'second', keywords: ['bug', 'fix'], correct: 3, errors: 4, examples: ['b'] },
		]);
		assert.strictEqual(merged.length, 1);
		assert.strictEqual(merged[0].name, 'first');
		assert.strictEqual(merged[0].correct, 5);
		assert.strictEqual(merged[0].errors, 5);
		assert.deepStrictEqual([...merged[0].examples!], ['a', 'b']);
		assert.strictEqual(merged[0].systemPromptPrefix, 'p1');
	});

	test('dedupe keeps distinct keyword-sets separate', () => {
		const merged = dedupeRouterRules([
			{ name: 'A', keywords: ['x'] },
			{ name: 'B', keywords: ['y'] },
		]);
		assert.strictEqual(merged.length, 2);
	});
});
