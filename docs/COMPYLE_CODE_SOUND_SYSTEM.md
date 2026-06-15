# Compyle Code — Sound System

## Design Principles

- **Off by default** — no sound surprises
- **All sounds through one service** — never call audio APIs directly in UI code
- **Settings-driven** — all behavior controlled via `compyle.sounds.*`
- **Accessible** — respects OS reduce-motion, works with screen readers
- **Non-annoying** — sounds should feel premium, not gimmicky

## Architecture

```
UI Event
  ↓
CompyleSoundService.playSound(CompyleSoundEvent)
  ↓
Check: compyle.sounds.enabled?
  ↓ no → skip
  ↓ yes
Check: specific event enabled?
  ↓ no → skip
  ↓ yes
Check: compyle.sounds.pack
  ↓
Load audio file from pack directory
  ↓
Apply masterVolume
  ↓
Play via Web Audio API / Electron audio
```

## Sound Events

| Event | Setting | Default |
|-------|---------|---------|
| Typing (per keystroke) | `compyle.sounds.typing` | false |
| File saved | `compyle.sounds.save` | true |
| Build success | `compyle.sounds.buildSuccess` | true |
| Build error | `compyle.sounds.buildError` | true |
| Terminal command done | `compyle.sounds.terminalDone` | false |
| AI response complete | `compyle.sounds.aiComplete` | true |
| Notification | `compyle.sounds.notification` | false |

## Sound Packs

| Pack | Character | Use Case |
|------|-----------|----------|
| `minimal` | Barely audible, 1-2 note chimes | Default — professional settings |
| `soft` | Gentle, warm tones | Home office, headphones |
| `mechanical` | Click/thump keyboard feel | Tactile feedback lovers |
| `futuristic` | Sci-fi bleeps and sweeps | Creative/gaming setups |
| `retro` | 8-bit terminal sounds | Nostalgic developers |
| `silent` | No audio (same as disabled) | Fallback |

## File Format

Sound packs live at: `resources/sounds/<pack-name>/`

Files: `save.mp3`, `build-success.mp3`, `build-error.mp3`, `ai-complete.mp3`, `typing.mp3`, `terminal-done.mp3`, `notification.mp3`

Use both MP3 (broad compatibility) and OGG (open format) variants where practical.

## Existing Signal System

Code-OSS already has `IAccessibilitySignalService` in `src/vs/platform/accessibilitySignal/browser/accessibilitySignalService.ts`. This handles screen reader announcements and accessibility sounds.

`CompyleSoundService` wraps/extends this — using the accessibility signal system for sounds that also benefit screen reader users, and adding its own audio layer for purely aesthetic sounds (typing, save, etc.).

## Implementation Notes (for Phase 5)

1. Create `CompyleSoundService` in `src/vs/workbench/contrib/compyleSounds/browser/compyleSoundService.ts`
2. Implement `ICompyleSoundService` interface (injectable)
3. Trigger `save` sound from `ITextFileService` save event
4. Trigger `buildSuccess`/`buildError` from task execution events
5. Trigger `aiComplete` from `CompyleBrainService` response complete event
6. All sound files must be original — do not copy from other projects

## Settings Reference

| Setting | Type | Default |
|---------|------|---------|
| `compyle.sounds.enabled` | boolean | false |
| `compyle.sounds.masterVolume` | number (0-100) | 50 |
| `compyle.sounds.pack` | enum | minimal |
| `compyle.sounds.typing` | boolean | false |
| `compyle.sounds.save` | boolean | true |
| `compyle.sounds.buildSuccess` | boolean | true |
| `compyle.sounds.buildError` | boolean | true |
| `compyle.sounds.terminalDone` | boolean | false |
| `compyle.sounds.aiComplete` | boolean | true |
| `compyle.sounds.notification` | boolean | false |
| `compyle.sounds.respectReduceMotion` | boolean | true |
| `compyle.sounds.disableWhileRecording` | boolean | true |
