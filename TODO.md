# TODO — Compyle Code

> Maintained by AI agents and developers. Check off items as completed.

## 🔴 Critical (Before Distribution)

- [ ] Replace binary icon files:
  - [ ] `resources/darwin/code.icns` → Compyle .icns (build from `assets/compyle/icons/compyle-code.svg`)
  - [ ] `resources/linux/code.png` → Compyle 512px PNG
  - [ ] `resources/win32/code.ico` → Compyle .ico
  - [ ] `resources/server/code-192.png` → Compyle 192px PNG
  - [ ] `resources/server/code-512.png` → Compyle 512px PNG
  - [ ] `resources/server/favicon.ico` → Compyle favicon
- [ ] Exclude `extensions/copilot/` from distribution build output
- [ ] Audit `src/vs/workbench/contrib/surveys/` for hardcoded Microsoft survey URLs
- [ ] Audit `src/vs/workbench/contrib/experiments/` for hardcoded Microsoft experiment endpoints
- [ ] Get lawyer review for items in `docs/legal/COMPYLE_CODE_COMPLIANCE_AUDIT.md` §10
- [ ] Regenerate Windows installer GUIDs (win32x64AppId, win32arm64AppId, etc.)

## 🟠 High Priority (Phase 2)

- [ ] Compyle Tutor panel (WebviewView) — visual lesson card display, not just notifications
- [ ] Focus mode actual panel hiding — wire `compyle.modes.focus.hideSidePanels` to toggle panels
- [ ] Memory auto-update detection — file watcher + throttle for `CHANGELOG.md` on save
- [ ] Sound per-mode behavior — connect mode switching to CompyleSoundService
- [ ] Tutor "Quiz Me" / "Generate Practice" commands — requires Compyle Brain
- [ ] Implement `CompyleBrainService` in `src/vs/workbench/contrib/compyleBrain/browser/compyleBrainService.ts`
  - [ ] Anthropic provider (using @anthropic-ai/sdk already in package.json)
  - [ ] OpenAI-compatible provider
  - [ ] Ollama provider
  - [ ] Context picker UI
  - [ ] Context preview dialog (show files before cloud send)
- [x] Create Compyle Dark theme JSON → `extensions/compyle-themes/themes/compyle-dark.json`
- [x] Create Compyle Light theme JSON → `extensions/compyle-themes/themes/compyle-light.json`
- [ ] Create `CompyleSoundService` with Minimal sound pack
- [ ] Connect Extension Shield to extension install lifecycle (hook in `extensionsWorkbenchService.ts`)
- [ ] Write Compyle welcome screen component (separate from Getting Started)

## 🟡 Medium Priority (Phase 3)

- [ ] "Build From Idea" quick input with REQUIREMENTS.md generation
- [x] Project memory file creation (`.compyle/` directory setup command) — `compyle.modes.initMemory`
- [x] "Generate Project Memory" command — writes 7 memory files via `compyleFlowMemory.ts`
- [ ] Theme gallery panel (grid view with previews)
- [ ] Favorites system for themes
- [ ] Random-on-launch theme feature
- [ ] Theme health checker (contrast validation)
- [ ] Extension risk badge in extensions list view
- [ ] VSIX install warning dialog

## 🟢 Lower Priority (Phase 4+)

- [ ] Performance panel with real data (startup time, extension activation)
- [ ] "Disable Slow Extensions" — list extensions by activation time
- [ ] Spec-driven development: full flow (Idea → REQUIREMENTS → DESIGN → TASKS → Implementation)
- [ ] Compyle Doctor (tool detection, setup help)
- [ ] Compyle Runway (unified run/build/test panel)
- [ ] Compyle Project Launcher (project templates)
- [ ] Migration wizard (import VS Code settings)
- [ ] Network Activity Inspector
- [ ] Compyle Learn panel
- [ ] Sound pack: Minimal (actual audio files)
- [ ] Sound pack: Soft
- [ ] macOS: binary icons for all language types in `resources/darwin/*.icns`

## 📚 Documentation

- [ ] Update `README.md` to describe Compyle Code (not VS Code)
- [ ] Update `CONTRIBUTING.md` for Compyle development
- [ ] Add `docs/COMPYLE_CODE_HANDOFF.md` — detailed developer handoff
- [ ] Add setup guide for building Compyle Code from source

## ✅ Done

- [x] Compyle Workspace Experiences system (Flow, Focus, Tutor, Resolve modes)
- [x] Mode status bar item (`compyleModeStatusBar.ts`)
- [x] Mode quick pick switcher (`compyleModeQuickPick.ts`)
- [x] First-open workspace prompt (`compyleModeWelcome.ts`)
- [x] Flow memory system (`.compyle/` directory, 7 files, secret scanning)
- [x] Tutor concept detection (17 Python + 9 JS + 3 CSS lesson cards)
- [x] Bug report generation from Problems panel diagnostics
- [x] All Compyle contributions wired into `workbench.common.main.ts` (previously dead code)
- [x] `docs/COMPYLE_WORKSPACE_MODES.md`
- [x] `docs/COMPYLE_FLOW_MEMORY.md`
- [x] `docs/COMPYLE_TUTOR_ARCHITECTURE.md`
- [x] `docs/COMPYLE_RESOLVE_WORKSPACE.md`
- [x] Compliance audit document (`docs/legal/COMPYLE_CODE_COMPLIANCE_AUDIT.md`)
- [x] Legal notices (`docs/legal/COMPYLE_CODE_LEGAL_NOTICES.md`)
- [x] `product.json` rebranded — all identity fields
- [x] Microsoft endpoints removed (voice, copilot, CDN)
- [x] Open VSX configured as extension registry
- [x] Telemetry disabled by default
- [x] Welcome screen strings updated
- [x] Marketplace headers updated
- [x] Linux desktop resources updated
- [x] Compliance check script (`scripts/check-compliance.mjs`)
- [x] Extension policy module
- [x] Compyle SVG icon sources
- [x] Compyle Brain scaffold
- [x] Theme Gallery scaffold
- [x] Sound Settings scaffold
- [x] Extension Shield scaffold
- [x] Performance Panel scaffold
- [x] Spec-Driven Development scaffold
- [x] Architecture map, roadmap, features docs
- [x] AI privacy, extension policy, theme, sound docs
- [x] COMPYLE_CODE_MEMORY.md, CLAUDE_HANDOFF.md, IMPLEMENTATION_LOG.md
