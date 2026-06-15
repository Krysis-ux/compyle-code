# Compyle Code — Compliance Audit

> **Disclaimer**: This document is a technical audit for developer reference. It does not constitute legal advice and does not replace review by a qualified software/IP attorney.

Generated: 2026-06-15  
Branch: claude/funny-cray-xj32la  
Base: Code - OSS (microsoft/vscode, MIT License)

---

## 1. Executive Summary

Compyle Code is built on Code - OSS, the open-source foundation of Visual Studio Code, licensed under the MIT License. This audit documents all Microsoft/VS Code branding, service endpoints, and potentially restricted content found in the repository, along with remediation status.

**Base assertion**: Compyle Code uses Code - OSS source, NOT the compiled Microsoft Visual Studio Code binary. This is the legally correct base for a fork.

---

## 2. Product Branding Occurrences

### 2.1 product.json (ROOT FILE — REMEDIATED)

All fields rebranded. Previously contained:

| Field | Old Value | New Value |
|-------|-----------|-----------|
| nameShort | "Code - OSS" | "Compyle Code" |
| nameLong | "Code - OSS" | "Compyle Code" |
| applicationName | "code-oss" | "compyle-code" |
| dataFolderName | ".vscode-oss" | ".compyle-code" |
| win32AppUserModelId | "Microsoft.CodeOSS" | "Compyle.CompyleCode" |
| win32DirName | "Microsoft Code OSS" | "Compyle Code" |
| win32NameVersion | "Microsoft Code OSS" | "Compyle Code" |
| darwinBundleIdentifier | "com.visualstudio.code.oss" | "com.compyle.code" |
| urlProtocol | "code-oss" | "compyle-code" |

### 2.2 Source Copyright Headers — DO NOT CHANGE

All TypeScript files in `src/vs/` contain:
```
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
```

**Status**: INTENTIONALLY PRESERVED. MIT License requires preservation of copyright notices. These are attribution headers, not product branding.

### 2.3 Welcome/Getting Started Content (REMEDIATED)

File: `src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts`
- Replaced: "Get started with VS Code" → "Get started with Compyle Code"
- Replaced: "VS Code Copilot" → "Compyle Brain"
- Replaced: "VS Code extension marketplace" → "Open VSX extension registry"
- Replaced: "VS Code's power-ups" → "Compyle's extensions"

### 2.4 Walkthrough Content (REMEDIATED)

File: `src/vs/workbench/contrib/welcomeWalkthrough/browser/editor/vs_code_editor_walkthrough.ts`
- Updated user-visible "VS Code" references to "Compyle Code"

### 2.5 Marketplace Headers (REMEDIATED)

File: `src/vs/platform/externalServices/common/marketplace.ts`
- `X-Market-Client-Id` header changed from `"VSCode {version}"` to `"CompyleCode {version}"`
- `User-Agent` header updated accordingly

### 2.6 Desktop/App Metadata (REMEDIATED)

- `resources/linux/code.desktop` — updated Exec and Name fields
- `resources/linux/code.appdata.xml` — updated product name and description

### 2.7 Remaining Documentation References (LOW RISK)

The following files contain "VS Code" or "Microsoft" in developer documentation context. These do NOT affect the runtime app experience and are informational:
- `README.md` — references upstream Code - OSS
- `CONTRIBUTING.md` — references upstream development process
- `cli/CONTRIBUTING.md` — references community extensions on marketplace
- `.github/commands.json` — bot response templates
- Extension-specific `CONTRIBUTING.md` files within `extensions/*/`
- `ThirdPartyNotices.txt` — must remain unchanged

**Recommendation**: Update `README.md` to describe Compyle Code rather than VS Code. Other developer docs may be updated progressively.

---

## 3. App Icons and Image Assets

### 3.1 Icons Requiring Replacement (NOT YET REPLACED — Needs Design Work)

