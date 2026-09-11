# Cyberpunk / Glitch Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Motus from dark blue-gray shadcn theme to a full cyberpunk/glitch aesthetic with neon colors, monospace fonts, chamfered corners, scanlines, and glitch animations.

**Architecture:** Hybrid approach — CSS token replacement + cyber utility classes + targeted shadcn component restyling + all page layouts. Changes layer bottom-up: foundation first, then utilities, then components, then layout, then pages.

**Tech Stack:** Tailwind CSS v4 (CSS-based config), shadcn/ui (new-york), React 19, class-variance-authority, clsx + tailwind-merge

**Design Spec:** `docs/superpowers/specs/2026-09-11-cyberpunk-redesign-design.md`

---

### Task 1: CSS Foundation — Tokens, Fonts, Global Effects

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace color tokens in `:root`**

Replace the entire `:root` block (lines 46-79) with:

```css
:root {
  --radius: 0px;
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
  --chart-1: #00ff88;
  --chart-2: #00d4ff;
  --chart-3: #ff00ff;
  --chart-4: #f59e0b;
  --chart-5: #ff3366;
  --sidebar: #0a0a0f;
  --sidebar-foreground: #e0e0e0;
  --sidebar-primary: #00ff88;
  --sidebar-primary-foreground: #0a0a0f;
  --sidebar-accent: #1c1c2e;
  --sidebar-accent-foreground: #e0e0e0;
  --sidebar-border: #2a2a3a;
  --sidebar-ring: #00ff88;
  --neon-green: #00ff88;
  --neon-magenta: #ff00ff;
  --neon-cyan: #00d4ff;
  --neon-green-glow: 0 0 5px #00ff88, 0 0 10px #00ff8840;
  --neon-magenta-glow: 0 0 5px #ff00ff, 0 0 20px #ff00ff60;
  --neon-cyan-glow: 0 0 5px #00d4ff, 0 0 20px #00d4ff60;
}
```

- [ ] **Step 2: Replace `.dark` block with identical values**

Replace the entire `.dark` block (lines 81-113) with the same values as `:root`. The root IS dark — no light mode.

```css
.dark {
  --radius: 0px;
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
  --chart-1: #00ff88;
  --chart-2: #00d4ff;
  --chart-3: #ff00ff;
  --chart-4: #f59e0b;
  --chart-5: #ff3366;
  --sidebar: #0a0a0f;
  --sidebar-foreground: #e0e0e0;
  --sidebar-primary: #00ff88;
  --sidebar-primary-foreground: #0a0a0f;
  --sidebar-accent: #1c1c2e;
  --sidebar-accent-foreground: #e0e0e0;
  --sidebar-border: #2a2a3a;
  --sidebar-ring: #00ff88;
}
```

- [ ] **Step 3: Add Google Fonts import and theme font mappings**

Add at the very top of `index.css` (before the tailwindcss import):

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');
```

Add to the `@theme inline` block (after the existing `--radius-*` lines, before the color mappings):

```css
--font-heading: 'Orbitron', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--font-sans: 'JetBrains Mono', monospace;
```

- [ ] **Step 4: Add global effects and keyframes to base layer**

Replace the `@layer base` block (lines 115-139) with:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    background-image:
      linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px);
    background-size: 50px 50px;
  }
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
  button:not([disabled]),
  [role="button"]:not([disabled]) {
    cursor: pointer;
  }
  ::selection {
    background-color: rgba(0, 255, 136, 0.3);
    color: #e0e0e0;
  }
  :focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--ring), 0 0 10px #00ff8840;
  }
  html {
    scroll-behavior: smooth;
  }
}
```

- [ ] **Step 5: Add keyframe animations and utility classes**

Append the following after the `@layer base` block:

