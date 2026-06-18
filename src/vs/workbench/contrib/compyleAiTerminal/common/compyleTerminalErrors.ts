/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Built-in knowledge base for the Compyle AI Terminal. Matches failed terminal
 * commands against common error patterns and produces a plain-English diagnosis
 * with a suggested fix. Pure logic — no AI dependency. AI-powered fallback for
 * unknown errors is a later layer (Compyle Brain).
 */

export interface IResolvedTerminalFix {
	readonly id: string;
	readonly title: string;
	readonly cause: string;
	readonly explanationBeginner: string;
	readonly explanationAdvanced: string;
	/** Suggested fix command, if one can be offered. */
	readonly fixCommand?: string;
	/** A lower-risk alternative to the fix command. */
	readonly saferFix?: string;
	/** A file the user should look at. */
	readonly relatedFile?: string;
	/** Whether the fix command should NOT auto-run (user reviews and presses Enter). */
	readonly destructive: boolean;
}

interface IErrorMatcher {
	readonly id: string;
	readonly title: string;
	readonly cause: string;
	readonly explanationBeginner: string;
	readonly explanationAdvanced: string;
	/** Tested against the combined command + output text. */
	readonly test: RegExp;
	readonly destructive?: boolean;
	readonly saferFix?: string;
	/** Builds the fix command from the regex match and the failing command. */
	readonly fix?: (match: RegExpMatchArray, command: string) => string | undefined;
	/** Extracts a related file from the match. */
	readonly relatedFile?: (match: RegExpMatchArray) => string | undefined;
}

/** Returns the package manager implied by a command, defaulting to npm. */
function packageManagerOf(command: string): string {
	if (/\byarn\b/.test(command)) { return 'yarn'; }
	if (/\bpnpm\b/.test(command)) { return 'pnpm'; }
	if (/\bbun\b/.test(command)) { return 'bun'; }
	return 'npm';
}

function installCommand(pm: string, pkg?: string): string {
	if (!pkg) {
		return `${pm} install`;
	}
	switch (pm) {
		case 'yarn': return `yarn add ${pkg}`;
		case 'pnpm': return `pnpm add ${pkg}`;
		case 'bun': return `bun add ${pkg}`;
		default: return `npm install ${pkg}`;
	}
}

