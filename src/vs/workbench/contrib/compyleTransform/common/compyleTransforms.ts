/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Transform Center conversion engine. Deterministic, dependency-free converters
 * for data and docs formats. Language-to-language code conversions (e.g. Python
 * to JavaScript) require AI and are surfaced as `needsAI` placeholders until the
 * Compyle Brain provider layer lands.
 */

export interface ITransformResult {
	readonly output: string;
	readonly warnings: string[];
}

export type TransformCategory = 'data' | 'docs' | 'code';

export interface ITransformer {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly category: TransformCategory;
	/** Monaco language id for the output, used for display/save. */
	readonly outputLanguage: string;
	/** Set when the conversion needs the AI provider layer (not yet available). */
	readonly needsAI?: boolean;
	readonly convert?: (input: string) => ITransformResult;
}

// ---------------------------------------------------------------------------
// CSV parsing / serialization
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let field = '';
	let row: string[] = [];
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') { i++; }
			row.push(field);
			rows.push(row);
			field = '';
			row = [];
		} else {
			field += char;
		}
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter(r => r.length > 1 || r[0] !== '');
}

function csvCell(value: unknown): string {
	const text = value === null || value === undefined ? '' : String(value);
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function convertCsvToJson(input: string): ITransformResult {
	const rows = parseCsv(input);
	const warnings: string[] = [];
	if (rows.length < 1) {
		return { output: '[]', warnings: ['No rows found in the CSV input.'] };
	}
	const headers = rows[0];
	const records = rows.slice(1).map(row => {
		const obj: Record<string, string> = {};
		headers.forEach((header, i) => { obj[header] = row[i] ?? ''; });
		return obj;
	});
	if (records.length === 0) {
		warnings.push('Only a header row was found — no data records.');
	}
	return { output: JSON.stringify(records, null, 2), warnings };
}

function convertJsonToCsv(input: string): ITransformResult {
	const data = JSON.parse(input);
	if (!Array.isArray(data)) {
		throw new Error('JSON to CSV expects a top-level array of objects.');
	}
	const warnings: string[] = [];
	const keys: string[] = [];
	for (const item of data) {
		if (item && typeof item === 'object' && !Array.isArray(item)) {
			for (const key of Object.keys(item)) {
				if (!keys.includes(key)) { keys.push(key); }
			}
		}
	}
	if (keys.length === 0) {
		return { output: '', warnings: ['No object rows found to build columns from.'] };
	}
	const lines = [keys.map(csvCell).join(',')];
	for (const item of data) {
		const record = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
		lines.push(keys.map(key => csvCell(record[key])).join(','));
	}
	return { output: lines.join('\n'), warnings };
}

// ---------------------------------------------------------------------------
// JSON to YAML
// ---------------------------------------------------------------------------

function yamlScalar(value: unknown): string {
	if (value === null || value === undefined) { return 'null'; }
	if (typeof value === 'boolean' || typeof value === 'number') { return String(value); }
	const text = String(value);
	if (text === '' || /[:#\-?{}\[\],&*!|>'"%@`]/.test(text[0] ?? '') || /[:#]\s|\s$|^\s|\n/.test(text) || /^(true|false|null|~)$/i.test(text) || /^[\d.+-]/.test(text)) {
		return JSON.stringify(text);
	}
	return text;
}

function jsonToYaml(value: unknown, indent: number): string {
	const pad = '  '.repeat(indent);
	if (Array.isArray(value)) {
		if (value.length === 0) { return `${pad}[]`; }
		return value.map(item => {
			if (item && typeof item === 'object') {
				const nested = jsonToYaml(item, indent + 1).replace(/^\s+/, '');
				return `${pad}- ${nested}`;
			}
			return `${pad}- ${yamlScalar(item)}`;
		}).join('\n');
	}
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) { return `${pad}{}`; }
		return entries.map(([key, val]) => {
			if (val && typeof val === 'object' && (Array.isArray(val) ? val.length : Object.keys(val).length)) {
				return `${pad}${key}:\n${jsonToYaml(val, indent + 1)}`;
			}
			return `${pad}${key}: ${yamlScalar(val)}`;
		}).join('\n');
	}
	return `${pad}${yamlScalar(value)}`;
}

function convertJsonToYaml(input: string): ITransformResult {
	const data = JSON.parse(input);
	return { output: jsonToYaml(data, 0), warnings: [] };
}

// ---------------------------------------------------------------------------
// JSON sample to JSON Schema (draft-07)
// ---------------------------------------------------------------------------

function inferSchema(value: unknown): Record<string, unknown> {
	if (value === null) { return { type: 'null' }; }
	if (Array.isArray(value)) {
		return { type: 'array', items: value.length ? inferSchema(value[0]) : {} };
	}
	switch (typeof value) {
		case 'string': return { type: 'string' };
		case 'number': return { type: Number.isInteger(value) ? 'integer' : 'number' };
		case 'boolean': return { type: 'boolean' };
		case 'object': {
			const properties: Record<string, unknown> = {};
			const required: string[] = [];
			for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
				properties[key] = inferSchema(val);
				required.push(key);
			}
			return { type: 'object', properties, required };
		}
		default: return {};
	}
}

function convertJsonToSchema(input: string): ITransformResult {
	const data = JSON.parse(input);
	const schema = { $schema: 'http://json-schema.org/draft-07/schema#', ...inferSchema(data) };
	return { output: JSON.stringify(schema, null, 2), warnings: ['Schema is inferred from a single sample. Review optional vs. required fields.'] };
}

