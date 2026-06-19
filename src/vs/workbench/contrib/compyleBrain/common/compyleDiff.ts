/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ICompyleLineDiff {
	readonly removed: string[];
	readonly added: string[];
}

/**
 * A minimal line diff for the agent's diff cards: trims the common prefix and
 * suffix and returns the changed region (removed lines, added lines). This is
 * enough for a readable preview of a single search/replace or a new file; it is
 * not a full LCS diff.
 */
export function simpleLineDiff(original: string, modified: string): ICompyleLineDiff {
	const a = original.length ? original.split('\n') : [];
	const b = modified.length ? modified.split('\n') : [];

	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) {
		start++;
	}

	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
	}

	return { removed: a.slice(start, endA), added: b.slice(start, endB) };
}
