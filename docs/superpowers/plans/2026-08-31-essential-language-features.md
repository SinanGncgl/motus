# Essential Language Learning Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audio on flashcards, leech warnings with actions, new cards/day limiting, and sentence-level cards.

**Architecture:** Server-side SRS modifications (sentence cards, leech suspend, new card limiting), client-side practice enhancements (TTS playback, leech UI, sentence card rendering).

**Tech Stack:** React, TypeScript, Node.js (server), PostgreSQL, Web Speech API (TTS)

---

## File Map

| File | Changes |
|------|---------|
| `local-server.mjs` | card_type column, sentence card creation/deletion, leech_count in due query, suspend endpoint, exclude suspended, new card limiting |
| `src/pages/Practice.tsx` | TTS auto-play, SpeakerButton, leech badge, suspend/delete, new card badge, sentence card rendering, new/review breakdown |
| `src/lib/local-api.ts` | suspendCard(), LocalCard cardType field |
| `src/lib/settings.ts` | newCardsPerDay setting |
| `src/pages/Settings.tsx` | newCardsPerDay UI |

---

### Task 1: Server schema — add card_type column and suspend support

**Files:**
- Modify: `local-server.mjs`

- [ ] **Step 1: Add card_type column migration**

In `local-server.mjs`, find the existing migration lines (around line 101-104) and add:

```javascript
await pool.query("ALTER TABLE anki_cards ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'word'").catch(() => {});
```

- [ ] **Step 2: Add suspend endpoint**

In `local-server.mjs`, find the word PATCH handler (around line 323-342). After the existing PATCH logic, before the DELETE handler, add a new endpoint for card suspension. Find the section that handles `p[0] === "api" && p[1] === "words" && p[2]` and add a new route for cards:

Find the area after the screenshot upload endpoint (around line 360) and before the cards/due endpoint. Add:

```javascript
      // Suspend a card (set due_at to +1 year)
      if (req.method === "POST" && path === "/api/cards/suspend") {
        const a = await body(req);
        const c = await q1("SELECT * FROM anki_cards WHERE id = $1 AND user_id = $2", [a.cardId, uid]);
        if (!c) return fail(res, 404, "Card not found");
        const oneYear = now() + 365 * 86400000;
        await q("UPDATE anki_cards SET due_at=$1 WHERE id=$2", [oneYear, c.id]);
        return send(res, 200, { ok: true });
      }
```

- [ ] **Step 3: Modify due cards query to exclude suspended and include leech_count**

In the GET /api/cards/due handler (around line 363-390), update the SQL query to:
1. Add `c.leech_count` to the SELECT
2. Filter out suspended cards: `AND c.due_at < $3` where $3 is `now() + 300 * 86400000` (cards due more than ~10 months out are suspended)

Replace the query with:

```javascript
    if (req.method === "GET" && path === "/api/cards/due") {
      const suspendCutoff = now() + 300 * 86400000;
      const due = await q(
        `SELECT c.id, c.front, c.back, c.box, c.due_at, c.leech_count, c.card_type, c.saved_word_id, w.translation, w.definition, w.example, w.language
         FROM anki_cards c
         LEFT JOIN saved_words w ON c.saved_word_id = w.id
         WHERE c.user_id = $1 AND c.due_at <= $2 AND c.due_at < $3
         ORDER BY c.due_at ASC LIMIT 100`,
        [uid, now(), suspendCutoff],
      );
```

Also update the return mapping to include `leech_count` and `cardType`:

