/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Built-in Create Project templates and add-ons. The scaffolder writes files,
 * dependencies, scripts, and docs only. It never runs package installation.
 */

export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type TemplateCategory = 'web' | 'backend' | 'python' | 'cli' | 'desktop' | 'bot';
export type ProjectKind = 'website' | 'webapp' | 'desktop' | 'api' | 'cli' | 'bot';

export interface ITemplateFile {
	readonly path: string;
	readonly content: string;
}

export interface IProjectAddOn {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly kinds: readonly ProjectKind[];
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
	readonly pythonRequirements?: readonly string[];
	readonly scripts?: Readonly<Record<string, string>>;
	readonly files?: readonly ITemplateFile[];
}

export interface IProjectTemplate {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly category: TemplateCategory;
	readonly kind: ProjectKind;
	readonly difficulty: TemplateDifficulty;
	readonly stack: readonly string[];
	readonly tags: readonly string[];
	readonly accent: string;
	readonly launchProfile: string;
	readonly runInstructions: string;
	readonly recommendedAddOns: readonly string[];
	readonly files: readonly ITemplateFile[];
}

const GITIGNORE_NODE = ['node_modules/', 'dist/', '.env', '*.log'].join('\n') + '\n';
const GITIGNORE_PY = ['__pycache__/', '.venv/', 'venv/', '*.pyc', '.env'].join('\n') + '\n';

export const COMPYLE_PROJECT_ADDONS: IProjectAddOn[] = [
	{
		id: 'tailwind',
		name: 'Tailwind CSS',
		description: 'Utility CSS setup for fast UI iteration.',
		kinds: ['website', 'webapp', 'desktop'],
		devDependencies: { tailwindcss: '^3.4.17', autoprefixer: '^10.4.20', postcss: '^8.4.49' },
		scripts: { 'style:setup': 'tailwindcss init -p' },
		files: [
			{ path: 'tailwind.config.js', content: 'export default { content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx,html}"], theme: { extend: {} }, plugins: [] };\n' },
			{ path: 'postcss.config.js', content: 'export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n' },
		],
	},
	{
		id: 'react-router',
		name: 'React Router',
		description: 'Client-side routing for multi-view React apps.',
		kinds: ['webapp', 'desktop'],
		dependencies: { 'react-router-dom': '^6.28.0' },
		files: [
			{ path: 'src/routes.tsx', content: 'export const routes = [{ path: "/", label: "Home" }];\n' },
		],
	},
	{
		id: 'zustand',
		name: 'Zustand Store',
		description: 'Small state store for app settings and user flows.',
		kinds: ['webapp', 'desktop'],
		dependencies: { zustand: '^5.0.2' },
		files: [
			{ path: 'src/store.ts', content: 'import { create } from "zustand";\n\ninterface AppState {\n\tready: boolean;\n\tsetReady(ready: boolean): void;\n}\n\nexport const useAppStore = create<AppState>(set => ({\n\tready: false,\n\tsetReady: ready => set({ ready }),\n}));\n' },
		],
	},
	{
		id: 'vitest',
		name: 'Vitest',
		description: 'Fast test runner for TypeScript and React projects.',
		kinds: ['webapp', 'desktop', 'cli'],
		devDependencies: { vitest: '^2.1.8' },
		scripts: { test: 'vitest' },
		files: [
			{ path: 'src/example.test.ts', content: 'import { describe, expect, test } from "vitest";\n\ndescribe("starter", () => {\n\ttest("runs tests", () => {\n\t\texpect(true).toBe(true);\n\t});\n});\n' },
		],
	},
	{
		id: 'eslint-prettier',
		name: 'ESLint + Prettier',
		description: 'Baseline formatting and linting config.',
		kinds: ['website', 'webapp', 'desktop', 'api', 'cli', 'bot'],
		devDependencies: { eslint: '^9.16.0', prettier: '^3.4.2' },
		scripts: { lint: 'eslint .', format: 'prettier --write .' },
		files: [
			{ path: '.prettierrc', content: '{\n\t"singleQuote": false,\n\t"semi": true\n}\n' },
		],
	},
	{
		id: 'fastapi-cors',
		name: 'CORS Middleware',
		description: 'FastAPI CORS setup for browser clients.',
		kinds: ['api'],
		pythonRequirements: ['fastapi', 'uvicorn'],
	},
	{
		id: 'python-dotenv',
		name: 'Python Dotenv',
		description: 'Load local environment variables safely during development.',
		kinds: ['api', 'bot'],
		pythonRequirements: ['python-dotenv'],
		files: [
			{ path: '.env.example', content: 'APP_ENV=development\n' },
		],
	},
	{
		id: 'commander',
		name: 'Commander CLI',
		description: 'Argument parsing for Node.js command-line tools.',
		kinds: ['cli'],
		dependencies: { commander: '^12.1.0' },
	},
	{
		id: 'electron-builder',
		name: 'Electron Builder',
		description: 'Packaging scripts for desktop app builds.',
		kinds: ['desktop'],
		devDependencies: { 'electron-builder': '^25.1.8' },
		scripts: { package: 'electron-builder --dir' },
	},
];

