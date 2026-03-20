# Design System — Abel

## Product Context
- **What this is:** ToB desktop AI assistant (Tauri app) forked from OpenWork, packaged as .dmg/.exe
- **Who it's for:** Enterprise knowledge workers ("Susan in accounting") — non-technical users who want AI to help with real work
- **Space/industry:** Enterprise AI desktop tools (peers: Cursor, Warp, Raycast, Notion AI)
- **Project type:** Desktop application (SolidJS + TailwindCSS + Tauri)
- **Languages:** Chinese (primary), English

## Aesthetic Direction
- **Direction:** Industrial/Refined — function-first with human warmth
- **Decoration level:** Intentional — subtle warmth through surface tints and gentle depth, no frosted glass
- **Mood:** Professional precision tool that doesn't feel intimidating. Trustworthy enough for real enterprise work, warm enough that non-technical users feel comfortable. More "reliable colleague" than "cold machine."
- **Reference sites:** Cursor (warm neutrals, light-mode-first), Linear (enterprise restraint), Raycast (productive density)
- **What Abel is NOT:** A developer tool (no terminal aesthetic), a consumer toy (no playful bouncing), a generic SaaS template (no frosted glass + violet gradients)

## Typography
- **Display/Hero:** Satoshi — geometric sans with warmth. Distinctive at headline sizes, sets Abel apart from Inter/system-font defaults. Weight range: 600-900 for headlines.
- **Body:** DM Sans — highly legible, excellent weight range, pairs cleanly with CJK fonts. Not overused in the AI space. Weight range: 400-600 for body and UI.
- **Chinese:** Noto Sans SC (bundled, ~5MB, OFL license) — cross-platform consistency. Fallback stack: `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif`
- **UI/Labels:** DM Sans 500 weight — slightly heavier than body for chrome and controls
- **Data/Tables:** DM Sans with `font-variant-numeric: tabular-nums` — ensures column alignment
- **Code:** JetBrains Mono — industry standard, ligatures, great readability
- **Loading:** Satoshi from Fontshare (`https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,900&display=swap`), DM Sans + Noto Sans SC + JetBrains Mono from Google Fonts
- **Scale:**

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `text-xs` | 11px | 400 | Metadata, timestamps |
| `text-sm` | 13px | 400-500 | Labels, captions, UI chrome |
| `text-base` | 15px | 400 | Body text, messages |
| `text-lg` | 18px | 500 | Section subtitles |
| `text-xl` | 20px | 600 | Page section headings |
| `text-2xl` | 24px | 600 | Page titles |
| `text-3xl` | 32px | 700 | Feature headlines |
| `text-4xl` | 40px | 700-900 | Hero headlines |

## Color
- **Approach:** Restrained with warm accent — color is meaningful, not decorative
- **Rationale:** Deep teal distinguishes Abel from the sea of blue SaaS tools. Teal signals innovation + stability, with positive cultural resonance in the Chinese market (growth, balance). Warm amber provides energy without the aggression of red or orange.

### Core Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--abel-primary` | `#0D7C66` | Primary actions, active states, brand moments |
| `--abel-primary-hover` | `#0A6553` | Primary hover state |
| `--abel-primary-light` | `#E8F5F1` | Primary tint for backgrounds, badges |
| `--abel-secondary` | `#F5A623` | Highlights, notifications, secondary accents |
| `--abel-secondary-hover` | `#E09515` | Secondary hover state |
| `--abel-secondary-light` | `#FEF7E8` | Secondary tint for backgrounds |

### Neutrals (Warm Gray)

| Token | Hex | Usage |
|-------|-----|-------|
| `--abel-bg` | `#FAFAF8` | Page background (warm off-white) |
| `--abel-bg-elevated` | `#FFFFFF` | Cards, modals, elevated surfaces |
| `--abel-bg-sunken` | `#F5F5F3` | Sidebar, recessed areas, code blocks |
| `--abel-ink` | `#1A1A1A` | Primary text (soft black) |
| `--abel-ink-secondary` | `#5C5C58` | Secondary text, descriptions |
| `--abel-ink-tertiary` | `#8A8A85` | Placeholder, timestamps, metadata |
| `--abel-border` | `#E8E8E5` | Default borders |
| `--abel-border-strong` | `#BDBDB8` | Emphasized borders, dividers |

### Semantic

