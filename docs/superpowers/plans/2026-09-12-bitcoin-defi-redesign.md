# Bitcoin DeFi Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Linear/Modern aesthetic with a Bitcoin DeFi design system — deep cosmic void with Bitcoin orange glows, gold highlights, pill-shaped buttons, grid patterns, glass morphism, and technical precision.

**Architecture:** Three-pass approach: (1) replace CSS tokens/fonts/keyframes/backgrounds, (2) restyle all UI components, (3) restyle all pages and layout.

**Tech Stack:** Tailwind CSS v4, shadcn/ui (new-york), class-variance-authority, Radix primitives, Space Grotesk + Inter + JetBrains Mono fonts

---

## Pass 1 — Foundation

### Task 1: Replace CSS tokens, fonts, keyframes, backgrounds

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace Google Fonts import**

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

- [ ] **Step 2: Update font tokens**

```css
  --font-heading: 'Space Grotesk', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-sans: 'Inter', sans-serif;
```

- [ ] **Step 3: Replace :root tokens**

```css
:root {
  --radius: 0.75rem;
  --background: #030304;
  --foreground: #FFFFFF;
  --card: #0F1115;
  --card-foreground: #FFFFFF;
  --popover: #0F1115;
  --popover-foreground: #FFFFFF;
  --primary: #F7931A;
  --primary-foreground: #FFFFFF;
  --secondary: #0F1115;
  --secondary-foreground: #FFFFFF;
  --muted: #0F1115;
  --muted-foreground: #94A3B8;
  --accent: #EA580C;
  --accent-foreground: #FFFFFF;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #1E293B;
  --input: #0F1115;
  --ring: #F7931A;
  --chart-1: #F7931A;
  --chart-2: #FFD600;
  --chart-3: #EA580C;
  --chart-4: #94A3B8;
  --chart-5: #ef4444;
  --sidebar: #030304;
  --sidebar-foreground: #FFFFFF;
  --sidebar-primary: #F7931A;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #0F1115;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #1E293B;
  --sidebar-ring: #F7931A;
}
```

- [ ] **Step 4: Replace .dark block** (same values)

- [ ] **Step 5: Replace @layer base**

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-image:
      linear-gradient(rgba(30, 41, 59, 0.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(30, 41, 59, 0.3) 1px, transparent 1px);
    background-size: 50px 50px;
    mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
    -webkit-mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
  }
  button:not([disabled]),
  [role="button"]:not([disabled]) {
    cursor: pointer;
  }
  ::selection {
    background-color: rgba(247, 147, 26, 0.3);
    color: #FFFFFF;
  }
  :focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--ring), 0 0 0 4px rgba(247, 147, 26, 0.2);
  }
  html {
    scroll-behavior: smooth;
  }
  button, a, [role="button"], input[type="checkbox"], input[type="radio"] {
    min-height: 44px;
    min-width: 44px;
  }
}
```

- [ ] **Step 6: Replace keyframes and utilities**

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px -5px rgba(247, 147, 26, 0.4); }
  50% { box-shadow: 0 0 30px -5px rgba(247, 147, 26, 0.6); }
}

@layer utilities {
  .gradient-text {
    background: linear-gradient(to right, #F7931A, #FFD600);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .glow-orange {
    box-shadow: 0 0 20px -5px rgba(234, 88, 12, 0.5);
  }
  .glow-orange-lg {
    box-shadow: 0 0 30px -5px rgba(247, 147, 26, 0.6);
  }
  .glow-gold {
    box-shadow: 0 0 20px rgba(255, 214, 0, 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 7: Build and commit**

```bash
bun run build && git add src/index.css && git commit -m "refactor(theme): replace tokens with Bitcoin DeFi design system"
```

---

### Task 2: Delete old utility module if exists

**Files:**
- Check: `src/lib/cyberpunk.ts` (already deleted in previous redesign)

- [ ] **Step 1: Verify file doesn't exist**

```bash
ls src/lib/cyberpunk.ts 2>&1 || echo "already deleted"
```

- [ ] **Step 2: Commit if any cleanup needed**

---

## Pass 2 — Components

### Task 3: Restyle Button

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Replace buttonVariants**

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold uppercase tracking-wider transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#EA580C] to-[#F7931A] text-white shadow-[0_0_20px_-5px_rgba(234,88,12,0.5)] hover:shadow-[0_0_30px_-5px_rgba(247,147,26,0.6)] hover:scale-105 active:scale-95",
        destructive:
          "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.6)] hover:scale-105 active:scale-95",
        outline:
          "bg-transparent border-2 border-white/20 text-white hover:border-white hover:bg-white/10 active:scale-95",
        secondary:
          "bg-white/5 text-white border border-white/10 hover:bg-white/10 active:scale-95",
        ghost:
          "bg-transparent text-white hover:bg-white/10 hover:text-[#F7931A]",
        link:
          "text-[#F7931A] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 px-8 has-[>svg]:px-6",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Build and commit**

```bash
bun run build && git add src/components/ui/button.tsx && git commit -m "refactor(theme): restyle Button with Bitcoin DeFi design"
```

---

### Task 4: Restyle Card

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Replace entire file**

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "bg-[#0F1115] text-white flex flex-col gap-6 rounded-2xl border border-white/10 py-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#F7931A]/50 hover:shadow-[0_0_30px_-10px_rgba(247,147,26,0.2)]",
  {
    variants: {
      variant: {
        default: "",
        glass: "bg-black/40 backdrop-blur-lg",
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
      className={cn("font-heading font-semibold text-lg tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-[#94A3B8]", className)}
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

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
```

