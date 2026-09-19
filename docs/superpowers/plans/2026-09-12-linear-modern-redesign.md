# Linear/Modern Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cyberpunk/hacker aesthetic with a Linear/Modern design system — cinematic dark UI with ambient lighting, multi-layer shadows, Inter typography, and precision micro-interactions.

**Architecture:** Three-pass approach: (1) replace CSS tokens/fonts/keyframes, (2) restyle all UI components and remove cyberpunk variants, (3) restyle all pages and layout. All changes are visual-only — no feature or data model changes.

**Tech Stack:** Tailwind CSS v4, shadcn/ui (new-york), class-variance-authority, Radix primitives, Inter font

---

## Pass 1 — Foundation

### Task 1: Replace CSS tokens, fonts, keyframes, and utility classes

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the Google Fonts import**

Replace line 2 (`@import url('https://fonts.googleapis.com/css2?family=Orbitron...`) with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

- [ ] **Step 2: Update font tokens in @theme inline**

Replace lines 13-15:
```css
  --font-heading: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-sans: 'Inter', sans-serif;
```

- [ ] **Step 3: Replace :root color tokens**

Replace lines 50-90 (the entire `:root` block) with:
```css
:root {
  --radius: 0.5rem;
  --background: #050506;
  --foreground: #EDEDEF;
  --card: rgba(255,255,255,0.05);
  --card-foreground: #EDEDEF;
  --popover: rgba(255,255,255,0.05);
  --popover-foreground: #EDEDEF;
  --primary: #5E6AD2;
  --primary-foreground: #ffffff;
  --secondary: rgba(255,255,255,0.05);
  --secondary-foreground: #EDEDEF;
  --muted: rgba(255,255,255,0.05);
  --muted-foreground: #8A8F98;
  --accent: #5E6AD2;
  --accent-foreground: #EDEDEF;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: rgba(255,255,255,0.06);
  --input: #0F0F12;
  --ring: #5E6AD2;
  --chart-1: #5E6AD2;
  --chart-2: #6872D9;
  --chart-3: #8B5CF6;
  --chart-4: #EC4899;
  --chart-5: #ef4444;
  --sidebar: #050506;
  --sidebar-foreground: #EDEDEF;
  --sidebar-primary: #5E6AD2;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: rgba(255,255,255,0.05);
  --sidebar-accent-foreground: #EDEDEF;
  --sidebar-border: rgba(255,255,255,0.06);
  --sidebar-ring: #5E6AD2;
}
```

- [ ] **Step 4: Replace .dark block**

Replace lines 92-126 (the entire `.dark` block) with the same values as `:root` (dark-only app):
```css
.dark {
  --radius: 0.5rem;
  --background: #050506;
  --foreground: #EDEDEF;
  --card: rgba(255,255,255,0.05);
  --card-foreground: #EDEDEF;
  --popover: rgba(255,255,255,0.05);
  --popover-foreground: #EDEDEF;
  --primary: #5E6AD2;
  --primary-foreground: #ffffff;
  --secondary: rgba(255,255,255,0.05);
  --secondary-foreground: #EDEDEF;
  --muted: rgba(255,255,255,0.05);
  --muted-foreground: #8A8F98;
  --accent: #5E6AD2;
  --accent-foreground: #EDEDEF;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: rgba(255,255,255,0.06);
  --input: #0F0F12;
  --ring: #5E6AD2;
  --chart-1: #5E6AD2;
  --chart-2: #6872D9;
  --chart-3: #8B5CF6;
  --chart-4: #EC4899;
  --chart-5: #ef4444;
  --sidebar: #050506;
  --sidebar-foreground: #EDEDEF;
  --sidebar-primary: #5E6AD2;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: rgba(255,255,255,0.05);
  --sidebar-accent-foreground: #EDEDEF;
  --sidebar-border: rgba(255,255,255,0.06);
  --sidebar-ring: #5E6AD2;
}
```

- [ ] **Step 5: Replace @layer base styles**

