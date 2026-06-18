# Compyle Code — Architecture Map

> Reference for developers and AI agents working on this codebase.

## Product Identity

| Concern | Location |
|---------|----------|
| App name, IDs, URLs | `product.json` (root) |
| Product TypeScript types | `src/vs/platform/product/common/productService.ts` |
| Runtime product loading | `src/vs/platform/product/common/product.ts` |
| Injected via `IProductService` | Throughout `src/vs/` |

## Branding & UI

| Concern | Location |
|---------|----------|
| Window title | `src/vs/workbench/browser/parts/titlebar/windowTitle.ts` |
| About dialog | `src/vs/workbench/browser/actions/windowActions.ts` → `ShowAboutDialogAction` |
| Welcome / Getting Started | `src/vs/workbench/contrib/welcomeGettingStarted/` |
| Getting started content (user-visible strings) | `src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts` |
| Interactive walkthrough | `src/vs/workbench/contrib/welcomeWalkthrough/` |
| Welcome banner | `src/vs/workbench/contrib/welcomeBanner/` |
| Onboarding flow | `src/vs/workbench/contrib/welcomeOnboarding/` |

## Settings System

| Concern | Location |
|---------|----------|
| Settings UI | `src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts` |
| Configuration registry | `src/vs/platform/configuration/common/configurationRegistry.ts` |
| Compyle settings registration | `src/vs/workbench/contrib/compyleBrain/browser/compyleBrain.contribution.ts` |
| Compyle theme settings | `src/vs/workbench/contrib/compyleThemes/browser/compyleThemes.contribution.ts` |
| Compyle sound settings | `src/vs/workbench/contrib/compyleSounds/browser/compyleSounds.contribution.ts` |
| Compyle extension shield settings | `src/vs/workbench/contrib/compyleExtensionShield/browser/compyleExtensionShield.contribution.ts` |

## Theme System

| Concern | Location |
|---------|----------|
| Core theme platform | `src/vs/platform/theme/` |
| Color token registry | `src/vs/platform/theme/common/colorRegistry.ts` |
| Color definitions (modular) | `src/vs/platform/theme/common/colors/` |
| Theme service | `src/vs/workbench/services/themes/` |
| Built-in themes (JSON) | `extensions/theme-defaults/themes/` |
| Theme picker contribution | `src/vs/workbench/contrib/themes/browser/themes.contribution.ts` |
| Compyle theme gallery | `src/vs/workbench/contrib/compyleThemes/browser/compyleThemes.contribution.ts` |

## Extension System

| Concern | Location |
|---------|----------|
| Extension gallery service | `src/vs/platform/extensionManagement/common/extensionGalleryService.ts` |
| Gallery manifest | `src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts` |
| Extension management UI | `src/vs/workbench/contrib/extensions/browser/` |
| Extension marketplace config | `product.json` → `extensionsGallery` (now points to Open VSX) |
| Compyle extension policy | `src/vs/platform/compyleExtensionPolicy/common/compyleExtensionPolicy.ts` |
| Extension shield contribution | `src/vs/workbench/contrib/compyleExtensionShield/browser/` |
| Bundled (in-repo) extensions | `extensions/` (105 folders) |
| Built-in extensions (downloaded at build) | `product.json` → `builtInExtensions` |

## Telemetry

| Concern | Location |
|---------|----------|
| Telemetry service | `src/vs/platform/telemetry/common/telemetryService.ts` |
| Microsoft 1DS appender (disabled) | `src/vs/platform/telemetry/common/1dsAppender.ts` |
| Telemetry level config | User setting `telemetry.telemetryLevel` |
| Default: off | `product.json` → `"enableTelemetry": false` |

## Service Endpoints

| Service | Status | Config Location |
|---------|--------|-----------------|
| Microsoft 1DS telemetry | Disabled | `product.json: enableTelemetry: false` |
| Microsoft Marketplace | Removed | `product.json: extensionsGallery` → Open VSX |
| Open VSX extension registry | Active | `product.json: extensionsGallery.serviceUrl` |
| Microsoft voice service | Removed | `voiceWsUrl` deleted from product.json |
| GitHub Copilot APIs | Removed | `defaultChatAgent` replaced with Compyle Brain stub |
| Auto-update service | Not configured | No `updateUrl` in product.json |
| Microsoft CDN (webviews) | Removed | `webviewContentExternalBaseUrlTemplate` deleted |