| File | Platform | Status |
|------|----------|--------|
| `resources/darwin/code.icns` | macOS app icon | ⚠️ Needs replacement with Compyle icon |
| `resources/darwin/*.icns` (20+ language icons) | macOS file icons | ⚠️ Review needed |
| `resources/linux/code.png` | Linux app icon | ⚠️ Needs replacement |
| `resources/linux/debian/`, `rpm/`, `snap/` | Linux package icons | ⚠️ Needs replacement |
| `resources/win32/code.ico` | Windows app icon | ⚠️ Needs replacement |
| `resources/win32/code_150x150.png` | Windows tile | ⚠️ Needs replacement |
| `resources/win32/code_70x70.png` | Windows tile | ⚠️ Needs replacement |
| `resources/server/code-192.png` | Web favicon | ⚠️ Needs replacement |
| `resources/server/code-512.png` | Web icon | ⚠️ Needs replacement |
| `resources/server/favicon.ico` | Web favicon | ⚠️ Needs replacement |

**Note**: Compyle SVG source icons have been created at `assets/compyle/icons/`. Binary icon generation (.icns, .ico) requires design tooling and should be done before public distribution.

### 3.2 File-Type Icons

Icons like `resources/win32/bower.ico`, `cpp.ico`, `css.ico` etc. are generic file-type icons for Code-OSS and are not Microsoft branding. These are generally safe to keep unless Microsoft has trademark claims on specific icon designs. **Needs lawyer review.**

---

## 4. Microsoft Service Endpoints

### 4.1 Telemetry — CRITICAL (REMEDIATED)

**Endpoint**: `https://mobile.events.data.microsoft.com/OneCollector/1.0`  
**File**: `src/vs/platform/telemetry/common/1dsAppender.ts`  
**Status**: Endpoint hardcoded in source. Telemetry disabled by default via `"enableTelemetry": false` in `product.json`. The 1DS code path is only reached if `enableTelemetry` is true AND an `instrumentationKey` is provided — neither is the case in Compyle Code's configuration.

**Packages still present**: `@microsoft/1ds-core-js`, `@microsoft/1ds-post-js` in `node_modules/`. These are MIT-licensed npm packages and safe to have as dependencies. Their network calls only happen when telemetry is enabled.

**Recommendation**: In a future cleanup, the 1DS appender could be replaced with a no-op or a Compyle-specific analytics backend (opt-in only). For now, disabling via config is sufficient.

### 4.2 Voice Service — REMEDIATED

**Endpoint**: `wss://falcon-caas.mai.microsoft.com/voice-code/api/v1/realtime/voice`  
**File**: `product.json` (field: `voiceWsUrl`)  
**Status**: Field removed from product.json. Voice features will not attempt to connect to Microsoft's voice service.

### 4.3 Update Service — SAFE (No Config Present)

No `updateUrl` or `downloadUrl` is configured in `product.json`. The update service is effectively disabled. Code-OSS does not include Microsoft's update infrastructure by default.

### 4.4 Extension Gallery — REMEDIATED

No `extensionsGallery.serviceUrl` pointed to Microsoft Marketplace. The field was absent (Code-OSS default). Replaced with Open VSX configuration in `product.json`.

### 4.5 Webview CDN — REMEDIATED

**Endpoint**: `https://{{uuid}}.vscode-cdn.net/...`  
**Field**: `webviewContentExternalBaseUrlTemplate`  
**Status**: Field removed from product.json. Webviews will use local content only.

---

## 5. Marketplace Endpoints

### 5.1 Microsoft Visual Studio Marketplace

**Status**: No runtime calls configured. `extensionsGallery.serviceUrl` now points to Open VSX.

**Remaining references (documentation only)**:
- `extensions/theme-seti/CONTRIBUTING.md` — link to marketplace for theme development
- `extensions/copilot/CHANGELOG.md` — historical changelog
- `cli/CONTRIBUTING.md` — recommends community extensions
- `.github/commands.json` — bot responses mention marketplace

These are developer documentation strings, not runtime API calls. They do not cause the app to call Microsoft Marketplace.

### 5.2 Open VSX (Configured)

```json
"extensionsGallery": {
  "serviceUrl": "https://open-vsx.org/vscode/gallery",
  "itemUrl": "https://open-vsx.org/vscode/item",
  "resourceUrlTemplate": "https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}",
  "controlUrl": "",
  "nlsBaseUrl": ""
}
```

**Note**: Open VSX is a community-maintained registry. Extensions on Open VSX are not automatically vetted by Compyle. The Extension Shield (see extension policy docs) adds risk classification.

---

## 6. Update URLs

### 6.1 Runtime Update System

