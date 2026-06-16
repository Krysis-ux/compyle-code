/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Compyle Spec — Spec-Driven Development Mode
 *
 * Flow:
 *  1. User enters rough idea → Compyle generates REQUIREMENTS.md
 *  2. User approves requirements → Compyle generates DESIGN.md
 *  3. User approves design → Compyle generates TASKS.md
 *  4. User selects task → Compyle Brain implements with diff preview
 *  5. Tests/lint/build run → PROJECT_MEMORY.md + CHANGELOG.md updated
 *
 * Stored in: .compyle/specs/<feature-name>/
 *   REQUIREMENTS.md, DESIGN.md, TASKS.md, DECISIONS.md, TEST_PLAN.md
 *
 * Status badges: Draft | Approved | In Progress | Done
 */

export const enum SpecStatus {
	Draft = 'draft',
	Approved = 'approved',
	InProgress = 'in-progress',
	Done = 'done',
}

export interface CompyleSpec {
	readonly name: string;
	readonly directory: string;
	readonly status: SpecStatus;
	readonly files: {
		requirements?: string;
		design?: string;
		tasks?: string;
		decisions?: string;
		testPlan?: string;
	};
}

export const SPEC_TEMPLATES = {
	requirements: (featureName: string) => `# Requirements: ${featureName}

## Status: Draft

## Problem Statement
<!-- What problem does this feature solve? -->

## User Stories
<!-- As a [user], I want [feature], so that [benefit] -->

## Acceptance Criteria
<!-- Specific, testable conditions that must be true when this is done -->
- [ ]

## Out of Scope
<!-- What this feature does NOT include -->

## Open Questions
<!-- Questions that need to be answered before implementation -->
`,

	design: (featureName: string) => `# Design: ${featureName}

## Status: Draft

## Architecture
<!-- How does this fit into the existing system? -->

## Data Model
<!-- New types, interfaces, storage -->

## API / Interface
<!-- Functions, commands, settings -->

## UI / UX
<!-- User-facing flows, mockups, interactions -->

## Dependencies
<!-- Other systems or features this depends on -->

## Risks
<!-- Technical risks and mitigations -->
`,

	tasks: (featureName: string) => `# Tasks: ${featureName}

## Status: Draft

## Implementation Checklist

- [ ] Task 1: <!-- Brief description -->
- [ ] Task 2:
- [ ] Task 3:
- [ ] Tests: Write unit tests
- [ ] Tests: Write integration tests
- [ ] Docs: Update docs
- [ ] Review: Self-review diff
`,
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

class NewFromIdeaAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.spec.newFromIdea',
			title: { value: localize('compyle.spec.newFromIdea', "Build From Idea..."), original: 'Build From Idea...' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: open quick input, get feature name/idea from user,
		// then call CompyleBrainService to generate REQUIREMENTS.md
		// Opens the spec editor after generation
	}
}

class ViewSpecsAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.spec.viewSpecs',
			title: { value: localize('compyle.spec.viewSpecs', "View All Specs"), original: 'View All Specs' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: open spec sidebar showing all .compyle/specs/*/
	}
}

class ImplementNextTaskAction extends Action2 {
	constructor() {
		super({
			id: 'compyle.spec.implementNextTask',
			title: { value: localize('compyle.spec.implementNextTask', "Implement Next Task"), original: 'Implement Next Task' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		// TODO: find first unchecked task in active spec's TASKS.md,
		// pass to CompyleBrainService in Edit/Agent mode with diff preview
	}
}

registerAction2(NewFromIdeaAction);
registerAction2(ViewSpecsAction);
registerAction2(ImplementNextTaskAction);
