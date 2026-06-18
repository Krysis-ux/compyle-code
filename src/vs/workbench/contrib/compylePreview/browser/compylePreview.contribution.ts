/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { ICompyleRunDoctorService } from '../../compyleRunDoctor/browser/compyleRunDoctorService.js';

const VIEW_TYPE = 'compyle.preview';

function escapeAttr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildPreviewHtml(url: string): string {
	const safeAttr = escapeAttr(url);
	const safeJs = JSON.stringify(url);
	return [
		'<!DOCTYPE html>',
		'<html lang="en">',
		'<head>',
		'<meta charset="UTF-8" />',
		'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; frame-src http: https: data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';" />',
		'<style>',
		'  :root { color-scheme: dark light; }',
		'  body { margin: 0; height: 100vh; display: flex; flex-direction: column; font-family: system-ui, sans-serif; background: #1b1b1f; color: #ddd; }',
		'  .bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #242429; border-bottom: 1px solid #333; }',
		'  .bar button { height: 28px; padding: 0 10px; border: 1px solid #3a3a42; border-radius: 6px; background: #2d2d34; color: #ddd; cursor: pointer; font-size: 12px; }',
		'  .bar button:hover { background: #36363f; }',
		'  .bar button.active { background: #4b6cff; border-color: #4b6cff; color: #fff; }',
		'  .url { flex: 1; height: 28px; padding: 0 10px; border-radius: 6px; border: 1px solid #3a3a42; background: #1b1b1f; color: #ddd; font-size: 12px; outline: none; }',
		'  .stage { flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 16px; background: #161619; }',
		'  .frame-wrap { width: 100%; height: 100%; transition: width 0.2s ease; }',
		'  .frame-wrap.tablet { width: 820px; }',
		'  .frame-wrap.mobile { width: 390px; }',
		'  .frame-wrap.tablet, .frame-wrap.mobile { height: 100%; border: 1px solid #3a3a42; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.5); background: #fff; }',
		'  iframe { width: 100%; height: 100%; border: 0; background: #fff; }',
		'  .group { display: flex; gap: 4px; }',
		'</style>',
		'</head>',
		'<body>',
		'  <div class="bar">',
		'    <button id="back" title="Reload">↻</button>',
		`    <input class="url" id="url" value="${safeAttr}" spellcheck="false" />`,
		'    <button id="go">Go</button>',
		'    <div class="group">',
		'      <button data-mode="desktop" class="active">Desktop</button>',
		'      <button data-mode="tablet">Tablet</button>',
		'      <button data-mode="mobile">Mobile</button>',
		'    </div>',
		'    <button id="external" title="Open in system browser">↗</button>',
		'  </div>',
		'  <div class="stage"><div class="frame-wrap" id="wrap"><iframe id="frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe></div></div>',
		'  <script>',
		'    var vscode = acquireVsCodeApi();',
		'    var frame = document.getElementById("frame");',
		'    var urlInput = document.getElementById("url");',
		'    var wrap = document.getElementById("wrap");',
		'    function navigate() { var u = urlInput.value.trim(); if (u) { frame.src = u; } }',
		`    frame.src = ${safeJs};`,
		'    document.getElementById("go").addEventListener("click", navigate);',
		'    urlInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { navigate(); } });',
		'    document.getElementById("back").addEventListener("click", function () { frame.src = frame.src; });',
		'    document.getElementById("external").addEventListener("click", function () { vscode.postMessage({ type: "openExternal", url: urlInput.value.trim() }); });',
		'    var modeButtons = document.querySelectorAll("[data-mode]");',
		'    modeButtons.forEach(function (btn) {',
		'      btn.addEventListener("click", function () {',
		'        modeButtons.forEach(function (b) { b.classList.remove("active"); });',
		'        btn.classList.add("active");',
		'        wrap.className = "frame-wrap " + btn.getAttribute("data-mode");',
		'      });',
		'    });',
		'  </script>',
		'</body>',
		'</html>',
	].join('\n');
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'compyle.preview.open',
			title: { value: localize('compyle.preview.open', "Open Live Preview"), original: 'Open Live Preview' },
			category: { value: localize('compyle', "Compyle"), original: 'Compyle' },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const webviewWorkbenchService = accessor.get(IWebviewWorkbenchService);
		const runDoctorService = accessor.get(ICompyleRunDoctorService);
		const openerService = accessor.get(IOpenerService);

		let url = 'http://localhost:3000';
		try {
			const plan = await runDoctorService.diagnose();
			if (plan.url) {
				url = plan.url;
			}
		} catch {
			// use default
		}

		const input = webviewWorkbenchService.openWebview(
			{
				title: localize('compyle.preview.editorTitle', "Live Preview"),
				options: {},
				contentOptions: { allowScripts: true, allowForms: true },
				extension: undefined,
			},
			VIEW_TYPE,
			localize('compyle.preview.editorTitle', "Live Preview"),
			undefined,
			{ group: ACTIVE_GROUP, preserveFocus: false },
		);

		input.webview.setHtml(buildPreviewHtml(url));
		input.webview.onMessage(event => {
			const message = event.message as { type?: string; url?: string };
			if (message?.type === 'openExternal' && message.url) {
				openerService.open(URI.parse(message.url));
			}
		});
	}
});