```css
/* === Cyberpunk Keyframes === */
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
@keyframes neon-pulse {
  0%, 100% { box-shadow: 0 0 5px #00ff88, 0 0 10px #00ff8840; }
  50% { box-shadow: 0 0 10px #00ff88, 0 0 20px #00ff8860; }
}

/* === Cyberpunk Utility Classes === */
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
.cyber-cursor::after {
  content: '\2588';
  animation: cyber-blink 1s step-end infinite;
  color: var(--neon-green);
}
.cyber-chromatic {
  text-shadow: -1px 0 #ff00ff, 1px 0 #00d4ff;
}
.cyber-text-glow-green {
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}
.cyber-text-glow-magenta {
  text-shadow: 0 0 10px rgba(255, 0, 255, 0.5);
}
.cyber-text-glow-cyan {
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}
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

@media (prefers-reduced-motion: reduce) {
  body::after { animation: none; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 6: Build and verify**

Run: `bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/index.css
git commit -m "feat(cyberpunk): replace CSS tokens, add fonts, global effects and keyframes"
```

---

### Task 2: Cyber Utilities Module

**Files:**
- Create: `src/lib/cyberpunk.ts`

- [ ] **Step 1: Create the cyberpunk utilities file**

```ts
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

- [ ] **Step 2: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cyberpunk.ts
git commit -m "feat(cyberpunk): add cyber utility functions module"
```

---

### Task 3: Restyle Button Component

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Replace buttonVariants**

Replace the entire `buttonVariants` cva call (lines 7-37) with:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-mono uppercase tracking-widest transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-transparent border-2 border-[#00ff88] text-[#00ff88] cyber-chamfer-sm hover:bg-[#00ff88] hover:text-[#0a0a0f] hover:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:ring-2 focus-visible:ring-[#00ff88] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        destructive:
          "bg-[#ff3366] text-white border-2 border-[#ff3366] cyber-chamfer-sm hover:brightness-110 hover:shadow-[0_0_5px_#ff3366,0_0_10px_#ff336640] focus-visible:ring-2 focus-visible:ring-[#ff3366] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        outline:
          "bg-transparent border border-[#2a2a3a] text-[#e0e0e0] cyber-chamfer-sm hover:border-[#00ff88] hover:text-[#00ff88] hover:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:ring-2 focus-visible:ring-[#00ff88] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        secondary:
          "bg-transparent border-2 border-[#ff00ff] text-[#ff00ff] cyber-chamfer-sm hover:bg-[#ff00ff] hover:text-[#0a0a0f] hover:shadow-[0_0_5px_#ff00ff,0_0_20px_#ff00ff60] focus-visible:ring-2 focus-visible:ring-[#ff00ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        ghost:
          "bg-transparent border-transparent text-[#6b7280] hover:bg-[#00ff8810] hover:text-[#00ff88]",
        link:
          "text-[#00ff88] underline-offset-4 hover:underline hover:text-[#00ff88] hover:text-shadow-[0_0_10px_rgba(0,255,136,0.5)]",
        glitch:
          "bg-[#00ff88] text-[#0a0a0f] border-2 border-[#00ff88] cyber-chamfer-sm hover:brightness-110 hover:shadow-[0_0_10px_#00ff88,0_0_20px_#00ff8860] focus-visible:ring-2 focus-visible:ring-[#00ff88] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(cyberpunk): restyle Button with neon variants and chamfered corners"
```

---

### Task 4: Restyle Card, Input, Textarea, Badge

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Restyle Card base**

In `src/components/ui/card.tsx`, replace the `Card` function's className (line 10):

```tsx
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm"
```

with:

```tsx
"bg-card text-card-foreground flex flex-col gap-6 border border-border cyber-chamfer py-6 shadow-sm transition-all duration-300"
```

- [ ] **Step 2: Restyle Input**

In `src/components/ui/input.tsx`, find the input element's className and replace with:

```tsx
"flex h-9 w-full border border-border bg-input cyber-chamfer-sm px-3 py-1 text-[#00ff88] font-mono text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-mono placeholder:text-[#6b7280] focus-visible:border-[#00ff88] focus-visible:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
```

- [ ] **Step 3: Restyle Textarea**

In `src/components/ui/textarea.tsx`, find the textarea element's className and replace with:

```tsx
"flex min-h-[60px] w-full border border-border bg-input cyber-chamfer-sm px-3 py-2 text-[#00ff88] font-mono text-sm placeholder:text-[#6b7280] focus-visible:border-[#00ff88] focus-visible:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
```

