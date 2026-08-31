# Essential Language Learning Features — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four must-have features for effective language learning: audio on flashcards, leech warnings with actions, new cards/day limiting, and sentence-level cards.

**Architecture:** Server-side SRS modifications (sentence cards, leech suspend, new card limiting), client-side practice enhancements (TTS playback, leech UI, sentence card rendering).

**Tech Stack:** React, TypeScript, Node.js (server), PostgreSQL, Web Speech API (TTS)

---

## Feature 1: Audio on Flashcards

### What
Play TTS pronunciation when a flashcard is shown and when flipped.

### How
- When a flashcard appears (front side), auto-play the word pronunciation via `speak()` from `src/lib/tts.ts`
- Use the card's associated word language to pick the right voice
- Add a manual replay `SpeakerButton` on both front and back of the card
- Auto-play is best-effort (browser may block unsolicited audio)

### Files
- Modify: `src/pages/Practice.tsx` — add `useEffect` for auto-play, add SpeakerButton to card

---

## Feature 2: Leech Warnings + Action

### What
Show when a card is a leech (3+ consecutive "Again" ratings), with options to suspend or delete it.

### How
- Server already returns `{ leech: true }` from `POST /api/cards/rate` when `leech_count >= 3`
- Extend the due cards endpoint to also return `leech_count` so the client knows the count
- On the flashcard back, show a yellow "Leech" badge when `leech_count >= 3`
- Add a "Suspend" button that calls a new `PATCH /api/cards/:id/suspend` endpoint
- Suspend sets `due_at` to +1 year (simple, no schema change needed)
- Add a "Delete" button that calls existing `DELETE /api/words/:id`
- In the due cards query, exclude suspended cards by filtering `due_at < (now + 300 days)`

### Files
- Modify: `local-server.mjs` — add suspend endpoint, modify due query to exclude suspended, return leech_count
- Modify: `src/pages/Practice.tsx` — leech badge, suspend/delete buttons
- Modify: `src/lib/local-api.ts` — add `suspendCard()` API method

---

## Feature 3: New Cards/Day Setting

### What
Limit how many NEW cards (box 0, never reviewed) are introduced per day.

### How
- Add `newCardsPerDay` setting (default: 10, range: 0-50) in `src/lib/settings.ts`
- Add UI control in `src/pages/Settings.tsx`
- Modify the due cards endpoint: count how many box-0 cards have `last_reviewed_at` today, then limit remaining new cards
- The query becomes: select due cards where (box > 0) OR (box = 0 AND (last_reviewed_at IS NULL OR last_reviewed_at < today_start))
- Add a "New" badge on cards being introduced for the first time (box 0, no last_reviewed_at)
- Show "X new, Y review" breakdown in Practice session stats

### Files
- Modify: `src/lib/settings.ts` — add `newCardsPerDay` setting
- Modify: `src/pages/Settings.tsx` — add slider/input for newCardsPerDay
- Modify: `local-server.mjs` — modify due cards query to limit new cards
- Modify: `src/pages/Practice.tsx` — show "New" badge, show new/review breakdown

---

## Feature 4: Sentence-Level Cards

### What
When a word is saved with an example sentence, also create a sentence card for cloze-style practice.

### How
- When `POST /api/words` creates a new word AND the word has an `example` sentence, also create a second `anki_cards` row:
  - `front`: the example sentence with the target word replaced by `____`
  - `back`: the full sentence with the word highlighted + definition
  - `box`: 0, `due_at`: now()
  - Link to the same `saved_word_id`
- When a word is deleted, also delete its sentence card
- In Practice, sentence cards are rendered differently: wider layout, shows the sentence context
- The card type is distinguished by a `card_type` column: "word" (default) or "sentence"

### Files
- Modify: `local-server.mjs` — add `card_type` column migration, create sentence card on word save, delete on word delete, modify due query
- Modify: `src/pages/Practice.tsx` — render sentence cards with different layout
- Modify: `src/lib/local-api.ts` — update `LocalCard` interface to include `cardType`

---

## Summary of File Changes

| File | Changes |
|------|---------|
| `local-server.mjs` | Leech_count in due query, suspend endpoint, exclude suspended, sentence card creation/deletion, card_type column, new card limiting |
| `src/pages/Practice.tsx` | TTS auto-play, SpeakerButton, leech badge, suspend/delete buttons, new card badge, sentence card rendering, new/review breakdown |
| `src/lib/local-api.ts` | suspendCard(), LocalCard cardType field |
| `src/lib/settings.ts` | newCardsPerDay setting |
| `src/pages/Settings.tsx` | newCardsPerDay UI control |
