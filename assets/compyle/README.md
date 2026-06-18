# Compyle Code Assets

This directory contains official Compyle Code assets.

## Icon Design Concept

The Compyle Code icon uses:
- **Shape**: Rounded square (no VS Code ribbon shape, no Microsoft geometry)
- **Background**: Deep indigo gradient (`#1e1e3f` → `#2d2b55`)
- **Letterform**: Bold "C" in a violet-to-teal gradient (`#7c6af7` → `#56d9cc`)
- **Accent**: Terminal cursor underscore below the "C" — symbolizing code/terminal
- **No Microsoft blue, no VS Code shape, no ribbon, no copied icon geometry**

## Icon Files

| File | Size | Format | Use |
|------|------|--------|-----|
| `icons/compyle-code.svg` | 128px | SVG | Canonical source, web |
| `icons/compyle-code-128.svg` | 128px | SVG | Same as above |
| `icons/compyle-code-48.svg` | 48px | SVG | Taskbar, file manager |
| `icons/compyle-code-32.svg` | 32px | SVG | Taskbar small, menus |
| `icons/compyle-code-16.svg` | 16px | SVG | Smallest UI use |

## Binary Icons (TODO — Needs Design Tooling)

The following binary icon files in `resources/` still use Code-OSS icons and must be replaced before any public distribution:

| File | Platform | Replacement Needed |
|------|----------|--------------------|
| `resources/darwin/code.icns` | macOS | Convert SVG → .icns using iconutil |
| `resources/linux/code.png` | Linux | Export SVG → PNG at 512px |
| `resources/win32/code.ico` | Windows | Convert SVG → .ico with multiple sizes |
| `resources/server/code-192.png` | Web | Export SVG → 192px PNG |
| `resources/server/code-512.png` | Web | Export SVG → 512px PNG |
| `resources/server/favicon.ico` | Web | Convert SVG → .ico |

### macOS Icon Generation

```bash
# Requires Inkscape or similar for SVG → PNG conversion
mkdir compyle-code.iconset
inkscape -w 16 -h 16 icons/compyle-code.svg -o compyle-code.iconset/icon_16x16.png
inkscape -w 32 -h 32 icons/compyle-code.svg -o compyle-code.iconset/icon_16x16@2x.png
inkscape -w 32 -h 32 icons/compyle-code.svg -o compyle-code.iconset/icon_32x32.png
inkscape -w 64 -h 64 icons/compyle-code.svg -o compyle-code.iconset/icon_32x32@2x.png
inkscape -w 128 -h 128 icons/compyle-code.svg -o compyle-code.iconset/icon_128x128.png
inkscape -w 256 -h 256 icons/compyle-code.svg -o compyle-code.iconset/icon_128x128@2x.png
inkscape -w 256 -h 256 icons/compyle-code.svg -o compyle-code.iconset/icon_256x256.png
inkscape -w 512 -h 512 icons/compyle-code.svg -o compyle-code.iconset/icon_256x256@2x.png
inkscape -w 512 -h 512 icons/compyle-code.svg -o compyle-code.iconset/icon_512x512.png
inkscape -w 1024 -h 1024 icons/compyle-code.svg -o compyle-code.iconset/icon_512x512@2x.png
iconutil -c icns compyle-code.iconset -o resources/darwin/code.icns
```

### Linux Icon Generation

```bash
inkscape -w 512 -h 512 icons/compyle-code.svg -o resources/linux/code.png
```

### Windows Icon Generation

Use a tool like `png2ico` or Inkscape with ico export:
```bash
inkscape -w 256 -h 256 icons/compyle-code.svg -o /tmp/c256.png
# ... repeat for 16, 32, 48, 64, 128 px
png2ico resources/win32/code.ico /tmp/c16.png /tmp/c32.png /tmp/c48.png /tmp/c256.png
```

## Palette

| Token | Value | Usage |
|-------|-------|-------|
| background | `#1e1e3f` | App background, icon bg |
| surface | `#2d2b55` | Panel background, icon bg end |
| panel | `#252545` | Sidebar, panels |
| border | `#3d3b6e` | Borders, separators |
| accent | `#7c6af7` | Primary accent, icon C start |
| accent-2 | `#56d9cc` | Secondary accent, icon C end |
| text-primary | `#e8e6f0` | Main text |
| text-secondary | `#9d9bbd` | Secondary text |
| success | `#4ade80` | Build success |
| warning | `#fbbf24` | Warnings |
| error | `#f87171` | Errors |
| code-keyword | `#c084fc` | Keywords |
| code-string | `#86efac` | Strings |
| code-function | `#7dd3fc` | Functions |
| code-comment | `#6b7280` | Comments |
| code-number | `#fde68a` | Numbers |
| terminal-background | `#0d0d1a` | Terminal bg |
| terminal-foreground | `#e8e6f0` | Terminal text |
