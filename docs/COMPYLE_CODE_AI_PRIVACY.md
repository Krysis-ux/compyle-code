# Compyle Code — AI Privacy Policy

## Summary

Compyle Brain is the AI assistant built into Compyle Code. It is **privacy-first by design**:

- **No code leaves your machine without your action**
- **No mandatory Compyle cloud backend**
- **You bring your own AI keys**
- **Local-only mode available**
- **Full context preview before any cloud send**

---

## How Compyle Brain Works

Compyle Brain connects to AI providers **you configure**. Compyle does not operate a mandatory proxy server between you and AI providers.

### Supported Providers

| Provider | Type | Requires API Key |
|----------|------|-----------------|
| Anthropic Claude | Cloud | Yes (your key) |
| OpenAI / Azure OpenAI | Cloud | Yes (your key) |
| OpenRouter | Cloud aggregator | Yes (your key) |
| Ollama | Local | No (runs on your machine) |
| LM Studio | Local | No (runs on your machine) |
| Custom endpoint | Varies | Depends on provider |

### Provider Configuration

Go to: **Settings → Compyle → Brain → Provider**

Your API keys are stored in Compyle Code's secure credential store (system keychain where available). They are never logged or sent to Compyle.

---

## What Data Is Sent to AI Providers

When you use Compyle Brain, the following may be sent to your configured AI provider:

1. **Your prompt/question** — what you type
2. **Code context** — files or selections you explicitly include
3. **Project memory** — contents of `.compyle/PROJECT_MEMORY.md` and `.compyle/RULES.md` (if you've created them)

### What Is Never Sent (by Default)

- Files matching `.gitignore` patterns
- Files matching `compyle.brain.excludePatterns` (defaults include `.env`, `node_modules`, `dist`, lockfiles)
- Files outside your selected context
- Any file you haven't explicitly included

### Context Preview

Before sending code to a cloud provider, Compyle Brain shows a **Context Preview** dialog listing exactly which files and content will be sent. You must confirm before the request is made (unless you disable `compyle.brain.confirmBeforeCloudSend`).

---

## Local-Only Mode

Set `compyle.brain.localOnly: true` to restrict Compyle Brain to only use local/self-hosted models (Ollama, LM Studio, or a custom local endpoint). In this mode:

- No code is ever sent to cloud AI services
- The provider setting is validated to ensure it points to a local endpoint
- A warning is shown if the configured endpoint appears to be remote

---

## Telemetry

Compyle Code does **not** send telemetry to Microsoft or to Compyle by default.

- `telemetry.telemetryLevel` is set to `off` by default
- No instrumentation key is configured
- The Microsoft 1DS telemetry backend is present in source code (inherited from Code-OSS) but is never activated in Compyle Code's default configuration

If Compyle adds its own telemetry in the future, it will:
- Be opt-in only
- Show a clear disclosure in first-run setup
- Be visible in a Privacy & Network settings panel
- Be completely off by default

---

## Extension Registry Privacy

Compyle Code uses **Open VSX** (https://open-vsx.org) as its extension registry. Open VSX is operated by the Eclipse Foundation.

When you search for or install extensions, Compyle Code sends:
- Search queries to Open VSX
- Your Compyle Code version (in `User-Agent: CompyleCode <version>`)

Compyle Code does **not** connect to the Microsoft Visual Studio Marketplace.

---

## Network Activity

All network activity in Compyle Code is limited to:

| Destination | Purpose | Default |
|-------------|---------|---------|
| open-vsx.org | Extension search and install | On (when browsing extensions) |
| Your AI provider | Compyle Brain (if configured) | Off (requires setup) |
| nodejs.org | Node.js download links | Off (link only, not auto-download) |
| GitHub (your repos) | Git operations | Off (requires git auth) |
| Internet | Extensions you install | Varies per extension |

**Nothing sends to microsoft.com by default in runtime operation.**

---

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `compyle.brain.enabled` | false | Enable Compyle Brain AI |
| `compyle.brain.provider` | none | AI provider to use |
| `compyle.brain.localOnly` | false | Restrict to local models only |
| `compyle.brain.confirmBeforeCloudSend` | true | Show context preview before cloud send |
| `compyle.brain.respectGitignore` | true | Exclude .gitignore'd files from context |
| `compyle.brain.excludePatterns` | (see settings) | Additional files to exclude |
| `telemetry.telemetryLevel` | off | Compyle telemetry (none configured) |
