# Cyberpunk / Glitch Design System — Implementation Spec

## Overview

Full visual redesign of the Motus language-learning app from dark blue-gray shadcn theme to a cyberpunk/glitch aesthetic. "High-Tech, Low-Life" — neon-drenched, terminal-inspired, scanline-textured, with chromatic aberration and chamfered corners. Replaces the current theme entirely. Full effects enabled.

## Scope

- **Approach:** Hybrid (CSS tokens + cyber utilities + targeted component updates + all pages)
- **Theme:** Replace entirely (no toggle)
- **Effects:** Full (chromatic aberration, scanlines, glitch animations, neon glows)
- **Typography:** Full cyberpunk everywhere, including learning content

## Files Changed

| Layer | Files | Purpose |
|---|---|---|
| Foundation | `src/index.css` | CSS tokens, fonts, global effects, keyframes |
| Utilities | `src/lib/cyberpunk.ts` (new) | Reusable cyber utility functions |
| Components | `src/components/ui/button.tsx` | Cyberpunk button variants |
| Components | `src/components/ui/card.tsx` | Cyberpunk card variants |
| Components | `src/components/ui/input.tsx` | Terminal-style input |
| Components | `src/components/ui/textarea.tsx` | Terminal-style textarea |
| Components | `src/components/ui/badge.tsx` | Neon badge variants |
| Components | `src/components/ui/progress.tsx` | Glowing progress bar |
| Components | `src/components/ui/skeleton.tsx` | Neon shimmer skeleton |
| Components | `src/components/ui/select.tsx` | Cyberpunk select trigger |
| Components | `src/components/ui/tabs.tsx` | Glowing tab indicators |
| Layout | `src/components/app/AppShell.tsx` | Cyberpunk nav + sidebar |
| Pages | `src/pages/Dashboard.tsx` | Cyberpunk dashboard |
| Pages | `src/pages/Watch.tsx` | Cyberpunk learning page |
| Pages | `src/pages/Words.tsx` | Cyberpunk vocabulary page |
| Pages | `src/pages/Practice.tsx` | Cyberpunk review page |
| Pages | `src/pages/Settings.tsx` | Cyberpunk settings |

---

## Section 1: Foundation — CSS Tokens, Fonts & Global Effects

### 1.1 Color Tokens

Replace all OKLCH values in `:root` and `.dark` with hex:

```css
:root {
  --background: #0a0a0f;
  --foreground: #e0e0e0;
  --card: #12121a;
  --card-foreground: #e0e0e0;
  --popover: #12121a;
  --popover-foreground: #e0e0e0;
  --primary: #00ff88;
  --primary-foreground: #0a0a0f;
  --secondary: #1c1c2e;
  --secondary-foreground: #e0e0e0;
  --muted: #1c1c2e;
  --muted-foreground: #6b7280;
  --accent: #ff00ff;
  --accent-foreground: #e0e0e0;
  --destructive: #ff3366;
  --destructive-foreground: #ffffff;
  --border: #2a2a3a;
  --input: #12121a;
  --ring: #00ff88;
  --radius: 0px;

  /* Cyberpunk-specific tokens */
  --neon-green: #00ff88;
  --neon-magenta: #ff00ff;
  --neon-cyan: #00d4ff;
  --neon-green-glow: 0 0 5px #00ff88, 0 0 10px #00ff8840;
  --neon-magenta-glow: 0 0 5px #ff00ff, 0 0 20px #ff00ff60;
  --neon-cyan-glow: 0 0 5px #00d4ff, 0 0 20px #00d4ff60;
}
```

The `.dark` class block gets identical values (the root IS dark). Remove light-mode overrides.

### 1.2 Fonts

Add to top of `index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');
```

Update `@theme inline`:

```css
--font-heading: 'Orbitron', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--font-sans: 'JetBrains Mono', monospace;
```

All text in the app uses monospace. Headings use Orbitron for futuristic geometric feel.

### 1.3 Global Effects

Add to `index.css` base layer:

**Scanline overlay (on body):**

```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.3) 2px,
    rgba(0, 0, 0, 0.3) 4px
  );
}
```

**Circuit grid background (on body):**

```css
body {
  background-image:
    linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
}
```

**Keyframe animations:**

