# Claude Handoff — Compyle Code

> This file is specifically for Claude Code (Anthropic). It provides session context to prevent repeating work and to continue efficiently.

## Session History

### Session 1 — 2026-06-15

**Prompt**: Two large prompts — legal compliance cleanup + premium feature build  
**Branch**: `claude/funny-cray-xj32la`  
**Status**: Phase 0 (Legal/Compliance) and Phase 1 (Foundation Scaffold) COMPLETE

**What was done**: See `COMPYLE_CODE_MEMORY.md` for full details.

**Compliance check**: ✅ `npm run compyle:compliance` passes (0 violations)

---

## How to Continue in a New Session

1. Read `COMPYLE_CODE_MEMORY.md` first — it has everything
2. Run `npm run compyle:compliance` to verify no regressions
3. Check `TODO.md` for the current task list
4. Check `IMPLEMENTATION_LOG.md` for what was last done
5. Work on branch `claude/funny-cray-xj32la`
6. Push with: `git push -u origin claude/funny-cray-xj32la`

## Priority Order for Next Session

1. **Exclude copilot extension from build** — `extensions/copilot/` must not be in distribution
2. **Compyle Dark/Light theme** — create JSON theme files in `extensions/theme-defaults/themes/`
3. **CompyleBrainService implementation** — actual AI provider connections
4. **Binary icon files** — generate from `assets/compyle/icons/compyle-code.svg`
5. **Compyle welcome screen** — custom welcome beyond Getting Started

## Files NOT to Touch

- `LICENSE.txt` — never modify
- `ThirdPartyNotices.txt` — never remove entries, can add Compyle entries at the bottom
- Any Microsoft copyright headers in `src/vs/**/*.ts` — preserve all `Copyright (c) Microsoft Corporation` headers
- `node_modules/` — don't touch
- `package-lock.json` — only change if intentionally updating dependencies

## Key TypeScript Patterns in This Codebase

```typescript
// Registering settings:
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
  .registerConfiguration({ ... });

// Registering commands:
registerAction2(class extends Action2 { ... });

// Injecting services:
class MyAction extends Action2 {
  override async run(accessor: ServicesAccessor): Promise<void> {
    const myService = accessor.get(IMyService);
  }
}

// Localization:
localize('key', "English string")
localize({ key: 'key', comment: ['...'] }, "String with {0}", value)
```

## Compliance Rules Quick Reference

Run `npm run compyle:compliance` — must pass before every commit.

Forbidden strings (in non-exempt paths):
- `marketplace.visualstudio.com`
- `update.code.visualstudio.com`
- Microsoft telemetry endpoints (1DS, ApplicationInsights)
- `falcon-caas.mai.microsoft.com`
- `"nameShort": "Code - OSS"` or `"VS Code"` or `"Visual Studio Code"`
- `"Microsoft.CodeOSS"` in win32AppUserModelId
- `"com.visualstudio"` in darwinBundleIdentifier
- `"voiceWsUrl"` in product config

## Helpful Commands

```bash
# Check compliance
npm run compyle:compliance

# Full audit report
npm run compyle:audit

# Compile TypeScript
npm run compile

# Git status
git status

# Stage and commit
git add <files>
git commit -m "feat: description"
git push -u origin claude/funny-cray-xj32la
```
