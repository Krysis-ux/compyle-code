/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { parseAgentActions } from '../../common/compyleAgentProtocol.js';

suite('CompyleAgentProtocol', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('parses create, edit (search/replace), run, and read actions', () => {
		const md = [
			'Sure, here goes.',
			'```compyle:create path=src/a.ts',
			'export const a = 1;',
			'```',
			'```compyle:edit path=src/b.ts',
			'<<<<<<< SEARCH',
			'const x = 1;',
			'=======',
			'const x = 2;',
			'>>>>>>> REPLACE',
			'```',
			'```compyle:run',
			'npm test',
			'```',
			'```compyle:read path=src/c.ts',
			'```',
		].join('\n');

		assert.deepStrictEqual(parseAgentActions(md), [
			{ kind: 'create', path: 'src/a.ts', content: 'export const a = 1;' },
			{ kind: 'edit', path: 'src/b.ts', search: 'const x = 1;', replace: 'const x = 2;' },
			{ kind: 'run', command: 'npm test' },
			{ kind: 'read', path: 'src/c.ts' },
		]);
	});

	test('returns an empty array when there are no action blocks', () => {
		assert.deepStrictEqual(parseAgentActions('Just a plain answer with `inline code` and no blocks.'), []);
	});

	test('ignores ordinary (non-compyle) code fences', () => {
		const md = [
			'Here is an example:',
			'```ts',
			'const y = 2;',
			'```',
		].join('\n');
		assert.deepStrictEqual(parseAgentActions(md), []);
	});

	test('handles multiple edits to the same file and CRLF line endings', () => {
		const md = [
			'```compyle:edit path=src/b.ts',
			'<<<<<<< SEARCH',
			'a',
			'=======',
			'b',
			'>>>>>>> REPLACE',
			'```',
			'```compyle:edit path=src/b.ts',
			'<<<<<<< SEARCH',
			'c',
			'=======',
			'd',
			'>>>>>>> REPLACE',
			'```',
		].join('\r\n');
		assert.deepStrictEqual(parseAgentActions(md), [
			{ kind: 'edit', path: 'src/b.ts', search: 'a', replace: 'b' },
			{ kind: 'edit', path: 'src/b.ts', search: 'c', replace: 'd' },
		]);
	});

	test('skips an edit block missing the REPLACE marker (lenient)', () => {
		const md = [
			'```compyle:edit path=src/b.ts',
			'<<<<<<< SEARCH',
			'only search, no replace',
			'```',
			'```compyle:run',
			'echo ok',
			'```',
		].join('\n');
		assert.deepStrictEqual(parseAgentActions(md), [
			{ kind: 'run', command: 'echo ok' },
		]);
	});

	test('preserves multi-line file bodies for create', () => {
		const md = [
			'```compyle:create path=src/multi.ts',
			'line one',
			'line two',
			'',
			'line four',
			'```',
		].join('\n');
		assert.deepStrictEqual(parseAgentActions(md), [
			{ kind: 'create', path: 'src/multi.ts', content: 'line one\nline two\n\nline four' },
		]);
	});
});
