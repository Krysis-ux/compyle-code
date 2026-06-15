# Compyle Code — Persistent Memory

> This file is the persistent memory for all AI agents (Claude, Codex, etc.) working on this project.
> Update this file after every major change. Future sessions start here.

## What Is This Project?

**Compyle Code** is a premium open-source IDE forked from **Code - OSS** (the open-source foundation of Microsoft VS Code, licensed under MIT). It is:

- NOT affiliated with Microsoft
- NOT VS Code or a reskin of VS Code — it is a separate product with its own identity
- Built to be privacy-first, AI-native, and legally clean
- Using **Open VSX** as the default extension registry (not Microsoft Marketplace)
- Targeting developers who want to leave VS Code, Cursor, Windsurf, Trae, or VSCodium

## Repository

- **Repo**: https://github.com/krysis-ux/compyle-code
- **Branch**: `claude/funny-cray-xj32la` (active development branch)
- **Base**: Code - OSS (microsoft/vscode), MIT License
- **Working directory**: `/home/user/compyle-code`

## Product Identity

| Field | Value |
|-------|-------|
| nameShort | Compyle Code |
| nameLong | Compyle Code |
| applicationName | compyle-code |
| dataFolderName | .compyle-code |
| CLI command | compyle-code |
| macOS bundle | com.compyle.code |
| Windows App ID | Compyle.CompyleCode |
| Extension registry | https://open-vsx.org/vscode/gallery |
| Issue tracker | https://github.com/krysis-ux/compyle-code/issues |
| Telemetry default | OFF |

## What Has Been Done (Session 1 — 2026-06-15)

### Legal & Compliance
- Created `docs/legal/COMPYLE_CODE_COMPLIANCE_AUDIT.md` — full audit of all Microsoft branding/endpoints
- Created `docs/legal/COMPYLE_CODE_LEGAL_NOTICES.md` — Compyle legal attribution notices
- LICENSE.txt and ThirdPartyNotices.txt preserved intact (MIT requires this)

### Product Rebrand (`product.json`)
- nameShort/nameLong: "Compyle Code"
- applicationName: "compyle-code"
- dataFolderName: ".compyle-code"
- win32AppUserModelId: "Compyle.CompyleCode"
- win32DirName/NameVersion: "Compyle Code"
- darwinBundleIdentifier: "com.compyle.code"
- linuxIconName: "compyle-code"
- urlProtocol: "compyle-code"
- serverApplicationName: "compyle-code-server"
- tunnelApplicationName: "compyle-tunnel"
- licenseUrl/reportIssueUrl: updated to krysis-ux/compyle-code repo
- **REMOVED**: voiceWsUrl (Microsoft voice service)
- **REMOVED**: defaultChatAgent GitHub Copilot (replaced with Compyle Brain stub)
- **REMOVED**: trustedExtensionAuthAccess (GitHub Copilot auth)
- **REMOVED**: builtInExtensionsEnabledWithAutoUpdates (GitHub.copilot-chat)
- **REMOVED**: webviewContentExternalBaseUrlTemplate (Microsoft CDN)
- **ADDED**: extensionsGallery → Open VSX
- **ADDED**: enableTelemetry: false
- **KEPT**: 3 MIT-licensed builtInExtensions (js-debug, js-debug-companion, js-profile-table)

### Microsoft Service Endpoints
- Microsoft 1DS telemetry: DISABLED via `enableTelemetry: false` (endpoint still in source but never called)
- Microsoft voice service: REMOVED from product.json
- Microsoft Marketplace: NOT configured (was already absent in Code-OSS, now Open VSX added)
- GitHub Copilot APIs: REMOVED (defaultChatAgent replaced)
- Microsoft CDN: REMOVED

### Welcome Screen Rebrand
- `src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts`
  - "Get started with VS Code" → "Get started with Compyle Code"
  - "Setup VS Code" → "Setup Compyle Code"
  - "Get Started with VS Code for the Web" → "Get Started with Compyle Code for the Web"
  - "VS Code's power-ups" → "Compyle Code's power-ups" (both web and desktop variants)
  - "VS Code extension marketplace" → "Open VSX extension registry"
  - Video tutorial link → Compyle docs link
  - Git install link → official git-scm.com (removed aka.ms link)
  - Workspace Trust link → Compyle docs link
  - AI step title → "Compyle Brain" instead of "Copilot"
  - Accessibility descriptions updated

