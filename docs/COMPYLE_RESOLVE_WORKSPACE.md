# Compyle Resolve Workspace

Compyle Resolve is the workspace experience for fixing broken projects. It surfaces diagnostics, keeps the terminal in view, and lets you generate a structured bug report from the current Problems panel output.

---

## Activation

Switch to Resolve via:
- **Status bar** — click `$(debug) Compyle: Resolve`
- **Command Palette** — `Compyle: Start Resolve Workspace`
- **Settings** — `compyle.modes.activeMode: resolve`

On activation, Resolve:
1. Opens the Problems panel (`workbench.panel.markers.view`)
2. Shows a brief notification: "Resolve workspace active. Use the Problems panel and terminal to diagnose issues."

The terminal is not forced open to avoid disrupting an existing layout — open it manually if needed with `` Ctrl+` ``.

---

## Behavior Defaults

| Setting | Resolve default |
|---------|----------------|
| Memory | Ask to initialize |
| AI | Errors only (requires Compyle Brain) |
| Sound | Off |
| Motion | Normal |

---

## Commands

### `Compyle: Generate Bug Report`

Reads all current diagnostics from the Problems panel and writes a structured `.compyle/BUG_REPORT.md` file, then opens it in the editor.

The report includes:
- Report date and project name
- Complete list of errors and warnings from the workspace (up to 20 items), with file path, line number, and message
- Sections for: Steps to reproduce, Expected behavior, Actual behavior, Environment
- A reproduction checklist

**Usage workflow:**
1. Reproduce the bug so the Problems panel shows the errors
2. Run `Compyle: Generate Bug Report`
3. Fill in the steps-to-reproduce and environment sections
4. Share the file or paste it into an issue

The command reads live from `IMarkerService` — if you fix errors between runs, the report reflects the current state, not cached diagnostics.

---

## Debugging Workflow

A typical Resolve session:

1. **Switch to Resolve** — Problems panel opens automatically
2. **Read the errors** — start from the first error in the list; later errors often cascade from earlier ones
3. **Open the terminal** — run build commands, tests, or type-checks to see full output
4. **Fix one error at a time** — return to Problems panel after each save
5. **Generate a bug report** if the issue is unclear or needs to be shared — `Compyle: Generate Bug Report`
6. **Switch back to Flow or Focus** once resolved

---

## Bug Report File Location

Bug reports are written to `.compyle/BUG_REPORT.md`. If `.compyle/` doesn't exist, it is created automatically.

Each run overwrites the existing `BUG_REPORT.md`. If you want to keep previous reports, rename the file before generating a new one.

---

## Privacy

Diagnostics written to `BUG_REPORT.md` contain file paths from your local workspace. These are strings like `src/components/App.tsx:42` — no file contents, just paths and error messages.

The report is a local file. It is not sent anywhere unless you share it explicitly.

---

## AI Integration (Future)

When Compyle Brain is connected, Resolve will offer to explain each error in `BUG_REPORT.md` with project-aware context. Until then, the static Tutor concept library covers common error types (SyntaxError, TypeError, ReferenceError, etc.) via `Compyle: Explain Current Error`.
