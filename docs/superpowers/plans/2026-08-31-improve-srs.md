# Improve Spaced Repetition System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 'Hard' rating, integrate SRS with all practice modes, add leech detection, and track session history.

**Architecture:** Server-side SRS algorithm updates (4 ratings, leech tracking), client-side practice mode SRS integration, session history persistence.

**Tech Stack:** React, TypeScript, Node.js (server), PostgreSQL (existing schema)

---

## File Map

| File | Change |
|------|--------|
| `local-server.mjs` | Update rating algorithm (4 ratings), add leech detection, add session history endpoint |
| `src/pages/Practice.tsx` | Add "Hard" button, update keyboard shortcuts, pass wordId to cloze/dictation |
| `src/components/app/PracticeModes.tsx` | Accept wordId + onRate callback, update SRS on answer |
| `src/lib/study.ts` | Update types for PracticeModes |
| `src/lib/local-api.ts` | Add session history API |
| `src/lib/streak.ts` | Add session history storage |
| `src/pages/Dashboard.tsx` | Show session history trend |

---

### Task 1: Add "Hard" rating to server SRS algorithm

**Files:**
- Modify: `local-server.mjs:396-405` (POST /api/cards/rate)

The current algorithm has 3 ratings: again (reset to box 0), good (+1 box), easy (+2 box). Add "hard" which stays at the current box with a shorter interval.

- [ ] **Step 1: Update the rating algorithm**

In `local-server.mjs`, find the rating handler (lines 396-405). Replace:

```javascript
    if (req.method === "POST" && path === "/api/cards/rate") {
      const a = await body(req);
      const c = await q1("SELECT * FROM anki_cards WHERE id = $1 AND user_id = $2", [a.cardId, uid]);
      if (!c) return fail(res, 404, "Card not found");
      const box = a.rating === "again" ? 0 : Math.min(c.box + (a.rating === "easy" ? 2 : 1), 5);
      const intervals = [60000, 600000, 86400000, 259200000, 604800000, 1814400000];
      const dueAt = now() + (a.rating === "again" ? 60000 : intervals[box]);
      await q("UPDATE anki_cards SET box=$1, due_at=$2, last_reviewed_at=$3 WHERE id=$4", [box, dueAt, now(), c.id]);
      return send(res, 200, { ok: true });
    }
```

With:

```javascript
    if (req.method === "POST" && path === "/api/cards/rate") {
      const a = await body(req);
      const c = await q1("SELECT * FROM anki_cards WHERE id = $1 AND user_id = $2", [a.cardId, uid]);
      if (!c) return fail(res, 404, "Card not found");
      const intervals = [60000, 600000, 86400000, 259200000, 604800000, 1814400000];
      let newBox;
      let intervalMs;
      switch (a.rating) {
        case "again":
          newBox = 0;
          intervalMs = 60000; // 1 minute
          break;
        case "hard":
          newBox = c.box; // stay at current box
          intervalMs = Math.floor(intervals[c.box] * 0.5); // half the normal interval
          break;
        case "good":
          newBox = Math.min(c.box + 1, 5);
          intervalMs = intervals[newBox];
          break;
        case "easy":
          newBox = Math.min(c.box + 2, 5);
          intervalMs = intervals[newBox];
          break;
        default:
          return fail(res, 400, "Invalid rating");
      }
      const dueAt = now() + intervalMs;
      // Leech detection: if "again" 3+ times in a row, increment leech_count
      const leechCount = a.rating === "again" ? (c.leech_count || 0) + 1 : 0;
      await q(
        "UPDATE anki_cards SET box=$1, due_at=$2, last_reviewed_at=$3, leech_count=$4 WHERE id=$5",
        [newBox, dueAt, now(), leechCount, c.id]
      );
      return send(res, 200, { ok: true, leech: leechCount >= 3 });
    }
```

- [ ] **Step 2: Add leech_count column to schema**

