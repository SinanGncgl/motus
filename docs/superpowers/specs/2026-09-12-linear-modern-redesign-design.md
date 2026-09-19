# Linear/Modern Redesign — Design Spec

**Date:** 2026-09-12
**Goal:** Replace the cyberpunk/hacker aesthetic with a Linear/Modern design system — cinematic dark UI with ambient lighting, multi-layer shadows, precision micro-interactions, and Inter typography.

---

## Scope

- **Restyle + simplify**: Update all tokens, colors, fonts, shadows, remove cyberpunk effects, remove unused variants
- **Keep functionality identical**: No feature changes, no data model changes
- **54 UI components**, **6 pages**, **1 layout shell**

---

## 1. Foundation

### Fonts

| Role | Current | New |
|------|---------|-----|
| Headings | Orbitron | Inter |
| Body/UI | JetBrains Mono | Inter |
| Code/mono | JetBrains Mono | Geist Mono or JetBrains Mono (code blocks only) |

Load Inter via Google Fonts or self-hosted. Remove Orbitron import.

### Color Tokens (CSS custom properties)

Replace all values in `src/index.css` `:root` block:

| Token | Current | New | Purpose |
|-------|---------|-----|---------|
| `--background` | `#0a0a0f` | `#050506` | Page canvas |
| `--foreground` | `#e0e0e0` | `#EDEDEF` | Primary text |
| `--card` | `#12121a` | `rgba(255,255,255,0.05)` | Card bg |
| `--card-foreground` | `#e0e0e0` | `#EDEDEF` | Card text |
| `--primary` | `#00ff88` | `#5E6AD2` | Accent interactive |
| `--primary-foreground` | `#0a0a0f` | `#ffffff` | Text on primary |
| `--secondary` | `#1c1c2e` | `rgba(255,255,255,0.05)` | Secondary bg |
| `--secondary-foreground` | `#e0e0e0` | `#EDEDEF` | Secondary text |
| `--muted` | `#1c1c2e` | `rgba(255,255,255,0.05)` | Muted bg |
| `--muted-foreground` | `#6b7280` | `#8A8F98` | Muted text |
| `--accent` | `#ff00ff` | `#5E6AD2` | Accent (same as primary) |
| `--accent-foreground` | `#e0e0e0` | `#EDEDEF` | Accent text |
| `--destructive` | `#ff3366` | `#ef4444` | Error/destructive |
| `--destructive-foreground` | `#ffffff` | `#ffffff` | Text on destructive |
| `--border` | `#2a2a3a` | `rgba(255,255,255,0.06)` | Borders |
| `--input` | `#12121a` | `#0F0F12` | Input bg |
| `--ring` | `#00ff88` | `#5E6AD2` | Focus ring |
| `--radius` | `0px` | `0.5rem` | Base border radius |

### Remove

- All `--neon-*` custom properties (`--neon-green`, `--neon-magenta`, `--neon-cyan`, `--neon-*-glow`)
- All `cyber-*` keyframes (`cyber-blink`, `cyber-glitch`, `cyber-rgbShift`, `cyber-scanline`, `cyber-shimmer`, `neon-pulse`)
- All `cyber-*` utility classes (`cyber-chamfer`, `cyber-chamfer-sm`, `cyber-cursor`, `cyber-chromatic`, `cyber-text-glow-*`, `cyber-glitch-text`)
- Grid background overlay (`body::before`)
- Scanline overlay (`body::after`)
- CRT selection color (replace with accent selection)
- Green focus ring glow (replace with accent ring)

### Add

- `float` keyframe for ambient blobs (8-10s, ease-in-out, infinite)
- Gradient text utility class
- Multi-layer shadow utility classes (card-default, card-hover, accent-glow)
- Noise texture overlay (optional, SVG at opacity 0.015)

### Background System

Page background uses layered gradients:
```
bg-[radial-gradient(ellipse_at_top,#0a0a0f_0%,#050506_50%,#020203_100%)]
```

Optional animated ambient blobs (large blurred shapes at low opacity) for depth.

---

## 2. Components

### Remove

- Card variants: `terminal`, `holographic` (keep `default`)
- Button variant: `glitch` (keep default, destructive, outline, secondary, ghost, link)
- `CardTerminalHeader` component
- `CardCornerAccents` component

### Button

- Base: `rounded-lg`, `font-medium`, `text-sm`
- Primary: `bg-[#5E6AD2]`, white text, multi-layer shadow with accent glow
- Primary hover: `bg-[#6872D9]`, increased glow
- Primary active: `scale-[0.98]`, reduced shadow
- Secondary: `bg-white/[0.05]`, `text-[#EDEDEF]`, inset shadow
- Secondary hover: `bg-white/[0.08]`
- Ghost: transparent, hover `bg-white/[0.05]`
- All: 200-300ms transitions, expo-out easing
- Remove: `cyber-chamfer-sm` clip-path, neon glow shadows, uppercase tracking

### Card

- Base: `rounded-2xl`, `bg-gradient-to-b from-white/[0.08] to-white/[0.02]`
- Border: `border border-white/[0.06]`
- Inner highlight: 1px gradient at top edge
- Hover: border brightens to 10%, increased shadow
- Shadow default: `[0_0_0_1px_rgba(255,255,255,0.06),0_2px_20px_rgba(0,0,0,0.4)]`
- Shadow hover: `[0_0_0_1px_rgba(255,255,255,0.1),0_8px_40px_rgba(0,0,0,0.5)]`
- Remove: `cyber-chamfer` clip-path, terminal dots, corner accents

### Input