const STATIC_SITE: IProjectTemplate = {
	id: 'static-site',
	name: 'Static Website',
	description: 'A clean HTML, CSS, and JavaScript website with no build step.',
	category: 'web',
	kind: 'website',
	difficulty: 'beginner',
	stack: ['HTML', 'CSS', 'JavaScript'],
	tags: ['website', 'frontend', 'no-build'],
	accent: '#3B9EFF',
	launchProfile: 'Browser',
	runInstructions: 'Open index.html in a browser, or run: npx serve .',
	recommendedAddOns: ['eslint-prettier'],
	files: [
		{ path: 'index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>My Site</title>\n\t<link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n\t<main>\n\t\t<h1>Hello from Compyle</h1>\n\t\t<p>Edit index.html to get started.</p>\n\t\t<button id="cta">Click me</button>\n\t</main>\n\t<script src="script.js"></script>\n</body>\n</html>\n' },
		{ path: 'styles.css', content: ':root { color-scheme: light dark; }\nbody { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }\nmain { text-align: center; }\nbutton { padding: 10px 18px; border: 0; border-radius: 8px; cursor: pointer; }\n' },
		{ path: 'script.js', content: 'document.getElementById("cta").addEventListener("click", () => {\n\talert("It works!");\n});\n' },
		{ path: 'README.md', content: '# Static Website\n\nOpen index.html in a browser, or run:\n\n    npx serve .\n' },
	],
};

const VITE_REACT: IProjectTemplate = {
	id: 'vite-react-ts',
	name: 'Vite React Web App',
	description: 'A modern React single-page app powered by Vite and TypeScript.',
	category: 'web',
	kind: 'webapp',
	difficulty: 'intermediate',
	stack: ['React', 'TypeScript', 'Vite'],
	tags: ['react', 'spa', 'frontend', 'typescript'],
	accent: '#61DAFB',
	launchProfile: 'Vite Dev Server',
	runInstructions: 'Run: npm install, then npm run dev. Visit http://localhost:5173',
	recommendedAddOns: ['react-router', 'zustand', 'vitest', 'eslint-prettier'],
	files: [
		{ path: 'package.json', content: JSON.stringify({ name: 'vite-react-ts', private: true, version: '0.1.0', type: 'module', scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' }, dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' }, devDependencies: { '@vitejs/plugin-react': '^4.3.1', typescript: '^5.5.4', vite: '^5.4.2', '@types/react': '^18.3.4', '@types/react-dom': '^18.3.0' } }, null, 2) + '\n' },
		{ path: 'index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>Vite React</title>\n</head>\n<body>\n\t<div id="root"></div>\n\t<script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n' },
		{ path: 'vite.config.ts', content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()] });\n' },
		{ path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true }, include: ['src'] }, null, 2) + '\n' },
		{ path: 'src/main.tsx', content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport { App } from "./App";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n\t<React.StrictMode>\n\t\t<App />\n\t</React.StrictMode>,\n);\n' },
		{ path: 'src/App.tsx', content: 'import { useState } from "react";\n\nexport function App() {\n\tconst [count, setCount] = useState(0);\n\treturn (\n\t\t<main style={{ fontFamily: "system-ui", textAlign: "center", marginTop: "20vh" }}>\n\t\t\t<h1>Vite + React + Compyle</h1>\n\t\t\t<button onClick={() => setCount(count + 1)}>Count is {count}</button>\n\t\t</main>\n\t);\n}\n' },
		{ path: '.gitignore', content: GITIGNORE_NODE },
		{ path: 'README.md', content: '# Vite React Web App\n\nInstall and run:\n\n    npm install\n    npm run dev\n\nThen open http://localhost:5173\n' },
	],
};