In `local-server.mjs`, find the SCHEMA definition (around line 72-86). Add a migration after the existing migrations:

```javascript
await pool.query("ALTER TABLE anki_cards ADD COLUMN IF NOT EXISTS leech_count INTEGER DEFAULT 0").catch(() => {});
```

- [ ] **Step 3: Update cards query to include leech_count**

In the `cards()` function (around line 162-164) and the due cards endpoint (lines 363-389), ensure `leech_count` is selected so the client can display it.

- [ ] **Step 4: Verify server starts**

Run: `node local-server.mjs &` (or check logs)
Expected: Server starts without errors

- [ ] **Step 5: Commit**

```bash
git add local-server.mjs
git commit -m "feat: add 'Hard' rating and leech detection to SRS algorithm"
```

---

### Task 2: Add "Hard" button to Practice page

**Files:**
- Modify: `src/pages/Practice.tsx:57,90-107,328-376`

Update the Practice page to support 4 ratings with keyboard shortcuts 1-4.

- [ ] **Step 1: Update handleRate type signature**

In `src/pages/Practice.tsx`, update the `handleRate` function signature (line 57) to:

```typescript
const handleRate = async (rating: "again" | "hard" | "good" | "easy") => {
```

Update the scoring logic (lines 64-65):

```typescript
    if (rating === "again") setIncorrectCount((n) => n + 1);
    else if (rating === "hard") setCorrectCount((n) => n + 1); // still recalled, just difficult
    else setCorrectCount((n) => n + 1);
```

Wait, actually "hard" should still count as recalled (the user did remember, just with difficulty). Keep it as correct.

- [ ] **Step 2: Update keyboard shortcuts**

In the keyboard handler (lines 90-107), update to support 4 keys:

```typescript
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1") {
        void handleRate("again");
      } else if (e.key === "2") {
        void handleRate("hard");
      } else if (e.key === "3") {
        void handleRate("good");
      } else if (e.key === "4") {
        void handleRate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
```

- [ ] **Step 3: Update rating buttons**

Replace the 3-column grid (lines 328-373) with a 4-column grid:

```typescript
        {/* Rating controls */}
        <div className="mt-6 grid grid-cols-4 gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isRating}
            onClick={() => void handleRate("again")}
            className="cursor-pointer flex-col gap-1 py-3 text-destructive hover:text-destructive sm:flex-row"
          >
            <RotateCcw className="size-4" />
            <span>
              Again
              <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px] text-muted-foreground">
                1
              </kbd>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isRating}
            onClick={() => void handleRate("hard")}
            className="cursor-pointer flex-col gap-1 py-3 sm:flex-row"
          >
            <span>
              Hard
              <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px] text-muted-foreground">
                2
              </kbd>
            </span>
          </Button>
          <Button
            type="button"
            disabled={isRating}
            onClick={() => void handleRate("good")}
            className="cursor-pointer flex-col gap-1 py-3 sm:flex-row"
          >
            <Check className="size-4" />
            <span>
              Good
              <kbd className="ml-1.5 rounded bg-primary-foreground/20 px-1 font-mono text-[10px]">
                3
              </kbd>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isRating}
            onClick={() => void handleRate("easy")}
            className="cursor-pointer flex-col gap-1 py-3 sm:flex-row"
          >
            <TrendingUp className="size-4" />
            <span>
              Easy
              <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px] text-muted-foreground">
                4
              </kbd>
            </span>
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Space flips the card · 1 / 2 / 3 / 4 rates it
        </p>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/Practice.tsx
git commit -m "feat: add 'Hard' rating button with keyboard shortcut to Practice page"
```

---

### Task 3: Integrate Cloze and Dictation with SRS

**Files:**
- Modify: `src/components/app/PracticeModes.tsx` (ClozePractice + DictationPractice)
- Modify: `src/lib/study.ts` (ClozeItem + DictationItem types)
- Modify: `src/pages/Practice.tsx` (pass onRate callback)