- Base: `rounded-lg`, `bg-[#0F0F12]`, `border border-white/10`
- Text: `text-gray-100` (not green)
- Focus: `border-[#5E6AD2]` with accent glow ring
- Placeholder: `text-gray-500`
- Remove: `cyber-chamfer-sm`, green text color

### Badge

- Base: `rounded-full`, `text-xs`, `font-medium`
- Default: `bg-[#5E6AD2]/10`, `text-[#5E6AD2]`, `border-[#5E6AD2]/30`
- Secondary: `bg-white/[0.05]`, `text-[#8A8F98]`, `border-white/10`
- Destructive: `bg-red-500/10`, `text-red-400`, `border-red-500/30`
- Outline: `border-white/10`, `text-[#EDEDEF]`
- Remove: uppercase, tracking-wider, mono font

### Select, Tabs, Switch, Progress

- Select: match input styling (rounded-lg, dark bg, accent focus)
- Tabs: accent underline on active, subtle hover
- Switch: accent color when checked
- Progress: accent fill with subtle glow

### Skeleton

- Keep shimmer animation, adjust colors to match new palette

---

## 3. Layout + Pages

### AppShell

- Sidebar: `bg-[#050506]`, subtle right border (`border-white/[0.06]`)
- Logo: Inter font, clean icon, no chamfer/clip-path/neon glow
- Nav items: Subtle hover bg (`bg-white/[0.05]`), accent left-border on active
- Mobile header: Same dark bg, clean logo, hamburger menu icon
- Remove: Neon logo glow, chamfered info card, all cyber effects

### Dashboard

- Hero: "Welcome back" with gradient text (white → semi-transparent)
- Stats cards: Multi-layer shadows, accent icon backgrounds (`bg-[#5E6AD2]/10`)
- Heatmap: Subtle grid, accent color for active days
- Subtitle list: Clean table-like rows, hover highlight
- Remove: Glitch text, chromatic aberration, neon glows, `data-text` attributes

### Watch

- Transcript lines: Clean hover highlight, accent color for active line
- Translation toggle: Simple accent button
- Video controls: Minimal, accent play button
- Remove: Scanline overlay on transcript, neon text effects

### Words

- Word list: Clean rows with hover, accent badges for box level
- Translation: Inline accent text
- Remove: Neon text glows

### Practice

- Card flip: Smooth 300ms transition
- SRS boxes: Accent gradient fills
- Progress: Clean accent bar

### Settings

- Form inputs: Consistent with global input style
- Section headers: Inter font, gradient text

### All Pages

- Max-width container with responsive padding
- `py-8` to `py-12` section spacing
- Consistent card/section styling
- Remove all hardcoded hex colors, use CSS variables

---

## 4. Typography

| Level | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| Display | `text-7xl` to `text-8xl` | `font-semibold` | `tracking-[-0.03em]` | Hero headlines |
| H1 | `text-5xl` to `text-6xl` | `font-semibold` | `tracking-tight` | Section headers |
| H2 | `text-3xl` to `text-4xl` | `font-semibold` | `tracking-tight` | Subsection headers |
| H3 | `text-xl` to `text-2xl` | `font-semibold` | `tracking-tight` | Card titles |
| Body Large | `text-lg` to `text-xl` | `font-normal` | default | Lead paragraphs |
| Body | `text-sm` to `text-base` | `font-normal` | default | Standard content |
| Label | `text-xs` | `font-mono` | `tracking-widest` | Section tags, metadata |

Gradient text for headlines:
```
bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent
```

---

## 5. Animation & Motion

- Quick interactions: 200ms
- Standard transitions: 300ms
- Entrance animations: 600ms
- Easing: `[0.16, 1, 0.3, 1]` (expo-out)
- Hover: minimal movement (4-8px max), subtle scale (0.98-1.02)
- No bouncy animations, no spring physics

---

## 6. Accessibility

- Primary text contrast: ~15:1 (EDEDEF on 050506)
- Muted text contrast: ~6:1 (8A8F98 on 050506)
- Always visible focus rings with accent color
- Respect `prefers-reduced-motion`
- 44px min touch targets

---

## 7. Files to Modify

### Pass 1 — Foundation
- `src/index.css` — tokens, keyframes, utility classes, fonts
- `src/lib/cyberpunk.ts` — delete or gut (remove all exports)
- `index.html` — update font imports

### Pass 2 — Components (54 files)
- `src/components/ui/button.tsx` — remove glitch variant, restyle
- `src/components/ui/card.tsx` — remove terminal/holographic, restyle
- `src/components/ui/input.tsx` — restyle
- `src/components/ui/badge.tsx` — restyle
- `src/components/ui/textarea.tsx` — restyle
- `src/components/ui/progress.tsx` — restyle
- `src/components/ui/skeleton.tsx` — adjust colors
- `src/components/ui/select.tsx` — restyle
- `src/components/ui/tabs.tsx` — restyle
- `src/components/ui/switch.tsx` — restyle
- All other UI components — audit and restyle as needed

### Pass 3 — Pages + Layout
- `src/components/app/AppShell.tsx` — restyle sidebar, nav, logo
- `src/pages/Dashboard.tsx` — restyle, remove cyber effects
- `src/pages/Words.tsx` — restyle
- `src/pages/Practice.tsx` — restyle
- `src/pages/Watch.tsx` — restyle
- `src/pages/Settings.tsx` — restyle
- `src/pages/NotFound.tsx` — restyle
- `src/components/app/VideoControls.tsx` — restyle
- `src/components/app/TranscriptPanel.tsx` — restyle
- `src/components/app/TranscriptLine.tsx` — restyle
