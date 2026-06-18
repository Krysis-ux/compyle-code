/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Minimal slice of the built-in Git extension's API — only what we need to read the
 * staged diff and write the commit message. Avoids importing the full git typings.
 */
interface MinimalRepository {
	readonly rootUri: vscode.Uri;
	readonly inputBox: { value: string };
	diff(cached?: boolean): Promise<string>;
}

interface MinimalGitAPI {
	readonly repositories: MinimalRepository[];
	getRepository(uri: vscode.Uri): MinimalRepository | null;
}

interface MinimalGitExtension {
	readonly enabled: boolean;
	getAPI(version: number): MinimalGitAPI;
}

export function activate(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('compyle.git.generateCommitMessage', async (arg?: { rootUri?: vscode.Uri }) => {
		const gitExtension = vscode.extensions.getExtension<MinimalGitExtension>('vscode.git');
		if (!gitExtension) {
			void vscode.window.showInformationMessage('The Git extension is not available.');
			return;
		}
		if (!gitExtension.isActive) {
			await gitExtension.activate();
		}

		const git = gitExtension.exports.getAPI(1);
		const repository = (arg?.rootUri && git.getRepository(arg.rootUri)) || git.repositories[0];
		if (!repository) {
			void vscode.window.showInformationMessage('No Git repository was found in this workspace.');
			return;
		}

		// Prefer the staged diff; fall back to all working-tree changes.
		let diff = await repository.diff(true);
		if (!diff || !diff.trim()) {
			diff = await repository.diff(false);
		}
		if (!diff || !diff.trim()) {
			void vscode.window.showInformationMessage('No changes to summarize. Stage some changes first.');
			return;
		}

		const message = await vscode.commands.executeCommand<string | undefined>('compyle.brain.generateCommitMessage', diff);
		if (message) {
			repository.inputBox.value = message;
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate(): void {
	// nothing to clean up
}
