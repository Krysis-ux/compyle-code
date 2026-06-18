# Compyle Flow Memory System

The Compyle Flow memory system stores structured project context in a `.compyle/` directory at your workspace root. It exists so you can pick up any session — or hand it to an AI assistant — without re-explaining your project from scratch.

---

## Directory Structure

```
.compyle/
├── PROJECT_MEMORY.md    ← Current state, goals, stack, preferences
├── RULES.md             ← Coding style, naming conventions, AI rules
├── ARCHITECTURE.md      ← Folder layout, key components, build commands
├── CHANGELOG.md         ← Running log of changes (newest first)
├── TODO.md              ← Open tasks and decisions pending
├── HANDOFF.md           ← Session handoff summary for AI or team members
└── settings.json        ← Mode configuration (activeMode, memoryBehavior)
```

---

## File Purposes

### `PROJECT_MEMORY.md`

The primary context file. Edit it freely to describe:
- What the project is and its current goals
- Tech stack and key dependencies
- Coding preferences (style guide, linter rules, test setup)
- Current state — what's working, what's in progress, what's blocked

### `RULES.md`

Constraints the project follows. Useful when working with AI:
- Naming conventions
- Files or directories to never touch
- Patterns to avoid
- Required review steps before merging

### `ARCHITECTURE.md`

Static snapshot of the folder layout with component descriptions and the commands needed to build, test, and run the project.

### `CHANGELOG.md`

A running table of changes — date, area affected, description. Updated manually or via the `Compyle: Summarize Recent Changes` command, which opens it for editing.

### `TODO.md`

Open tasks in a simple checklist format. Edit directly in the editor.

### `HANDOFF.md`

A session summary template for handing context to an AI assistant or team member. Generated fresh each session via `Compyle: Generate Handoff`. Fill in what changed and what's next before closing.

### `settings.json`

Stores project-scoped mode configuration. Example:
```json
{
  "activeMode": "flow",
  "memoryBehavior": "ask",
  "createdAt": "2026-06-15",
  "projectName": "my-project"
}
```

---

## Commands

| Command | What it does |
|---------|--------------|
| `Compyle: Initialize Project Memory` | Creates all `.compyle/` files (skips existing ones) |
| `Compyle: Open Project Memory` | Opens `PROJECT_MEMORY.md` in the editor |
| `Compyle: Update Project Memory` | Same — opens the file for direct editing |
| `Compyle: Generate Handoff` | Writes a fresh `HANDOFF.md` template and opens it |
| `Compyle: Summarize Recent Changes` | Opens `CHANGELOG.md` for editing |
| `Compyle: Clean Project Memory` | Opens memory files so you can manually remove sensitive content |

---

## Secret Scanning

Before any memory file is written, Compyle scans the content for patterns that look like secrets:

- OpenAI keys (`sk-...`)
- GitHub tokens (`ghp_...`, `gho_...`)
- AWS access keys (`AKIA...`)
- Private key headers (`-----BEGIN ... PRIVATE KEY-----`)
- Generic patterns: `password=`, `api_key=`, `secret=`, `token=` followed by a value
- Long base64 strings following `=` assignments

If a pattern is detected, the write is **blocked** and a warning notification appears. You must remove the sensitive content before saving.

**Memory files are plain text on disk.** They are not encrypted. Do not store API keys, passwords, tokens, cookies, private keys, or credentials in any `.compyle/` file.

---

## Privacy

- No `.compyle/` file is ever sent anywhere by Compyle itself.
- When AI features are used (`compyle.modes.aiBehavior` is not `off`), you are prompted before any content is shared with an AI provider.
- The `.compyle/` directory should be added to `.gitignore` if it contains project-specific notes you don't want in version control. Whether to commit it is your choice.

---

## When Flow Memory is Active

Flow memory requires a workspace folder to be open. If the editor is opened without a folder, memory commands show a prompt to open a folder first.

Initialization is triggered once via a non-blocking notification when you switch to Flow mode in a workspace where `.compyle/` doesn't yet exist. You can also run `Compyle: Initialize Project Memory` from the Command Palette at any time.
