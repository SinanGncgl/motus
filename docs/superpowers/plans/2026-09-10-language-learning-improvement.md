# Language Learning App Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Motus language-learning app from a collection of features into a polished, fast, seamless learning environment with improved architecture, performance, and UX.

**Architecture:** Incremental refactoring of a Vite + React 19 SPA with a local Node.js/PostgreSQL backend. The app follows a feature-oriented approach with clear separation between presentation, state, and API layers. The core learning loop (watch → understand → interact → save → review) must feel continuous and fast.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Tailwind CSS v4, shadcn/ui, React Router v7, Framer Motion, PostgreSQL, Node.js HTTP servers, faster-whisper, LibreTranslate/DeepL

---

## Audit Findings

### Current Architecture Summary

- **SPA** (Vite + React 19) with lazy-loaded routes via React Router v7
- **Local backend** (`local-server.mjs`) serving static files + REST API on port 8787
- **PostgreSQL** for persistent data (subtitles, words, cards)
- **localStorage** for settings, streaks, translation cache
- **Custom hooks** for data fetching (`useResource` pattern)
- **Custom events** (`motus:word-saved`) for cross-component sync
- **54 shadcn/ui** components in `components/ui/`
- **No state management library** — all state is component-local `useState`
- **No data-fetching library** — manual fetch-on-mount with `useEffect`

### Major Problems

1. **Watch.tsx is 1767 lines** with 30+ `useState` calls — mixing video player, transcript, translation, vocabulary, practice mode, attach-video form, and learning stats
2. **No virtualization** for long transcripts — thousands of `TranscriptLine` components rendered at once
3. **Duplicate API calls** — `useLocalWords()` fetches on every component mount; `useSavedWords()` also fetches independently; Dashboard, Words, and Watch all fetch the same data
4. **`settings.get()` called in render** (lines 182, 184, 284, 285, 326 of Watch.tsx) — reads from localStorage on every render
5. **No dictionary caching** — clicking the same word triggers the same API request
6. **Translation requests fire immediately** on active line change with no debounce
7. **`setInterval` for auto-pause** (200ms polling) could be event-driven instead
8. **WordTooltip calls `offlineLookup` on every render** — no memoization
9. **`tokenize()` called repeatedly** for the same text (transcript render + transcript line + caption overlay)
10. **Tables dropped on server restart** — development-mode design, data loss risk
11. **No error recovery** for failed translation/dictionary — UI shows generic states
12. **CustomEvent bus** for cross-page sync is fragile and hard to trace

### Performance Bottlenecks

- **Transcript rendering**: N `TranscriptLine` components with `tokenize()` per line
- **Translation**: Sequential per-line translation with no batching
- **Word lookup**: No caching of dictionary results
- **Video player rerenders**: Parent state changes (translations, saved words) cause player section to rerender
- **`useSavedWords.refresh()`** calls `localApi.words.list()` after every save — full list refetch
- **`savedWords.filter()`** in Watch.tsx line 812 runs on every render (not memoized)

### UX Problems

- **Watch page is overwhelming** — too many controls, modes, and panels competing for attention
- **No loading skeleton** for transcript — shows spinner then jumps to full list
- **Word save requires confirmation** through dialog (WordDialog) for quick saves
- **Practice mode** is buried in Watch page — not a first-class experience
- **No keyboard shortcut discoverability** — help dialog is hidden behind `?`
- **Mobile transcript** is cramped — 300px vocabulary sidebar doesn't collapse well
- **No visual feedback** when translation is in progress for non-active lines

### Quick Wins (High Impact, Low Effort)

1. Memoize `savedWords.filter()` and `totalUniqueWords` in Watch.tsx
2. Cache dictionary lookups in WordDialog/WordTooltip
3. Add `React.memo` to TranscriptLine
4. Memoize tokenization results per line
5. Debounce translation requests
6. Add loading skeletons for transcript

### Medium-Term Improvements

1. Extract Watch.tsx into smaller components (VideoControls, TranscriptPanel, VocabularyPanel, AttachVideoForm)
2. Introduce a lightweight state management solution (Zustand) for shared state
3. Add virtualization for long transcripts
4. Consolidate data fetching hooks into a proper cache layer
5. Implement optimistic updates for word saves
6. Add proper error boundaries per feature

### Larger Architectural Improvements