- [ ] **Step 2: Build and commit**

```bash
bun run build && git add src/components/ui/card.tsx && git commit -m "refactor(theme): restyle Card with Bitcoin DeFi design"
```

---

### Task 5: Restyle Input and Textarea

**Files:**
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`

- [ ] **Step 1: Replace Input**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full bg-black/50 border-b-2 border-white/20 px-4 py-2 text-white text-sm transition-colors file:border-0 file:bg-transparent file:text-sm placeholder:text-white/30 focus-visible:border-[#F7931A] focus-visible:shadow-[0_10px_20px_-10px_rgba(247,147,26,0.3)] focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

- [ ] **Step 2: Replace Textarea**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full bg-black/50 border-b-2 border-white/20 px-4 py-3 text-white text-sm transition-colors placeholder:text-white/30 focus-visible:border-[#F7931A] focus-visible:shadow-[0_10px_20px_-10px_rgba(247,147,26,0.3)] focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

- [ ] **Step 3: Build and commit**

```bash
bun run build && git add src/components/ui/input.tsx src/components/ui/textarea.tsx && git commit -m "refactor(theme): restyle Input and Textarea with Bitcoin DeFi design"
```

---

### Task 6: Restyle Badge

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Replace badgeVariants**

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#F7931A]/50 focus:ring-offset-2 focus:ring-offset-[#030304]",
  {
    variants: {
      variant: {
        default:
          "border-[#F7931A]/30 bg-[#F7931A]/10 text-[#F7931A]",
        secondary:
          "border-white/10 bg-white/5 text-[#94A3B8]",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400",
        outline:
          "border-white/10 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

- [ ] **Step 2: Build and commit**

```bash
bun run build && git add src/components/ui/badge.tsx && git commit -m "refactor(theme): restyle Badge with Bitcoin DeFi design"
```

---

### Task 7: Restyle remaining UI components

**Files:**
- Modify: `src/components/ui/progress.tsx`
- Modify: `src/components/ui/skeleton.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/ui/switch.tsx`

- [ ] **Step 1: Restyle Progress** — orange fill, no chamfer
- [ ] **Step 2: Restyle Skeleton** — shimmer with orange tint
- [ ] **Step 3: Restyle Select** — dark bg, orange focus, bottom-border style
- [ ] **Step 4: Restyle Tabs** — orange active underline
- [ ] **Step 5: Restyle Switch** — orange when checked
- [ ] **Step 6: Build and commit**

```bash
bun run build && git add src/components/ui/progress.tsx src/components/ui/skeleton.tsx src/components/ui/select.tsx src/components/ui/tabs.tsx src/components/ui/switch.tsx && git commit -m "refactor(theme): restyle Progress, Skeleton, Select, Tabs, Switch"
```

---

## Pass 3 — Pages + Layout

### Task 8: Restyle AppShell

**Files:**
- Modify: `src/components/app/AppShell.tsx`

- [ ] **Step 1: Replace entire file with Bitcoin DeFi styled sidebar**

Key changes:
- Sidebar bg: `#030304` with `border-white/10`
- Logo: Orange gradient icon with glow
- Nav items: White text, orange active with left border
- Info card: Orange accent border
- Mobile header: Dark with orange accents

- [ ] **Step 2: Build and commit**

---

### Task 9: Restyle Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace all `#5E6AD2` → `#F7931A` or `#EA580C`**
- [ ] **Step 2: Replace all `#EDEDEF` → `#FFFFFF`**
- [ ] **Step 3: Replace all `#8A8F98` → `#94A3B8`**
- [ ] **Step 4: Update card styles to Bitcoin DeFi**
- [ ] **Step 5: Add gradient text to hero heading**
- [ ] **Step 6: Build and commit**

---

### Task 10: Restyle Watch + subcomponents

**Files:**
- Modify: `src/pages/Watch.tsx`
- Modify: `src/components/app/TranscriptPanel.tsx`
- Modify: `src/components/app/TranscriptLine.tsx`
- Modify: `src/components/app/VideoControls.tsx`

- [ ] **Step 1: Replace all color references**
- [ ] **Step 2: Update active states to orange**
- [ ] **Step 3: Build and commit**

---

### Task 11: Restyle Words + Practice

**Files:**
- Modify: `src/pages/Words.tsx`
- Modify: `src/pages/Practice.tsx`

- [ ] **Step 1: Replace all color references**
- [ ] **Step 2: Update card and badge styles**
- [ ] **Step 3: Build and commit**

---

### Task 12: Restyle Settings + NotFound

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/NotFound.tsx`

- [ ] **Step 1: Replace all color references**
- [ ] **Step 2: Update heading styles to Space Grotesk**
- [ ] **Step 3: Build and commit**

---

### Task 13: Final verification

- [ ] **Step 1: Full build** — `bun run build`
- [ ] **Step 2: Check for remaining old colors** — grep for `#5E6AD2`, `#EDEDEF`, `#8A8F98`
- [ ] **Step 3: Visual check** — start dev server
- [ ] **Step 4: Final commit if fixes needed**
