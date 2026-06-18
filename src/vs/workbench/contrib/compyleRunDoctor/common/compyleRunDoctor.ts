/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Run Doctor detection engine. Pure logic: given a snapshot of a project folder
 * (top-level entries plus a few parsed files), it produces a run plan describing
 * how to install, run, build, and test the project. All file IO lives in the
 * service; this module stays testable and platform-free.
 */

export interface IRunCommand {
	readonly label: string;
	readonly command: string;
}

export interface IRunPlan {
	/** Whether a known project type was recognized. */
	readonly detected: boolean;
	readonly projectType: string;
	readonly language: string;
	readonly framework?: string;
	readonly packageManager?: string;
	readonly install?: IRunCommand;
	readonly dev?: IRunCommand;
	readonly build?: IRunCommand;
	readonly test?: IRunCommand;
	/** Default local URL to open once the dev server runs. */
	readonly url?: string;
	/** Required runtime, e.g. "Node 18+". */
	readonly runtime?: string;
	/** Env var keys discovered in an example file when the real .env is missing. */
	readonly envKeys: readonly string[];
	readonly warnings: readonly string[];
	/** Marker files/dirs that drove detection. */
	readonly markers: readonly string[];
	/** Plain-English explanation of the setup. */
	readonly explanation: string;
}

export interface IRunPlanInput {
	/** Top-level entry names (files and directories) in the project root. */
	readonly files: readonly string[];
	readonly hasNodeModules: boolean;
	readonly packageJson?: IPackageJsonShape;
	/** Raw content of a .env example file, if present. */
	readonly envExampleContent?: string;
	/** Lowercased dependency names from requirements.txt / pyproject / Pipfile. */
	readonly pythonDeps: readonly string[];
	readonly envFilePresent: boolean;
}

export interface IPackageJsonShape {
	readonly scripts?: Record<string, string>;
	readonly dependencies?: Record<string, string>;
	readonly devDependencies?: Record<string, string>;
	readonly engines?: Record<string, string>;
}

export const ENV_EXAMPLE_NAMES = ['.env.example', '.env.sample', '.env.template'];

function has(files: readonly string[], name: string): boolean {
	return files.some(f => f.toLowerCase() === name.toLowerCase());
}

function parseEnvKeys(content: string): string[] {
	const keys: string[] = [];
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}
		const eq = line.indexOf('=');
		const key = (eq === -1 ? line : line.slice(0, eq)).replace(/^export\s+/, '').trim();
		if (key) {
			keys.push(key);
		}
	}
	return keys;
}

function detectPackageManager(files: readonly string[]): string {
	if (has(files, 'pnpm-lock.yaml')) { return 'pnpm'; }
	if (has(files, 'yarn.lock')) { return 'yarn'; }
	if (has(files, 'bun.lockb')) { return 'bun'; }
	return 'npm';
}

function runScript(pm: string, script: string): string {
	if (pm === 'npm') { return `npm run ${script}`; }
	return `${pm} ${script}`;
}

interface INodeFrameworkInfo {
	readonly projectType: string;
	readonly framework: string;
	readonly url?: string;
}

function detectNodeFramework(deps: Set<string>, files: readonly string[]): INodeFrameworkInfo | undefined {
	if (deps.has('next')) { return { projectType: 'Next.js App', framework: 'Next.js', url: 'http://localhost:3000' }; }
	if (deps.has('@remix-run/react')) { return { projectType: 'Remix App', framework: 'Remix', url: 'http://localhost:3000' }; }
	if (deps.has('@angular/core')) { return { projectType: 'Angular App', framework: 'Angular', url: 'http://localhost:4200' }; }
	if (deps.has('@sveltejs/kit')) { return { projectType: 'SvelteKit App', framework: 'SvelteKit', url: 'http://localhost:5173' }; }
	if (deps.has('nuxt')) { return { projectType: 'Nuxt App', framework: 'Nuxt', url: 'http://localhost:3000' }; }
	if (deps.has('vite') || has(files, 'vite.config.ts') || has(files, 'vite.config.js')) { return { projectType: 'Vite App', framework: 'Vite', url: 'http://localhost:5173' }; }
	if (deps.has('react-scripts')) { return { projectType: 'Create React App', framework: 'React', url: 'http://localhost:3000' }; }
	if (deps.has('@nestjs/core')) { return { projectType: 'NestJS API', framework: 'NestJS', url: 'http://localhost:3000' }; }
	if (deps.has('express') || deps.has('fastify') || deps.has('koa')) { return { projectType: 'Node Backend API', framework: deps.has('express') ? 'Express' : deps.has('fastify') ? 'Fastify' : 'Koa', url: 'http://localhost:3000' }; }
	if (deps.has('electron')) { return { projectType: 'Electron Desktop App', framework: 'Electron' }; }
	if (deps.has('react')) { return { projectType: 'React App', framework: 'React', url: 'http://localhost:3000' }; }
	if (deps.has('vue')) { return { projectType: 'Vue App', framework: 'Vue', url: 'http://localhost:5173' }; }
	return undefined;
}