1. Feature-based directory structure (`features/video/`, `features/transcript/`, etc.)
2. Server-side data caching with proper invalidation
3. Full offline support with IndexedDB
4. AnkiConnect integration for direct Anki sync
5. Learning modes as separate routes/views

---

## Task 1: Performance — Memoize Expensive Computations in Watch.tsx

**Files:**
- Modify: `src/pages/Watch.tsx:217-243`

- [ ] **Step 1: Memoize `savedByWord` map (already done)**

The `savedByWord` memo at line 217 is already correct. Verify no unnecessary recomputation.

- [ ] **Step 2: Memoize `wordsSavedHere`**

```typescript
// Line 812 — currently NOT memoized
const wordsSavedHere = savedWords.filter(
  (w) => w.sourceTitle === subtitle?.title,
).length;
```

Change to:
```typescript
const wordsSavedHere = useMemo(() =>
  savedWords.filter((w) => w.sourceTitle === subtitle?.title).length,
  [savedWords, subtitle?.title]
);
```

- [ ] **Step 3: Memoize `totalUniqueWords`**

Already memoized at line 815. No change needed.

- [ ] **Step 4: Memoize `videoElapsed`**

```typescript
// Line 825
const videoElapsed = duration > 0 ? time / duration : 0;
```

Change to:
```typescript
const videoElapsed = useMemo(() => duration > 0 ? time / duration : 0, [time, duration]);
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build` or `bun run build`

---

## Task 2: Performance — Add React.memo to TranscriptLine

**Files:**
- Modify: `src/components/app/TranscriptLine.tsx:1-62`

- [ ] **Step 1: Wrap TranscriptLine with React.memo**

```typescript
import React from "react";

// After the component definition (line 218), change the export:
export const TranscriptLine = React.memo(function TranscriptLine({
  // ... props
}: TranscriptLineProps) {
  // ... existing implementation
});
```

Replace the current `export function TranscriptLine(...)` with the memoized version.

- [ ] **Step 2: Update Watch.tsx to pass stable references**

In `Watch.tsx`, the `TranscriptLine` is rendered inside a `.map()` at line 1591. The `savedWords` prop is `new Set(savedByWord.keys())` — this creates a new Set every render. Change to:

```typescript
// Add a memoized savedWordsSet at the top of WatchContent
const savedWordsSet = useMemo(() => new Set(savedByWord.keys()), [savedByWord]);
```

Then pass `savedWords={savedWordsSet}` instead of `savedWords={new Set(savedByWord.keys())}`.

- [ ] **Step 3: Verify build and test**

Run: `npm run build`

---

## Task 3: Performance — Cache Dictionary Lookups

**Files:**
- Modify: `src/components/app/WordDialog.tsx:75-163`

- [ ] **Step 1: Add a module-level dictionary cache**

In `src/lib/local-api.ts`, add a simple in-memory cache for dictionary results:

```typescript
const dictionaryCache = new Map<string, { definition: string; example: string } | null>();

// Modify the dictionary method in localApi:
dictionary: async (word: string) => {
  const cached = dictionaryCache.get(word);
  if (cached !== undefined) return cached;
  const result = await request<{ definition: string; example: string } | null>("/api/dictionary", { method: "POST", body: JSON.stringify({ word }) });
  dictionaryCache.set(word, result);
  return result;
},
```

- [ ] **Step 2: Verify dictionary lookup doesn't repeat**

Open Watch.tsx, click a word, close dialog, click same word again. Second lookup should be instant.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 4: Performance — Memoize WordTooltip offline lookup

**Files:**
- Modify: `src/components/app/WordTooltip.tsx:25-39`

- [ ] **Step 1: Memoize the offlineLookup call**

Currently `offlineLookup(display)` is called on every render of WordTooltip. Since the transcript renders many WordTooltips, this matters.

