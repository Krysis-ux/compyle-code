# Compyle Code — Roadmap

## Phase 0 — Legal & Compliance (COMPLETE ✅)

- [x] Compliance audit document
- [x] Legal notices document
- [x] product.json rebrand (all identity fields)
- [x] Microsoft telemetry disabled by default
- [x] Microsoft voice service endpoint removed
- [x] GitHub Copilot as default agent removed
- [x] Open VSX configured as default extension registry
- [x] Microsoft CDN webview template removed
- [x] Welcome screen strings updated to Compyle Code
- [x] Marketplace headers updated (CompyleCode instead of VSCode)
- [x] Linux desktop metadata updated
- [x] Compliance check script (`npm run compyle:compliance`)
- [x] Extension policy module (blocklist, risk classification)
- [x] Compyle SVG icon source files

## Phase 1 — Foundation Scaffold (COMPLETE ✅)

- [x] Compyle Brain AI contribution (commands + settings)
- [x] Compyle Theme Gallery contribution (settings + commands)
- [x] Compyle Sound Settings contribution
- [x] Compyle Extension Shield contribution
- [x] Compyle Performance Panel contribution
- [x] Compyle Spec-Driven Development contribution
- [x] Architecture map documentation
- [x] AI privacy documentation

## Phase 2 — Icon Replacement (TODO)

- [ ] Generate .icns from SVG source (requires Inkscape + iconutil)
- [ ] Generate .ico from SVG source
- [ ] Generate PNG variants for Linux and web
- [ ] Replace all `resources/*/code.*` icon files
- [ ] Replace `resources/server/favicon.ico`

## Phase 3 — Compyle Brain MVP (TODO)

- [ ] Implement `CompyleBrainService` — connects to configured provider
- [ ] Implement Anthropic provider (using `@anthropic-ai/sdk`)
- [ ] Implement OpenAI-compatible provider
- [ ] Implement Ollama provider
- [ ] Context picker UI — show files in context, allow add/remove
- [ ] Context preview dialog — show what will be sent before cloud calls
- [ ] Project memory file creation (.compyle/ directory)
- [ ] "Generate Project Memory" command — analyze workspace, write PROJECT_MEMORY.md
- [ ] "Explain Error" command — capture diagnostic, explain in plain English
- [ ] Brain panel webview — chat-style interface

## Phase 4 — Theme Gallery MVP (TODO)

- [ ] Compyle Dark theme JSON (using Compyle palette)
- [ ] Compyle Light theme JSON
- [ ] Theme gallery panel — grid of theme previews
- [ ] Category filtering (Dark, Light, Neon, etc.)
- [ ] Favorites system
- [ ] Random theme on launch
- [ ] Theme health checker (low contrast detection)
- [ ] Match OS dark/light mode

## Phase 5 — Sound System MVP (TODO)

- [ ] `CompyleSoundService` — settings-driven audio service
- [ ] Minimal sound pack (MP3/OGG files)
- [ ] Save sound trigger
- [ ] Build success/error sound trigger
- [ ] AI complete sound trigger
- [ ] Volume control
- [ ] Disable on OS reduce-motion

## Phase 6 — Extension Shield MVP (TODO)

- [ ] Hook into extension install lifecycle
- [ ] Block installation of blocked extension IDs
- [ ] Show risk badge in extension list
- [ ] VSIX install warning dialog
- [ ] Extension source label (Open VSX / Local / Unknown)
- [ ] Publisher warning for ms-* / github.*

## Phase 7 — Performance Panel MVP (TODO)

- [ ] Startup time display
- [ ] Extension activation time list
- [ ] Memory usage display
- [ ] "Disable Slow Extensions" — list + toggle
- [ ] "Restart Language Server" quick action
- [ ] Export performance report

## Phase 8 — Spec-Driven Development MVP (TODO)

- [ ] "Build From Idea" quick input
- [ ] Generate REQUIREMENTS.md via Compyle Brain
- [ ] Approval flow (user reviews → approve → generate DESIGN.md)
- [ ] Generate TASKS.md
- [ ] Task checklist sidebar
- [ ] "Implement Next Task" → Compyle Brain Edit mode with diff

## Phase 9 — Premium UX Polish (TODO)

- [ ] Compyle welcome screen (custom, not just Getting Started)
- [ ] "What are you building?" launcher on first open
- [ ] Beginner / Pro / Minimal layout modes
- [ ] Premium empty states
- [ ] Consistent spacing/button audit
- [ ] Migration wizard (import VS Code settings, map extensions)

## Phase 10 — Additional Premium Features (TODO)

- [ ] Compyle Doctor (detect missing tools, explain setup errors)
- [ ] Compyle Runway (unified run/build/test panel)
- [ ] Compyle Project Launcher (new project templates)
- [ ] Compyle Convert (file/language converter)
- [ ] Compyle Learn side panel
- [ ] Network Activity Inspector (show all outbound connections)

## Phase 11 — Server / Cloud Mode (Future)

- [ ] Architecture audit for OpenVSCode Server compatibility
- [ ] Browser workspace mode planning
- [ ] Compyle Cloud workspace (optional, if Compyle builds hosting)

---

## Competitive Position

| Feature | VSCodium | Cursor | Windsurf | Compyle Code |
|---------|---------|--------|---------|--------------|
| Privacy-first | ✅ | ❌ | ❌ | ✅ |
| Open VSX | ✅ | ❌ | ❌ | ✅ |
| AI-native | ❌ | ✅ | ✅ | 🔨 (Phase 3) |
| BYOK AI | ❌ | Limited | ❌ | ✅ |
| Local models | ❌ | Limited | ❌ | ✅ |
| Theme gallery | ❌ | ❌ | ❌ | 🔨 (Phase 4) |
| Spec-driven dev | ❌ | ❌ | Limited | 🔨 (Phase 8) |
| Extension Shield | ❌ | ❌ | ❌ | 🔨 (Phase 6) |
| Performance panel | ❌ | ❌ | ❌ | 🔨 (Phase 7) |
| Premium UX | ❌ | ✅ | ✅ | 🔨 (Phase 9) |

🔨 = In development / scaffolded
