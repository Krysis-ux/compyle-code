# Compyle Code — Cohesion + Signature Look + Core Features

**Date:** 2026-06-16
**Status:** Approved (look, feature set, keybinding confirmed with user)

## Goal

Stop Compyle from feeling like 13 separate panels bolted onto VS Code. Give it one
premium design language ("Quiet"), a true Minimal mode, a single discoverable launcher,
a premium first run, and two genuine "better than Cursor" editor features (inline AI edit,
fix-with-Brain). Same feature count as VS Code+ — but cohesive, calm, and easy to navigate.

## Decisions (locked)

- **Signature look:** "Quiet" (flat monochrome, one warm accent `#E8A33D`, no borders,
  generous space) is the **default**. "Editorial" (`#635BFF`, hairline borders) and the
  existing "Liquid Glass" are one-click UI Packs.
- **Features this round:** Inline AI edit, Fix-with-Brain, First-run Welcome, Project Pulse.
- **Inline edit keybinding:** `Ctrl+I` (plain `Ctrl+K` is VS Code's chord leader; hijacking
  it breaks Ctrl+K Ctrl+S etc). Also in editor context menu + command palette.

## Workstreams (build order — compile-check after each)

### 0. Quiet design language (foundation)
- New `compyleShared.css` defining panel primitives: `.compyle-panel`, `.compyle-panel-header`,
  `.compyle-h1`, `.compyle-sub`, `.compyle-card`, `.compyle-btn` (+ `.primary`/`.secondary`),
  `.compyle-field`, a spacing scale and type scale. Loaded once.
- Migrate the 13 Compyle panels to consume these primitives so they share padding, radius,
  type, and color. Incremental; each panel still compiles independently.
- Add **Quiet** + **Editorial** UI Packs to `compyleUIPacksRegistry.ts`. Make Quiet the
  default applied pack on a fresh install (only when no pack chosen yet).

### 1. Minimal Mode
- Command `compyle.minimalMode.toggle` + status-bar pill.
- Body class `.compyle-minimal` (applied via `CompyleAppearanceService`): hide activity-bar
  labels, thin status bar, compact tabs, drop non-essential borders/padding, minimap off.
- Reversible: restores any VS Code setting it flips. All features remain reachable —
  chrome reduction only, not Zen mode.

### 2. Project Pulse
- One left status-bar cluster = unified launcher (discoverability anchor).
- Shows live run state (active Compyle run / dev terminal) + a quality dot when known.
- Click → quick pick jumping to Run Doctor / Quality Guardian / Explain / Ship / Home.

### 3. First-run Welcome
- `CompyleWelcomeInput` editor pane, opened once at `AfterRestored` when storage flag
  `compyle.welcome.completed` is unset.
- 30-second setup: pick look (Quiet/Editorial/Glass) → color theme → optional Brain API key.
- On finish: apply choices, set flag.

### 4. Fix-with-Brain
- `CodeActionProvider` registered for all languages via `ILanguageFeaturesService`.
- For any diagnostic, offers quick fix "Fix with Compyle Brain".
- Invoke → Brain receives file + diagnostic message + range → returns corrected file →
  applied as a diff (accept/reject). Disabled gracefully when Brain not configured.

### 5. Inline AI edit (`Ctrl+I`)
- Editor contribution `CompyleInlineEditController` (`registerEditorContribution`).
- Overlay input anchored at the selection → user describes change → Brain rewrites the
  selection (with surrounding context) → inline diff with Accept / Reject.
- v1: replace selection + diff peek for accept/reject. Inline red/green decorations are a
  polish follow-up. Built last so the rest ships regardless.

## Out of scope (flagged)
- Tab/ghost-text autocomplete (huge, separate round).
- Extension Strategy / marketplace curation.

## Reused infrastructure
- `CompyleAppearanceService` + `--compyle-*` tokens (packs, minimal class).
- `ICompyleBrainService` (inline edit, fix-with-brain, welcome key entry).
- `ICompyleRunDoctorService` (Project Pulse run state).
- `EditorPane` + `EditorInput` + serializer pattern (Welcome).
- `IStatusbarService` (Minimal pill, Project Pulse).
- `ILanguageFeaturesService.codeActionProvider` (Fix-with-Brain).

## Verification
- After each workstream: `npm run compile-check-ts-native` → 0 errors.
- Launch `.\scripts\code.bat`; smoke-test each feature end to end.