// ---------------------------------------------------------------------------
// JSON sample to TypeScript interfaces
// ---------------------------------------------------------------------------

function tsType(value: unknown): string {
	if (value === null) { return 'null'; }
	if (Array.isArray(value)) {
		return value.length ? `${tsType(value[0])}[]` : 'unknown[]';
	}
	switch (typeof value) {
		case 'string': return 'string';
		case 'number': return 'number';
		case 'boolean': return 'boolean';
		case 'object': {
			const lines = Object.entries(value as Record<string, unknown>)
				.map(([key, val]) => `\t${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${tsType(val)};`);
			return `{\n${lines.join('\n')}\n}`;
		}
		default: return 'unknown';
	}
}

function convertJsonToTs(input: string): ITransformResult {
	const data = JSON.parse(input);
	const body = Array.isArray(data)
		? `export type Root = ${tsType(data)};`
		: `export interface Root ${tsType(data)}`;
	return { output: body, warnings: ['Nested objects are inlined. Extract them into named interfaces if you prefer.'] };
}

// ---------------------------------------------------------------------------
// Markdown to HTML (basic, common syntax)
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(text: string): string {
	return escapeHtml(text)
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function convertMarkdownToHtml(input: string): ITransformResult {
	const lines = input.split(/\r?\n/);
	const html: string[] = [];
	let inCode = false;
	let listType: 'ul' | 'ol' | undefined;

	const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = undefined; } };

	for (const line of lines) {
		const fence = line.match(/^```/);
		if (fence) {
			closeList();
			html.push(inCode ? '</code></pre>' : '<pre><code>');
			inCode = !inCode;
			continue;
		}
		if (inCode) { html.push(escapeHtml(line)); continue; }

		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			closeList();
			const level = heading[1].length;
			html.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
			continue;
		}
		const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
		const unordered = line.match(/^\s*[-*]\s+(.*)$/);
		if (ordered || unordered) {
			const wanted = ordered ? 'ol' : 'ul';
			if (listType !== wanted) { closeList(); html.push(`<${wanted}>`); listType = wanted; }
			html.push(`<li>${inlineMd((ordered ?? unordered)![1])}</li>`);
			continue;
		}
		if (line.trim() === '') { closeList(); continue; }
		closeList();
		html.push(`<p>${inlineMd(line)}</p>`);
	}
	closeList();
	if (inCode) { html.push('</code></pre>'); }
	return { output: html.join('\n'), warnings: ['Basic Markdown conversion: tables, images, and nested lists are not yet supported.'] };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const COMPYLE_TRANSFORMERS: ITransformer[] = [
	{ id: 'csv-to-json', label: 'CSV → JSON', description: 'Turn a CSV table into an array of JSON objects.', category: 'data', outputLanguage: 'json', convert: convertCsvToJson },
	{ id: 'json-to-csv', label: 'JSON → CSV', description: 'Flatten an array of JSON objects into a CSV table.', category: 'data', outputLanguage: 'plaintext', convert: convertJsonToCsv },
	{ id: 'json-to-yaml', label: 'JSON → YAML', description: 'Convert JSON into readable YAML.', category: 'data', outputLanguage: 'yaml', convert: convertJsonToYaml },
	{ id: 'json-to-schema', label: 'JSON → JSON Schema', description: 'Infer a draft-07 JSON Schema from a sample.', category: 'data', outputLanguage: 'json', convert: convertJsonToSchema },
	{ id: 'json-to-ts', label: 'JSON → TypeScript', description: 'Generate TypeScript interfaces from a JSON sample.', category: 'data', outputLanguage: 'typescript', convert: convertJsonToTs },
	{ id: 'markdown-to-html', label: 'Markdown → HTML', description: 'Convert Markdown to HTML.', category: 'docs', outputLanguage: 'html', convert: convertMarkdownToHtml },

	// AI-backed conversions — available once the Compyle Brain provider layer lands.
	{ id: 'python-to-js', label: 'Python → JavaScript', description: 'Translate Python to JavaScript.', category: 'code', outputLanguage: 'javascript', needsAI: true },
	{ id: 'js-to-ts', label: 'JavaScript → TypeScript', description: 'Add types and migrate JavaScript to TypeScript.', category: 'code', outputLanguage: 'typescript', needsAI: true },
	{ id: 'css-to-tailwind', label: 'CSS → Tailwind', description: 'Rewrite CSS as Tailwind utility classes.', category: 'code', outputLanguage: 'html', needsAI: true },
	{ id: 'html-to-react', label: 'HTML → React', description: 'Split HTML/CSS/JS into React components.', category: 'code', outputLanguage: 'typescriptreact', needsAI: true },
];

export function getTransformer(id: string): ITransformer | undefined {
	return COMPYLE_TRANSFORMERS.find(t => t.id === id);
}

export function runTransform(id: string, input: string): ITransformResult {
	const transformer = getTransformer(id);
	if (!transformer) {
		return { output: '', warnings: [`Unknown transformer: ${id}`] };
	}
	if (!transformer.convert) {
		return { output: '', warnings: ['This conversion needs Compyle Brain (AI), which is not configured yet.'] };
	}
	try {
		return transformer.convert(input);
	} catch (error) {
		return { output: '', warnings: [`Could not convert: ${error instanceof Error ? error.message : String(error)}`] };
	}
}