No update URL is configured. The auto-update mechanism is effectively disabled in Compyle Code. Future Compyle distributions should configure their own update server or disable updates entirely.

**Test file references**: The following test files reference update URLs but these are test fixtures, not runtime configuration:
- `test/smoke/src/main.ts`
- `test/sanity/src/context.ts`
- `test/mcp/src/application.ts`

---

## 7. Telemetry / Crash / Survey / Experiment

### 7.1 Microsoft 1DS Telemetry

**Endpoint**: `https://mobile.events.data.microsoft.com/OneCollector/1.0`  
**Status**: Disabled via `"enableTelemetry": false` in product.json.

### 7.2 Crash Reporting

Setting `telemetry.enableCrashReporter` exists. Crash reporting disabled by default when `enableTelemetry: false`.

### 7.3 Surveys

File: `src/vs/workbench/contrib/surveys/` — survey contribution exists. Surveys are triggered by product configuration. No Compyle survey endpoint is configured. Microsoft survey URLs, if any exist in survey content, should be reviewed.

### 7.4 Experiments

File: `src/vs/workbench/contrib/experiments/` — experiment service exists. No Microsoft experiment endpoint is configured in product.json. **Needs review**: Check if a default experiment URL is hardcoded anywhere.

### 7.5 Application Insights Key (`aiConfig.ariaKey`)

The `aiConfig` field is not present in Compyle Code's product.json. No instrumentation key is provided. The 1DS telemetry system will not activate.

### 7.6 Agents Telemetry

Field `agentsTelemetryAppName: "agents"` was present. This appears to be a telemetry namespace for agent sessions. **Status**: Kept for now as it's a namespace string, not an endpoint. Needs review of how it's used.

---

## 8. Bundled Extensions Analysis

### 8.1 Built-In Extensions (builtInExtensions in product.json)

These are downloaded at build time and bundled:

| Extension ID | Version | License | Status |
|-------------|---------|---------|--------|
| ms-vscode.js-debug | 1.117.0 | MIT | ✅ SAFE — open source, MIT |
| ms-vscode.js-debug-companion | 1.1.3 | MIT | ✅ SAFE — open source, MIT |
| ms-vscode.vscode-js-profile-table | 1.0.10 | MIT | ✅ SAFE — open source, MIT |

**Note**: These extensions use `ms-vscode` publisher name. They are MIT-licensed and the publisher name is an identifier, not a trademark claim on usage. Safe to bundle.

### 8.2 Extensions in `extensions/` Folder (In-Repository)

These are part of the Code-OSS source and are built from source:

| Extension | License | Status |
|-----------|---------|--------|
| `bat`, `clojure`, `coffeescript`, etc. (language grammars) | MIT | ✅ SAFE |
| `git` | MIT | ✅ SAFE |
| `github` | MIT | ✅ SAFE |
| `html-language-features`, `json-language-features`, etc. | MIT | ✅ SAFE |
| `markdown-*` | MIT | ✅ SAFE |
| `typescript-language-features` | MIT | ✅ SAFE |
| `microsoft-authentication` | MIT | ✅ SAFE — generic OAuth, not Microsoft-specific functionality |
| `github-authentication` | MIT | ✅ SAFE — OAuth for GitHub, no GitHub-only license restriction found |
| `copilot` | ⚠️ | **BLOCKED — NEEDS LAWYER REVIEW** |
| `cpp` | MIT | ✅ SAFE — IntelliSense built from open source |
| `csharp` | MIT | ✅ SAFE — grammar only, not C# Dev Kit |
| `docker` | MIT | ✅ SAFE |

### 8.3 GitHub Copilot Extension (`extensions/copilot/`)

**Status**: ⚠️ **BLOCKED FOR DISTRIBUTION**

The Copilot extension source is present in the repository (likely pulled in as part of the Code-OSS fork). Its license status must be verified:
- GitHub Copilot's EULA typically restricts use to Microsoft/GitHub products
- The extension may include a "Visual Studio Code only" restriction
- Even if the source is MIT, the service agreement may restrict use

**Action Required**:
1. Do not include `extensions/copilot` in the Compyle Code distribution build
2. Remove `GitHub.copilot-chat` from `builtInExtensionsEnabledWithAutoUpdates`
3. Remove `defaultChatAgent` GitHub Copilot config (done)
4. Have lawyer verify whether the copilot extension source in the repo creates any licensing obligation