const ELECTRON_APP: IProjectTemplate = {
	id: 'electron-ts-app',
	name: 'Electron Desktop App',
	description: 'A launchable desktop app using Electron, TypeScript, and Vite.',
	category: 'desktop',
	kind: 'desktop',
	difficulty: 'advanced',
	stack: ['Electron', 'TypeScript', 'Vite'],
	tags: ['desktop', 'app', 'electron', 'typescript'],
	accent: '#9BA7FF',
	launchProfile: 'Desktop App',
	runInstructions: 'Run: npm install, then npm run dev. The app opens in an Electron window.',
	recommendedAddOns: ['electron-builder', 'zustand', 'vitest', 'eslint-prettier'],
	files: [
		{ path: 'package.json', content: JSON.stringify({ name: 'electron-ts-app', version: '0.1.0', private: true, type: 'module', main: 'dist/main.js', scripts: { dev: 'vite --host 127.0.0.1 & tsc -p tsconfig.electron.json && electron .', build: 'tsc -p tsconfig.electron.json && vite build' }, dependencies: { '@vitejs/plugin-react': '^4.3.1', electron: '^33.2.1', react: '^18.3.1', 'react-dom': '^18.3.1' }, devDependencies: { typescript: '^5.5.4', vite: '^5.4.2', '@types/react': '^18.3.4', '@types/react-dom': '^18.3.0' } }, null, 2) + '\n' },
		{ path: 'index.html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>Compyle Desktop App</title>\n</head>\n<body>\n\t<div id="root"></div>\n\t<script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n' },
		{ path: 'electron/main.ts', content: 'import { app, BrowserWindow } from "electron";\nimport { join } from "path";\n\nfunction createWindow() {\n\tconst window = new BrowserWindow({ width: 1100, height: 760 });\n\tconst devUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";\n\tvoid window.loadURL(devUrl).catch(() => window.loadFile(join(process.cwd(), "dist", "index.html")));\n}\n\napp.whenReady().then(createWindow);\napp.on("window-all-closed", () => {\n\tif (process.platform !== "darwin") {\n\t\tapp.quit();\n\t}\n});\n' },
		{ path: 'tsconfig.electron.json', content: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', outDir: 'dist', strict: true, skipLibCheck: true }, include: ['electron'] }, null, 2) + '\n' },
		{ path: 'vite.config.ts', content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()], server: { port: 5173 } });\n' },
		{ path: 'src/main.tsx', content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport { App } from "./App";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n' },
		{ path: 'src/App.tsx', content: 'export function App() {\n\treturn <main style={{ fontFamily: "system-ui", padding: 32 }}><h1>Compyle Desktop App</h1><p>Build a real desktop workflow here.</p></main>;\n}\n' },
		{ path: '.gitignore', content: GITIGNORE_NODE },
		{ path: 'README.md', content: '# Electron Desktop App\n\nInstall and run:\n\n    npm install\n    npm run dev\n\nThe app opens in an Electron window.\n' },
	],
};

