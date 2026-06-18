/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Compyle Converter format catalog. Each target format names the local tool that
 * performs the conversion and how to build its command. The set is intentionally
 * broad and searchable; for the long tail (1000+ formats) users can point the
 * converter at a self-hosted ConvertX server instead of installing every tool.
 */

export type CompyleConverterTool = 'markitdown' | 'pandoc' | 'ffmpeg' | 'imagemagick' | 'libreoffice';

export type CompyleConverterCategory = 'documents' | 'images' | 'video' | 'audio' | 'data' | 'ebooks';

export interface ICompyleFormat {
	/** Target extension without the dot, e.g. "mp4". */
	readonly ext: string;
	readonly label: string;
	readonly category: CompyleConverterCategory;
	readonly tool: CompyleConverterTool;
}

export interface ICompyleToolInfo {
	readonly id: CompyleConverterTool;
	readonly name: string;
	/** Probe command used to check availability (first token is the binary). */
	readonly probe: string;
	readonly install: string;
}

export const COMPYLE_TOOLS: Record<CompyleConverterTool, ICompyleToolInfo> = {
	markitdown: { id: 'markitdown', name: 'MarkItDown', probe: 'markitdown --version', install: 'pip install markitdown' },
	pandoc: { id: 'pandoc', name: 'Pandoc', probe: 'pandoc --version', install: 'https://pandoc.org/installing.html' },
	ffmpeg: { id: 'ffmpeg', name: 'FFmpeg', probe: 'ffmpeg -version', install: 'https://ffmpeg.org/download.html' },
	imagemagick: { id: 'imagemagick', name: 'ImageMagick', probe: 'magick -version', install: 'https://imagemagick.org/script/download.php' },
	libreoffice: { id: 'libreoffice', name: 'LibreOffice', probe: 'libreoffice --version', install: 'https://www.libreoffice.org/download/' },
};

export const COMPYLE_CATEGORY_LABELS: Record<CompyleConverterCategory, string> = {
	documents: 'Documents',
	images: 'Images',
	video: 'Video',
	audio: 'Audio',
	data: 'Data',
	ebooks: 'E-Books',
};

function imageFormats(): ICompyleFormat[] {
	return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'avif', 'heic', 'tga', 'ppm', 'pdf']
		.map(ext => ({ ext, label: ext.toUpperCase(), category: 'images' as const, tool: 'imagemagick' as const }));
}

function videoFormats(): ICompyleFormat[] {
	return ['mp4', 'mkv', 'webm', 'mov', 'avi', 'gif', 'flv', 'wmv', 'm4v', 'mpg', 'ts']
		.map(ext => ({ ext, label: ext.toUpperCase(), category: 'video' as const, tool: 'ffmpeg' as const }));
}

function audioFormats(): ICompyleFormat[] {
	return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'aiff']
		.map(ext => ({ ext, label: ext.toUpperCase(), category: 'audio' as const, tool: 'ffmpeg' as const }));
}

function documentFormats(): ICompyleFormat[] {
	return [
		{ ext: 'md', label: 'Markdown (for AI)', category: 'documents' as const, tool: 'markitdown' as const },
		{ ext: 'pdf', label: 'PDF', category: 'documents' as const, tool: 'libreoffice' as const },
		{ ext: 'docx', label: 'Word (DOCX)', category: 'documents' as const, tool: 'pandoc' as const },
		{ ext: 'html', label: 'HTML', category: 'documents' as const, tool: 'pandoc' as const },
		{ ext: 'rtf', label: 'Rich Text (RTF)', category: 'documents' as const, tool: 'libreoffice' as const },
		{ ext: 'odt', label: 'OpenDocument (ODT)', category: 'documents' as const, tool: 'libreoffice' as const },
		{ ext: 'txt', label: 'Plain Text', category: 'documents' as const, tool: 'pandoc' as const },
		{ ext: 'tex', label: 'LaTeX', category: 'documents' as const, tool: 'pandoc' as const },
		{ ext: 'rst', label: 'reStructuredText', category: 'documents' as const, tool: 'pandoc' as const },
	];
}

function dataFormats(): ICompyleFormat[] {
	return [
		{ ext: 'json', label: 'JSON', category: 'data' as const, tool: 'pandoc' as const },
		{ ext: 'csv', label: 'CSV', category: 'data' as const, tool: 'libreoffice' as const },
		{ ext: 'xlsx', label: 'Excel (XLSX)', category: 'data' as const, tool: 'libreoffice' as const },
		{ ext: 'ods', label: 'OpenDocument Sheet', category: 'data' as const, tool: 'libreoffice' as const },
	];
}

function ebookFormats(): ICompyleFormat[] {
	return [
		{ ext: 'epub', label: 'EPUB', category: 'ebooks' as const, tool: 'pandoc' as const },
		{ ext: 'pdf', label: 'PDF (E-Book)', category: 'ebooks' as const, tool: 'pandoc' as const },
	];
}

export const COMPYLE_FORMATS: readonly ICompyleFormat[] = [
	...documentFormats(),
	...imageFormats(),
	...videoFormats(),
	...audioFormats(),
	...dataFormats(),
	...ebookFormats(),
];

/** Filter the catalog by a free-text query over ext, label, and category. */
export function searchFormats(query: string): readonly ICompyleFormat[] {
	const q = query.trim().toLowerCase();
	if (!q) {
		return COMPYLE_FORMATS;
	}
	return COMPYLE_FORMATS.filter(f =>
		f.ext.includes(q) || f.label.toLowerCase().includes(q) || COMPYLE_CATEGORY_LABELS[f.category].toLowerCase().includes(q));
}

/** Build the shell command that converts `input` to `outputDir/<base>.<ext>`. */
export function buildConvertCommand(format: ICompyleFormat, inputPath: string, outputPath: string, outputDir: string): string {
	const q = (s: string) => `"${s}"`;
	switch (format.tool) {
		case 'markitdown':
			return `markitdown ${q(inputPath)} -o ${q(outputPath)}`;
		case 'pandoc':
			return `pandoc ${q(inputPath)} -o ${q(outputPath)}`;
		case 'ffmpeg':
			return `ffmpeg -y -i ${q(inputPath)} ${q(outputPath)}`;
		case 'imagemagick':
			return `magick ${q(inputPath)} ${q(outputPath)}`;
		case 'libreoffice':
			return `libreoffice --headless --convert-to ${format.ext} ${q(inputPath)} --outdir ${q(outputDir)}`;
	}
}
