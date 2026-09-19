# Bitcoin DeFi Redesign — Design Spec

**Date:** 2026-09-12
**Goal:** Replace the Linear/Modern aesthetic with a Bitcoin DeFi design system — deep cosmic void with Bitcoin orange glows, gold highlights, pill-shaped buttons, grid patterns, glass morphism, and technical precision.

---

## Scope

- **Full visual redesign**: tokens, fonts, backgrounds, components, pages, layout
- **Keep functionality identical**: no feature or data model changes
- **Dark mode only**: true void (#030304) foundation

---

## 1. Foundation

### Fonts

| Role | Current | New |
|------|---------|-----|
| Headings | Inter | Space Grotesk |
| Body | Inter | Inter (keep) |
| Mono/Data | JetBrains Mono | JetBrains Mono (keep) |

### Color Tokens

| Token | Current | New |
|-------|---------|-----|
| `--background` | `#050506` | `#030304` |
| `--foreground` | `#EDEDEF` | `#FFFFFF` |
| `--card` | `rgba(255,255,255,0.05)` | `#0F1115` |
| `--card-foreground` | `#EDEDEF` | `#FFFFFF` |
| `--popover` | `rgba(255,255,255,0.05)` | `#0F1115` |
| `--popover-foreground` | `#EDEDEF` | `#FFFFFF` |
| `--primary` | `#5E6AD2` | `#F7931A` |
| `--primary-foreground` | `#ffffff` | `#FFFFFF` |
| `--secondary` | `rgba(255,255,255,0.05)` | `#0F1115` |
| `--secondary-foreground` | `#EDEDEF` | `#FFFFFF` |
| `--muted` | `rgba(255,255,255,0.05)` | `#0F1115` |
| `--muted-foreground` | `#8A8F98` | `#94A3B8` |
| `--accent` | `#5E6AD2` | `#EA580C` |
| `--accent-foreground` | `#EDEDEF` | `#FFFFFF` |
| `--destructive` | `#ef4444` | `#ef4444` |
| `--border` | `rgba(255,255,255,0.06)` | `#1E293B` |
| `--input` | `#0F0F12` | `#0F1115` |
| `--ring` | `#5E6AD2` | `#F7931A` |
| `--radius` | `0.5rem` | `0.75rem` |

### Background System

- True void: `#030304`
- Grid pattern: 50px grid with `rgba(30,41,59,0.5)` lines, masked with radial vignette
- Radial gradient blurs: orange blobs at low opacity with heavy blur
- Body has grid pattern overlay

### Keyframes

- `float` — 8s ease-in-out infinite vertical oscillation
- `shimmer` — horizontal translate for loading states
- `pulse-glow` — orange glow intensity pulse
- `spin-slow` — 10s linear infinite rotation (orbital rings)
- `ping` — scale + fade for live indicators

---

## 2. Components

### Button

- **Primary**: `rounded-full`, `bg-gradient-to-r from-[#EA580C] to-[#F7931A]`, white bold text, `tracking-wider`, orange glow shadow, hover `scale-105` + intensified glow
- **Outline**: `rounded-full`, `border-2 border-white/20`, white text, hover `border-white` + `bg-white/10`
- **Ghost**: transparent, white text, hover `bg-white/10` + `text-[#F7931A]`
- **Destructive**: `rounded-full`, red bg, red glow
- **Link**: `text-[#F7931A]`, hover underline

### Card

- `bg-[#0F1115]`, `border border-white/10`, `rounded-2xl`, `p-6`
- Hover: `-translate-y-1`, `border-[#F7931A]/50`, orange glow shadow
- Glass variant: `bg-black/40`, `backdrop-blur-lg`, `border-white/10`

### Input

- `bg-black/50`, `border-b-2 border-white/20` (bottom border only)
- `h-12`, white text, `placeholder:text-white/30`
- Focus: `border-[#F7931A]`, orange glow shadow

### Badge

- `rounded-full`, mono font
- Default: `bg-[#F7931A]/10`, `text-[#F7931A]`, `border-[#F7931A]/30`
- Secondary: `bg-white/5`, `text-[#94A3B8]`, `border-white/10`

---

## 3. Layout + Pages

### AppShell

- Sidebar: `bg-[#030304]`, `border-r border-white/10`
- Logo: Orange gradient icon with glow
- Nav: White text, orange active state with left border
- Mobile: Dark header with orange accents

### Dashboard

- Hero: Large heading with gradient text (orange → gold)
- Stats: Cards with orange icon containers, glow on hover
- Subtitle list: Dark surface rows, orange hover accent

### Watch

- Transcript: White text, orange active line, gold translations
- Controls: Orange accent buttons with glow

### Words / Practice

- Word list: Dark rows, orange badges for box level
- Practice cards: Orange borders on active, glow effects

### Settings

- Section headers: Space Grotesk, orange accents
- Inputs: Bottom-border style with orange focus

---

## 4. Animation

- Cards: `duration-300` lift + glow on hover
- Buttons: `scale-105` + glow intensification on hover
- All transitions: `duration-200` to `duration-300`
- No bouncy animations — precise and snappy
