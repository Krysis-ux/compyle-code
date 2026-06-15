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

- [ ] Implement `CompyleBrainService` in `src/vs/workbench/contrib/compyleBrain/browser/compyleBrainService.ts`
  - [ ] Anthropic provider (using @anthropic-ai/sdk already in package.json)
  - [ ] OpenAI-compatible provider
  - [ ] Ollama provider
  - [ ] Context picker UI
  - [ ] Context preview dialog (show files before cloud send)
- [ ] Create Compyle Dark theme JSON at `extensions/theme-defaults/themes/compyle-dark.json`
- [ ] Create Compyle Light theme JSON at `extensions/theme-defaults/themes/compyle-light.json`
- [ ] Create `CompyleSoundService` with Minimal sound pack
- [ ] Connect Extension Shield to extension install lifecycle (hook in `extensionsWorkbenchService.ts`)
- [ ] Write Compyle welcome screen component (separate from Getting Started)

## 🟡 Medium Priority (Phase 3)

- [ ] "Build From Idea" quick input with REQUIREMENTS.md generation
- [ ] Project memory file creation (`.compyle/` directory setup command)
- [ ] "Generate Project Memory" command — workspace analysis
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
