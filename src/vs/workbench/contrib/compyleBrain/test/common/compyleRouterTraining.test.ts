/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildSynthesisPrompt, parseChallenges, parseJudgement, parseSynthesizedRule } from '../../common/compyleRouterTraining.js';

suite('CompyleRouterTraining', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('synthesis prompt includes the request and the failure', () => {
		const p = buildSynthesisPrompt('make a calculator', 'TypeError: undefined is not a function', 'crashed on add');
		assert.ok(p.includes('make a calculator'));
		assert.ok(p.includes('crashed on add'));
		assert.ok(p.toLowerCase().includes('json'));
	});

	test('parseSynthesizedRule extracts a valid rule with difficulty', () => {
		const reply = 'Here you go: {"name":"Guard add","keywords":["calculator","add"],"systemPromptPrefix":"validate inputs","difficulty":"function"}';
		assert.deepStrictEqual(parseSynthesizedRule(reply), {
			name: 'Guard add',
			keywords: ['calculator', 'add'],
			systemPromptPrefix: 'validate inputs',
			difficulty: 'function',
		});
	});

	test('parseSynthesizedRule rejects rules with no name or keywords', () => {
		assert.strictEqual(parseSynthesizedRule('{"keywords":["x"]}'), undefined);
		assert.strictEqual(parseSynthesizedRule('{"name":"x","keywords":[]}'), undefined);
		assert.strictEqual(parseSynthesizedRule('no json here'), undefined);
	});

	test('parseSynthesizedRule drops an invalid difficulty', () => {
		const rule = parseSynthesizedRule('{"name":"n","keywords":["k"],"difficulty":"huge"}');
		assert.strictEqual(rule?.difficulty, undefined);
	});

	test('parseChallenges reads a JSON array of challenges', () => {
		const reply = 'Sure: [{"title":"Add","prompt":"sum two numbers","expected":"prints 3"}]';
		assert.deepStrictEqual(parseChallenges(reply), [{ title: 'Add', prompt: 'sum two numbers', expected: 'prints 3' }]);
	});

	test('parseJudgement reads explicit JSON verdicts', () => {
		assert.deepStrictEqual(parseJudgement('{"pass": true, "reason": "ok"}'), { pass: true, reason: 'ok' });
		assert.strictEqual(parseJudgement('{"pass": false, "reason": "bad"}').pass, false);
	});

	test('parseJudgement falls back to a failed verdict on garbage', () => {
		assert.strictEqual(parseJudgement('total nonsense').pass, false);
	});
});
