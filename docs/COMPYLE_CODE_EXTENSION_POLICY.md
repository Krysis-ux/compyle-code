# Compyle Code — Extension Policy

## Extension Registry

Compyle Code uses **Open VSX** (https://open-vsx.org) as its default extension registry.

**Why not Microsoft Visual Studio Marketplace?**

- Microsoft Marketplace Terms of Service restrict access to Microsoft products and licensed partners
- Compyle Code is not a Microsoft product and is not authorized to use the Marketplace
- Open VSX is the community-maintained alternative, operated by the Eclipse Foundation
- Open VSX has no usage restrictions for forks and derivatives

## Risk Classification

Every extension installed in Compyle Code receives a risk badge from the Extension Shield:

| Badge | Color | Meaning |
|-------|-------|---------|
| Safe | Green | Open source, reviewed, no known issues |
| Needs Review | Yellow | Has warnings — telemetry, unclear license, broad permissions |
| Restricted | Orange | License limits use (e.g. Visual Studio family only) |
| Blocked | Red | Must not be installed in Compyle Code |
| Unknown | Grey | Not yet reviewed — install with caution |

## Blocked Extensions

The following extensions are blocked in Compyle Code:

| Extension ID | Reason |
|-------------|--------|
| `GitHub.copilot` | GitHub Copilot license restricts to Microsoft/GitHub products |
| `GitHub.copilot-chat` | Same restriction |
| `ms-vscode.remote-server` | Proprietary VS Code Server component |
| `ms-dotnettools.csdevkit` | C# Dev Kit — Visual Studio family license restriction |

## Restricted Extensions (Legal Review Required)

| Extension ID | Concern |
|-------------|---------|
| `ms-vscode-remote.remote-ssh` | Microsoft Remote Development license — needs review |
| `ms-vscode-remote.remote-wsl` | Same |
| `ms-vscode-remote.remote-containers` | Same |

"Restricted" means: the extension may work technically, but its license may not permit use outside Microsoft products. Do not distribute these extensions bundled with Compyle Code without explicit legal review.

## Warning Rules

The Extension Shield warns (but does not block) when:

- Publisher ID starts with `ms-`, `microsoft.`, or `github.`
- Extension has no license field
- Extension requests broad file system or terminal access
- Extension is installed from a local `.vsix` file (supply chain risk)

## Local VSIX Installation

Installing a `.vsix` file from disk bypasses the Open VSX registry and its community vetting. Compyle Code shows a security warning before completing a VSIX install:

> "You are installing an extension from a local file. This extension has not been reviewed by Compyle or the Open VSX community. Install only .vsix files from sources you trust."

## Future: Compyle Verified Registry

A future "Compyle Verified" tier will be available for extensions that have been:

1. Reviewed for license compatibility with Compyle Code
2. Reviewed for privacy (no unexpected telemetry)
3. Reviewed for security (no supply chain risks)

This is a future feature — it does not exist yet.

## What Extensions Are Safe to Bundle?

Extensions that are MIT/Apache-2.0/BSD licensed and:
- Have no "Visual Studio family only" or "Microsoft products only" restriction in their license
- Do not depend on Microsoft-proprietary backend services
- Are available on Open VSX or are included in the Code-OSS source repository

The 100+ language/grammar extensions included in Code-OSS source (`extensions/`) are generally safe to bundle as they are MIT-licensed and part of the open-source codebase.

## The Three js-debug Extensions

Three MIT-licensed built-in extensions from Microsoft are included:
- `ms-vscode.js-debug` — JavaScript debugger
- `ms-vscode.js-debug-companion` — Debugger companion
- `ms-vscode.vscode-js-profile-table` — Profiler visualization

These carry `ms-vscode` publisher IDs but are MIT-licensed open-source projects. They are included as `builtInExtensions` in `product.json` because they are essential for JS/TS debugging. **Needs lawyer review to confirm no additional restrictions apply.**