```javascript
      return send(res, 200, due.rows.map((c) => {
        let back = c.back || "";
        if (c.translation && !back.includes("Translation:")) {
          const parts = [back, `Translation: ${c.translation}`].filter(Boolean);
          back = parts.join("\n\n");
        } else if (!c.translation && c.definition && !back.includes(c.definition)) {
          const parts = [];
          if (c.definition) parts.push(c.definition);
          if (c.example) parts.push(`Context: ${c.example}`);
          back = parts.join("\n\n") || c.front;
        }
        const hasScreenshot = c.saved_word_id && existsSync(join(SCREENSHOTS_DIR, `${c.saved_word_id}.jpg`));
        return {
          id: c.id,
          _id: c.id,
          front: c.front,
          back,
          box: c.box,
          dueAt: c.due_at,
          leechCount: c.leech_count || 0,
          cardType: c.card_type || "word",
          screenshotUrl: hasScreenshot ? `/api/screenshots/${c.saved_word_id}.jpg` : undefined,
          language: c.language || undefined,
        };
      }));
    }
```

- [ ] **Step 4: Update due-count endpoint to exclude suspended**

In GET /api/cards/due-count (around line 391-395), add the same suspend filter:

```javascript
    if (req.method === "GET" && path === "/api/cards/due-count") {
      const suspendCutoff = now() + 300 * 86400000;
      const n = await q1("SELECT COUNT(*)::int AS n FROM anki_cards WHERE user_id = $1 AND due_at <= $2 AND due_at < $3", [uid, now(), suspendCutoff]);
      return send(res, 200, n?.n ?? 0);
    }
```

- [ ] **Step 5: Verify server starts**