```css
@keyframes cyber-blink {
  50% { opacity: 0; }
}

@keyframes cyber-glitch {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(2px, -2px); }
  60% { transform: translate(-1px, -1px); }
  80% { transform: translate(1px, 1px); }
}

@keyframes cyber-rgbShift {
  0%, 100% { text-shadow: -2px 0 #ff00ff, 2px 0 #00d4ff; }
  50% { text-shadow: 2px 0 #ff00ff, -2px 0 #00d4ff; }
}

@keyframes cyber-scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@keyframes cyber-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

**Reduced motion:**

```css
@media (prefers-reduced-motion: reduce) {
  body::after { animation: none; }
  *, *::before, *::after { animation-duration: 0.01ms !important; }
}
```

**Base overrides:**

```css
body {
  font-family: var(--font-sans);
  background-color: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}

::selection {
  background-color: rgba(0, 255, 136, 0.3);
  color: #e0e0e0;
}

*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring), 0 0 10px #00ff8840;
}
```

---

## Section 2: Cyber Utilities

### 2.1 New file: `src/lib/cyberpunk.ts`

```ts
import { cn } from "@/lib/utils";

/** Chamfered corners via clip-path */
export function cyberChamfer(sm = false) {
  return sm ? "cyber-chamfer-sm" : "cyber-chamfer";
}

/** Neon glow via Tailwind arbitrary shadow */
export function neonGlow(
  color: "green" | "magenta" | "cyan" = "green",
  size: "sm" | "md" | "lg" = "md"
) {
  const map = {
    green: {
      sm: "shadow-[0_0_3px_#00ff88,0_0_6px_#00ff8830]",
      md: "shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]",
      lg: "shadow-[0_0_10px_#00ff88,0_0_20px_#00ff8860,0_0_40px_#00ff8830]",
    },
    magenta: {
      sm: "shadow-[0_0_3px_#ff00ff,0_0_6px_#ff00ff30]",
      md: "shadow-[0_0_5px_#ff00ff,0_0_20px_#ff00ff60]",
      lg: "shadow-[0_0_10px_#ff00ff,0_0_30px_#ff00ff60,0_0_60px_#ff00ff30]",
    },
    cyan: {
      sm: "shadow-[0_0_3px_#00d4ff,0_0_6px_#00d4ff30]",
      md: "shadow-[0_0_5px_#00d4ff,0_0_20px_#00d4ff60]",
      lg: "shadow-[0_0_10px_#00d4ff,0_0_30px_#00d4ff60,0_0_60px_#00d4ff30]",
    },
  };
  return map[color][size];
}

/** Chromatic aberration class (defined in index.css) */
export function chromaticAberration() {
  return "cyber-chromatic";
}

/** Neon text glow class (defined in index.css) */
export function neonTextGlow(color: "green" | "magenta" | "cyan" = "green") {
  return `cyber-text-glow-${color}`;
}
```

### 2.2 CSS classes (in `index.css`)

```css
.cyber-chamfer {
  clip-path: polygon(
    0 12px, 12px 0,
    calc(100% - 12px) 0, 100% 12px,
    100% calc(100% - 12px), calc(100% - 12px) 100%,
    12px 100%, 0 calc(100% - 12px)
  );
}

.cyber-chamfer-sm {
  clip-path: polygon(
    0 6px, 6px 0,
    calc(100% - 6px) 0, 100% 6px,
    100% calc(100% - 6px), calc(100% - 6px) 100%,
    6px 100%, 0 calc(100% - 6px)
  );
}

/* Blinking cursor */
.cyber-cursor::after {
  content: '\2588';
  animation: cyber-blink 1s step-end infinite;
  color: var(--neon-green);
}

/* Chromatic aberration text-shadow */
.cyber-chromatic {
  text-shadow: -1px 0 #ff00ff, 1px 0 #00d4ff;
}