- [ ] **Step 4: Restyle Badge**

In `src/components/ui/badge.tsx`, replace the `badgeVariants` cva call with:

```tsx
const badgeVariants = cva(
  "inline-flex items-center border font-mono text-[10px] uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-[#00ff88] focus:ring-offset-2 focus:ring-offset-[#0a0a0f]",
  {
    variants: {
      variant: {
        default:
          "border-[#00ff88] bg-transparent text-[#00ff88]",
        secondary:
          "border-[#ff00ff] bg-transparent text-[#ff00ff]",
        destructive:
          "border-[#ff3366]/50 bg-[#ff3366]/20 text-[#ff3366]",
        outline:
          "border-[#2a2a3a] bg-transparent text-[#6b7280]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

- [ ] **Step 5: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/badge.tsx
git commit -m "feat(cyberpunk): restyle Card, Input, Textarea, Badge with cyber theme"
```

---

### Task 5: Restyle Progress, Skeleton, Select, Tabs

**Files:**
- Modify: `src/components/ui/progress.tsx`
- Modify: `src/components/ui/skeleton.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/tabs.tsx`

- [ ] **Step 1: Restyle Progress**

In `src/components/ui/progress.tsx`, update the indicator element's className to include neon glow:

```tsx
"bg-[#00ff88] shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] h-full w-full flex-1 transition-all"
```

And the root element to use chamfer:

```tsx
"bg-muted cyber-chamfer-sm relative h-3 w-full overflow-hidden"
```

- [ ] **Step 2: Restyle Skeleton**

In `src/components/ui/skeleton.tsx`, replace the div className with:

```tsx
"bg-muted relative overflow-hidden cyber-chamfer-sm"
```

Add a shimmer pseudo-element by wrapping the skeleton in a container that has the shimmer animation. Update to:

```tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted relative overflow-hidden cyber-chamfer-sm", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[cyber-shimmer_2s_infinite] bg-gradient-to-r from-transparent via-[#00ff8810] to-transparent" />
    </div>
  )
}

export { Skeleton }
```

- [ ] **Step 3: Restyle Select**

In `src/components/ui/select.tsx`, replace the `SelectTrigger` className (line 38):

```tsx
"border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
```

with:

```tsx
"flex w-fit items-center justify-between gap-2 border border-border bg-input cyber-chamfer-sm px-3 py-2 text-[#00ff88] font-mono text-sm whitespace-nowrap transition-colors focus:border-[#00ff88] focus:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840] focus-visible:ring-[3px] focus-visible:ring-[#00ff88]/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
```

Replace the `SelectContent` className (line 63):

```tsx
"bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md"
```

with:

```tsx
"bg-card text-[#e0e0e0] cyber-chamfer relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto border border-border shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
```

Replace the `SelectItem` className (line 110):

```tsx
"focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
```

with:

```tsx
"focus:bg-[#00ff8810] focus:text-[#00ff88] relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
```

Replace the `SelectLabel` className (line 95):

```tsx
"text-muted-foreground px-2 py-1.5 text-xs"
```

with:

```tsx
"px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#6b7280]"
```

Replace the `SelectSeparator` className (line 136):

```tsx
"bg-border pointer-events-none -mx-1 my-1 h-px"
```

with:

```tsx
"bg-[#2a2a3a] pointer-events-none -mx-1 my-1 h-px"
```

- [ ] **Step 4: Restyle Tabs**

In `src/components/ui/tabs.tsx`, replace the `TabsList` className (line 29):

```tsx
"bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]"
```

with:

```tsx
"inline-flex h-9 w-fit items-center justify-center gap-1 bg-muted cyber-chamfer-sm p-[3px] text-[#6b7280]"
```

Replace the `TabsTrigger` className (line 45):

```tsx
"data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
```

with:

```tsx
"inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 border border-transparent px-2 py-1 font-mono text-xs font-medium uppercase tracking-wider text-[#6b7280] transition-[color,box-shadow] hover:text-[#00ff88] data-[state=active]:bg-[#00ff8810] data-[state=active]:text-[#00ff88] data-[state=active]:shadow-[0_2px_5px_#00ff8840] data-[state=active]:border-b-2 data-[state=active]:border-[#00ff88] focus-visible:ring-[3px] focus-visible:ring-[#00ff88]/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
```