| Token | Hex | Background | Usage |
|-------|-----|-----------|-------|
| Success | `#2E7D32` | `#E8F5E9` | Connected, completed, healthy |
| Warning | `#E6A817` | `#FFF8E1` | Usage limits, degraded state |
| Error | `#C62828` | `#FFEBEE` | Failed, disconnected, invalid |
| Info | `#1565C0` | `#E3F2FD` | Tips, new features, informational |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--abel-shadow-sm` | `0 1px 2px rgba(26,26,26,0.06)` | Subtle depth for small elements |
| `--abel-shadow-md` | `0 4px 12px rgba(26,26,26,0.08)` | Cards, dropdowns |
| `--abel-shadow-lg` | `0 12px 32px rgba(26,26,26,0.12)` | Modals, floating panels |

### Dark Mode Strategy
- **v1:** Light theme only, with dark-ready CSS variable infrastructure
- **Future:** Redesign surfaces (not just invert), reduce saturation 10-20%, adjust shadow opacity
- **Dark values (prepared):**

| Token | Dark Value |
|-------|-----------|
| `--abel-bg` | `#141413` |
| `--abel-bg-elevated` | `#1E1E1C` |
| `--abel-bg-sunken` | `#0F0F0E` |
| `--abel-ink` | `#EDEDEB` |
| `--abel-ink-secondary` | `#A8A8A3` |
| `--abel-ink-tertiary` | `#6E6E69` |
| `--abel-border` | `#2E2E2B` |
| `--abel-border-strong` | `#4A4A46` |

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — not cramped (enterprise users aren't power-user developers), not wasteful (desktop real estate matters for three-pane layout)

| Token | Value | Usage |
|-------|-------|-------|
| `2xs` | 2px | Tight micro-spacing |
| `xs` | 4px | Icon-to-label gap |
| `sm` | 8px | Inline element spacing |
| `md` | 16px | Component internal padding |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Major section gaps |
| `2xl` | 48px | Page-level spacing |
| `3xl` | 64px | Hero/section top spacing |

## Layout
- **Approach:** Grid-disciplined — predictable, scannable. Enterprise users want to find things in the same place every time.
- **App shell:** Three-pane (decided in design review):
  - Left rail: ~260px (Wide), ~48px icon mode (Medium), hidden with hamburger (Narrow)
  - Center canvas: fluid
  - Right rail: ~280px (Wide), floating panel (Medium), overlay (Narrow)
- **Max content width:** 1200px (for settings, dashboard)
- **Breakpoints:**
  - Wide: >= 1280px (full three-pane)
  - Medium: 900px - 1279px (collapsed left rail)
  - Narrow: < 900px (single pane with overlays)

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--abel-radius-sm` | 6px | Small elements, inputs, code blocks |
| `--abel-radius-md` | 10px | Cards, dropdowns, chat bubbles |
| `--abel-radius-lg` | 14px | Modals, large containers |
| `--abel-radius-full` | 9999px | Buttons (pill), badges, toggles |

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension. Enterprise users want speed, not choreography.
- **Principle:** Motion should support orientation, not decorate. If you can't explain what the animation communicates, remove it.

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `micro` | 100ms | `ease-out` | Toggle, checkbox, focus ring |
| `short` | 150ms | `ease-out` | Button hover, input focus, tooltip |
| `medium` | 250ms | `ease-out` | Panel open/close, dropdown, sidebar |
| `long` | 400ms | `ease-in-out` | Page transitions (rare) |

- **Reduced motion:** Respect `prefers-reduced-motion` — disable all non-essential animation
- **Loading states:** Skeleton screens with subtle pulse animation (opacity 0.4-0.7, 1.5s cycle)

## Engineering Rules
- Use CSS variables (`--abel-*`) for ALL visual values — never hardcode hex colors
- Use the spacing scale tokens — never use arbitrary pixel values
- Use the type scale tokens — never set ad-hoc font sizes
- All interactive elements must have visible focus states (`:focus-visible` with `box-shadow: 0 0 0 3px var(--abel-primary-light)`)
- New components should follow existing material patterns (elevated surface, subtle border, medium shadow)
- Test all UI changes in both Chinese and English — text length varies significantly

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-20 | Initial design system created | Created by /design-consultation based on competitive research (Cursor, Warp, Raycast, Linear) and enterprise positioning |
| 2026-03-20 | Deep teal primary (#0D7C66) | Differentiates from blue SaaS monotony; positive cultural resonance in Chinese market |
| 2026-03-20 | Satoshi for display font | Geometric warmth that Inter lacks; signals intentional design |
| 2026-03-20 | Bundle Noto Sans SC | Cross-platform CJK consistency (macOS vs Windows rendering differs) |
| 2026-03-20 | Warm off-white (#FAFAF8) background | Subtly warmer than cold grays; welcoming for non-technical users |
| 2026-03-20 | Light-only v1 with dark-ready infrastructure | Full dark mode is v2; CSS variable structure supports future addition |
| 2026-03-20 | Minimal-functional motion | Enterprise users penalize slow UIs; speed over choreography |
