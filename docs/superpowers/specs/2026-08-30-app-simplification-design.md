# App Simplification — Design Spec

## Problem

The app has 8 routed pages, but several are redundant or unnecessary:
- Landing page is marketing fluff — users just want to use the app
- Stats page overlaps heavily with Dashboard (both show streaks, word counts, due cards)
- Subtitles page is a separate library page when Dashboard could be the home base
- Dead code: Auth.tsx, RequireAuth.tsx, LogoDropdown.tsx, Convex dependencies

The learning flow should be: Dashboard (home) → Watch (learn) → Practice (review) → Words (manage).

## Goal

Reduce from 8 pages to 5 focused pages. Dashboard becomes the true home base with subtitle library + stats merged in. Remove all dead code.

## Target Structure

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/dashboard` | Home base — goals, streak, subtitle library, stats |
| Watch | `/watch/:id` | Immersive learning — video, transcript, word saving |
| Practice | `/practice` | SRS review — flashcards, cloze, dictation |
| Words | `/words` | Vocabulary management — search, filter, export |
| Settings | `/settings` | Preferences |

## Changes

### 1. Remove Landing Page

- Delete `src/pages/Landing.tsx`
- Change `/` route to redirect to `/dashboard`
- In `main.tsx`: replace `<Route path="/" element={<Landing />} />` with `<Route path="/" element={<Navigate to="/dashboard" replace />} />`

### 2. Remove Stats Page — Merge into Dashboard

- Delete `src/pages/Stats.tsx`
- Move these unique Stats sections into Dashboard:
  - **Card maturity** — SRS box distribution bar (New/Learning/Young/Mature/Mastered) with color legend
  - **Reviews due** — 14-day forecast bar chart
- Place them below the existing subtitle grid in Dashboard
- Remove the "Stats" nav button from Dashboard header (the content is now visible on the page)

### 3. Remove Subtitles Page — Merge into Dashboard

- Delete `src/pages/Subtitles.tsx`
- Move subtitle management into Dashboard:
  - "New subtitle" button opens a modal (reuse existing `NewSubtitleDialog` pattern)
  - Subtitle list becomes the main content area (already partially exists as "Continue watching")
  - Expand the subtitle grid to show ALL subtitles (not just 6 recent)
  - Each subtitle card shows: thumbnail, title, line count, collection, Watch button
- Move word-tap-to-save functionality out of Subtitles page (it already exists in Watch page)

### 4. Remove Dead Code

- Delete `src/pages/Auth.tsx`
- Delete `src/components/RequireAuth.tsx`
- Delete `src/components/LogoDropdown.tsx`
- Remove unused Convex imports/dependencies from `package.json` if present

### 5. Update Navigation

**AppShell sidebar** — remove "Subtitles" and "Stats" nav items:
```
Dashboard (/dashboard)
Words (/words)
Practice (/practice)
Settings (/settings)
```

**Dashboard header buttons** — update:
- "New subtitle" → opens modal (not navigate to /subtitles)
- "Start reviewing" → /practice
- "My words" → /words
- Remove "Stats" button (content is on the page now)

### 6. Update Internal References

All pages/components that reference `/subtitles` or `/stats` routes need updating:
- Dashboard empty state: "Learn new words" button → open subtitle creation modal
- Watch back button: currently goes to `/subtitles` → change to `/dashboard`
- Practice empty state: link to `/subtitles` → link to `/dashboard`
- Words empty state: link to `/subtitles` → link to `/dashboard`

## Files to Change

| File | Action |
|------|--------|
| `src/pages/Landing.tsx` | Delete |
| `src/pages/Stats.tsx` | Delete |
| `src/pages/Subtitles.tsx` | Delete |
| `src/pages/Auth.tsx` | Delete |
| `src/components/RequireAuth.tsx` | Delete |
| `src/components/LogoDropdown.tsx` | Delete |
| `src/main.tsx` | Update routes (remove Landing, Stats, Subtitles, add redirect) |
| `src/components/app/AppShell.tsx` | Update NAV_ITEMS (remove Subtitles, Stats) |
| `src/pages/Dashboard.tsx` | Major rewrite — add subtitle library, subtitle creation modal, merge Stats content |
| `src/pages/Watch.tsx` | Update back button target |
| `src/pages/Practice.tsx` | Update empty state links |
| `src/pages/Words.tsx` | Update empty state links |

## Dashboard Layout (After Merge)

```
┌─────────────────────────────────────────────────┐
│ Welcome back, [name]                            │
│ Your vocabulary studio                          │
│                                                 │
│ [New subtitle] [Start reviewing] [My words]     │
├─────────────────────────────────────────────────┤
│ Daily goal (progress bar)     │ Streak (heatmap)│
├─────────────────────────────────────────────────┤
│ Words saved │ Cards due │ Mastered │ Sources    │
├─────────────────────────────────────────────────┤
│ Your subtitles                    [+ New]       │
│ ┌──────┐ ┌──────┐ ┌──────┐                    │
│ │ Sub1 │ │ Sub2 │ │ Sub3 │ ...                │
│ └──────┘ └──────┘ └──────┘                    │
├─────────────────────────────────────────────────┤
│ Card maturity (SRS distribution bar)            │
│ [New: 5] [Learning: 12] [Young: 8] ...         │
├─────────────────────────────────────────────────┤
│ Reviews due (14-day forecast chart)             │
│ ▁▂▃▅▇▆▄▂▁▁▁▁                                 │
└─────────────────────────────────────────────────┘
```

## Testing

1. Navigate to `/` → redirects to `/dashboard`
2. Dashboard shows all subtitle cards (not just 6)
3. "New subtitle" button opens a creation modal
4. Click subtitle card → navigates to Watch
5. SRS box distribution chart visible on Dashboard
6. 14-day forecast chart visible on Dashboard
7. Sidebar shows only: Dashboard, Words, Practice, Settings
8. Watch back button goes to `/dashboard`
9. Practice/Words empty states link to `/dashboard`
10. `Auth.tsx`, `RequireAuth.tsx`, `LogoDropdown.tsx` are deleted