- [ ] **Step 5: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/progress.tsx src/components/ui/skeleton.tsx src/components/ui/select.tsx src/components/ui/tabs.tsx
git commit -m "feat(cyberpunk): restyle Progress, Skeleton, Select, Tabs with neon effects"
```

---

### Task 6: Restyle AppShell — Cyberpunk Navigation

**Files:**
- Modify: `src/components/app/AppShell.tsx`

- [ ] **Step 1: Restyle desktop sidebar**

Read the current AppShell.tsx. Apply the following changes:

**Sidebar container:** Change from `border-r border-white/10 bg-card/70` to `border-r border-[#2a2a3a] bg-[#0a0a0f]`

**Logo icon container:** Change from `bg-primary text-primary-foreground` to `bg-[#00ff88] text-[#0a0a0f] shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]`

**Logo text "Motus":** Change to `font-heading text-sm font-semibold tracking-widest text-[#00ff88]` (add `font-heading` class for Orbitron)

**"Private workspace" label:** Change to `text-[10px] uppercase tracking-[0.2em] text-[#6b7280]`

**Nav items:** Change NavLink className to:
```tsx
"flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-[#6b7280] transition-all hover:border-[#00ff8830] hover:text-[#00ff88] hover:bg-[#00ff8808]"
```

**Active nav state:** Change active className to:
```tsx
"border-l-2 border-[#00ff88] bg-[#00ff8810] text-[#00ff88] shadow-[inset_0_0_10px_#00ff8810]"
```

**Bottom info box:** Change to `cyber-chamfer border border-[#00ff8830] bg-[#00ff8805] p-3`

**Bottom box text:** "Local mode" → `text-xs font-medium text-[#00ff88]`. Description → `text-xs leading-5 text-[#6b7280]`.

- [ ] **Step 2: Restyle mobile header**

**Header container:** Change to `border-b border-[#2a2a3a] bg-[#0a0a0f]`

**Logo icon:** Change to `bg-[#00ff88] text-[#0a0a0f]`

**Logo text:** Change to `font-heading text-sm font-semibold text-[#00ff88]`

**Nav icon buttons:** Active → `text-[#00ff88]`, Inactive → `text-[#6b7280] hover:text-[#00ff88]`

- [ ] **Step 3: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/AppShell.tsx
git commit -m "feat(cyberpunk): restyle AppShell with cyberpunk nav, neon accents, Orbitron logo"
```

---

### Task 7: Restyle Dashboard Page

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Update imports**

Add at the top of Dashboard.tsx:

```tsx
import { cyberChamfer, neonGlow } from "@/lib/cyberpunk";
```

- [ ] **Step 2: Restyle header section**

Replace the welcome/title section. Change the title to use Orbitron + glitch effect:

```tsx
<h1
  className="font-heading text-3xl font-bold uppercase tracking-widest text-[#00ff88] cyber-chromatic"
  data-text="WELCOME BACK"
>
  WELCOME BACK
  <span className="cyber-cursor" />
</h1>
```

Change description text to `text-sm leading-6 text-[#6b7280] font-mono`.

- [ ] **Step 3: Restyle action buttons**

The "New subtitle" button should use `variant="glitch"`. Other buttons use `variant="outline"`.

- [ ] **Step 4: Restyle stats cards**

For each stats card, add `cyber-chamfer` class and update the icon container to use green glow:

```tsx
<div className="rounded-lg bg-[#00ff8810] p-2 text-[#00ff88] shadow-[0_0_5px_#00ff8840]">
  <Icon className="h-5 w-5" />
</div>
```

Stat number: Add `font-heading` class for Orbitron. Keep `text-3xl font-semibold`.

Stat label: Add `font-mono text-xs uppercase tracking-wider text-[#6b7280]`.

- [ ] **Step 5: Restyle progress bar**

The daily goal progress bar fill should use `bg-[#00ff88] shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]`. Track stays `bg-muted`.

- [ ] **Step 6: Restyle streak heatmap**

Active day cells: Add `shadow-[0_0_3px_#00ff8840]` for glow.

- [ ] **Step 7: Restyle subtitle list cards**

Each subtitle card: Add `cyber-chamfer` class. Hover state: `hover:border-[#00ff88] hover:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]`.

- [ ] **Step 8: Restyle section headers**

All section titles: Add `font-heading uppercase tracking-widest text-[#00ff88] cyber-chromatic` classes.

- [ ] **Step 9: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(cyberpunk): restyle Dashboard with glitch headers, neon stats, cyber cards"
```

---

### Task 8: Restyle Watch Page

**Files:**
- Modify: `src/pages/Watch.tsx`

- [ ] **Step 1: Update imports**

Add at the top:

```tsx
import { cyberChamfer, neonGlow } from "@/lib/cyberpunk";
```

- [ ] **Step 2: Restyle transcript panel**

Transcript container: Add `bg-[#0a0a0f] relative` and a scanline overlay via a child div:

```tsx
<div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.15)_2px,rgba(0,0,0,0.15)_4px)]" />
```

Active transcript line: Change left border to `border-l-2 border-[#00ff88]`, text to `text-[#00ff88]`, add `shadow-[0_0_5px_#00ff8840]`.

Saved word badges: Use `variant="default"` (now green neon).

Translation text: Add `text-[#ff00ff]` for magenta tint.

- [ ] **Step 3: Restyle vocabulary sidebar**

Vocabulary cards: Add `cyber-chamfer` class. Border: `border-[#00ff8830]`.

- [ ] **Step 4: Restyle transport controls**

Transport button icons: Green (`text-[#00ff88]`) for active/primary actions.

Mode buttons: Add `cyber-chamfer-sm` class.

Active mode: `text-[#00ff88] shadow-[0_0_5px_#00ff8840]`.

- [ ] **Step 5: Restyle captions overlay**

Captions text: Add `font-mono text-[#00ff88] shadow-[0_0_5px_#00ff8840]` for glow.

- [ ] **Step 6: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Watch.tsx
git commit -m "feat(cyberpunk): restyle Watch page with neon transcript, green active line, magenta translations"
```

---

### Task 9: Restyle Words, Practice, Settings Pages

**Files:**
- Modify: `src/pages/Words.tsx`
- Modify: `src/pages/Practice.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Restyle Words page**

Add `import { cyberChamfer } from "@/lib/cyberpunk"` at top.

Word cards: Add `cyber-chamfer border border-[#00ff8830]` to card classes.

Word display: Add `font-heading` for Orbitron.

Definition text: `font-mono text-sm text-[#6b7280]`.

Search input: Already terminal-styled via Input component (Task 4).

Filter tabs: Already terminal-styled via Tabs component (Task 5).

Export button: Use `variant="glitch"`.

- [ ] **Step 2: Restyle Practice page**

Card front: `border-2 border-[#00ff88] cyber-chamfer`.

Card back: `border-2 border-[#ff00ff] cyber-chamfer`.

Rating buttons: Color-code with inline styles or Tailwind:
- Again: `border-[#ff3366] text-[#ff3366] hover:bg-[#ff3366] hover:text-white hover:shadow-[0_0_5px_#ff336640]`
- Hard: `border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b] hover:text-[#0a0a0f] hover:shadow-[0_0_5px_#f59e0b40]`
- Good: `border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88] hover:text-[#0a0a0f] hover:shadow-[0_0_5px_#00ff8840]`
- Easy: `border-[#00d4ff] text-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#0a0a0f] hover:shadow-[0_0_5px_#00d4ff40]`

Progress bar: Green fill with glow (handled by Progress component).

Session stats: `font-heading` for numbers, `font-mono text-xs uppercase tracking-wider text-[#6b7280]` for labels.

- [ ] **Step 3: Restyle Settings page**

Section headers: Add `font-heading uppercase tracking-widest text-[#00ff88] cyber-chromatic`.

Form inputs: Already terminal-styled via Input component.

Toggle switches: In `src/components/ui/switch.tsx`, replace the `Switch` root className (line 16):

```tsx
"peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
```

with:

```tsx
"peer data-[state=checked]:bg-[#00ff88] data-[state=unchecked]:bg-input inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-[#00ff88] focus-visible:ring-[3px] focus-visible:ring-[#00ff88]/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]"
```

Replace the `Switch` thumb className (line 24):

```tsx
"bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
```

with:

```tsx
"bg-background data-[state=unchecked]:bg-[#6b7280] data-[state=checked]:bg-[#0a0a0f] pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
```

Save button: Use `variant="glitch"`.

- [ ] **Step 4: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Words.tsx src/pages/Practice.tsx src/pages/Settings.tsx
git commit -m "feat(cyberpunk): restyle Words, Practice, Settings with cyber theme"
```

---

### Task 10: Final Build Verification and Polish

**Files:**
- Modify: any files that need cleanup

- [ ] **Step 1: Full production build**

Run: `bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Visual verification**

Run the app and verify:
- Background is deep void black (#0a0a0f) with subtle green grid
- Scanline overlay visible across the page
- All text is monospace (JetBrains Mono)
- Headings use Orbitron
- Buttons have chamfered corners and neon borders
- Cards have chamfered corners
- Active nav item has green border + glow
- Dashboard title has chromatic aberration
- Focus states show green glow ring

- [ ] **Step 3: Check for any hardcoded OKLCH values**

Run: `grep -r "oklch" src/ --include="*.tsx" --include="*.ts" --include="*.css"`
Expected: No remaining OKLCH values in component files (only in index.css if any).

- [ ] **Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "feat(cyberpunk): final polish and cleanup for cyberpunk redesign"
```

---

### Task 11: Card Terminal and Holographic Variants

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `src/lib/cyberpunk.ts`

- [ ] **Step 1: Add Card variants to card.tsx**

Add a `variant` prop to the `Card` component. Replace the entire file with:

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col gap-6 border border-border cyber-chamfer py-6 shadow-sm transition-all duration-300",
  {
    variants: {
      variant: {
        default: "",
        terminal: "bg-[#0a0a0f] relative overflow-hidden",
        holographic: "bg-card/70 backdrop-blur-md relative overflow-hidden",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Card({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
}

function CardTerminalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-b border-border px-6 py-3", className)}
      {...props}
    >
      <div className="flex gap-1.5">
        <div className="size-2 rounded-full bg-[#ff3366]" />
        <div className="size-2 rounded-full bg-[#f59e0b]" />
        <div className="size-2 rounded-full bg-[#00ff88]" />
      </div>
      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[#6b7280]">
        terminal
      </span>
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-sm font-semibold uppercase tracking-wider", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-[#6b7280] font-mono", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

function CardCornerAccents({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <>
      <div className={cn("absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#00ff88]", className)} />
      <div className={cn("absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[#00ff88]", className)} />
      <div className={cn("absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#00ff88]", className)} />
      <div className={cn("absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#00ff88]", className)} />
      <div {...props} />
    </>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardTerminalHeader,
  CardCornerAccents,
  cardVariants,
}
```

- [ ] **Step 2: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat(cyberpunk): add Card terminal/holographic variants and corner accents"
```

---

### Task 12: Accessibility — Touch Targets and Screen Reader Labels

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Enforce 44px minimum touch targets in CSS**

Add to the `@layer base` block in `src/index.css` (after the `html { scroll-behavior: smooth; }` rule):

```css
  button, a, [role="button"], input[type="checkbox"], input[type="radio"] {
    min-height: 44px;
    min-width: 44px;
  }
```

- [ ] **Step 2: Verify aria labels on icon-only buttons**

In `src/components/app/AppShell.tsx`, check that all icon-only buttons (mobile nav, sidebar nav) have `aria-label` attributes. Add any missing:

```tsx
<button aria-label="Navigate to Dashboard">
  <BookOpenIcon className="..." />
</button>
```

- [ ] **Step 3: Build and verify**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/components/app/AppShell.tsx
git commit -m "feat(cyberpunk): add accessibility — 44px touch targets, aria-labels"
```
