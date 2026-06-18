/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ship Center planning. Pure logic: given a project's run plan plus a few signals,
 * it produces a deployment plan — workflow steps, an environment checklist,
 * candidate hosting targets, and safety warnings. Running steps lives in the service.
 */

import { IRunCommand, IRunPlan } from '../../compyleRunDoctor/common/compyleRunDoctor.js';

export type ShipStepStatus = 'idle' | 'running' | 'passed' | 'failed' | 'unknown';

export interface IShipStep {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** Present when the step runs a shell command; absent for guidance-only steps. */
	readonly command?: string;
}

export interface IDeployTarget {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly docsUrl: string;
}

export interface IShipPlan {
	readonly detected: boolean;
	readonly projectType: string;
	readonly language: string;
	readonly framework?: string;
	readonly steps: readonly IShipStep[];
	readonly envKeys: readonly string[];
	readonly targets: readonly IDeployTarget[];
	readonly warnings: readonly string[];
}

export interface IShipPlanInput {
	readonly files: readonly string[];
	readonly envFilePresent: boolean;
	readonly gitignoreContent?: string;
}

const TARGETS = {
	vercel: { id: 'vercel', name: 'Vercel', description: 'Best for Next.js and frontend apps. Git-based deploys.', docsUrl: 'https://vercel.com/docs' },
	netlify: { id: 'netlify', name: 'Netlify', description: 'Great for static sites and SPAs.', docsUrl: 'https://docs.netlify.com' },
	githubPages: { id: 'github-pages', name: 'GitHub Pages', description: 'Free static hosting from a repo.', docsUrl: 'https://docs.github.com/pages' },
	cloudflare: { id: 'cloudflare-pages', name: 'Cloudflare Pages', description: 'Fast static + edge functions.', docsUrl: 'https://developers.cloudflare.com/pages' },
	render: { id: 'render', name: 'Render', description: 'Web services, APIs, and databases.', docsUrl: 'https://render.com/docs' },
	railway: { id: 'railway', name: 'Railway', description: 'Simple backend and full-stack deploys.', docsUrl: 'https://docs.railway.app' },
	fly: { id: 'fly', name: 'Fly.io', description: 'Run containers close to users.', docsUrl: 'https://fly.io/docs' },
} satisfies Record<string, IDeployTarget>;

function pickTargets(plan: IRunPlan): IDeployTarget[] {
	const fw = (plan.framework ?? '').toLowerCase();
	const type = plan.projectType.toLowerCase();

	if (fw.includes('next') || fw.includes('nuxt') || fw.includes('sveltekit') || fw.includes('remix')) {
		return [TARGETS.vercel, TARGETS.netlify, TARGETS.cloudflare];
	}
	if (type.includes('static') || fw.includes('vite') || fw.includes('react') || fw.includes('vue') || fw.includes('angular')) {
		return [TARGETS.netlify, TARGETS.vercel, TARGETS.cloudflare, TARGETS.githubPages];
	}
	if (type.includes('api') || type.includes('backend') || fw.includes('express') || fw.includes('fastapi') || fw.includes('flask') || fw.includes('django') || fw.includes('nest')) {
		return [TARGETS.render, TARGETS.railway, TARGETS.fly];
	}
	if (plan.language === 'Docker') {
		return [TARGETS.fly, TARGETS.render, TARGETS.railway];
	}
	return [TARGETS.render, TARGETS.railway, TARGETS.vercel];
}

function step(id: string, label: string, description: string, command?: IRunCommand): IShipStep {
	return { id, label, description, command: command?.command };
}

export function buildShipPlan(plan: IRunPlan, input: IShipPlanInput): IShipPlan {
	if (!plan.detected) {
		return {
			detected: false,
			projectType: plan.projectType,
			language: plan.language,
			steps: [],
			envKeys: [],
			targets: [],
			warnings: ['No project detected. Open a project folder to prepare a deployment.'],
		};
	}

	const warnings: string[] = [...plan.warnings];

	const gitignore = input.gitignoreContent ?? '';
	if (input.envFilePresent && !/(^|\n)\s*\.env\b/.test(gitignore)) {
		warnings.push('A .env file is present but may not be git-ignored. Add ".env" to .gitignore so secrets are not committed or deployed.');
	}
	if (!plan.build && (plan.projectType.toLowerCase().includes('app') || plan.framework)) {
		warnings.push('No build command was detected. Most hosts expect a build step — add a "build" script if your project needs one.');
	}
	warnings.push('Set environment variables in your hosting provider dashboard. Never ship secrets or API keys in client-side code.');

	const targets = pickTargets(plan);

	const steps: IShipStep[] = [];
	if (plan.install) { steps.push(step('prepare', 'Prepare', 'Install dependencies so the project can build.', plan.install)); }
	if (plan.test) { steps.push(step('test', 'Run tests', 'Make sure tests pass before shipping.', plan.test)); }
	if (plan.build) { steps.push(step('build', 'Build', 'Create a production build.', plan.build)); }
	if (plan.dev) { steps.push(step('preview', 'Preview', 'Run locally one more time to sanity-check.', plan.dev)); }
	steps.push(step('deploy', 'Deploy', `Deploy to ${targets[0]?.name ?? 'your host'}. Install its CLI or connect your Git repo, then follow its guide.`));
	steps.push(step('verify', 'Verify', 'Open the live URL, confirm it loads, and test the key flows. Check the host logs if something breaks.'));

	return {
		detected: true,
		projectType: plan.projectType,
		language: plan.language,
		framework: plan.framework,
		steps,
		envKeys: plan.envKeys,
		targets,
		warnings,
	};
}