Currently Cloze and Dictation modes use all words regardless of SRS state and don't update card box/due dates. Add SRS integration so wrong answers demote cards and correct answers promote them.

- [ ] **Step 1: Update ClozeItem and DictationItem types**

In `src/lib/study.ts`, update the types (lines 61-69) to include the word's card ID:

```typescript
export interface ClozeItem {
  wordId: string;
  cardId: string; // anki_cards.id for SRS updates
  display: string;
  sentence: string;
}

export interface DictationItem {
  wordId: string;
  cardId: string; // anki_cards.id for SRS updates
  display: string;
  sentence: string;
}
```

- [ ] **Step 2: Update buildClozeItems and buildDictationItems to include cardId**

In `src/lib/study.ts`, update `buildClozeItems` (lines 74-86) to accept cards and include `cardId`:

```typescript
export function buildClozeItems(words: LocalWord[], cards?: Array<{ id: string; _id?: string; front: string }>): ClozeItem[] {
  const cardByWord = new Map<string, string>();
  if (cards) {
    for (const c of cards) {
      const front = c.front.toLowerCase();
      if (!cardByWord.has(front)) cardByWord.set(front, c.id || c._id || "");
    }
  }
  const items: ClozeItem[] = [];
  for (const w of words) {
    const ex = (w.example || "").trim();
    if (!ex) continue;
    const normalized = w.display.trim().toLowerCase();
    const re = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i");
    if (!re.test(ex)) continue;
    const sentence = ex.replace(re, " ____ ");
    const cardId = cardByWord.get(normalized) || w._id;
    items.push({ wordId: w._id, cardId, display: w.display, sentence });
  }
  return shuffle(items);
}
```

Do the same for `buildDictationItems`:

```typescript
export function buildDictationItems(words: LocalWord[], cards?: Array<{ id: string; _id?: string; front: string }>): DictationItem[] {
  const cardByWord = new Map<string, string>();
  if (cards) {
    for (const c of cards) {
      const front = c.front.toLowerCase();
      if (!cardByWord.has(front)) cardByWord.set(front, c.id || c._id || "");
    }
  }
  const items = words
    .filter((w) => (w.example || "").trim().length > 0)
    .map((w) => ({
      wordId: w._id,
      cardId: cardByWord.get(w.display.trim().toLowerCase()) || w._id,
      display: w.display,
      sentence: w.example!.trim(),
    }));
  return shuffle(items);
}
```

- [ ] **Step 3: Update PracticeModes to accept onRate callback**

In `src/components/app/PracticeModes.tsx`, update both components to accept an `onRate` prop:

For `ClozePractice`:
```typescript
export function ClozePractice({ words, cards, onResult, onRate }: {
  words: LocalWord[];
  cards?: Array<{ id: string; _id?: string; front: string }>;
  onResult?: (correct: boolean) => void;
  onRate?: (cardId: string, rating: "again" | "hard" | "good" | "easy") => void;
}) {
  const items = useMemo(() => buildClozeItems(words, cards), [words, cards]);
```

When an answer is checked:
- Correct: call `onRate(item.cardId, "good")`
- Incorrect: call `onRate(item.cardId, "again")`

For `DictationPractice`:
```typescript
export function DictationPractice({ words, cards, onResult, onRate }: {
  words: LocalWord[];
  cards?: Array<{ id: string; _id?: string; front: string }>;
  onResult?: (correct: boolean) => void;
  onRate?: (cardId: string, rating: "again" | "hard" | "good" | "easy") => void;
}) {
  const items = useMemo(() => buildDictationItems(words, cards), [words, cards]);
```

- [ ] **Step 4: Update Practice.tsx to pass onRate and cards**

In `src/pages/Practice.tsx`, update the ClozePractice and DictationPractice usages (lines 380-396) to pass `cards` and `onRate`:

```typescript
          {mode === "cloze" ? (
            <ClozePractice
              words={(allWords ?? []) as LocalWord[]}
              cards={due ?? []}
              onResult={(ok) => {
                if (ok) setCorrectCount((c) => c + 1);
                else setIncorrectCount((c) => c + 1);
              }}
              onRate={async (cardId, rating) => {
                try {
                  await localApi.cards.rate(cardId, rating);
                  await refreshDue();
                  streak.record(1);
                } catch {
                  // SRS update is best-effort for cloze/dictation
                }
              }}
            />
          ) : (
            <DictationPractice
              words={(allWords ?? []) as LocalWord[]}
              cards={due ?? []}
              onResult={(ok) => {
                if (ok) setCorrectCount((c) => c + 1);
                else setIncorrectCount((c) => c + 1);
              }}
              onRate={async (cardId, rating) => {
                try {
                  await localApi.cards.rate(cardId, rating);
                  await refreshDue();
                  streak.record(1);
                } catch {
                  // SRS update is best-effort for cloze/dictation
                }
              }}
            />
          )}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/app/PracticeModes.tsx src/lib/study.ts src/pages/Practice.tsx
git commit -m "feat: integrate cloze and dictation modes with SRS"
```

---

### Task 4: Session history tracking

**Files:**
- Modify: `src/lib/streak.ts` (add session history)
- Modify: `src/pages/Dashboard.tsx` (show history)

Currently only the last session's accuracy is stored. Add persistent history of all sessions.

- [ ] **Step 1: Add session history storage to streak.ts**

In `src/lib/streak.ts`, add a `SessionHistory` interface and functions. Find the `session` export object and extend it:

```typescript
const HISTORY_KEY = "motus.session-history.v1";

export interface SessionRecord {
  reviewed: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  at: number;
}

function getSessionHistory(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function addSessionToHistory(record: SessionRecord) {
  const history = getSessionHistory();
  history.push(record);
  // Keep last 50 sessions
  if (history.length > 50) history.splice(0, history.length - 50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function lastDaysHistory(days: number): SessionRecord[] {
  const cutoff = Date.now() - days * 86400000;
  return getSessionHistory().filter((s) => s.at >= cutoff);
}
```

Export these alongside the existing `session` and `streak` objects.

- [ ] **Step 2: Update session.record to also save to history**

In the `session.record` function, add the call to `addSessionToHistory`.

- [ ] **Step 3: Add session history to Dashboard**

In `src/pages/Dashboard.tsx`, import the new history functions and add a "Session History" section showing a simple list of recent sessions with their accuracy.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak.ts src/pages/Dashboard.tsx
git commit -m "feat: track and display session history"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 2: Manual test — Hard rating**

1. Go to Practice page with due cards
2. Flip a card → rate "Hard" → verify card stays at current box but due date is shorter
3. Press keyboard 2 → verify it triggers "Hard"

- [ ] **Step 3: Manual test — Cloze/Dictation SRS**

1. Switch to Cloze mode → answer correctly → verify card is promoted
2. Answer incorrectly → verify card is demoted
3. Switch to Dictation mode → same test

- [ ] **Step 4: Manual test — Leech detection**

1. Rate a card "Again" 3 times in a row → verify it's flagged
2. Check that the card appears differently (if UI support added)

- [ ] **Step 5: Manual test — Session history**

1. Complete a practice session
2. Go to Dashboard → verify session history shows recent sessions

- [ ] **Step 6: Final commit (if needed)**

```bash
git add -A
git commit -m "feat: improved SRS with hard rating, SRS integration, leech detection, session history"
```

---

## Summary

| Task | What it builds | Files touched |
|------|---------------|---------------|
| 1 | Hard rating + leech detection (server) | `local-server.mjs` |
| 2 | Hard button in Practice UI | `src/pages/Practice.tsx` |
| 3 | SRS integration for Cloze/Dictation | `PracticeModes.tsx`, `study.ts`, `Practice.tsx` |
| 4 | Session history tracking | `streak.ts`, `Dashboard.tsx` |
| 5 | Verification | — |