const MATCHERS: IErrorMatcher[] = [
	{
		id: 'node-module-not-found',
		title: 'Missing Node module',
		cause: 'The code imported a package that is not installed in node_modules.',
		explanationBeginner: 'Your project is trying to use a package it cannot find. This usually means dependencies were never installed, or one package is missing.',
		explanationAdvanced: 'Node could not resolve a module from node_modules. Either dependencies are not installed, the package is missing from package.json, or the import path is wrong.',
		test: /Cannot find module ['"]([^'"]+)['"]/,
		fix: (match, command) => {
			const name = match[1];
			if (name.startsWith('.') || name.startsWith('/')) {
				return undefined; // local path problem, not an install issue
			}
			// Strip subpaths like "lodash/fp" down to the package name.
			const pkg = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
			return installCommand(packageManagerOf(command), pkg);
		},
		relatedFile: match => (match[1].startsWith('.') ? match[1] : undefined),
	},
	{
		id: 'npm-deps-not-installed',
		title: 'Dependencies not installed',
		cause: 'node_modules is missing, so scripts cannot run.',
		explanationBeginner: 'You tried to run the project before installing its building blocks. Install them first.',
		explanationAdvanced: 'A lifecycle script or binary could not be found because node_modules has not been populated yet.',
		test: /sh: \d*:?\s*\S+: not found|is not recognized as an internal or external command|command not found: (vite|next|tsc|nest|react-scripts)/,
		fix: (_match, command) => installCommand(packageManagerOf(command)),
	},
	{
		id: 'python-module-not-found',
		title: 'Missing Python module',
		cause: 'A Python import refers to a package that is not installed in this environment.',
		explanationBeginner: 'Python cannot find one of the libraries your code needs. Install it with pip.',
		explanationAdvanced: 'ModuleNotFoundError indicates the package is absent from the active interpreter/venv. Activate the right environment, then install it.',
		test: /ModuleNotFoundError: No module named ['"]([^'"]+)['"]/,
		fix: match => `pip install ${match[1].split('.')[0]}`,
		saferFix: 'python -m pip install <package>  (after activating your virtual environment)',
	},
	{
		id: 'port-in-use',
		title: 'Port already in use',
		cause: 'Another process is already listening on the port your server wants.',
		explanationBeginner: 'The address your app wants is taken — usually an old server is still running. Stop it, or start your app on a different port.',
		explanationAdvanced: 'EADDRINUSE: the requested port is bound by another process. Identify and stop it, or override the port via env/config.',
		test: /EADDRINUSE|address already in use|port \d+ is (already )?in use/i,
		destructive: true,
		fix: () => 'npx kill-port 3000',
		saferFix: 'Start the dev server on a different port instead of killing the other process.',
	},
	{
		id: 'node-version',
		title: 'Incompatible Node version',
		cause: 'A dependency requires a different Node.js version than the one installed.',
		explanationBeginner: 'This project needs a specific version of Node.js. Switch to the version it asks for.',
		explanationAdvanced: 'The engines field (or a dependency) is incompatible with the current Node runtime. Use a version manager to match the required range.',
		test: /Unsupported engine|engine ['"]?node['"]? is incompatible|required: \{ node/i,
		fix: () => 'nvm use',
		saferFix: 'Install and select the required Node version with nvm (or your version manager).',
	},
	{
		id: 'eresolve-peer-deps',
		title: 'Dependency conflict',
		cause: 'npm could not satisfy conflicting peer dependency requirements.',
		explanationBeginner: 'Two packages want different versions of the same thing. You can ask npm to install anyway, but check for breakage.',
		explanationAdvanced: 'ERESOLVE: the dependency tree cannot be resolved due to conflicting peer ranges. --legacy-peer-deps bypasses the check; prefer aligning versions.',
		test: /ERESOLVE|unable to resolve dependency tree/i,
		destructive: true,
		fix: () => 'npm install --legacy-peer-deps',
		saferFix: 'Align the conflicting package versions in package.json instead of forcing the install.',
	},
	{
		id: 'eacces-permission',
		title: 'Permission denied',
		cause: 'The command tried to write somewhere it is not allowed to.',
		explanationBeginner: 'Your system blocked the command from changing protected files. Avoid using sudo with npm — fix the folder permissions instead.',
		explanationAdvanced: 'EACCES: the process lacks write permission for the target path. Reinstalling global tools under a user-owned prefix avoids sudo.',
		test: /EACCES|permission denied/i,
		destructive: true,
		saferFix: 'Fix ownership of the affected folder rather than running with elevated privileges.',
	},
	{
		id: 'not-a-git-repo',
		title: 'Not a git repository',
		cause: 'You ran a git command in a folder that is not yet a repository.',
		explanationBeginner: 'This folder is not tracked by git yet. Initialize it first.',
		explanationAdvanced: 'fatal: not a git repository. Run git init, or cd into an existing repository root.',
		test: /fatal: not a git repository/i,
		fix: () => 'git init',
	},
	{
		id: 'git-merge-conflict',
		title: 'Merge conflict',
		cause: 'Git could not automatically merge changes that overlap.',
		explanationBeginner: 'Two sets of changes touched the same lines. Open the marked files, choose what to keep, then commit.',
		explanationAdvanced: 'Automatic merge failed; conflicted regions are marked with <<<<<<< / ======= / >>>>>>>. Resolve, git add, then commit or continue.',
		test: /Merge conflict|Automatic merge failed|fix conflicts and then commit/i,
		fix: () => 'git status',
	},
	{
		id: 'enoent-package-json',
		title: 'No package.json here',
		cause: 'npm was run in a folder without a package.json.',
		explanationBeginner: 'You are probably in the wrong folder. Move into your project folder, or create a package.json.',
		explanationAdvanced: 'ENOENT for package.json means the current working directory is not a Node project root. cd to the project, or run npm init.',
		test: /ENOENT.*package\.json|Could not read package\.json/i,
		fix: () => 'npm init -y',
		saferFix: 'cd into the correct project folder before running npm.',
	},
	{
		id: 'pip-not-found',
		title: 'pip is not available',
		cause: 'Python or pip is not installed or not on PATH.',
		explanationBeginner: 'Your system cannot find pip. Make sure Python is installed, or activate your virtual environment.',
		explanationAdvanced: 'pip is missing from PATH. Use python -m pip, or activate the venv that provides it.',
		test: /pip: command not found|'pip' is not recognized/i,
		fix: () => 'python -m pip --version',
	},
];

export function matchTerminalError(command: string, output: string, exitCode: number | undefined): IResolvedTerminalFix | undefined {
	if (exitCode === 0) {
		return undefined;
	}
	const haystack = `${command}\n${output}`;
	for (const matcher of MATCHERS) {
		const match = haystack.match(matcher.test);
		if (!match) {
			continue;
		}
		const fixCommand = matcher.fix?.(match, command);
		return {
			id: matcher.id,
			title: matcher.title,
			cause: matcher.cause,
			explanationBeginner: matcher.explanationBeginner,
			explanationAdvanced: matcher.explanationAdvanced,
			fixCommand,
			saferFix: matcher.saferFix,
			relatedFile: matcher.relatedFile?.(match),
			destructive: matcher.destructive ?? false,
		};
	}
	return undefined;
}
