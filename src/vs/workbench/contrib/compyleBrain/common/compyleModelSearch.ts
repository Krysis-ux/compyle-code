/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Helpers for searching Hugging Face for GGUF models and turning a chosen repo +
 * quantization into an `ollama pull hf.co/<id>:<quant>` command. Pure functions so
 * they can be unit-tested without the network.
 */

export interface IHfModel {
	readonly id: string;
	readonly downloads: number;
	readonly likes: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

/** Build the Hugging Face models search URL, filtered to GGUF repos, sorted by downloads. */
export function buildHfSearchUrl(query: string): string {
	return `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=gguf&sort=downloads&direction=-1&limit=30`;
}

/** The model-detail URL (includes the file list under `siblings`). */
export function buildHfModelUrl(id: string): string {
	return `https://huggingface.co/api/models/${id}`;
}

/** Parse the HF search response into a list of models. */
export function parseHfModels(json: unknown): IHfModel[] {
	if (!Array.isArray(json)) {
		return [];
	}
	const out: IHfModel[] = [];
	for (const item of json) {
		const rec = asRecord(item);
		if (rec && typeof rec.id === 'string') {
			out.push({
				id: rec.id,
				downloads: typeof rec.downloads === 'number' ? rec.downloads : 0,
				likes: typeof rec.likes === 'number' ? rec.likes : 0,
			});
		}
	}
	return out;
}

/** Extract the available GGUF quantization tags (e.g. Q4_K_M) from a HF model's file list. */
export function parseGgufQuants(json: unknown): string[] {
	const rec = asRecord(json);
	const siblings = rec && Array.isArray(rec.siblings) ? rec.siblings : [];
	const quants = new Set<string>();
	for (const sibling of siblings) {
		const file = asRecord(sibling);
		const name = file && typeof file.rfilename === 'string' ? file.rfilename : '';
		if (!/\.gguf$/i.test(name)) {
			continue;
		}
		const match = name.match(/-(Q[0-9][A-Za-z0-9_.]*?)\.gguf$/i) || name.match(/\.([A-Za-z0-9_]+)\.gguf$/i);
		if (match) {
			quants.add(match[1]);
		}
	}
	return [...quants];
}

/** Build the Ollama pull target for a Hugging Face GGUF repo + optional quantization. */
export function buildOllamaHfPull(id: string, quant?: string): string {
	return quant ? `hf.co/${id}:${quant}` : `hf.co/${id}`;
}