function detectPythonFramework(deps: readonly string[]): { projectType: string; framework: string; dev: string; url?: string } | undefined {
	const set = new Set(deps);
	if (set.has('fastapi')) { return { projectType: 'FastAPI Backend', framework: 'FastAPI', dev: 'uvicorn main:app --reload', url: 'http://localhost:8000' }; }
	if (set.has('flask')) { return { projectType: 'Flask App', framework: 'Flask', dev: 'flask run', url: 'http://localhost:5000' }; }
	if (set.has('django')) { return { projectType: 'Django App', framework: 'Django', dev: 'python manage.py runserver', url: 'http://localhost:8000' }; }
	if (set.has('streamlit')) { return { projectType: 'Streamlit App', framework: 'Streamlit', dev: 'streamlit run app.py', url: 'http://localhost:8501' }; }
	return undefined;
}

export function buildRunPlan(input: IRunPlanInput): IRunPlan {
	const { files } = input;
	const warnings: string[] = [];
	const markers: string[] = [];

	// Env detection (applies regardless of language).
	let envKeys: string[] = [];
	const exampleName = ENV_EXAMPLE_NAMES.find(n => has(files, n));
	if (exampleName && !input.envFilePresent && input.envExampleContent) {
		envKeys = parseEnvKeys(input.envExampleContent);
		if (envKeys.length) {
			warnings.push(`Missing .env file. Copy ${exampleName} to .env and fill in: ${envKeys.join(', ')}.`);
		}
	}

	// ---- Node / JavaScript / TypeScript ----
	if (has(files, 'package.json') && input.packageJson) {
		markers.push('package.json');
		const pkg = input.packageJson;
		const scripts = pkg.scripts ?? {};
		const deps = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
		const isTs = has(files, 'tsconfig.json');
		const pm = detectPackageManager(files);
		const fw = detectNodeFramework(deps, files);

		const devScript = scripts['dev'] ? 'dev' : scripts['start'] ? 'start' : scripts['serve'] ? 'serve' : undefined;
		const runtime = pkg.engines?.node ? `Node ${pkg.engines.node}` : 'Node 18+';

		if (!input.hasNodeModules) {
			warnings.push('Dependencies are not installed yet. Run the install command first.');
		}

		const projectType = fw?.projectType ?? (Object.keys(scripts).length ? 'Node Project' : 'Node Library');
		const language = isTs ? 'TypeScript' : 'JavaScript';

		return finalize({
			detected: true,
			projectType,
			language,
			framework: fw?.framework,
			packageManager: pm,
			install: { label: 'Install dependencies', command: `${pm} install` },
			dev: devScript ? { label: 'Start dev server', command: runScript(pm, devScript) } : undefined,
			build: scripts['build'] ? { label: 'Build', command: runScript(pm, 'build') } : undefined,
			test: scripts['test'] ? { label: 'Run tests', command: runScript(pm, 'test') } : undefined,
			url: fw?.url,
			runtime,
			envKeys,
			warnings,
			markers: [...markers, isTs ? 'tsconfig.json' : ''].filter(Boolean),
		});
	}

	// ---- Python ----
	const pyMarker = ['requirements.txt', 'pyproject.toml', 'Pipfile'].find(n => has(files, n));
	if (pyMarker || input.pythonDeps.length) {
		if (pyMarker) { markers.push(pyMarker); }
		const fw = detectPythonFramework(input.pythonDeps);
		const pm = has(files, 'Pipfile') ? 'pipenv' : (has(files, 'pyproject.toml') && input.pythonDeps.includes('poetry')) ? 'poetry' : 'pip';
		const install = pm === 'pipenv'
			? 'pipenv install'
			: pm === 'poetry'
				? 'poetry install'
				: has(files, 'requirements.txt') ? 'pip install -r requirements.txt' : 'pip install .';

		return finalize({
			detected: true,
			projectType: fw?.projectType ?? 'Python Project',
			language: 'Python',
			framework: fw?.framework,
			packageManager: pm,
			install: { label: 'Install dependencies', command: install },
			dev: fw ? { label: 'Run', command: fw.dev } : undefined,
			test: { label: 'Run tests', command: 'pytest' },
			url: fw?.url,
			runtime: 'Python 3.10+',
			envKeys,
			warnings,
			markers,
		});
	}

	// ---- Rust ----
	if (has(files, 'Cargo.toml')) {
		return finalize({
			detected: true, projectType: 'Rust Project', language: 'Rust', packageManager: 'cargo',
			install: { label: 'Fetch dependencies', command: 'cargo fetch' },
			dev: { label: 'Run', command: 'cargo run' },
			build: { label: 'Build (release)', command: 'cargo build --release' },
			test: { label: 'Run tests', command: 'cargo test' },
			runtime: 'Rust (stable)', envKeys, warnings, markers: ['Cargo.toml'],
		});
	}

	// ---- Go ----
	if (has(files, 'go.mod')) {
		return finalize({
			detected: true, projectType: 'Go Project', language: 'Go', packageManager: 'go modules',
			install: { label: 'Download modules', command: 'go mod download' },
			dev: { label: 'Run', command: 'go run .' },
			build: { label: 'Build', command: 'go build ./...' },
			test: { label: 'Run tests', command: 'go test ./...' },
			runtime: 'Go 1.21+', envKeys, warnings, markers: ['go.mod'],
		});
	}

	// ---- Java ----
	if (has(files, 'pom.xml')) {
		return finalize({
			detected: true, projectType: 'Java (Maven) Project', language: 'Java', packageManager: 'maven',
			install: { label: 'Install dependencies', command: 'mvn install' },
			dev: { label: 'Run', command: 'mvn exec:java' },
			build: { label: 'Package', command: 'mvn package' },
			test: { label: 'Run tests', command: 'mvn test' },
			runtime: 'JDK 17+', envKeys, warnings, markers: ['pom.xml'],
		});
	}
	if (has(files, 'build.gradle') || has(files, 'build.gradle.kts')) {
		return finalize({
			detected: true, projectType: 'Java (Gradle) Project', language: 'Java', packageManager: 'gradle',
			install: { label: 'Resolve dependencies', command: 'gradle build -x test' },
			dev: { label: 'Run', command: 'gradle run' },
			build: { label: 'Build', command: 'gradle build' },
			test: { label: 'Run tests', command: 'gradle test' },
			runtime: 'JDK 17+', envKeys, warnings, markers: ['build.gradle'],
		});
	}

	// ---- Docker (fallback when no language manifest) ----
	if (has(files, 'docker-compose.yml') || has(files, 'docker-compose.yaml')) {
		return finalize({
			detected: true, projectType: 'Docker Compose Project', language: 'Docker',
			dev: { label: 'Start services', command: 'docker compose up' },
			build: { label: 'Build images', command: 'docker compose build' },
			envKeys, warnings, markers: ['docker-compose.yml'],
		});
	}
	if (has(files, 'Dockerfile')) {
		return finalize({
			detected: true, projectType: 'Docker Project', language: 'Docker',
			build: { label: 'Build image', command: 'docker build -t app .' },
			dev: { label: 'Run container', command: 'docker run --rm -it app' },
			envKeys, warnings, markers: ['Dockerfile'],
		});
	}

	// ---- Static site ----
	if (has(files, 'index.html')) {
		return finalize({
			detected: true, projectType: 'Static Website', language: 'HTML / CSS / JS',
			dev: { label: 'Serve locally', command: 'npx serve .' },
			url: 'http://localhost:3000', envKeys, warnings, markers: ['index.html'],
		});
	}

	// ---- Nothing recognized ----
	warnings.push('No recognized project files were found. Open a folder that contains a project manifest such as package.json, requirements.txt, Cargo.toml, or go.mod.');
	return finalize({
		detected: false, projectType: 'Unknown', language: 'Unknown',
		envKeys, warnings, markers,
	});
}

/** Fills in the human-readable explanation from the assembled plan. */
function finalize(plan: Omit<IRunPlan, 'explanation'>): IRunPlan {
	return { ...plan, explanation: buildExplanation(plan) };
}

function buildExplanation(plan: Omit<IRunPlan, 'explanation'>): string {
	if (!plan.detected) {
		return 'Compyle could not detect a known project type in this folder. Make sure you opened the project root.';
	}
	const lines: string[] = [];
	lines.push(`This looks like a ${plan.projectType}${plan.framework ? ` built with ${plan.framework}` : ''} (${plan.language}).`);
	if (plan.runtime) {
		lines.push(`It expects ${plan.runtime} to be installed.`);
	}
	if (plan.install) {
		lines.push(`First, install dependencies: "${plan.install.command}".`);
	}
	if (plan.dev) {
		lines.push(`Then start it with "${plan.dev.command}".${plan.url ? ` Open ${plan.url} in a browser.` : ''}`);
	}
	if (plan.test) {
		lines.push(`Run the tests with "${plan.test.command}".`);
	}
	if (plan.build) {
		lines.push(`Create a production build with "${plan.build.command}".`);
	}
	return lines.join(' ');
}
