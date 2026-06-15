# Compyle Workspace Experiences

Compyle Code ships with four **Workspace Experiences** that shape how the editor behaves around the way you work. Each experience is a named mode with its own defaults for AI behavior, memory, sounds, and motion — but you can switch anytime from the status bar or Command Palette.

---

## The Four Experiences

### Compyle Flow — Build with memory.

**Best for:** AI-assisted projects, long-running codebases, context handoffs across sessions, team handovers.

Flow is for builders who want the editor to remember what they're working on. It supports the `.compyle/` project memory directory, which stores your project goals, architecture notes, a changelog, and a handoff summary that an AI assistant can use to catch up instantly.

| Setting | Default |
|---------|---------|
| Memory | Ask to initialize |
| AI behavior | Ask before using |
| Sound | Subtle |
| Motion | Normal |

**Commands in Flow mode:**
- `Compyle: Initialize Project Memory` — creates `.compyle/` with all memory files
- `Compyle: Open Project Memory` — opens `PROJECT_MEMORY.md` for editing
- `Compyle: Update Project Memory` — opens the memory file
- `Compyle: Generate Handoff` — writes `HANDOFF.md` with a session handoff template
- `Compyle: Summarize Recent Changes` — opens `CHANGELOG.md`

---

### Compyle Focus — Code without distraction.

**Best for:** Deep work sessions, distraction-free writing, high-concentration debugging, keyboard-only workflows.

Focus turns off AI popups, memory prompts, and reduces visual motion. It surfaces no suggestions unless explicitly asked. The status bar item remains for quick mode switching.

| Setting | Default |
|---------|---------|
| Memory | Off |
| AI behavior | Off |
| Sound | Off |
| Motion | Reduced |

**Settings to tune:**
- `compyle.modes.focus.reduceMotion` (default: `true`)
- `compyle.modes.focus.hideSidePanels` (default: `false`)

---

### Compyle Tutor — Learn while you code.

**Best for:** Students, bootcamp learners, self-taught developers, onboarding to a new language, debugging unfamiliar errors.

Tutor detects concepts in your selected code and explains them at your chosen level — beginner, normal, or advanced. Explanations come from static lesson cards and are instant, offline, and free. No AI call is made unless you explicitly trigger Compyle Brain.

| Setting | Default |
|---------|---------|
| Memory | Off |
| AI behavior | Ask before using |
| Sound | Subtle |
| Motion | Normal |

**Commands in Tutor mode:**
- `Compyle: Explain Selected Code` — highlight code, run this, get an explanation
- `Compyle: Explain Current Error` — places cursor on a problem, run this, get matched lesson card

**Explanation levels** (set via `compyle.modes.tutor.explanationLevel`):
- `beginner` — plain English, no assumed knowledge
- `normal` (default) — concise explanation with the key pattern
- `advanced` — includes edge cases, performance notes, idiomatic usage

---

### Compyle Resolve — Fix what's broken.

**Best for:** Debugging sessions, investigating error cascades, reviewing Problems panel output, generating reproducible bug reports.

Resolve opens the Problems panel and terminal on activation, keeps them in view, and lets you generate a structured bug report from the current workspace diagnostics.

| Setting | Default |
|---------|---------|
| Memory | Ask |
| AI behavior | Errors only |
| Sound | Off |
| Motion | Normal |

**Commands in Resolve mode:**
- `Compyle: Generate Bug Report` — reads Problems panel diagnostics, writes `.compyle/BUG_REPORT.md`, opens in editor

---

## Switching Experiences

**Status bar** — The current mode shows as `$(icon) Compyle: Flow` in the left status bar. Click it to open the mode switcher.

**Command Palette** — Run `Compyle: Switch Workspace Experience` (`Ctrl+Shift+P`).

**Settings** — Set `compyle.modes.activeMode` to `flow`, `focus`, `tutor`, `resolve`, or `none`.

---

## First-Open Prompt

When you open a folder for the first time with no mode selected, Compyle shows a non-blocking notification:

> *"Choose your workspace experience — Compyle can shape the editor around how you want to work."*

Choose **Choose Now** to open the mode switcher, or **Decide Later** to dismiss. This prompt appears once per workspace and can be disabled by setting `compyle.modes.askOnFolderOpen` to `false`.

---

## Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `compyle.modes.activeMode` | enum | `none` | Active workspace experience |
| `compyle.modes.askOnFolderOpen` | boolean | `true` | Prompt on first folder open |
| `compyle.modes.askOnNewProject` | boolean | `true` | Prompt on new project creation |
| `compyle.modes.memory.enabled` | boolean | `true` | Enable project memory system |
| `compyle.modes.memory.behavior` | enum | `ask` | Memory write behavior: ask / auto / off |
| `compyle.modes.tutor.explanationLevel` | enum | `normal` | Tutor detail level |
| `compyle.modes.tutor.aiBehavior` | enum | `ask` | When Tutor uses AI |
| `compyle.modes.focus.reduceMotion` | boolean | `true` | Reduce animations in Focus mode |
| `compyle.modes.focus.hideSidePanels` | boolean | `false` | Hide side panels in Focus mode |
