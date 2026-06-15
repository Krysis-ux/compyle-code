# Compyle Code — Features

## Core Identity

Compyle Code is a premium open-source IDE built on Code - OSS (the open-source foundation of VS Code). It is **not** VS Code and is **not affiliated with Microsoft**.

Key differentiators:
- **Privacy-first**: No Microsoft telemetry, no Microsoft Marketplace, no forced cloud services
- **AI-native**: Compyle Brain AI assistant, bring-your-own-key, local model support
- **Extension safety**: Open VSX registry, Extension Shield risk classification
- **Premium UX**: Theme gallery with 100+ themes, sound effects, spec-driven development

---

## Extension Registry

**Default registry**: Open VSX (https://open-vsx.org)  
**Microsoft Marketplace**: Not connected  
**Local VSIX**: Supported with security warning

## Compyle Brain (AI Assistant)

- Bring-your-own-key (Anthropic, OpenAI, OpenRouter, Ollama, LM Studio, custom)
- Local-only mode (no cloud required)
- Context preview before any cloud send
- AI modes: Ask / Edit / Agent / Plan / Learn
- Project memory files (`.compyle/PROJECT_MEMORY.md`, `RULES.md`, etc.)
- Commands: Explain Error, Review Diff, Generate Tests, Create Plan, Generate Project Memory

## Theme Gallery

- Searchable theme gallery in Settings and Command Palette
- Categories: Dark, Light, Neon, Cyber, Glass, Minimal, High Contrast, Warm, Cool, Retro, Focus, OLED, Classroom, Hacker Lab
- Random theme on launch
- Match OS dark/light mode
- Favorite themes
- Reduce motion / reduce transparency options

## Sound Effects

- Optional, off by default
- Sound packs: Minimal, Soft, Mechanical, Futuristic, Retro Terminal, Silent
- Per-event toggles: typing, save, build, terminal, AI complete, notification
- Volume control
- Respects OS reduce-motion setting

## Extension Shield

- Risk badges on all extensions (Safe / Needs Review / Restricted / Blocked / Unknown)
- Blocks known license-restricted extensions (GitHub Copilot, etc.)
- Warns on Microsoft/GitHub publisher
- VSIX install security warning
- Extension source label (Open VSX / Local / Unknown)

## Performance Panel

- Startup time breakdown
- Extension activation timing
- Memory usage overview
- Quick actions: Safe Mode, Disable Slow Extensions, Restart Language Server
- Export performance report

## Spec-Driven Development

- "Build From Idea" flow: Idea → Requirements → Design → Tasks → Implementation
- Stored in `.compyle/specs/<feature>/`
- Status badges: Draft / Approved / In Progress / Done
- Task checklist with "Implement Next Task" action

## Workspace Trust

Users can decide whether project folders allow or restrict automatic code execution. Opening untrusted folders prompts for trust grant.

See: https://github.com/krysis-ux/compyle-code/blob/main/docs/COMPYLE_CODE_FEATURES.md#workspace-trust

## Privacy & Network

- Telemetry: off by default
- No Microsoft services connected by default
- Extension registry: Open VSX only
- AI: only connects to provider you configure
- Network activity is limited to: Open VSX, your AI provider, Git operations

## Built-In Languages

Compyle Code includes support for:
JavaScript, TypeScript, Python, Rust, Go, Java, C/C++, C#, PHP, Ruby, Swift, Kotlin, Dart, Julia, R, MATLAB, SQL, HTML, CSS, LESS, SASS, JSON, YAML, XML, Markdown, LaTeX, Dockerfile, and many more.

All language support uses open-source grammars and language servers.