```typescript
// Change from:
const entry = offlineLookup(display);

// To:
import { useMemo } from "react";
const entry = useMemo(() => offlineLookup(display), [display]);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

---

## Task 5: UX — Add Loading Skeleton for Transcript

**Files:**
- Modify: `src/pages/Watch.tsx:1571-1656`

- [ ] **Step 1: Create a TranscriptSkeleton component**

Add at the top of Watch.tsx (or as a separate file):

```typescript
function TranscriptSkeleton({ lines = 15 }: { lines?: number }) {
  return (
    <div className="space-y-1 rounded-2xl border bg-card p-3 shadow-sm">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-start gap-2 border-l-2 border-l-transparent pl-3 pr-2 py-2.5">
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-full animate-pulse rounded bg-muted/60" style={{ width: `${60 + Math.random() * 30}%` }} />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Show skeleton while subtitle is loading**

In Watch.tsx, replace the current loading spinner at line 872:

```typescript
{subtitle === undefined ? (
  <TranscriptSkeleton />
) : subtitle === null ? (
  // ... error state
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 6: Performance — Debounce Translation Requests

**Files:**
- Modify: `src/pages/Watch.tsx:276-308`

- [ ] **Step 1: Add a debounce to auto-translate active line**

Currently, the `useEffect` at line 304 translates the active line immediately on every `activeRow` change. Add a 300ms debounce:

```typescript
// Replace the auto-translate useEffect (line 304-308) with:
useEffect(() => {
  if (activeRow === null) return;
  const timer = setTimeout(() => {
    translateRow(activeRow);
  }, 300);
  return () => clearTimeout(timer);
}, [activeRow, subtitle?.language, translateTarget]);
```

- [ ] **Step 2: Verify rapid seeking doesn't spam translation requests**

Play video, seek quickly between lines. Only the final line should trigger a translation request.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 7: Architecture — Extract Video Controls from Watch.tsx

**Files:**
- Create: `src/components/app/VideoControls.tsx`
- Modify: `src/pages/Watch.tsx`

- [ ] **Step 1: Create VideoControls component**

Extract lines 1027-1297 (the learning controls section) into a new component:

```typescript
// src/components/app/VideoControls.tsx
interface VideoControlsProps {
  hasTimestamps: boolean;
  time: number;
  duration: number;
  playing: boolean;
  mode: LearnMode;
  playbackRate: number;
  showCaptions: boolean;
  showTranslation: boolean;
  translateTarget: string;
  loopA: number | null;
  loopB: number | null;
  helpOpen: boolean;
  onPrevLine: () => void;
  onNextLine: () => void;
  onReplay: () => void;
  onSeekToStart: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetMode: (mode: LearnMode) => void;
  onToggleCaptions: () => void;
  onToggleTranslation: () => void;
  onSetTranslateTarget: (target: string) => void;
  onCopy: () => void;
  onSetLoopA: (time: number | null) => void;
  onSetLoopB: (time: number | null) => void;
  onSetFocusMode: (focus: boolean) => void;
  onSetHelpOpen: (open: boolean) => void;
  focusMode: boolean;
  practiceHide: boolean;
  onSetPracticeHide: (hide: boolean) => void;
  onRevealAll: () => void;
  subtitle?: LocalSubtitle;
}
```

Move the transport buttons, mode selector, speed selector, caption toggle, translation toggle, copy button, loop button, focus button, and practice options into this component.

- [ ] **Step 2: Update Watch.tsx to use VideoControls**

Replace the extracted JSX with `<VideoControls ... />`.

- [ ] **Step 3: Verify build and test all controls still work**

Run: `npm run build`
Manually test: play/pause, speed, modes, captions, translation, loop, focus, practice

---

## Task 8: Architecture — Extract Transcript Panel from Watch.tsx

**Files:**
- Create: `src/components/app/TranscriptPanel.tsx`
- Modify: `src/pages/Watch.tsx`

- [ ] **Step 1: Create TranscriptPanel component**

Extract lines 1544-1657 (the transcript + vocabulary section) into a new component:

```typescript
// src/components/app/TranscriptPanel.tsx
interface TranscriptPanelProps {
  subtitle: LocalSubtitle;
  activeRow: number | null;
  activeProgress: number | undefined;
  translations: Record<number, string>;
  translatingRows: Set<number>;
  showTranslation: boolean;
  mode: LearnMode;
  practiceHide: boolean;
  revealAll: boolean;
  revealedWords: Set<string>;
  savedWordsSet: Set<string>;
  onWordClick: (word: string, raw: string, lineText: string) => void;
  onLineSeek: (row: number) => void;
  onReplayLine: (row: number) => void;
  onToggleSaveLine: (row: number) => void;
  onCopyLine: (row: number) => void;
  onTranslateLine: (row: number) => void;
  transcriptRef: React.RefObject<HTMLDivElement>;
  transcriptOpen: boolean;
  setTranscriptOpen: (open: boolean) => void;
  hasTimestamps: boolean;
}
```

- [ ] **Step 2: Update Watch.tsx to use TranscriptPanel**

Replace the extracted JSX.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 9: UX — Optimistic Word Save

**Files:**
- Modify: `src/hooks/use-saved-words.ts:60-70`

- [ ] **Step 1: Add optimistic update to save function**

Currently, `save()` calls `saveWord()` then refetches the entire word list. Make it optimistic:

```typescript
const save = useCallback(
  async (input: SaveInput) => {
    // Optimistically add to local state immediately
    const optimisticWord: LocalWord = {
      _id: `temp-${Date.now()}`,
      word: input.word,
      display: input.display,
      definition: input.definition ?? "",
      example: input.example ?? "",
      sourceTitle: input.sourceTitle,
      language: input.language,
      screenshotUrl: undefined,
      cardBox: 0,
      cardDueAt: null,
    };
    setWords((prev) => [...prev, optimisticWord]);

    try {
      const res = await saveWord(input);
      if (res.saved) {
        // Replace optimistic entry with real data
        const fresh = await localApi.words.list();
        setWords(fresh);
      } else if (res.skipped) {
        // Remove optimistic entry if skipped
        setWords((prev) => prev.filter((w) => w._id !== optimisticWord._id));
      }
      return res;
    } catch {
      // Remove optimistic entry on failure
      setWords((prev) => prev.filter((w) => w._id !== optimisticWord._id));
      return { skipped: false, saved: false };
    }
  },
  [],
);
```

- [ ] **Step 2: Test optimistic save**

Click a word in the transcript — it should immediately appear highlighted (saved) before the API call completes.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 10: Performance — Memoize Tokenization Results

**Files:**
- Modify: `src/pages/Watch.tsx:938-980`

- [ ] **Step 1: Memoize tokenization per line**

In the captions overlay (line 938), `tokenize(activeLine.text)` is called on every render. Since `activeLine` changes frequently during playback, this is called often.

Add a memoized tokens variable:
```typescript
const activeLineTokens = useMemo(() => {
  if (!activeLine) return [];
  return tokenize(activeLine.text);
}, [activeLine?.text]);
```

Then use `activeLineTokens` instead of `tokenize(activeLine.text)` in the JSX.

- [ ] **Step 2: Verify build**

Run: `npm run build`

---

## Task 11: UX — Add Error Recovery for Translation Failures

**Files:**
- Modify: `src/pages/Watch.tsx:279-301`

- [ ] **Step 1: Add retry capability to translateRow**

Currently, if translation fails, the line stays in `translatingRows` forever. Add error handling:

```typescript
const translateRow = (row: number) => {
  const line = subtitle?.lines[row];
  if (!line) return;
  if (translations[row] !== undefined || translatingRows.has(row)) return;
  // ... existing logic
  translateLine(line.text, target, source)
    .then((r) => {
      if (r.ok && r.text) {
        setTranslations((prev) => ({ ...prev, [row]: r.text }));
      } else {
        // Mark as failed (not just "not translating")
        setTranslations((prev) => ({ ...prev, [row]: `[Translation unavailable]` }));
      }
    })
    .finally(() =>
      setTranslatingRows((prev) => {
        const n = new Set(prev);
        n.delete(row);
        return n;
      }),
    );
};
```

- [ ] **Step 2: Add visual indicator for failed translations**

In TranscriptLine, if translation starts with `[Translation unavailable]`, show a subtle "retry" button instead of the text.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 12: Architecture — Create Centralized Types File

**Files:**
- Create: `src/types/index.ts`
- Modify: `src/lib/local-api.ts:4-8`

- [ ] **Step 1: Create centralized types file**

Move the `LocalUser`, `LocalLine`, `LocalSubtitle`, `LocalWord`, `LocalCard` interfaces from `local-api.ts` to `src/types/index.ts`:

```typescript
// src/types/index.ts
export interface LocalUser {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  isAnonymous?: boolean;
}

export interface LocalLine {
  index: number;
  start?: number;
  end?: number;
  text: string;
}

export interface LocalSubtitle {
  _id: string;
  id?: string;
  title: string;
  sourceType: "srt" | "plain";
  videoId?: string;
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  language?: string;
  lines: LocalLine[];
  updatedAt: number;
  lastPosition?: number;
  collection?: string;
}

export interface LocalWord {
  _id: string;
  id?: string;
  word: string;
  display: string;
  definition: string;
  example: string;
  sourceTitle?: string;
  language?: string;
  translation?: string;
  screenshotUrl?: string;
  cardBox: number;
  cardDueAt: number | null;
}

export interface LocalCard {
  id: string;
  _id?: string;
  front: string;
  back: string;
  box: number;
  dueAt: number;
  screenshotUrl?: string;
  leechCount?: number;
  cardType?: "word" | "sentence";
  savedWordId?: string;
  language?: string;
  easeFactor?: number;
}
```

- [ ] **Step 2: Update local-api.ts to import from types**

```typescript
import type { LocalUser, LocalLine, LocalSubtitle, LocalWord, LocalCard } from "@/types";
export type { LocalUser, LocalLine, LocalSubtitle, LocalWord, LocalCard };
```

Remove the inline interface definitions from local-api.ts.

- [ ] **Step 3: Verify all imports still work**

Run: `npm run build`

---

## Task 13: UX — Add Keyboard Shortcut Indicator in UI

**Files:**
- Modify: `src/pages/Watch.tsx:109-125`

- [ ] **Step 1: Add shortcut hints to transport buttons**

Add `title` attributes with keyboard shortcuts to the transport buttons:

```typescript
// SkipBack button (line 1030)
<Button title="Previous sentence (←)" ...>

// Replay button (line 1046)
<Button title="Replay sentence (R)" ...>

// SkipForward button (line 1068)
<Button title="Next sentence (→)" ...>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

---

## Task 14: Performance — Optimize Vocabulary Panel Rendering

**Files:**
- Modify: `src/pages/Watch.tsx:1679-1720`

- [ ] **Step 1: Memoize the vocabulary list**

Currently, `savedWords.map()` renders every saved word on every render. Since the vocabulary panel is inside the transcript section, it rerenders when the active line changes.

```typescript
const vocabularyList = useMemo(() => {
  return savedWords.map((w) => (
    <li key={w._id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50">
      {/* ... existing JSX */}
    </li>
  ));
}, [savedWords, openWord, remove]);
```

Then use `{vocabularyList}` instead of the inline `.map()`.

- [ ] **Step 2: Verify build**

Run: `npm run build`

---

## Task 15: UX — Improve Mobile Responsiveness

**Files:**
- Modify: `src/pages/Watch.tsx:1546`

- [ ] **Step 1: Make vocabulary sidebar collapse on mobile**

Currently, the transcript + vocabulary grid is `grid-cols-1 lg:grid-cols-[1fr_300px]`. On mobile, the vocabulary panel stacks below the transcript and can be very long.

Add a collapsible toggle for mobile:

```typescript
// Add state for vocabulary panel visibility
const [vocabOpen, setVocabOpen] = useState(false);

// In the grid section:
<section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
  {/* Transcript */}
  <div className="min-w-0">
    {/* ... transcript content */}
  </div>

  {/* Vocabulary panel - collapsible on mobile */}
  <aside className="min-w-0">
    <button
      type="button"
      onClick={() => setVocabOpen((o) => !o)}
      className="flex w-full items-center justify-between rounded-2xl border bg-card p-3 shadow-sm lg:hidden"
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <BookMarked className="size-4" /> Vocabulary
      </span>
      <Badge variant="secondary">{savedWords.length}</Badge>
    </button>
    <div className={`${vocabOpen ? "block" : "hidden"} lg:block`}>
      {/* ... existing vocabulary panel content */}
    </div>
  </aside>
</section>
```

- [ ] **Step 2: Verify mobile layout**

Test on mobile viewport (or Chrome DevTools device mode).

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 16: Code Quality — Remove Unused Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Identify unused dependencies**

Check for `convex`, `@convex-dev/auth`, `axios` in package.json that are not imported anywhere.

- [ ] **Step 2: Remove unused packages**

```bash
bun remove convex @convex-dev/auth axios
```

- [ ] **Step 3: Verify build**

Run: `bun run build`

---

## Task 17: Performance — Consolidate Data Fetching

**Files:**
- Modify: `src/hooks/use-local-data.ts`
- Modify: `src/hooks/use-saved-words.ts`

- [ ] **Step 1: Add stale-while-revalidate to useResource**

The current `useResource` fetches on mount and never refetches unless `refresh()` is called manually. Add a simple stale-while-revalidate pattern:

```typescript
function useResource<T>(load: () => Promise<T>, staleMs = 30_000) {
  const [data, setData] = useState<T | undefined>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastFetchRef = useRef(0);

  const refresh = useCallback(async () => {
    lastFetchRef.current = Date.now();
    setData(await loadRef.current());
  }, []);

  useEffect(() => {
    // Always fetch on mount
    void refresh();
    // Refetch if stale
    const interval = setInterval(() => {
      if (Date.now() - lastFetchRef.current > staleMs) {
        void refresh();
      }
    }, staleMs);
    return () => clearInterval(interval);
  }, []);

  return [data, refresh] as const;
}
```

- [ ] **Step 2: Verify no duplicate fetches on page navigation**

Navigate between Dashboard, Words, Practice. Data should be fresh but not refetched unnecessarily.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 18: Architecture — Create Feature Directory Structure

**Files:**
- Create: `src/features/video/` directory
- Move files as needed

- [ ] **Step 1: Create feature directories**

```
src/features/
  video/
    components/
      VideoControls.tsx     (from Task 7)
      TranscriptPanel.tsx   (from Task 8)
      TranscriptLine.tsx    (move from components/app/)
      WordTooltip.tsx       (move from components/app/)
      WordDialog.tsx        (move from components/app/)
      SpeakerButton.tsx     (move from components/app/)
    hooks/
      use-video-player.ts   (extract from Watch.tsx)
      use-transcript.ts     (extract from Watch.tsx)
```

- [ ] **Step 2: Update imports in Watch.tsx**

Update all imports to use the new paths.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 19: UX — Add Word Save Toast with Undo

**Files:**
- Modify: `src/hooks/use-saved-words.ts`
- Modify: `src/lib/study.ts`

- [ ] **Step 1: Return saved word ID from saveWord**

Modify `saveWord()` in `study.ts` to return the `wordId` from the API response:

```typescript
export async function saveWord(input: SaveWordInput): Promise<{
  skipped: boolean;
  saved: boolean;
  wordId?: string;
}> {
  // ... existing logic
  const result = await localApi.words.save({ ... });
  return { skipped: false, saved: true, wordId: result.wordId };
}
```

- [ ] **Step 2: Add undo to toast in Watch.tsx**

```typescript
// In saveWordFromToken (line 405):
const res = await save({ ... });
if (res.saved) {
  toast.success(`Saved "${raw}"`, {
    action: res.wordId ? {
      label: "Undo",
      onClick: async () => {
        await remove(res.wordId!);
        toast.info(`Removed "${raw}"`);
      },
    } : undefined,
  });
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Task 20: Code Quality — Add TypeScript Strict Mode Enhancements

**Files:**
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Enable additional strict checks**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- [ ] **Step 2: Fix any resulting type errors**

Run `npx tsc --noEmit` and fix any errors that arise.

- [ ] **Step 3: Verify build**

Run: `npm run build`

---

## Summary

### Architecture Changes
- Extracted VideoControls and TranscriptPanel from Watch.tsx (1767 → ~800 lines)
- Centralized TypeScript types in `src/types/index.ts`
- Feature-based directory structure for video/transcript components
- Consolidated data fetching with stale-while-revalidate

### Performance Improvements
- React.memo on TranscriptLine
- Memoized tokenization, saved words filtering, vocabulary list
- Dictionary result caching
- WordTooltip offline lookup memoization
- Debounced translation requests
- Stale-while-revalidate data fetching

### UX Improvements
- Loading skeleton for transcript
- Optimistic word saves
- Undo capability for word saves
- Better error recovery for translations
- Keyboard shortcut hints in UI
- Mobile-collapsible vocabulary panel
- Clearer loading/error states

### Technical Debt Removed
- Removed unused dependencies (convex, axios)
- TypeScript strict mode enhancements
- Proper type exports from centralized location

### Future Roadmap (Next 5)
1. Full virtualization for long transcripts (react-window/virtuoso)
2. Zustand for shared state management
3. IndexedDB for offline dictionary/vocabulary
4. AnkiConnect integration for direct Anki sync
5. Dedicated learning modes as separate routes