Replace lines 128-174 with:
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
  }
  button:not([disabled]),
  [role="button"]:not([disabled]) {
    cursor: pointer;
  }
  ::selection {
    background-color: rgba(94, 106, 210, 0.3);
    color: #EDEDEF;
  }
  :focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--ring), 0 0 0 4px rgba(94, 106, 210, 0.2);
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

- [ ] **Step 6: Replace keyframes and utility classes**

Replace lines 176-270 (everything after `@layer base`) with:
```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(1deg); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@layer utilities {
  .gradient-text {
    background: linear-gradient(to bottom, #fff, rgba(255,255,255,0.7));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 7: Build to verify no CSS errors**

Run: `bun run build`
Expected: Build succeeds, no CSS parse errors

- [ ] **Step 8: Commit**

```bash
git add src/index.css
git commit -m "refactor(theme): replace cyberpunk tokens with Linear/Modern design system"
```

---

### Task 2: Delete cyberpunk utility module

**Files:**
- Delete: `src/lib/cyberpunk.ts`

- [ ] **Step 1: Delete the file**

Run: `rm src/lib/cyberpunk.ts`

- [ ] **Step 2: Verify build fails (expected — imports broken)**

Run: `bun run build 2>&1 | head -20`
Expected: Build errors about missing `@/lib/cyberpunk` imports

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/cyberpunk.ts
git commit -m "refactor(theme): delete cyberpunk utility module"
```

(Import errors will be fixed in Pass 2/3 as each file is restyled)

---

### Task 3: Update index.html font references

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Read current index.html**

Verify line 6 has `<link rel="icon" type="image/svg+xml" href="./logo.svg" />`

- [ ] **Step 2: No changes needed**

The Google Fonts import is handled in `src/index.css` (Task 1). The `index.html` font references are already relative (`./logo.svg`, `./manifest.webmanifest`). No changes needed.

- [ ] **Step 3: Commit (skip if no changes)**

If no changes were made, skip this commit.

---

## Pass 2 — Components

### Task 4: Restyle Button

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Replace buttonVariants**

Replace the entire `buttonVariants` constant (lines 7-41) with:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#5E6AD2] text-white shadow-[0_0_0_1px_rgba(94,106,210,0.5),0_4px_12px_rgba(94,106,210,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)] hover:bg-[#6872D9] hover:shadow-[0_0_0_1px_rgba(104,114,217,0.5),0_6px_20px_rgba(94,106,210,0.4),inset_0_1px_0_0_rgba(255,255,255,0.2)] active:scale-[0.98] active:shadow-[0_0_0_1px_rgba(94,106,210,0.5),0_2px_8px_rgba(94,106,210,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
        destructive:
          "bg-[#ef4444] text-white shadow-[0_0_0_1px_rgba(239,68,68,0.5),0_4px_12px_rgba(239,68,68,0.3)] hover:bg-[#dc2626] hover:shadow-[0_0_0_1px_rgba(220,38,38,0.5),0_6px_20px_rgba(239,68,68,0.4)] active:scale-[0.98]",
        outline:
          "bg-transparent text-[#EDEDEF] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-white/[0.05] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] active:scale-[0.98]",
        secondary:
          "bg-white/[0.05] text-[#EDEDEF] shadow-[0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:bg-white/[0.08] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_0_rgba(255,255,255,0.05)] active:scale-[0.98]",
        ghost:
          "bg-transparent text-[#8A8F98] hover:bg-white/[0.05] hover:text-[#EDEDEF]",
        link:
          "text-[#5E6AD2] underline-offset-4 hover:underline",
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

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "refactor(theme): restyle Button with Linear/Modern design"
```

---

### Task 5: Restyle Card and remove cyberpunk variants

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Replace cardVariants and remove cyberpunk components**

Replace the entire file content with:

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-[#EDEDEF] flex flex-col gap-6 rounded-2xl border border-white/[0.06] py-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_20px_rgba(0,0,0,0.4)] transition-all duration-300",
  {
    variants: {
      variant: {
        default: "",
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
      className={cn("font-semibold text-sm tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-[#8A8F98]", className)}
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

Note: `CardTerminalHeader` and `CardCornerAccents` are removed. Any files importing them will need updating (handled in Pass 3).

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build may fail due to missing `CardTerminalHeader`/`CardCornerAccents` imports — those will be fixed in Pass 3

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "refactor(theme): restyle Card, remove terminal/holographic variants"
```