### Marketplace Headers
- `src/vs/platform/externalServices/common/marketplace.ts`
  - X-Market-Client-Id: "VSCode {ver}" → "CompyleCode {ver}"
  - User-Agent: "VSCode {ver}" → "CompyleCode {ver}"

### Linux Desktop Resources
- `resources/linux/code.desktop` — Keywords updated (removed vscode, added compyle)
- `resources/linux/code.appdata.xml` — All VS Code/Microsoft URLs and descriptions replaced

### Compyle Icon Assets (SVG Sources)
- `assets/compyle/icons/compyle-code.svg` (128px canonical)
- `assets/compyle/icons/compyle-code-128.svg`
- `assets/compyle/icons/compyle-code-48.svg`
- `assets/compyle/icons/compyle-code-32.svg`
- `assets/compyle/icons/compyle-code-16.svg`
- `assets/compyle/README.md` — Design concept, palette, build instructions
- **NOTE**: Binary icons (.icns, .ico, .png) still need replacement — requires design tooling

### Compliance Script
- `scripts/check-compliance.mjs` — CI script that fails on forbidden strings
  - Scans product.json, marketplace.ts, telemetry, welcome, resources
  - Exempts 1dsAppender.ts (disabled by config), legal docs, LICENSE files
  - **Status**: ✅ PASSING (0 violations)
- `package.json` scripts added: `compyle:compliance`, `compyle:audit`

### Extension Policy
- `src/vs/platform/compyleExtensionPolicy/common/compyleExtensionPolicy.ts`
  - CompyleExtensionRisk enum: Safe | Unknown | Warning | Restricted | Blocked
  - BLOCKED: GitHub.copilot, GitHub.copilot-chat, ms-vscode.remote-server, ms-dotnettools.csdevkit
  - RESTRICTED: ms-vscode-remote.remote-ssh, remote-wsl, remote-containers
  - WARNING: ms-python.python, ms-toolsai.jupyter

### Premium Feature Scaffolds
All are registered contributions with settings and commands. None have full implementation yet.

| Feature | Location | Status |
|---------|----------|--------|
| Compyle Brain (AI) | `src/vs/workbench/contrib/compyleBrain/` | Scaffolded — types, commands, settings |
| Theme Gallery | `src/vs/workbench/contrib/compyleThemes/` | Scaffolded — settings, categories, commands |
| Sound Settings | `src/vs/workbench/contrib/compyleSounds/` | Scaffolded — all settings registered |
| Extension Shield | `src/vs/workbench/contrib/compyleExtensionShield/` | Scaffolded — settings, risk badges, safe mode |
| Performance Panel | `src/vs/workbench/contrib/compylePerformance/` | Scaffolded — commands, delegates to built-in |
| Spec-Driven Dev | `src/vs/workbench/contrib/compyleSpec/` | Scaffolded — types, templates, commands |

### Documentation Created
- `docs/COMPYLE_CODE_ARCHITECTURE_MAP.md` — Where everything lives in the codebase
- `docs/COMPYLE_CODE_ROADMAP.md` — Phased roadmap with competitive positioning
- `docs/COMPYLE_CODE_FEATURES.md` — User-facing feature descriptions
- `docs/COMPYLE_CODE_AI_PRIVACY.md` — AI privacy policy and data flow
- `docs/COMPYLE_CODE_EXTENSION_POLICY.md` — Extension registry policy and blocklist
- `docs/COMPYLE_CODE_THEME_SYSTEM.md` — Theme architecture and adding new themes
- `docs/COMPYLE_CODE_SOUND_SYSTEM.md` — Sound service architecture

## What Still Needs to Be Done