const EXPRESS_API: IProjectTemplate = {
	id: 'express-api',
	name: 'Express API',
	description: 'A minimal Node.js REST API using Express.',
	category: 'backend',
	kind: 'api',
	difficulty: 'intermediate',
	stack: ['Node.js', 'Express'],
	tags: ['api', 'backend', 'server'],
	accent: '#68A063',
	launchProfile: 'Node Server',
	runInstructions: 'Run: npm install, then npm run dev. Visit http://localhost:3000',
	recommendedAddOns: ['eslint-prettier'],
	files: [
		{ path: 'package.json', content: JSON.stringify({ name: 'express-api', version: '0.1.0', private: true, type: 'commonjs', scripts: { start: 'node server.js', dev: 'node server.js' }, dependencies: { express: '^4.19.2' } }, null, 2) + '\n' },
		{ path: 'server.js', content: 'const express = require("express");\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get("/", (req, res) => {\n\tres.json({ message: "Hello from Compyle Express API" });\n});\n\napp.listen(port, () => {\n\tconsole.log("API running on http://localhost:" + port);\n});\n' },
		{ path: '.gitignore', content: GITIGNORE_NODE },
		{ path: '.env.example', content: 'PORT=3000\n' },
		{ path: 'README.md', content: '# Express API\n\nInstall and run:\n\n    npm install\n    npm run dev\n\nThen open http://localhost:3000\n' },
	],
};