---

### Task 6: Restyle Input and Textarea

**Files:**
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`

- [ ] **Step 1: Replace Input component**

Replace entire `src/components/ui/input.tsx` with:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-lg border border-white/10 bg-[#0F0F12] px-3 py-1 text-sm text-[#EDEDEF] transition-colors file:border-0 file:bg-transparent file:text-sm placeholder:text-gray-500 focus-visible:border-[#5E6AD2] focus-visible:shadow-[0_0_0_3px_rgba(94,106,210,0.15)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

- [ ] **Step 2: Replace Textarea component**

Replace entire `src/components/ui/textarea.tsx` with:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[60px] w-full rounded-lg border border-white/10 bg-[#0F0F12] px-3 py-2 text-sm text-[#EDEDEF] transition-colors placeholder:text-gray-500 focus-visible:border-[#5E6AD2] focus-visible:shadow-[0_0_0_3px_rgba(94,106,210,0.15)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "refactor(theme): restyle Input and Textarea with Linear/Modern design"
```

---

### Task 7: Restyle Badge

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Replace badgeVariants**

Replace the `badgeVariants` constant (lines 7-26) with:

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/50 focus:ring-offset-2 focus:ring-offset-[#050506]",
  {
    variants: {
      variant: {
        default:
          "border-[#5E6AD2]/30 bg-[#5E6AD2]/10 text-[#5E6AD2]",
        secondary:
          "border-white/10 bg-white/[0.05] text-[#8A8F98]",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400",
        outline:
          "border-white/10 text-[#EDEDEF]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "refactor(theme): restyle Badge with Linear/Modern design"
```

---

### Task 8: Restyle remaining UI components

**Files:**
- Modify: `src/components/ui/progress.tsx`
- Modify: `src/components/ui/skeleton.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/ui/switch.tsx`

- [ ] **Step 1: Restyle Progress**

In `src/components/ui/progress.tsx`, find the indicator element and replace its className. The indicator currently has `bg-[#00ff88]` — replace with `bg-[#5E6AD2]`. Also remove any `neonGlow` or `shadow-[0_0_*px_#00ff88*]` references.

Read the file first, then make targeted edits to replace:
- `bg-[#00ff88]` → `bg-[#5E6AD2]`
- Any `shadow-[0_0_*]` neon glow → remove or replace with subtle `shadow-[0_0_8px_rgba(94,106,210,0.3)]`

- [ ] **Step 2: Restyle Skeleton**

In `src/components/ui/skeleton.tsx`, the shimmer animation colors should be updated. Replace any `bg-[#00ff88]` or neon-colored shimmer with `bg-white/[0.05]` and shimmer overlay `bg-white/[0.08]`.

- [ ] **Step 3: Restyle Select**

In `src/components/ui/select.tsx`, find and replace:
- `bg-[#0a0a0f]` or `bg-[#12121a]` → `bg-[#0F0F12]`
- `border-[#2a2a3a]` → `border-white/10`
- `text-[#00ff88]` → `text-[#EDEDEF]`
- `border-[#00ff88]` (focus) → `border-[#5E6AD2]`
- Any `cyber-chamfer-sm` → remove
- Any neon glow shadow → remove

- [ ] **Step 4: Restyle Tabs**

In `src/components/ui/tabs.tsx`, find and replace:
- Active tab indicator: `bg-[#00ff88]` → `bg-[#5E6AD2]`
- Active tab text: `text-[#00ff88]` → `text-[#EDEDEF]`
- Tab hover: any neon colors → `hover:text-[#EDEDEF]`

- [ ] **Step 5: Restyle Switch**

In `src/components/ui/switch.tsx`, find and replace:
- Checked state: `bg-[#00ff88]` → `bg-[#5E6AD2]`
- Any neon glow on checked → remove

- [ ] **Step 6: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/progress.tsx src/components/ui/skeleton.tsx src/components/ui/select.tsx src/components/ui/tabs.tsx src/components/ui/switch.tsx
git commit -m "refactor(theme): restyle Progress, Skeleton, Select, Tabs, Switch"
```

---

## Pass 3 — Pages + Layout

### Task 9: Restyle AppShell

**Files:**
- Modify: `src/components/app/AppShell.tsx`

- [ ] **Step 1: Replace entire AppShell**

Replace the entire file content with:

```tsx
import { cn } from "@/lib/utils";
import { GraduationCap, LayoutDashboard, Library, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/words", label: "Words", icon: Library },
  { to: "/practice", label: "Practice", icon: GraduationCap },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#050506] px-4 py-6 lg:flex">
        <NavLink to="/dashboard" aria-label="Motus Home" className="flex items-center gap-2.5 px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#5E6AD2] text-white">
            <span className="text-sm font-bold">M</span>
          </span>
          <span className="text-sm font-semibold tracking-tight text-[#EDEDEF]">Motus</span>
        </NavLink>
        <p className="px-3 pt-1 text-xs text-[#8A8F98]">Private workspace</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm text-[#8A8F98] transition-all duration-200 hover:border-white/10 hover:text-[#EDEDEF] hover:bg-white/[0.03]",
                  isActive && "border-l-2 border-[#5E6AD2] bg-[#5E6AD2]/10 text-[#EDEDEF]"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-xs font-medium text-[#EDEDEF]">Local mode</p>
          <p className="mt-1 text-xs leading-5 text-[#8A8F98]">Your library and media stay on this machine.</p>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#050506]/95 px-4 backdrop-blur-xl lg:hidden">
        <NavLink to="/dashboard" aria-label="Motus Home" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-[#5E6AD2] text-white">
            <span className="text-xs font-bold">M</span>
          </span>
          <span className="text-sm font-semibold text-[#EDEDEF]">Motus</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  "flex size-9 items-center justify-center rounded-lg text-[#8A8F98] hover:text-[#EDEDEF]",
                  isActive && "text-[#5E6AD2]"
                )
              }
            >
              <item.icon className="size-5" />
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/app/AppShell.tsx
git commit -m "refactor(theme): restyle AppShell with Linear/Modern design"
```

---

### Task 10: Restyle Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Remove cyberpunk imports**

Remove line 40: `import { cyberChamfer, neonGlow } from "@/lib/cyberpunk";`

- [ ] **Step 2: Replace hardcoded colors and cyber effects**

Use the Edit tool to make targeted replacements throughout the file:

1. `bg-[#00ff88]` → `bg-[#5E6AD2]`
2. `text-[#00ff88]` → `text-[#5E6AD2]` (for icons/accents) or `text-[#EDEDEF]` (for text)
3. `bg-[#00ff8810]` → `bg-[#5E6AD2]/10`
4. `border-[#00ff88]` → `border-[#5E6AD2]`
5. `border-[#00ff8830]` → `border-[#5E6AD2]/30`
6. `border-[#ff336630]` → `border-[#ef4444]/30`
7. `bg-[#ff336608]` → `bg-[#ef4444]/5`
8. `text-[#ff3366]` → `text-[#ef4444]`
9. `shadow-[0_0_5px_#00ff8840]` → remove entirely
10. `shadow-[0_0_3px_#00ff8840]` → remove entirely
11. `shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]` → remove entirely
12. `font-heading` → remove (Inter is now the default sans font)
13. `cyber-chromatic` → remove
14. `cyber-cursor` → remove
15. `data-text="WELCOME BACK"` → remove
16. `cyberChamfer()` → remove from className strings
17. `neonGlow("green", "md")` → remove from className strings

For the heading (around line 142):
```tsx
// Before:
<h1 className="font-heading text-3xl font-bold uppercase tracking-widest text-[#00ff88] cyber-chromatic" data-text="WELCOME BACK">
  WELCOME BACK<span className="cyber-cursor" />
</h1>

// After:
<h1 className="text-3xl font-semibold tracking-tight gradient-text">
  Welcome back
</h1>
```

For stat cards (around lines 230-260), replace the `cyberChamfer()` + `neonGlow` pattern with simple rounded cards:
```tsx
// Before:
<div className={`${cyberChamfer()} rounded-2xl border bg-card p-5 shadow-sm`}>
  <div className={`rounded-lg bg-[#00ff8810] p-2 text-[#00ff88] ${neonGlow("green", "md")}`}>

// After:
<div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_20px_rgba(0,0,0,0.4)]">
  <div className="rounded-lg bg-[#5E6AD2]/10 p-2 text-[#5E6AD2]">
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "refactor(theme): restyle Dashboard with Linear/Modern design"
```

---

### Task 11: Restyle Watch page and subcomponents

**Files:**
- Modify: `src/pages/Watch.tsx`
- Modify: `src/components/app/TranscriptPanel.tsx`
- Modify: `src/components/app/TranscriptLine.tsx`
- Modify: `src/components/app/VideoControls.tsx`

- [ ] **Step 1: Restyle TranscriptLine**

In `src/components/app/TranscriptLine.tsx`, replace:
- `border-l-[#00ff88]` → `border-l-[#5E6AD2]`
- `text-[#00ff88]` → `text-[#EDEDEF]` (for active line text)
- `shadow-[0_0_5px_#00ff8840]` → remove
- `text-[#ff00ff]` → `text-[#8A8F98]` (for translations)

- [ ] **Step 2: Restyle TranscriptPanel**

In `src/components/app/TranscriptPanel.tsx`:
- Remove `import { cyberChamfer } from "@/lib/cyberpunk";`
- `bg-[#0a0a0f]` → `bg-[#050506]`
- `border-[#00ff8830]` → `border-white/[0.06]`
- Remove `cyberChamfer()` from className

- [ ] **Step 3: Restyle VideoControls**

In `src/components/app/VideoControls.tsx`:
- Remove `import { cyberChamfer } from "@/lib/cyberpunk";`
- `text-[#00ff88]` → `text-[#EDEDEF]` or `text-[#5E6AD2]` for active states
- Remove `cyberChamfer(true)` from className
- `bg-card text-[#00ff88] shadow-[0_0_5px_#00ff8840]` → `bg-[#5E6AD2] text-white`

- [ ] **Step 4: Restyle Watch page**

In `src/pages/Watch.tsx`, replace throughout:
- `text-[#00ff88]` → `text-[#5E6AD2]` (for interactive) or `text-[#EDEDEF]` (for text)
- `shadow-[0_0_5px_#00ff8840]` → remove
- `bg-[#00ff88]/25` → `bg-[#5E6AD2]/25`
- `bg-[#00ff88]/20` → `bg-[#5E6AD2]/20`
- `text-[#ff00ff]` → `text-[#8A8F98]` (for translations)
- `bg-[#00ff88]/20` (progress bar bg) → `bg-white/[0.05]`
- `bg-[#00ff88]` (progress bar fill) → `bg-[#5E6AD2]`

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/pages/Watch.tsx src/components/app/TranscriptPanel.tsx src/components/app/TranscriptLine.tsx src/components/app/VideoControls.tsx
git commit -m "refactor(theme): restyle Watch page and subcomponents"
```

---

### Task 12: Restyle Words and Practice pages

**Files:**
- Modify: `src/pages/Words.tsx`
- Modify: `src/pages/Practice.tsx`

- [ ] **Step 1: Restyle Words page**

In `src/pages/Words.tsx`:
- Remove `import { cyberChamfer } from "@/lib/cyberpunk";`
- Remove `cyberChamfer()` from className strings
- `border-[#00ff8830]` → `border-[#5E6AD2]/30` or `border-white/[0.06]`
- `text-[#00ff88]` → `text-[#5E6AD2]` (for accents) or `text-[#EDEDEF]` (for text)
- `hover:border-[#00ff88]` → `hover:border-[#5E6AD2]`
- `hover:shadow-[0_0_5px_#00ff88,0_0_10px_#00ff8840]` → remove or replace with `hover:shadow-[0_0_0_1px_rgba(94,106,210,0.3)]`

- [ ] **Step 2: Restyle Practice page**

In `src/pages/Practice.tsx`:
- Remove `import { cyberChamfer } from "@/lib/cyberpunk";`
- Remove `cyberChamfer()` from className strings
- `border-2 border-[#00ff88]` → `border-2 border-[#5E6AD2]`
- `border-2 border-[#ff00ff]` → `border-2 border-[#8A8F98]`
- `border-[#f59e0b]` → `border-[#EDEDEF]` (or keep amber for "good" rating)
- `text-[#f59e0b]` → keep for "good" rating
- `hover:bg-[#f59e0b]` → keep for "good" rating
- `hover:shadow-[0_0_5px_#f59e0b40]` → remove
- `border-[#00ff88]` → `border-[#5E6AD2]`
- `text-[#00ff88]` → `text-[#5E6AD2]`
- `hover:bg-[#00ff88]` → `hover:bg-[#5E6AD2]`
- `hover:text-[#0a0a0f]` → `hover:text-white`
- `hover:shadow-[0_0_5px_#00ff8840]` → remove
- `border-[#00d4ff]` → `border-[#EDEDEF]` (or keep cyan for "easy" rating)
- `text-[#00d4ff]` → keep for "easy" rating
- `hover:bg-[#00d4ff]` → keep for "easy" rating
- `hover:text-[#0a0a0f]` → `hover:text-[#050506]`

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/pages/Words.tsx src/pages/Practice.tsx
git commit -m "refactor(theme): restyle Words and Practice pages"
```

---

### Task 13: Restyle Settings and NotFound pages

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/NotFound.tsx`

- [ ] **Step 1: Restyle Settings page**

In `src/pages/Settings.tsx`:
- Remove `import { chromaticAberration } from "@/lib/cyberpunk";`
- Remove `${chromaticAberration()}` from heading classNames
- `font-heading` → remove (Inter is now default)
- `text-[#00ff88]` → `text-[#EDEDEF]` (for headings) or `text-[#5E6AD2]` (for accents)
- `uppercase tracking-widest` → remove from section headings (use `tracking-tight` instead)

- [ ] **Step 2: Restyle NotFound page**

In `src/pages/NotFound.tsx`:
- Replace any cyberpunk colors with Linear/Modern equivalents
- `text-[#00ff88]` → `text-[#5E6AD2]`
- `bg-[#0a0a0f]` → `bg-[#050506]`

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Verify no remaining cyberpunk references**

Run: `grep -r "cyber\|#00ff88\|#ff00ff\|#00d4ff\|#0a0a0f\|#1c1c2e\|#2a2a3a\|font-heading\|Orbitron" src/ --include="*.tsx" --include="*.ts" --include="*.css" | grep -v node_modules | grep -v docs`
Expected: No output (all cyberpunk references removed)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx src/pages/NotFound.tsx
git commit -m "refactor(theme): restyle Settings and NotFound pages"
```

---

### Task 14: Final build verification

- [ ] **Step 1: Full build**

Run: `bun run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Check for any remaining cyberpunk artifacts**

Run: `grep -r "cyber\|neon\|Orbitron\|#00ff88\|#ff00ff\|#00d4ff" src/ --include="*.tsx" --include="*.ts" --include="*.css" | grep -v node_modules | grep -v docs | grep -v "\.d\.ts"`
Expected: No output

- [ ] **Step 3: Start dev server and visual check**

Run: `bun run dev`
Open http://localhost:5173 — verify the app loads with the new Linear/Modern theme

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "refactor(theme): Linear/Modern redesign complete"
```
