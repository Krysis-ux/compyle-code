# Design

## Design System Overview

Compyle Code uses a restrained product UI register. The default surface is Quiet: low-chrome, precise spacing, familiar developer-tool density, and one purposeful accent. Liquid Glass is an optional premium mode, not the baseline.

## Color

- Default accent: `#E8A33D` for Quiet.
- Liquid Glass accent: `#7E81FF`, used for focus, selection, and meaningful controls.
- Avoid one-note palettes and decorative glow. Color should indicate state, selection, priority, or provider type.
- Body and control text must remain readable over glass. If contrast is uncertain, use the opaque fallback.

## Typography

- Use the existing workbench/system font stack.
- Keep product headings compact and fixed-size.
- Use tabular numbers for values and status counters.
- Avoid display typography in labels, buttons, and data surfaces.

## Layout

- Compyle panes should share the same shell rhythm: header, task surface, content grid or rail, and stable action area.
- Avoid nested cards. Cards are only for repeated items, proposals, templates, provider statuses, and pack previews.
- Split panes must align by header height, content top edge, and footer/action placement.

## Components

- Buttons, inputs, selects, range controls, badges, and cards read from `--compyle-*` tokens where practical.
- Icon-only actions need hover text or accessible labels.
- Empty states should explain the next action without marketing copy.
- AI actions must show review/apply/reject states where edits are involved.

## Liquid Glass

- Full Glass Mode applies to chrome and floating workbench UI, not dense code surfaces.
- Glass surfaces use a shared vocabulary: translucent fill, subtle highlight border, controlled blur, and moderate shadow.
- Interactive glass is reserved for buttons, tabs, cards, provider controls, and pack previews.
- Safe Mode and reduce transparency disable glass immediately.

## Motion

- Keep transitions 150-200 ms.
- Motion should signal hover, selection, preview, mode change, or busy state.
- Reduced motion collapses transitions to near-instant timing.
