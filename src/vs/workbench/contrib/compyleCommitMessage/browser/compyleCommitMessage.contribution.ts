/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ICompyleBrainService } from '../../compyleBrain/browser/compyleBrainService.js';

/**
 * Core half of AI commit messages. The built-in `compyle-git-ai` extension reads the
 * staged diff from the git API and calls this command, which runs Compyle Brain and
 * returns a commit message string. Kept in core so it reuses the one Brain provider.
 */

const COMMIT_SYSTEM = [
	'You are Compyle\'s commit message writer.',
	'Given a git diff, write ONE clear commit message.',
	'Rules:',
	'- Use Conventional Commits style when it fits (feat:, fix:, refactor:, docs:, chore:, test:).',
	'- First line is a concise summary in the imperative mood, at most 72 characters.',
	'- Optionally add a blank line and a short body of bullet points for non-trivial changes.',
	'- Return ONLY the commit message text. No explanations, no markdown code fences.',
].join('\n');

function stripFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
	return fenced ? fenced[1] : trimmed;
}

CommandsRegistry.registerCommand('compyle.brain.generateCommitMessage', async (accessor: ServicesAccessor, diff?: string): Promise<string | undefined> => {
	const brainService = accessor.get(ICompyleBrainService);
	const notificationService = accessor.get(INotificationService);

	if (!brainService.isConfigured()) {
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.commit.noBrain', "Configure Compyle Brain (an AI provider) to generate commit messages.") });
		return undefined;
	}

	const text = (diff ?? '').trim();
	if (!text) {
		notificationService.notify({ severity: Severity.Info, message: localize('compyle.commit.noChanges', "No staged changes to summarize.") });
		return undefined;
	}

	// Bound the diff so we don't blow the context window on huge changes.
	const bounded = text.length > 12000 ? `${text.slice(0, 12000)}\n…(diff truncated)` : text;

	const reply = await brainService.chat(
		[{ role: 'user', content: `Write a commit message for this diff:\n\n${bounded}` }],
		{ system: COMMIT_SYSTEM, maxTokens: 512 },
	);
	return stripFences(reply).trim();
});
