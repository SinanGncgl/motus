# Fix Screenshots, Word Highlighting, and Improve Anki Cards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix screenshots not appearing after save, fix words not highlighting in Watch panel, and make Anki cards richer with audio pronunciation.

**Architecture:** Fix the race condition in screenshot upload timing, ensure Watch vocabulary panel refreshes properly, enrich card back content, and add TTS audio URLs to Anki export.

**Tech Stack:** React, TypeScript, Node.js (server), Web Speech API (TTS)

---

## File Map

| File | Change |
|------|--------|
| `src/lib/study.ts` | Await screenshot upload before dispatching event |
| `src/pages/Watch.tsx` | Add `motus:word-saved` listener to refresh vocabulary panel |
| `src/pages/Words.tsx` | Add `screenshotUrl` to `SavedWord` interface, enrich export |
| `src/lib/subtitles.ts` | Update `buildAnkiTsv` to include richer card content + audio |
| `src/pages/Words.tsx` | Update `handleExport` to build richer card backs |
| `local-server.mjs` | Enrich `formatCardBack` with source title |

---

### Task 1: Fix screenshot race condition in saveWord

**Files:**
- Modify: `src/lib/study.ts:46-53`

The `motus:word-saved` event fires before the screenshot upload completes. The word list re-fetches but `existsSync()` returns false because the file isn't on disk yet.

- [ ] **Step 1: Await screenshot upload before dispatching event**

In `src/lib/study.ts`, replace lines 46-53:

```typescript
    // Upload screenshot if provided (await to ensure file exists on disk)
    if (input.screenshot && result.wordId) {
      await localApi.words.uploadScreenshot(result.wordId, input.screenshot).catch(() => {
        // Screenshot upload is best-effort; don't block word save
      });
    }
    // Notify all components that a word was saved (cross-page refresh)
    window.dispatchEvent(new CustomEvent("motus:word-saved"));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/study.ts
git commit -m "fix: await screenshot upload before dispatching word-saved event"
```

---

### Task 2: Add motus:word-saved listener to Watch.tsx

**Files:**
- Modify: `src/pages/Watch.tsx`

Watch.tsx relies on `useSavedWords().save()` to re-fetch, but the vocabulary panel may not update if the re-fetch completes before state propagates. Adding an explicit event listener ensures a fresh fetch.

- [ ] **Step 1: Add useEffect to listen for motus:word-saved**

In `src/pages/Watch.tsx`, find the existing `useSavedWords()` usage (line 151) and the `refresh` function it provides. Add a `useEffect` nearby (after the other effects, around line 380) to listen for the event:

```typescript
  // Refresh saved words when a word is saved from any source
  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener("motus:word-saved", handler);
    return () => window.removeEventListener("motus:word-saved", handler);
  }, [refresh]);
```