Run: `node -c local-server.mjs` (syntax check)
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add local-server.mjs
git commit -m "feat: add card_type column, suspend endpoint, exclude suspended from due query, return leech_count"
```

---

### Task 2: Sentence card creation on word save

**Files:**
- Modify: `local-server.mjs` (POST /api/words handler)

- [ ] **Step 1: Create sentence card when word has example**

In `local-server.mjs`, find the POST /api/words handler where a new word is created (around lines 312-318). After the word card INSERT, add a sentence card INSERT:

Current code (around line 315-317):
```javascript
      const cid = id("card");
      await q("INSERT INTO anki_cards (id,user_id,saved_word_id,front,back,box,due_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [cid, uid, wid, a.display || word, formatCardBack(a, a.display || word), 0, now(), now()]);
```

Replace with:
```javascript
      const cid = id("card");
      await q("INSERT INTO anki_cards (id,user_id,saved_word_id,front,back,box,due_at,card_type,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [cid, uid, wid, a.display || word, formatCardBack(a, a.display || word), 0, now(), "word", now()]);
      // Create sentence card if example exists
      if (a.example && a.example.trim()) {
        const normalizedWord = (a.display || word).trim();
        const re = new RegExp(`\\b${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        const sentenceFront = a.example.replace(re, "____");
        const sentenceBack = `${a.example}\n\n${formatCardBack(a, normalizedWord)}`;
        const scid = id("card");
        await q("INSERT INTO anki_cards (id,user_id,saved_word_id,front,back,box,due_at,card_type,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [scid, uid, wid, sentenceFront, sentenceBack, 0, now(), "sentence", now()]);
      }
```

- [ ] **Step 2: Create sentence card on word update (existing word via POST)**

In the same handler, where existing words are updated (around lines 305-310), check if a sentence card already exists. If not, create one. After the existing word UPDATE:

Find the line `return send(res, 200, { wordId: existing.id, created: false });` and add before it:

```javascript
        // Create sentence card if example exists and no sentence card exists
        if (a.example && a.example.trim()) {
          const existingSentenceCard = await q1("SELECT id FROM anki_cards WHERE saved_word_id = $1 AND card_type = 'sentence'", [existing.id]);
          if (!existingSentenceCard) {
            const normalizedWord = (a.display || existing.display || word).trim();
            const re = new RegExp(`\\b${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
            const sentenceFront = a.example.replace(re, "____");
            const sentenceBack = `${a.example}\n\n${formatCardBack(a, normalizedWord)}`;
            const scid = id("card");
            await q("INSERT INTO anki_cards (id,user_id,saved_word_id,front,back,box,due_at,card_type,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
              [scid, uid, existing.id, sentenceFront, sentenceBack, 0, now(), "sentence", now()]);
          }
        }
```

- [ ] **Step 3: Delete sentence cards when word is deleted**

In the DELETE handler (around line 344-348), the existing code deletes `anki_cards WHERE saved_word_id = $1`. This already deletes ALL cards for the word (both word and sentence cards), so no change needed. Verify this is correct.

- [ ] **Step 4: Verify server starts**

Run: `node -c local-server.mjs`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add local-server.mjs
git commit -m "feat: create sentence cards automatically when saving words with examples"
```

---

### Task 3: New cards/day limiting

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/pages/Settings.tsx`
- Modify: `local-server.mjs` (due cards query)

- [ ] **Step 1: Add newCardsPerDay setting**

In `src/lib/settings.ts`, find the `AppSettings` interface and add:

```typescript
  newCardsPerDay: number; // default 10
```

Find the default settings object and add:

```typescript
  newCardsPerDay: 10,
```

- [ ] **Step 2: Add Settings UI for newCardsPerDay**

In `src/pages/Settings.tsx`, find the settings form (look for the dailyGoal setting). Add a similar control after it:

```tsx
            <div className="flex flex-col gap-2">
              <Label htmlFor="newCards">New cards per day</Label>
              <Input
                id="newCards"
                type="number"
                min={0}
                max={50}
                value={settings.newCardsPerDay}
                onChange={(e) => update({ newCardsPerDay: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                How many new words to introduce each day (0-50).
              </p>
            </div>
```

- [ ] **Step 3: Modify due cards query to limit new cards**

In `local-server.mjs`, the due cards endpoint needs to limit box-0 cards. The approach: count how many box-0 cards the user has already reviewed today (last_reviewed_at is today), then limit remaining new cards.

Update the due cards query (the one modified in Task 1) to use a subquery:

```javascript
    if (req.method === "GET" && path === "/api/cards/due") {
      const suspendCutoff = now() + 300 * 86400000;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartMs = todayStart.getTime();

      // Get the newCardsPerDay setting (stored in client, passed as query param or use default)
      // Since settings are client-side, we pass the limit from the client
      const url = new URL(req.url, `http://${req.headers.host}`);
      const newCardsLimit = parseInt(url.searchParams.get("newCardsLimit") || "10", 10);

      // Count new cards already reviewed today
      const reviewedToday = await q1(
        "SELECT COUNT(*)::int AS n FROM anki_cards WHERE user_id = $1 AND box = 0 AND last_reviewed_at >= $2",
        [uid, todayStartMs]
      );
      const newCardsReviewed = reviewedToday?.n ?? 0;
      const newCardsRemaining = Math.max(0, newCardsLimit - newCardsReviewed);

      const due = await q(
        `SELECT c.id, c.front, c.back, c.box, c.due_at, c.leech_count, c.card_type, c.saved_word_id, c.last_reviewed_at, w.translation, w.definition, w.example, w.language
         FROM anki_cards c
         LEFT JOIN saved_words w ON c.saved_word_id = w.id
         WHERE c.user_id = $1 AND c.due_at <= $2 AND c.due_at < $3
         AND (c.box > 0 OR c.last_reviewed_at IS NULL OR c.last_reviewed_at < $4 OR c.id IN (
           SELECT id FROM anki_cards WHERE user_id = $1 AND box = 0 AND (last_reviewed_at IS NULL OR last_reviewed_at < $4) LIMIT $5
         ))
         ORDER BY c.due_at ASC LIMIT 100`,
        [uid, now(), suspendCutoff, todayStartMs, newCardsRemaining],
      );
```

Actually, this subquery approach is complex. Let me simplify: fetch all due cards, then in the response, limit box-0 cards to `newCardsRemaining`.

Simpler approach — keep the query simple and filter in JavaScript:

```javascript
    if (req.method === "GET" && path === "/api/cards/due") {
      const suspendCutoff = now() + 300 * 86400000;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartMs = todayStart.getTime();

      const url = new URL(req.url, `http://${req.headers.host}`);
      const newCardsLimit = parseInt(url.searchParams.get("newCardsLimit") || "10", 10);

      const due = await q(
        `SELECT c.id, c.front, c.back, c.box, c.due_at, c.leech_count, c.card_type, c.saved_word_id, c.last_reviewed_at, w.translation, w.definition, w.example, w.language
         FROM anki_cards c
         LEFT JOIN saved_words w ON c.saved_word_id = w.id
         WHERE c.user_id = $1 AND c.due_at <= $2 AND c.due_at < $3
         ORDER BY c.due_at ASC LIMIT 200`,
        [uid, now(), suspendCutoff],
      );

      // Limit new cards (box 0, never reviewed)
      let newCardsSeen = 0;
      const filtered = due.rows.filter((c) => {
        if (c.box === 0 && (!c.last_reviewed_at || c.last_reviewed_at >= todayStartMs)) {
          newCardsSeen++;
          return newCardsSeen <= newCardsLimit;
        }
        return true;
      });
```

Then use `filtered` instead of `due.rows` in the map.

- [ ] **Step 4: Update client to pass newCardsLimit**

In `src/lib/local-api.ts`, update the `cards.due()` method to accept and pass the limit:

```typescript
  cards: {
    due: (newCardsLimit?: number) => request<LocalCard[]>(`/api/cards/due${newCardsLimit != null ? `?newCardsLimit=${newCardsLimit}` : ""}`),
    // ... rest stays the same
  },
```

In `src/hooks/use-local-data.ts`, update the `useDueCards` hook to pass the setting:

```typescript
import { settings } from "@/lib/settings";
// ...
export function useDueCards() {
  return useResource<LocalCard[]>(() => localApi.cards.due(settings.get().newCardsPerDay));
}
```

Wait, `useResource` may not accept a function that calls settings. Let me check the hook pattern. Read `src/hooks/use-local-data.ts` first to understand the pattern.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts src/pages/Settings.tsx local-server.mjs src/lib/local-api.ts src/hooks/use-local-data.ts
git commit -m "feat: add new cards per day setting with server-side limiting"
```

---

### Task 4: Client — LocalCard interface update + suspendCard API

**Files:**
- Modify: `src/lib/local-api.ts`

- [ ] **Step 1: Update LocalCard interface**

In `src/lib/local-api.ts`, update the `LocalCard` interface (line 8) to include new fields:

```typescript
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
  language?: string;
}
```

- [ ] **Step 2: Add suspendCard method**

In the `cards` object in `localApi`, add a `suspend` method:

```typescript
  cards: {
    due: (newCardsLimit?: number) => request<LocalCard[]>(`/api/cards/due${newCardsLimit != null ? `?newCardsLimit=${newCardsLimit}` : ""}`),
    dueCount: () => request<number>("/api/cards/due-count"),
    rate: (cardId: string, rating: string) => request<void>("/api/cards/rate", { method: "POST", body: JSON.stringify({ cardId, rating }) }),
    suspend: (cardId: string) => request<void>("/api/cards/suspend", { method: "POST", body: JSON.stringify({ cardId }) }),
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/local-api.ts
git commit -m "feat: update LocalCard interface and add suspendCard API method"
```

---

### Task 5: Practice page — audio, leech, new card badge, sentence rendering

**Files:**
- Modify: `src/pages/Practice.tsx`

- [ ] **Step 1: Add TTS auto-play on card show**

In `src/pages/Practice.tsx`, import `speak` from `@/lib/tts`:

```typescript
import { speak } from "@/lib/tts";
```

Add a `useEffect` to auto-play when the card changes:

```typescript
  // Auto-play pronunciation when a new card appears
  useEffect(() => {
    if (current && mode === "flashcard" && !flipped) {
      speak(current.front, current.language || "de");
    }
  }, [current?.id, mode, flipped]);
```

Add this after the other useEffects (around line 107).

- [ ] **Step 2: Add SpeakerButton to flashcard front and back**

Import SpeakerButton:

```typescript
import { SpeakerButton } from "@/components/app/SpeakerButton";
```

On the flashcard front (around line 276-291), add a SpeakerButton after the "Do you know this word?" badge:

```tsx
              <Badge variant="outline" className="text-xs font-normal">
                Do you know this word?
              </Badge>
              <SpeakerButton
                text={current.front}
                lang={current.language || "de"}
                label="Pronounce"
              />
```

On the flashcard back (around line 301-307), add a SpeakerButton next to the word:

```tsx
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold tracking-tight">
                    {current.front}
                  </p>
                  <SpeakerButton
                    text={current.front}
                    lang={current.language || "de"}
                    label="Pronounce"
                  />
                </div>
                <Badge variant="secondary">
                  Box {current.box + 1}
                </Badge>
              </div>
```

- [ ] **Step 3: Add leech badge and action buttons**

On the flashcard back, after the Box badge, add leech warning and actions:

```tsx
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold tracking-tight">
                    {current.front}
                  </p>
                  <SpeakerButton
                    text={current.front}
                    lang={current.language || "de"}
                    label="Pronounce"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {(current.leechCount ?? 0) >= 3 && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      Leech
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    Box {current.box + 1}
                  </Badge>
                </div>
              </div>
```

Add action buttons below the card content (after the back text):

```tsx
                {(current.leechCount ?? 0) >= 3 && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await localApi.cards.suspend(current.id ?? current._id ?? "");
                        await refreshDue();
                        toast.success("Card suspended");
                      }}
                    >
                      Suspend
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={async () => {
                        // Find the word ID and delete it
                        // The card has saved_word_id from the server
                        // We need to expose this or use a different approach
                        // For now, just suspend
                        await localApi.cards.suspend(current.id ?? current._id ?? "");
                        await refreshDue();
                        toast.success("Card suspended");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
```

Note: For the "Remove" button, we need the `saved_word_id` to delete the word. The server returns this in the due query. Update the `LocalCard` interface to include `savedWordId?: string` and add it to the server response.

- [ ] **Step 4: Add "New" card badge**

On the flashcard front, add a "New" badge for cards that haven't been reviewed:

```tsx
              {(!current.dueAt || current.box === 0) && (
                <Badge variant="outline" className="text-xs font-normal border-emerald-500 text-emerald-600">
                  New
                </Badge>
              )}
```

Wait, `dueAt` is always set. The distinction is: box 0 AND `lastReviewedAt` is null means "never reviewed". But `lastReviewedAt` isn't in the LocalCard interface yet. Let me add it.

Actually, for simplicity: box 0 = "New", box 1-2 = "Learning", box 3+ = "Mastered". The existing box badge already shows this. Let me just add a "New" badge for box 0 cards on the front.

- [ ] **Step 5: Add sentence card rendering**

For sentence cards (cardType === "sentence"), render differently. The front shows the sentence with `____`, the back shows the full sentence + definition.

Update the flashcard rendering section (around line 257) to check `current.cardType`:

```tsx
      {mode === "flashcard" ? (
      <div className="mx-auto w-full max-w-xl">
        <div
          className="relative cursor-pointer select-none"
          style={{ perspective: "1200px" }}
          onClick={() => setFlipped((f) => !f)}
        >
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="relative min-h-[340px] w-full"
          >
            {/* Front */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-10 shadow-lg"
              style={{ backfaceVisibility: "hidden" }}
            >
              {current.cardType === "sentence" ? (
                <>
                  <Badge variant="outline" className="text-xs font-normal">
                    Fill in the blank
                  </Badge>
                  <p className="text-center text-2xl leading-8 text-foreground/90">
                    {current.front}
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs font-normal">
                    Do you know this word?
                  </Badge>
                  <SpeakerButton text={current.front} lang={current.language || "de"} label="Pronounce" />
                  {current.screenshotUrl && (
                    <img src={current.screenshotUrl} alt="" className="w-full max-h-32 rounded-lg object-cover" />
                  )}
                  <p className="text-center text-4xl font-semibold tracking-tight">
                    {current.front}
                  </p>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Click to reveal the answer
              </p>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 flex flex-col justify-center gap-5 rounded-2xl border bg-card p-10 shadow-lg"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold tracking-tight">
                    {current.cardType === "sentence" ? current.front.replace("____", "«»") : current.front}
                  </p>
                  {current.cardType === "word" && (
                    <SpeakerButton text={current.front} lang={current.language || "de"} label="Pronounce" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(current.leechCount ?? 0) >= 3 && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">Leech</Badge>
                  )}
                  <Badge variant="secondary">Box {current.box + 1}</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-4 overflow-y-auto">
                {current.screenshotUrl && current.cardType === "word" && (
                  <img src={current.screenshotUrl} alt="" className="w-full max-h-48 rounded-lg object-cover" />
                )}
                {current.back && (
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
                    {current.back}
                  </p>
                )}
              </div>
              {(current.leechCount ?? 0) >= 3 && (
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={async (e) => {
                    e.stopPropagation();
                    await localApi.cards.suspend(current.id ?? current._id ?? "");
                    await refreshDue();
                    toast.success("Card suspended");
                  }}>Suspend</Button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
```

- [ ] **Step 6: Add new/review breakdown to session stats**

In the session stats display (around line 244-255), count new vs review cards:

```typescript
  const newCount = useMemo(() => {
    return (due ?? []).filter((c) => c.box === 0 && !reviewed.has(c.id ?? c._id ?? "")).length;
  }, [due, reviewed]);
  const reviewCount = totalCount - newCount;
```

Update the stats display:

```tsx
      {(correctCount > 0 || incorrectCount > 0) && (
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            {correctCount} recalled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            {incorrectCount} to revisit
          </span>
          {newCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky-500" />
              {newCount} new
            </span>
          )}
        </div>
      )}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/pages/Practice.tsx
git commit -m "feat: add TTS audio, leech badge, sentence card rendering, and new card stats to Practice"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 2: Manual test — Audio on flashcards**

1. Save a word with an example sentence
2. Go to Practice → flashcard mode
3. Verify the word is pronounced when the card appears
4. Click the SpeakerButton → verify it replays

- [ ] **Step 3: Manual test — Sentence cards**

1. Save a word with an example sentence
2. Go to Practice → verify both word card and sentence card appear
3. Sentence card front shows "____" in the sentence
4. Sentence card back shows full sentence + definition

- [ ] **Step 4: Manual test — Leech detection**

1. Rate a card "Again" 3 times → verify "Leech" badge appears
2. Click "Suspend" → verify card disappears from queue

- [ ] **Step 5: Manual test — New cards/day**

1. Set "New cards per day" to 2 in Settings
2. Save 5 new words
3. Go to Practice → verify only 2 new cards appear
4. Verify review cards (box > 0) still appear normally

- [ ] **Step 6: Final commit (if needed)**

```bash
git add -A
git commit -m "feat: essential language learning features — audio, leeches, new cards/day, sentence cards"
```

---

## Summary

| Task | What it builds | Files |
|------|---------------|-------|
| 1 | Server schema + suspend + leech in due query | `local-server.mjs` |
| 2 | Sentence card creation on word save | `local-server.mjs` |
| 3 | New cards/day setting + server limiting | `settings.ts`, `Settings.tsx`, `local-server.mjs`, `local-api.ts`, `use-local-data.ts` |
| 4 | LocalCard interface + suspendCard API | `local-api.ts` |
| 5 | Practice page: audio, leech, sentence, stats | `Practice.tsx` |
| 6 | Verification | — |