### Immediate (Before Any Distribution)
1. **Binary icon replacement** — generate .icns/.ico/.png from SVG sources (needs Inkscape/design tool)
2. **Copilot extension exclusion** — ensure `extensions/copilot/` is excluded from build output
3. **Survey/experiment audit** — check `src/vs/workbench/contrib/surveys/` and `experiments/` for hardcoded Microsoft URLs
4. **Windows installer GUIDs** — regenerate for Compyle (current ones are from Code-OSS)
5. **Lawyer review** — all items in `docs/legal/COMPYLE_CODE_COMPLIANCE_AUDIT.md` Section 10

### Phase 2 Next Steps
- Implement CompyleBrainService (actual AI calls)
- Implement Compyle Dark/Light themes (JSON files)
- Create CompyleSoundService with minimal sound pack
- Connect Extension Shield to extension install lifecycle
- Create welcome screen panel (custom, beyond Getting Started)

## Critical Rules for This Project

1. **NEVER** push to main or any branch other than `claude/funny-cray-xj32la`
2. **NEVER** remove Microsoft copyright headers from source files
3. **NEVER** add marketplace.visualstudio.com to runtime code
4. **NEVER** add Microsoft telemetry endpoints to product.json
5. **ALWAYS** run `npm run compyle:compliance` before committing
6. **ALWAYS** update this file and `IMPLEMENTATION_LOG.md` after major changes
7. **ALWAYS** keep LICENSE.txt and ThirdPartyNotices.txt intact
8. **Compyle Brain settings** namespace: `compyle.brain.*`
9. **Extension Shield** namespace: `compyle.extensionShield.*`
10. **Theme settings** namespace: `compyle.themes.*`
11. **Sound settings** namespace: `compyle.sounds.*`

## Key File Locations Quick Reference

| What | Where |
|------|-------|
| Product config | `product.json` (root) |
| Compliance check | `scripts/check-compliance.mjs` |
| Extension policy | `src/vs/platform/compyleExtensionPolicy/common/compyleExtensionPolicy.ts` |
| Compyle Brain types | `src/vs/workbench/contrib/compyleBrain/common/compyleBrain.ts` |
| Compyle Brain commands/settings | `src/vs/workbench/contrib/compyleBrain/browser/compyleBrain.contribution.ts` |
| Marketplace headers | `src/vs/platform/externalServices/common/marketplace.ts` |
| Welcome content | `src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts` |
| 1DS telemetry (disabled) | `src/vs/platform/telemetry/common/1dsAppender.ts` |
| Linux desktop | `resources/linux/code.desktop` |
| Linux appdata | `resources/linux/code.appdata.xml` |
| Compyle icons (SVG) | `assets/compyle/icons/` |
| Legal docs | `docs/legal/` |
| Architecture map | `docs/COMPYLE_CODE_ARCHITECTURE_MAP.md` |
| Roadmap | `docs/COMPYLE_CODE_ROADMAP.md` |
| AI privacy | `docs/COMPYLE_CODE_AI_PRIVACY.md` |
| Extension policy docs | `docs/COMPYLE_CODE_EXTENSION_POLICY.md` |

## Compyle Color Palette

```
background:        #1e1e3f
surface:           #2d2b55
panel:             #252545
border:            #3d3b6e
accent:            #7c6af7
accent-2:          #56d9cc
text-primary:      #e8e6f0
text-secondary:    #9d9bbd
success:           #4ade80
warning:           #fbbf24
error:             #f87171
code-keyword:      #c084fc
code-string:       #86efac
code-function:     #7dd3fc
code-comment:      #6b7280
code-number:       #fde68a
terminal-bg:       #0d0d1a
terminal-fg:       #e8e6f0
```

## Build System Notes

- **Build**: Gulp + TypeScript (`npm run compile`, `npm run gulp compile`)
- **Test**: `npm test`, `npm run test-node`
- **Compliance**: `npm run compyle:compliance`
- **Branch to push**: `claude/funny-cray-xj32la`
- **Remote**: `git push -u origin claude/funny-cray-xj32la`
- The app cannot be launched in the remote container without Electron build chain
- Build the app locally: `npm run compile && ./scripts/code.sh`
