# Compyle Code — Theme System

## Architecture

Compyle Code uses the same color token system as Code-OSS, extended with Compyle-specific tokens.

### Color Token Registry

Location: `src/vs/platform/theme/common/colorRegistry.ts`

Colors are organized into modules:
- `colors/baseColors.ts` — base background/foreground
- `colors/editorColors.ts` — editor-specific colors
- `colors/inputColors.ts` — form inputs
- `colors/listColors.ts` — lists and trees
- `colors/menuColors.ts` — menus and dropdowns
- `colors/miscColors.ts` — miscellaneous
- `colors/searchColors.ts` — search highlights
- `colors/minimapColors.ts` — minimap

### Theme File Format

Themes are JSON files in `extensions/theme-*/themes/`:

```json
{
  "name": "Compyle Dark",
  "type": "dark",
  "colors": {
    "editor.background": "#1e1e3f",
    "editor.foreground": "#e8e6f0",
    "activityBar.background": "#1a1a36",
    "sideBar.background": "#1c1c3a"
  },
  "tokenColors": [
    {
      "scope": ["keyword"],
      "settings": { "foreground": "#c084fc" }
    }
  ]
}
```

## Compyle Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#1e1e3f` | App background, editor bg |
| `surface` | `#2d2b55` | Panel/sidebar background |
| `panel` | `#252545` | Floating panels |
| `border` | `#3d3b6e` | Borders, dividers |
| `accent` | `#7c6af7` | Primary action color |
| `accent-2` | `#56d9cc` | Secondary accent |
| `text-primary` | `#e8e6f0` | Main text |
| `text-secondary` | `#9d9bbd` | Dimmed text |
| `success` | `#4ade80` | Success states |
| `warning` | `#fbbf24` | Warnings |
| `error` | `#f87171` | Errors |
| `code-keyword` | `#c084fc` | Keywords |
| `code-string` | `#86efac` | Strings |
| `code-function` | `#7dd3fc` | Functions |
| `code-comment` | `#6b7280` | Comments |
| `code-number` | `#fde68a` | Numbers |
| `terminal-background` | `#0d0d1a` | Terminal background |
| `terminal-foreground` | `#e8e6f0` | Terminal text |

## Adding a New Theme

1. Create a new file in `extensions/theme-defaults/themes/` (or a new theme extension)
2. Define `colors` and `tokenColors` following the JSON schema
3. Register in the extension's `package.json` `contributes.themes` array
4. Add the theme ID to the appropriate category in `src/vs/workbench/contrib/compyleThemes/browser/compyleThemes.contribution.ts`
5. Test with all UI elements: editor, sidebar, terminal, statusbar, menus

## Theme Categories

Defined in `compyleThemes.contribution.ts`:
- Dark, Light, High Contrast
- Neon, Cyber, Glass
- Minimal, Focus, OLED
- Warm, Cool, Retro
- Classroom/Beginner, Hacker Lab

## Contrast Validation (Future)

A theme health checker should verify:
- Text color contrast ratio ≥ 4.5:1 (WCAG AA) against backgrounds
- Button text readable
- Selected tab text readable
- Input placeholder readable

This is a future feature (Phase 4).

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `compyle.themes.randomOnLaunch` | false | Random theme from favorites on start |
| `compyle.themes.matchOS` | true | Follow OS dark/light mode |
| `compyle.themes.reduceTransparency` | false | Remove transparency effects |
| `compyle.themes.reduceMotion` | auto | Respect OS reduce-motion |
| `compyle.themes.favorites` | [] | Saved favorite theme IDs |
| `workbench.colorTheme` | (system default) | Active theme |