/* Neon text glow variants */
.cyber-text-glow-green {
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}
.cyber-text-glow-magenta {
  text-shadow: 0 0 10px rgba(255, 0, 255, 0.5);
}
.cyber-text-glow-cyan {
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}
```

---

## Section 3: Component Restyling

### 3.1 Button (`src/components/ui/button.tsx`)

Update `buttonVariants` in `cva`:

| Variant | Styling |
|---|---|
| `default` | bg-transparent, border-2 border-[#00ff88], text-[#00ff88], uppercase, tracking-widest, font-mono, cyber-chamfer-sm. Hover: bg-[#00ff88] text-[#0a0a0f] shadow-neon-green. |
| `secondary` | border-2 border-[#ff00ff], text-[#ff00ff]. Hover: bg-[#ff00ff] text-[#0a0a0f] shadow-neon-magenta. |
| `outline` | border border-[#2a2a3a], text-[#e0e0e0]. Hover: border-[#00ff88] text-[#00ff88] shadow-neon-green. |
| `ghost` | No border. Hover: bg-[#00ff8810] text-[#00ff88]. |
| `destructive` | bg-[#ff3366] text-white. Hover: brightness(1.1). |
| `link` | text-[#00ff88] underline-offset-4. Hover: text-[#00ff88] glow. |

New variant: `glitch` — bg-[#00ff88] text-[#0a0a0f], with `.cyber-glitch` class on hover for chromatic aberration flicker.

All sizes: `font-mono text-xs uppercase tracking-widest`.

### 3.2 Card (`src/components/ui/card.tsx`)

Base: `bg-card text-card-foreground border border-border cyber-chamfer`.

Hover state (via className on consumer): `hover:-translate-y-0.5 hover:border-[#00ff88] hover:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] transition-all duration-300`.

New variants:
- `terminal`: bg-[#0a0a0f], decorative header bar with 3 colored dots (red/yellow/green), content padded below header.
- `holographic`: bg-[#1c1c2e]/30, border-[#00ff88]/30, backdrop-blur, neon glow, corner accent marks.

### 3.3 Input / Textarea

Base: `bg-input border border-border cyber-chamfer-sm text-[#00ff88] font-mono`.
Placeholder: `text-[#6b7280]`.
Focus: `border-[#00ff88] shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] outline-none`.

### 3.4 Badge

Variants:
- `default`: bg-transparent, border border-[#00ff88], text-[#00ff88]
- `secondary`: bg-transparent, border border-[#ff00ff], text-[#ff00ff]
- `outline`: bg-transparent, border border-[#2a2a3a], text-[#6b7280]
- `destructive`: bg-[#ff3366]/20, text-[#ff3366], border border-[#ff3366]/50

All: `uppercase tracking-wider font-mono text-[10px]`.

### 3.5 Progress

Track: `bg-muted cyber-chamfer-sm`.
Fill: `bg-[#00ff88] shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]`.

### 3.6 Skeleton

Base: `bg-muted`. Animated shimmer: pseudo-element with `bg-gradient-to-r from-transparent via-[#00ff8810] to-transparent` sweeping left-to-right via `@keyframes cyber-shimmer`.

### 3.7 Select

Trigger: Same as Input styling.
Content: `bg-card border border-border cyber-chamfer`.
Item highlight: `bg-[#00ff8810] text-[#00ff88]`.

### 3.8 Tabs

List: `bg-muted cyber-chamfer-sm`.
Active: `text-[#00ff88] border-b-2 border-[#00ff88] shadow-[0_2px_5px_#00ff8840]`.
Inactive: `text-[#6b7280] hover:text-[#00ff88]`.

---

## Section 4: Layout & Pages

### 4.1 AppShell

**Desktop sidebar:**
- Bg: `bg-[#0a0a0f]`, `border-r border-[#2a2a3a]`
- Logo: Green square icon with `shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]`, "MOTUS" in Orbitron uppercase text-sm tracking-widest text-[#00ff88]
- Label: `text-[10px] uppercase tracking-[0.2em] text-[#6b7280]`
- Nav items: `font-mono text-xs uppercase tracking-wider`. Active: `text-[#00ff88] border-l-2 border-[#00ff88] bg-[#00ff8810]`. Inactive: `text-[#6b7280] hover:text-[#00ff88] hover:bg-[#00ff8808]`
- Bottom box: `cyber-chamfer border border-[#00ff8830] bg-[#00ff8805]`
- Scanline overlay on entire sidebar

**Mobile header:**
- Bg: `bg-[#0a0a0f]`, `border-b border-[#2a2a3a]`
- Logo: Orbitron "MOTUS" text-[#00ff88]
- Icons: Active = text-[#00ff88] with glow, Inactive = text-[#6b7280]

### 4.2 Dashboard

- Title: "SYSTEM READY" or "WELCOME BACK" in Orbitron text-3xl uppercase with `text-shadow: -1px 0 #ff00ff, 1px 0 #00d4ff`. Blinking cursor after text.
- Action buttons: Glitch variant "NEW SUBTITLE" as primary CTA.
- Stats cards: `cyber-chamfer bg-card border border-border`, green icon containers with glow, Orbitron numbers, monospace labels.
- Progress: Neon green fill with glow.
- Streak heatmap: Green intensity cells with active day glow.
- Subtitle list: `cyber-chamfer` cards, green hover border + glow.
- Section headers: Orbitron uppercase tracking-widest text-[#00ff88] with chromatic aberration.

### 4.3 Watch

- Transcript: `bg-[#0a0a0f]` with scanline overlay, JetBrains Mono. Active line: `border-l-2 border-[#00ff88] text-[#00ff88] shadow-[0_0_5px_#00ff8840]`. Saved words: green badge. Translations: magenta text.
- Vocabulary sidebar: `cyber-chamfer` cards, green badges, magenta translation text.
- Transport controls: Green icons, `cyber-chamfer-sm` buttons, glow on active.
- Captions overlay: Monospace, green text with text-shadow glow.

### 4.4 Words

- Word cards: `cyber-chamfer border border-[#00ff8830]`, Orbitron word, JetBrains Mono definition.
- Search: Terminal-style with `>` prefix in green, blinking cursor.
- Filter tabs: Green active with glow.
- Export: Glitch variant button.

### 4.5 Practice

- Card flip: Green border front, magenta border back.
- Rating buttons: Color-coded with glow (Again=#ff3366, Hard=#f59e0b, Good=#00ff88, Easy=#00d4ff).
- Progress: Green bar with glow.
- Stats: Orbitron numbers, monospace labels.

### 4.6 Settings

- Headers: Orbitron uppercase text-[#00ff88] with chromatic aberration.
- Inputs: Terminal-style with `>` prefix.
- Toggles: Green when on, muted when off, glow.
- Save: Glitch variant.

---

## Section 5: Animations & Effects

### 5.1 Glitch Text

Applied to hero headlines (Dashboard title, section headings):

```css
.cyber-glitch-text {
  position: relative;
  text-shadow: -1px 0 #ff00ff, 1px 0 #00d4ff;
}
.cyber-glitch-text::before,
.cyber-glitch-text::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.cyber-glitch-text::before {
  color: #ff00ff;
  text-shadow: none;
  clip-path: inset(0 0 60% 0);
  animation: cyber-glitch 4s infinite linear alternate-reverse;
}
.cyber-glitch-text::after {
  color: #00d4ff;
  text-shadow: none;
  clip-path: inset(60% 0 0 0);
  animation: cyber-glitch 4s infinite linear alternate;
}
```

### 5.2 Scanline Scroll

Optional: A single bright scanline that slowly scrolls down the page every few seconds (via `@keyframes cyber-scanline`). Applied sparingly — only on hero sections or full-page overlays.

### 5.3 Neon Pulse

Active/selected elements get a subtle pulsing glow:

```css
@keyframes neon-pulse {
  0%, 100% { box-shadow: 0 0 5px #00ff88, 0 0 10px #00ff8840; }
  50% { box-shadow: 0 0 10px #00ff88, 0 0 20px #00ff8860; }
}
```

### 5.4 Performance

- `will-change: transform` only on elements during active glitch animation
- `prefers-reduced-motion: reduce` disables all animations, keeps static effects
- Scanlines: pure CSS, no image assets
- Neon glow: `box-shadow` is GPU-composited
- Maximum 3 concurrent glow animations per viewport

---

## Accessibility

- **Contrast:** Neon green (#00ff88) on void black (#0a0a0f) = 13.5:1 ratio (exceeds AAA)
- **Focus states:** All interactive elements get green glow ring on focus-visible
- **Reduced motion:** All animations disabled, static glow/chromatic kept
- **Touch targets:** Minimum 44px height on all buttons/links
- **Screen readers:** All icons have aria-labels, semantic HTML preserved
