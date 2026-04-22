# Design System — CloudVoyager

## Product Context
- **What this is:** SonarQube-to-SonarCloud migration tool (CLI + Electron desktop app)
- **Who it's for:** DevOps engineers, platform teams, and SonarQube admins at enterprises
- **Space/industry:** Developer tooling, code quality, DevSecOps
- **Project type:** Desktop app (Electron) + CLI tool

## Aesthetic Direction
- **Direction:** Retro-Futuristic Developer Tool
- **Decoration level:** Intentional (glow effects, scanlines, and glass blur serve hierarchy, not decoration)
- **Mood:** A terminal that went to art school. Dark, precise, confident. The pixel-art whale gives it personality without undermining the seriousness of enterprise migration tooling.
- **Mascot:** Pixel-art whale (animated progress bar sprite). The whale IS the brand.

## Typography
- **Display/Hero:** Geist (700 weight) — geometric, built for developer tool UIs, clean at large sizes
- **Body:** Geist (400/500 weight) — same family for coherence, excellent readability on dark backgrounds
- **UI/Labels:** Geist (500 weight, 13px)
- **Data/Tables:** Geist Mono (tabular-nums built in) — ensures numbers align in columns
- **Code:** Geist Mono (400 weight)
- **Loading:** Bundle in Electron app (self-hosted, ~100KB). No CDN dependency.
- **Scale:**
  - xs: 11px (badges, meta)
  - sm: 13px (labels, hints, sidebar)
  - base: 14px (body text, form inputs)
  - lg: 16px (section headers)
  - xl: 18px (page titles)
  - 2xl: 22px (hero subheadings)
  - 3xl: 28px (hero headings)
  - display: 32px (welcome screen title)

## Color
- **Approach:** Restrained (1 accent + neutrals, color is rare and meaningful)

### Dark Theme (primary)
- **Background primary:** #0f1419
- **Background secondary:** #1a1f2e
- **Background tertiary:** #242938
- **Background card:** rgba(30, 36, 51, 0.7) + backdrop-filter: blur(12px)
- **Background input:** #161b27
- **Border:** #2d3548
- **Border focus:** #4a7dff
- **Text primary:** #e6edf3
- **Text secondary:** #9ba5af
- **Text muted:** #848d97
- **Accent:** #4a7dff
- **Accent hover:** #5c8bff
- **Accent background:** rgba(74, 125, 255, 0.12)
- **Glow accent:** rgba(74, 125, 255, 0.4)

### Light Theme
- **Background primary:** #ffffff
- **Background secondary:** #f6f8fa
- **Background tertiary:** #e9ecef
- **Background card:** rgba(255, 255, 255, 0.85) + backdrop-filter: blur(8px)
- **Border:** #d0d7de
- **Border focus:** #0969da
- **Text primary:** #1f2328
- **Text secondary:** #656d76
- **Text muted:** #8b949e
- **Accent:** #0969da
- **Accent hover:** #0860ca

### Semantic Colors (both themes)
- **Success:** #3fb950 (dark) / #1a7f37 (light) — bg: rgba(63, 185, 80, 0.12/0.08)
- **Warning:** #d29922 (dark) / #9a6700 (light) — bg: rgba(210, 153, 34, 0.12/0.08)
- **Danger:** #f85149 (dark) / #cf222e (light) — bg: rgba(248, 81, 73, 0.12/0.08)
- **Info/Cyan:** #38bdf8 (dark) / #0284c7 (light) — used for whale highlights and informational alerts

### ANSI Colors (log viewer)
- Red: #f85149, Green: #3fb950, Yellow: #d29922, Blue: #58a6ff
- Magenta: #bc8cff, Cyan: #39d2f5, White: #e6edf3, Gray: #848d97

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px
- **Rule:** No ad-hoc values. Round to nearest scale step. Former 10px becomes 8px or 12px. Former 14px becomes 16px. Former 20px becomes 24px. Former 28px becomes 24px or 32px.

## Layout
- **Approach:** Grid-disciplined (sidebar + content area)
- **Sidebar:** 260px fixed width, dark glassmorphic background
- **Content area:** flex: 1, padding 32px, auto-scroll
- **Max content width:** 800px (forms), unconstrained (execution/results screens)
- **Border radius:**
  - sm: 4px (buttons, badges, inline code)
  - md: 8px (cards, inputs, sections)
  - lg: 12px (modals, large panels)
  - full: 9999px (status badges, pills)

## Glass Effect
- **Card background:** rgba(30, 36, 51, 0.7)
- **Backdrop blur:** 12px (cards), 16px (overlays), 8px (subtle)
- **Glass border:** 1px solid rgba(255, 255, 255, 0.06)
- **Contrast rule:** All text on glass surfaces must maintain 4.5:1 contrast ratio. Add solid fallback background behind text areas if the blur alone doesn't guarantee readability.

## Motion
- **Approach:** Intentional (animations serve hierarchy and feedback, not decoration)
- **Easing:** enter: ease-out, exit: ease-in, move: ease-in-out
- **Duration tiers:**
  - Micro (150ms): button hovers, input focus, tooltip show
  - Standard (200-400ms): screen transitions, card entrance, progress updates
  - Dramatic (600ms+): whale progress, completion celebration, glow pulses
- **Named animations:**
  - screen-enter: 200ms ease-out (fade + scale(0.98) + blur(4px))
  - card-entrance: 400ms ease-out, staggered by index
  - glow-pulse: 2s ease-in-out infinite (active/running states)
  - whale-swim: 600ms ease-out (progress bar width transition)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-22 | Geist replaces system font stack | Intentional typography for developer tool identity. Same family across display/body/mono for coherence. |
| 2026-04-22 | Formalize 4px spacing scale | Kill ad-hoc values (10px, 14px, 20px, 28px). Consistent rhythm. |
| 2026-04-22 | Contrast rule for glass surfaces | Glassmorphic design risks WCAG failures when background shifts. Solid fallbacks required. |
| 2026-04-22 | 3-tier motion system | Micro/standard/dramatic prevents animation soup. Each tier has a clear purpose. |
| 2026-04-22 | Initial design system created | Extracted from existing CSS (wizard.css, main.css) and evolved via /design-consultation |
