# Add light mode / respect prefers-color-scheme

## Current state

The site is dark-only. Background is `#0e1117`, text is white/gray. There's no way to switch to light mode.

## Desired state

Roko should respect the user's system setting via the `prefers-color-scheme` media query. Optionally, add a manual toggle in the header.

Dark mode remains the default for users without a preference.

## Why

Some users – especially older, non-technical people who are the primary target audience for a scam checker – find dark interfaces harder to read. Accessibility matters for a safety tool.

## Implementation

1. Define CSS custom properties for all colors (background, text, borders, card backgrounds, score colors).

2. Set dark values as default, override with `@media (prefers-color-scheme: light)`.

3. Add a toggle button (sun/moon icon) that sets a `data-theme` attribute on `<html>` and saves the preference to `localStorage`.

4. Define a light palette. Starting point:

```
--bg: #f5f5f7
--surface: #ffffff
--text: #1d1d1f
--text-secondary: #6e6e73
--border: #d2d2d7
--accent: keep the same raccoon green
```

5. Test all score colors (green/yellow/red) for contrast in both modes. WCAG AA minimum.

## Files to change

- `public/index.html` – CSS variables, toggle button, `localStorage` logic
- `public/quest.html` – same CSS variable approach
