#!/usr/bin/env node
/**
 * Compyle Code — Compliance Check Script
 *
 * Scans runtime/build files for forbidden Microsoft/VS Code strings that
 * should not appear in the Compyle Code product configuration.
 *
 * Usage:
 *   node scripts/check-compliance.mjs          # check and exit 1 on violations
 *   node scripts/check-compliance.mjs --audit  # print full audit report
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const isAudit = process.argv.includes('--audit');

// ---------------------------------------------------------------------------
// Forbidden strings — must not appear in runtime/product configuration files
// ---------------------------------------------------------------------------
const FORBIDDEN_PATTERNS = [
	{
		pattern: /marketplace\.visualstudio\.com/gi,
		description: 'Microsoft Visual Studio Marketplace endpoint',
		severity: 'CRITICAL',
	},
	{
		pattern: /update\.code\.visualstudio\.com/gi,
		description: 'Microsoft VS Code update service endpoint',
		severity: 'CRITICAL',
	},
	{
		pattern: /mobile\.events\.data\.microsoft\.com/gi,
		description: 'Microsoft 1DS telemetry endpoint (active call)',
		severity: 'HIGH',
	},
	{
		pattern: /falcon-caas\.mai\.microsoft\.com/gi,
		description: 'Microsoft voice/AI service endpoint',
		severity: 'CRITICAL',
	},
	{
		pattern: /"nameShort"\s*:\s*"(Code - OSS|Visual Studio Code|VS Code)"/gi,
		description: 'Microsoft/VS Code product name in nameShort field',
		severity: 'CRITICAL',
	},
	{
		pattern: /"nameLong"\s*:\s*"(Code - OSS|Visual Studio Code|VS Code)"/gi,
		description: 'Microsoft/VS Code product name in nameLong field',
		severity: 'CRITICAL',
	},
	{
		pattern: /"win32AppUserModelId"\s*:\s*"Microsoft\./gi,
		description: 'Microsoft branding in Windows App User Model ID',
		severity: 'HIGH',
	},
	{
		pattern: /"darwinBundleIdentifier"\s*:\s*"com\.visualstudio/gi,
		description: 'Visual Studio branding in macOS bundle identifier',
		severity: 'HIGH',
	},
	{
		pattern: /wss?:\/\/[a-z0-9-]+\.microsoft\.com/gi,
		description: 'Microsoft WebSocket/HTTP service endpoint',
		severity: 'HIGH',
	},
	{
		pattern: /"voiceWsUrl"/gi,
		description: 'Microsoft voice service URL field in product config',
		severity: 'HIGH',
	},
];

// ---------------------------------------------------------------------------
// Exempt paths — allowed to contain forbidden strings (legal/historical docs)
// ---------------------------------------------------------------------------
const EXEMPT_PATTERNS = [
	/LICENSE(\.txt)?$/i,
	/ThirdPartyNotices(\.txt)?$/i,
	/NOTICE(\.txt)?$/i,
	/CREDITS(\.txt)?$/i,
	/node_modules\//,
	/\.git\//,
	/docs\/legal\//,
	/docs\/COMPYLE_CODE_COMPLIANCE_AUDIT/,
	/COMPYLE_CODE_MEMORY\.md$/,
	/CLAUDE_HANDOFF\.md$/,
	/IMPLEMENTATION_LOG\.md$/,
	/check-compliance\.mjs$/,  // This file itself
	// 1DS telemetry appenders — contain Microsoft endpoint constants but only
	// activate when enableTelemetry=true AND instrumentationKey is provided.
	// Compyle Code sets enableTelemetry:false by default and provides no key.
	/platform\/telemetry\/.*\/1dsAppender\.ts$/,
	/\.png$/, /\.ico$/, /\.icns$/, /\.svg$/, /\.jpg$/, /\.gif$/, /\.woff/, /\.ttf/,
	/package-lock\.json$/,
	/cgmanifest\.json$/,
	/cglicenses\.json$/,
	/out\//,
	/\.build\//,
	/build\/lib\//,
];

// ---------------------------------------------------------------------------
// Files/directories to scan
// ---------------------------------------------------------------------------
const SCAN_TARGETS = [
	'product.json',
	'src/vs/platform/externalServices',
	'src/vs/platform/telemetry',
	'src/vs/platform/update',
	'src/vs/workbench/contrib/welcome',
	'resources/linux',
	'resources/win32/VisualElementsManifest.xml',
];

function isExempt(filePath) {
	const rel = relative(ROOT, filePath).replace(/\\/g, '/');
	return EXEMPT_PATTERNS.some(p => p.test(rel));
}

function scanFile(filePath) {
	if (isExempt(filePath)) { return []; }

	const ext = extname(filePath).toLowerCase();
	const textExts = ['.ts', '.js', '.mjs', '.mts', '.json', '.md', '.html', '.xml', '.desktop', '.sh', '.txt'];
	if (!textExts.includes(ext) && !filePath.endsWith('product.json')) { return []; }

	let content;
	try {
		content = readFileSync(filePath, 'utf8');
	} catch {
		return [];
	}

	const violations = [];
	const lines = content.split('\n');

	for (const { pattern, description, severity } of FORBIDDEN_PATTERNS) {
		pattern.lastIndex = 0;
		for (let i = 0; i < lines.length; i++) {
			if (pattern.test(lines[i])) {
				violations.push({
					file: relative(ROOT, filePath),
					line: i + 1,
					content: lines[i].trim().slice(0, 120),
					description,
					severity,
				});
				pattern.lastIndex = 0;
			}
		}
	}

	return violations;
}

function scanDirectory(dirPath) {
	const violations = [];
	let entries;
	try {
		entries = readdirSync(dirPath);
	} catch {
		return violations;
	}

	for (const entry of entries) {
		const full = join(dirPath, entry);
		let stat;
		try {
			stat = statSync(full);
		} catch {
			continue;
		}

		if (stat.isDirectory()) {
			if (!isExempt(full)) {
				violations.push(...scanDirectory(full));
			}
		} else {
			violations.push(...scanFile(full));
		}
	}

	return violations;
}

function scan() {
	const allViolations = [];

	for (const target of SCAN_TARGETS) {
		const full = join(ROOT, target);
		let stat;
		try {
			stat = statSync(full);
		} catch {
			continue;
		}

		if (stat.isDirectory()) {
			allViolations.push(...scanDirectory(full));
		} else {
			allViolations.push(...scanFile(full));
		}
	}

	return allViolations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const violations = scan();

if (violations.length === 0) {
	console.log('✅ Compyle compliance check passed — no forbidden strings found.');
	process.exit(0);
}

const critical = violations.filter(v => v.severity === 'CRITICAL');
const high = violations.filter(v => v.severity === 'HIGH');

console.error(`\n🔴 Compyle Compliance Check FAILED`);
console.error(`   ${critical.length} CRITICAL, ${high.length} HIGH violations found.\n`);

for (const v of violations) {
	const icon = v.severity === 'CRITICAL' ? '🔴' : '🟠';
	console.error(`${icon} [${v.severity}] ${v.file}:${v.line}`);
	console.error(`   Rule: ${v.description}`);
	if (isAudit) {
		console.error(`   Line: ${v.content}`);
	}
	console.error('');
}

console.error('To suppress a specific file, add it to EXEMPT_PATTERNS in scripts/check-compliance.mjs');
console.error('Run with --audit for full line content.\n');

process.exit(1);