**For now**: Source is preserved in the repository for fork integrity. It must be excluded from the build output and not shipped to users.

### 8.4 Extensions Blocked from Distribution

The following extension IDs are blocked in the Compyle Extension Policy:

| Extension ID | Reason |
|-------------|--------|
| `GitHub.copilot` | License restricts to GitHub/Microsoft products |
| `GitHub.copilot-chat` | Same as above |
| `ms-vscode-remote.remote-ssh` | Microsoft license, Visual Studio family restriction |
| `ms-vscode-remote.remote-wsl` | Microsoft license, Visual Studio family restriction |
| `ms-vscode-remote.remote-containers` | Microsoft license, Visual Studio family restriction |
| `ms-vscode.remote-server` | Microsoft license, proprietary server component |
| `ms-dotnettools.csdevkit` | C# Dev Kit — Visual Studio family license |
| `ms-dotnettools.csharp` (proprietary debugger) | Proprietary debugger components |

---

## 9. Files Requiring Modification

### 9.1 Already Modified

- [x] `product.json` — rebranded
- [x] `src/vs/platform/externalServices/common/marketplace.ts` — headers updated
- [x] `src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts` — VS Code strings replaced
- [x] `resources/linux/code.desktop` — product name updated
- [x] `resources/linux/code.appdata.xml` — product metadata updated

### 9.2 Recommended Future Changes

- [ ] `README.md` — rewrite to describe Compyle Code
- [ ] `CONTRIBUTING.md` — update to Compyle contribution guidelines
- [ ] Binary icon files — replace with Compyle-designed icons
- [ ] `extensions/copilot/` — exclude from distribution build
- [ ] Survey contribution — verify no hardcoded Microsoft survey URLs
- [ ] Experiment service — verify no hardcoded Microsoft experiment endpoint

---

## 10. Needs Lawyer / Developer Review

1. **GitHub Copilot extension source in repo**: Does having the source in the fork create any obligation? Must it be removed entirely or just excluded from builds?

2. **ms-vscode.js-debug extensions**: These are MIT-licensed but carry Microsoft publisher ID. Is there any restriction on bundling these in a non-Microsoft product?

3. **Windows installer GUIDs** (`win32x64AppId`, etc.): The current GUIDs are from the original Code-OSS. Should these be regenerated for Compyle Code to avoid any collision or confusion with VS Code installations?

4. **`darwinProfileUUID` / `darwinProfilePayloadUUID`**: These appear to be macOS configuration profile UUIDs. Should these be regenerated?

5. **`microsoft-authentication` extension**: The extension name includes "microsoft" but the extension enables generic OAuth. Is the name a trademark concern for bundling?

6. **Open VSX terms of service**: Verify Open VSX terms allow use as a default extension registry in a commercial fork.

7. **File-type icons** in `resources/win32/*.ico` and `resources/darwin/*.icns`: These are generic file-type icons. Verify no Microsoft trademark applies.

8. **Survey content**: The survey contribution may contain Microsoft survey links. Audit `src/vs/workbench/contrib/surveys/` for hardcoded URLs.

9. **Experiment service**: Audit `src/vs/workbench/contrib/experiments/` for hardcoded Microsoft experiment endpoint URLs.

10. **ThirdPartyNotices.txt**: Is the current ThirdPartyNotices.txt complete for all dependencies? Compyle Code may add new dependencies that need to be listed.

---

## 11. Privacy & Network Summary

| Service | Status | Default |
|---------|--------|---------|
| Microsoft 1DS Telemetry | Disabled (config) | OFF |
| Microsoft Crash Reporting | Disabled (config) | OFF |
| Microsoft Voice Service | Removed (endpoint deleted) | OFF |
| Microsoft Marketplace | Not configured | OFF |
| Microsoft CDN (webviews) | Removed | OFF |
| Open VSX Registry | Configured | ON |
| GitHub Copilot API | defaultChatAgent removed | OFF |
| GitHub Copilot Token APIs | Extension blocked | OFF |
| Auto-Update Service | Not configured | OFF |
| Settings Sync | Uses open-source sync service | OFF by default |