Note: Check if `useSavedWords()` returns a `refresh` function. If not, check `use-saved-words.ts` line 81 — it does return `refresh: async () => { const fresh = await localApi.words.list(); setWords(fresh); }`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Watch.tsx
git commit -m "fix: listen for motus:word-saved event to refresh Watch vocabulary panel"
```

---

### Task 3: Add screenshotUrl to SavedWord interface in Words.tsx

**Files:**
- Modify: `src/pages/Words.tsx:49-59`

The `SavedWord` interface is missing `screenshotUrl`, which means TypeScript doesn't know about it even though the server returns it.

- [ ] **Step 1: Add screenshotUrl to SavedWord interface**

In `src/pages/Words.tsx`, update the `SavedWord` interface (lines 49-59) to:

```typescript
interface SavedWord {
  _id: string;
  word: string;
  display: string;
  definition: string;
  example: string;
  sourceTitle?: string;
  language?: string;
  screenshotUrl?: string;
  cardBox: number;
  cardDueAt: number | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Words.tsx
git commit -m "fix: add screenshotUrl to SavedWord interface in Words.tsx"
```

---

### Task 4: Enrich Anki card back with source title

**Files:**
- Modify: `local-server.mjs:91-97` (formatCardBack function)

The card back currently has definition, context, and translation. Adding the source video title gives context about where the word was encountered.

- [ ] **Step 1: Update formatCardBack to include source title**

In `local-server.mjs`, update the `formatCardBack` function (lines 91-97) to:

```javascript
function formatCardBack(a, fallbackWord) {
  const parts = [];
  if (a.definition) parts.push(a.definition);
  if (a.example) parts.push(`Context: ${a.example}`);
  if (a.translation) parts.push(`Translation: ${a.translation}`);
  if (a.sourceTitle) parts.push(`Source: ${a.sourceTitle}`);
  return parts.join("\n\n") || fallbackWord;
}
```

Note: The `sourceTitle` field needs to be available in the object passed to `formatCardBack`. Check the POST /api/words handler (line 301-318) — the `a` object comes from `body(req)` which includes `sourceTitle` from the client. For the PATCH handler (line 323-342), the `upd` object also includes `sourceTitle`. This should work as-is.

- [ ] **Step 2: Verify server starts**

Run: `node local-server.mjs &` (or check logs)
Expected: Server starts without errors

- [ ] **Step 3: Commit**

```bash
git add local-server.mjs
git commit -m "feat: include source video title in Anki card back"
```

---

### Task 5: Enrich Anki TSV export with audio and better formatting

**Files:**
- Modify: `src/lib/subtitles.ts:130-136` (buildAnkiTsv)
- Modify: `src/pages/Words.tsx:106-116` (handleExport)

The current export produces plain text front/back. We'll add HTML formatting and a Google Translate TTS audio URL.

- [ ] **Step 1: Update buildAnkiTsv to support HTML content**

In `src/lib/subtitles.ts`, the `buildAnkiTsv` function (lines 130-136) stays the same — it just joins columns with tabs. The change is in what we pass to it.

- [ ] **Step 2: Update handleExport to build richer cards**

In `src/pages/Words.tsx`, replace `handleExport` (lines 106-116) with:

```typescript
  const handleExport = () => {
    if (!words || words.length === 0) return;
    const rows = words.map((w) => {
      // Build rich front with word and optional screenshot
      const frontParts = [w.display];
      if (w.screenshotUrl) {
        frontParts.push(`<img src="${w.screenshotUrl}" />`);
      }
      const front = frontParts.join("<br>");

      // Build rich back with definition, context, translation, source, and audio
      const backParts: string[] = [];
      if (w.definition) backParts.push(w.definition);
      if (w.example) backParts.push(`<br><b>Context:</b> ${w.example}`);
      if (w.translation) backParts.push(`<br><b>Translation:</b> ${w.translation}`);
      if (w.sourceTitle) backParts.push(`<br><i>${w.sourceTitle}</i>`);
      // Add TTS audio link (Google Translate TTS)
      const lang = w.language || "de";
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(w.display)}`;
      backParts.push(`<br>[sound:${ttsUrl}]`);
      const back = backParts.join("");

      return { front, back };
    });
    const tsv = buildAnkiTsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`motus-anki-${stamp}.tsv`, tsv);
    toast.success(`Exported ${rows.length} cards — import the TSV in Anki`);
  };
```

Note: Anki's TSV import supports HTML in fields. The `[sound:URL]` syntax tells Anki to download the audio from the URL and embed it in the card. The user needs to be online when importing for the audio to download.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/Words.tsx src/lib/subtitles.ts
git commit -m "feat: enrich Anki export with HTML formatting, screenshots, and TTS audio"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 2: Manual test — screenshots appear after save**

1. Start the app, navigate to Watch screen with a video file
2. Play video, click a word in the subtitle overlay
3. WordDialog opens with screenshot thumbnail → save
4. Go to Vocabulary page → verify screenshot thumbnail appears immediately
5. Return to Watch → verify the word highlights in the subtitle overlay
6. Verify the word appears in the right vocabulary panel

- [ ] **Step 3: Manual test — quick-save with screenshot**

1. On Watch screen, press `S` to save current sentence
2. Verify words highlight in the overlay
3. Verify words appear in the vocabulary panel

- [ ] **Step 4: Manual test — Anki export**

1. Go to Vocabulary page
2. Click "Export to Anki"
3. Open the TSV file → verify it contains HTML with `<img>` tags and `[sound:]` URLs
4. Import in Anki → verify cards show images and play audio

- [ ] **Step 5: Final commit (if needed)**

```bash
git add -A
git commit -m "fix: screenshots, word highlighting, and enriched Anki cards"
```

---

## Summary

| Task | What it builds | Files touched |
|------|---------------|---------------|
| 1 | Fix screenshot race condition | `src/lib/study.ts` |
| 2 | Watch vocabulary panel auto-refresh | `src/pages/Watch.tsx` |
| 3 | Type-safe SavedWord interface | `src/pages/Words.tsx` |
| 4 | Source title in card back | `local-server.mjs` |
| 5 | Rich Anki export with audio | `src/pages/Words.tsx` |
| 6 | Verification | — |