## AI / Compyle Brain

| Concern | Location |
|---------|----------|
| Types and constants | `src/vs/workbench/contrib/compyleBrain/common/compyleBrain.ts` |
| Project memory helpers | `src/vs/workbench/contrib/compyleBrain/common/compyleBrainMemory.ts` |
| Commands + settings registration | `src/vs/workbench/contrib/compyleBrain/browser/compyleBrain.contribution.ts` |
| Project memory files (workspace) | `.compyle/PROJECT_MEMORY.md`, `RULES.md`, `ARCHITECTURE.md`, etc. |
| AI Privacy docs | `docs/COMPYLE_CODE_AI_PRIVACY.md` |

## Sound System

| Concern | Location |
|---------|----------|
| Existing accessibility signals | `src/vs/platform/accessibilitySignal/browser/accessibilitySignalService.ts` |
| Compyle sound settings | `src/vs/workbench/contrib/compyleSounds/browser/compyleSounds.contribution.ts` |
| All sounds default: off | `compyle.sounds.enabled: false` |

## Spec-Driven Development

| Concern | Location |
|---------|----------|
| Commands + types | `src/vs/workbench/contrib/compyleSpec/browser/compyleSpec.contribution.ts` |
| Spec files (workspace) | `.compyle/specs/<feature>/REQUIREMENTS.md`, `DESIGN.md`, `TASKS.md` |

## Build System

| Concern | Location |
|---------|----------|
| Main build entry | `gulpfile.mjs` |
| Client compilation | `build/gulpfile.compile.ts` |
| Extension build | `build/gulpfile.extensions.ts` |
| Platform packaging | `build/gulpfile.vscode.*.ts` |
| Build configuration | `build/` |
| Asset/icon locations | `resources/darwin/`, `resources/linux/`, `resources/win32/`, `resources/server/` |
| Compyle SVG source icons | `assets/compyle/icons/` |

## Command Palette

All Compyle commands are registered under category `"Compyle"` and are `f1: true` (appear in command palette). See individual `*.contribution.ts` files in `src/vs/workbench/contrib/compyle*/`.

## Workbench Layout

```
src/vs/workbench/
  browser/
    parts/            ← Title bar, sidebar, panel, editor, statusbar
    actions/          ← Window-level actions (About, etc.)
    layout.ts         ← Layout management
  contrib/            ← 100+ feature contributions (where Compyle features live)
    compyleBrain/     ← AI assistant
    compyleThemes/    ← Theme gallery
    compyleSounds/    ← Sound settings
    compyleExtensionShield/  ← Extension security
    compylePerformance/      ← Performance panel
    compyleSpec/      ← Spec-driven development
  services/           ← Core workbench services
  api/                ← Extension API
```

## Legal Files

| File | Purpose |
|------|---------|
| `LICENSE.txt` | MIT license — do not modify |
| `ThirdPartyNotices.txt` | Third-party attributions — do not remove entries |
| `docs/legal/COMPYLE_CODE_COMPLIANCE_AUDIT.md` | Compliance audit |
| `docs/legal/COMPYLE_CODE_LEGAL_NOTICES.md` | Compyle legal notices |

## Key Rules for Agents Working on This Repo

1. **Never modify** `LICENSE.txt` or `ThirdPartyNotices.txt` (only add Compyle's own entries)
2. **Never remove** Microsoft copyright headers from source files
3. **Never add** `marketplace.visualstudio.com` URLs to runtime code
4. **Never add** Microsoft telemetry keys or 1DS endpoints to product.json
5. **Always run** `npm run compyle:compliance` before committing
6. **All Compyle features** go in `src/vs/workbench/contrib/compyle*/` or `src/vs/platform/compyle*/`
7. **product.json** is the single source of truth for app identity — don't hardcode names in source
8. **Extension registry** is Open VSX — never add Microsoft Marketplace as a fallback
9. **Telemetry default** is OFF — any Compyle analytics must be opt-in
10. **AI features** must show context preview before sending code to cloud providers
