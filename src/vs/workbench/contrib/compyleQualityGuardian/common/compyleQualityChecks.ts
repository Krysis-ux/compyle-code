/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Quality Guardian check detection. Pure logic: given a snapshot of a project,
 * it decides which quality checks apply (lint, format, type check, tests, build)
 * and how to run them. Running and result interpretation live in the service.
 */

export type QualityCheckKind = 'lint' | 'format' | 'typecheck' | 'test' | 'build' | 'audit';

export type QualityCheckStatus = 'idle' | 'running' | 'passed' | 'failed' | 'unknown';

export interface IQualityCheck {
	readonly id: string;
	readonly label: string;
	readonly command: string;
	readonly kind: QualityCheckKind;
	/** Critical checks drive the risk level harder when they fail. */
	readonly critical: boolean;
}

export interface IQualityChecksInput {
	readonly files: readonly string[];
	readonly packageJson?: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
	readonly pythonDeps: readonly string[];
}

function has(files: readonly string[], name: string): boolean {
	return files.some(f => f.toLowerCase() === name.toLowerCase());
}

function hasPrefix(files: readonly string[], prefix: string): boolean {
	return files.some(f => f.toLowerCase().startsWith(prefix.toLowerCase()));
}

function detectPackageManager(files: readonly string[]): string {
	if (has(files, 'pnpm-lock.yaml')) { return 'pnpm'; }
	if (has(files, 'yarn.lock')) { return 'yarn'; }
	if (has(files, 'bun.lockb')) { return 'bun'; }
	return 'npm';
}

function runScript(pm: string, script: string): string {
	return pm === 'npm' ? `npm run ${script}` : `${pm} ${script}`;
}

export function detectQualityChecks(input: IQualityChecksInput): IQualityCheck[] {
	const { files } = input;
	const checks: IQualityCheck[] = [];

	// ---- Node ----
	if (has(files, 'package.json') && input.packageJson) {
		const pkg = input.packageJson;
		const scripts = pkg.scripts ?? {};
		const deps = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
		const pm = detectPackageManager(files);

		if (scripts['lint']) {
			checks.push({ id: 'lint', label: 'Lint', command: runScript(pm, 'lint'), kind: 'lint', critical: false });
		} else if (deps.has('eslint') || hasPrefix(files, '.eslintrc') || hasPrefix(files, 'eslint.config')) {
			checks.push({ id: 'lint', label: 'Lint (ESLint)', command: 'npx eslint .', kind: 'lint', critical: false });
		}

		if (scripts['format']) {
			checks.push({ id: 'format', label: 'Format check', command: runScript(pm, 'format'), kind: 'format', critical: false });
		} else if (deps.has('prettier') || hasPrefix(files, '.prettierrc') || hasPrefix(files, 'prettier.config')) {
			checks.push({ id: 'format', label: 'Format check (Prettier)', command: 'npx prettier --check .', kind: 'format', critical: false });
		}

		const typecheckScript = scripts['typecheck'] ? 'typecheck' : scripts['type-check'] ? 'type-check' : undefined;
		if (typecheckScript) {
			checks.push({ id: 'typecheck', label: 'Type check', command: runScript(pm, typecheckScript), kind: 'typecheck', critical: true });
		} else if (has(files, 'tsconfig.json')) {
			checks.push({ id: 'typecheck', label: 'Type check (tsc)', command: 'npx tsc --noEmit', kind: 'typecheck', critical: true });
		}

		if (scripts['test']) {
			checks.push({ id: 'test', label: 'Tests', command: runScript(pm, 'test'), kind: 'test', critical: true });
		}
		if (scripts['build']) {
			checks.push({ id: 'build', label: 'Build', command: runScript(pm, 'build'), kind: 'build', critical: true });
		}
		checks.push({ id: 'audit', label: 'Dependency audit', command: `${pm} audit`, kind: 'audit', critical: false });
	}

	// ---- Python ----
	const isPython = has(files, 'requirements.txt') || has(files, 'pyproject.toml') || has(files, 'Pipfile') || input.pythonDeps.length > 0;
	if (isPython) {
		const deps = new Set(input.pythonDeps);
		if (deps.has('ruff') || has(files, 'ruff.toml')) {
			checks.push({ id: 'py-lint', label: 'Lint (Ruff)', command: 'ruff check .', kind: 'lint', critical: false });
		} else if (deps.has('flake8')) {
			checks.push({ id: 'py-lint', label: 'Lint (flake8)', command: 'flake8', kind: 'lint', critical: false });
		}
		if (deps.has('black')) {
			checks.push({ id: 'py-format', label: 'Format check (Black)', command: 'black --check .', kind: 'format', critical: false });
		}
		if (deps.has('mypy')) {
			checks.push({ id: 'py-typecheck', label: 'Type check (mypy)', command: 'mypy .', kind: 'typecheck', critical: true });
		}
		checks.push({ id: 'py-test', label: 'Tests (pytest)', command: 'pytest', kind: 'test', critical: true });
	}

	return checks;
}

export function computeRisk(checks: IQualityCheck[], statuses: ReadonlyMap<string, QualityCheckStatus>): 'low' | 'medium' | 'high' {
	let criticalFailed = false;
	let anyFailed = false;
	for (const check of checks) {
		if (statuses.get(check.id) === 'failed') {
			anyFailed = true;
			if (check.critical) { criticalFailed = true; }
		}
	}
	if (criticalFailed) { return 'high'; }
	if (anyFailed) { return 'medium'; }
	return 'low';
}