const FASTAPI_APP: IProjectTemplate = {
	id: 'fastapi-app',
	name: 'FastAPI Backend',
	description: 'A modern, typed Python API using FastAPI.',
	category: 'python',
	kind: 'api',
	difficulty: 'intermediate',
	stack: ['Python', 'FastAPI', 'Uvicorn'],
	tags: ['python', 'api', 'backend', 'async'],
	accent: '#05998B',
	launchProfile: 'Python API',
	runInstructions: 'Run: pip install -r requirements.txt, then uvicorn main:app --reload. Visit http://localhost:8000',
	recommendedAddOns: ['fastapi-cors', 'python-dotenv'],
	files: [
		{ path: 'main.py', content: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n\n@app.get("/")\ndef read_root():\n    return {"message": "Hello from Compyle FastAPI"}\n' },
		{ path: 'requirements.txt', content: 'fastapi\nuvicorn\n' },
		{ path: '.gitignore', content: GITIGNORE_PY },
		{ path: 'README.md', content: '# FastAPI Backend\n\nInstall and run:\n\n    pip install -r requirements.txt\n    uvicorn main:app --reload\n\nThen open http://localhost:8000\n' },
	],
};

const FLASK_APP: IProjectTemplate = {
	id: 'flask-app',
	name: 'Flask App',
	description: 'A minimal Python web app using Flask.',
	category: 'python',
	kind: 'api',
	difficulty: 'beginner',
	stack: ['Python', 'Flask'],
	tags: ['python', 'web', 'backend'],
	accent: '#000000',
	launchProfile: 'Python Web Server',
	runInstructions: 'Run: pip install -r requirements.txt, then flask run. Visit http://localhost:5000',
	recommendedAddOns: ['python-dotenv'],
	files: [
		{ path: 'app.py', content: 'from flask import Flask\n\napp = Flask(__name__)\n\n\n@app.route("/")\ndef home():\n    return "Hello from Compyle Flask"\n\n\nif __name__ == "__main__":\n    app.run(debug=True)\n' },
		{ path: 'requirements.txt', content: 'flask\n' },
		{ path: '.gitignore', content: GITIGNORE_PY },
		{ path: 'README.md', content: '# Flask App\n\nInstall and run:\n\n    pip install -r requirements.txt\n    flask run\n\nThen open http://localhost:5000\n' },
	],
};

const PYTHON_SCRIPT: IProjectTemplate = {
	id: 'python-script',
	name: 'Python Script',
	description: 'A blank Python automation project with a clean entry point.',
	category: 'python',
	kind: 'cli',
	difficulty: 'beginner',
	stack: ['Python'],
	tags: ['python', 'script', 'automation'],
	accent: '#FFD43B',
	launchProfile: 'Python Script',
	runInstructions: 'Run: python main.py',
	recommendedAddOns: ['python-dotenv'],
	files: [
		{ path: 'main.py', content: 'def main():\n    print("Hello from Compyle")\n\n\nif __name__ == "__main__":\n    main()\n' },
		{ path: 'requirements.txt', content: '' },
		{ path: '.gitignore', content: GITIGNORE_PY },
		{ path: 'README.md', content: '# Python Script\n\nRun:\n\n    python main.py\n' },
	],
};

const NODE_CLI: IProjectTemplate = {
	id: 'node-cli',
	name: 'Node CLI Tool',
	description: 'A command-line tool starter for Node.js.',
	category: 'cli',
	kind: 'cli',
	difficulty: 'intermediate',
	stack: ['Node.js'],
	tags: ['cli', 'tool', 'automation'],
	accent: '#8957E5',
	launchProfile: 'Node CLI',
	runInstructions: 'Run: node index.js --name World',
	recommendedAddOns: ['commander', 'eslint-prettier'],
	files: [
		{ path: 'package.json', content: JSON.stringify({ name: 'node-cli', version: '0.1.0', private: true, type: 'commonjs', bin: { 'node-cli': 'index.js' }, scripts: { start: 'node index.js' } }, null, 2) + '\n' },
		{ path: 'index.js', content: '#!/usr/bin/env node\nconst args = process.argv.slice(2);\nconst nameIndex = args.indexOf("--name");\nconst name = nameIndex !== -1 ? args[nameIndex + 1] : "World";\nconsole.log("Hello, " + name + "!");\n' },
		{ path: '.gitignore', content: GITIGNORE_NODE },
		{ path: 'README.md', content: '# Node CLI Tool\n\nRun:\n\n    node index.js --name World\n' },
	],
};

const DISCORD_BOT: IProjectTemplate = {
	id: 'discord-bot-py',
	name: 'Discord Bot (Python)',
	description: 'A starter Discord bot using discord.py.',
	category: 'bot',
	kind: 'bot',
	difficulty: 'intermediate',
	stack: ['Python', 'discord.py'],
	tags: ['bot', 'discord', 'python'],
	accent: '#5865F2',
	launchProfile: 'Python Bot',
	runInstructions: 'Set DISCORD_TOKEN in .env, run: pip install -r requirements.txt, then python bot.py',
	recommendedAddOns: ['python-dotenv'],
	files: [
		{ path: 'bot.py', content: 'import os\nimport discord\n\nintents = discord.Intents.default()\nintents.message_content = True\nclient = discord.Client(intents=intents)\n\n\n@client.event\nasync def on_ready():\n    print("Logged in as " + str(client.user))\n\n\n@client.event\nasync def on_message(message):\n    if message.author == client.user:\n        return\n    if message.content.startswith("!ping"):\n        await message.channel.send("Pong!")\n\n\nclient.run(os.environ["DISCORD_TOKEN"])\n' },
		{ path: 'requirements.txt', content: 'discord.py\n' },
		{ path: '.env.example', content: 'DISCORD_TOKEN=your-token-here\n' },
		{ path: '.gitignore', content: GITIGNORE_PY },
		{ path: 'README.md', content: '# Discord Bot\n\n1. Copy .env.example to .env and add your token.\n2. Install and run:\n\n    pip install -r requirements.txt\n    python bot.py\n' },
	],
};

export const COMPYLE_TEMPLATES: IProjectTemplate[] = [
	STATIC_SITE,
	VITE_REACT,
	ELECTRON_APP,
	EXPRESS_API,
	FASTAPI_APP,
	FLASK_APP,
	PYTHON_SCRIPT,
	NODE_CLI,
	DISCORD_BOT,
];

export function getTemplate(id: string): IProjectTemplate | undefined {
	return COMPYLE_TEMPLATES.find(t => t.id === id);
}

export function getAddOn(id: string): IProjectAddOn | undefined {
	return COMPYLE_PROJECT_ADDONS.find(addOn => addOn.id === id);
}

export function getAddOnsForTemplate(template: IProjectTemplate): IProjectAddOn[] {
	return COMPYLE_PROJECT_ADDONS.filter(addOn => addOn.kinds.includes(template.kind));
}
