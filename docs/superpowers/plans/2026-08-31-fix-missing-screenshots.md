# Fix Missing Screenshots in Quick-Save Paths — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure screenshots are captured when saving words via quick-save paths (keyboard shortcut S, token click) and when updating existing words in WordDialog.

**Architecture:** Extract video frame capture into a reusable utility, thread screenshot through the `useSavedWords` hook, and fix the WordDialog update path to upload screenshots.

**Tech Stack:** React, TypeScript, Canvas API (frame capture)

---

## File Map

| File | Change |
|------|--------|
| `src/lib/player.ts` | Add `captureFrame()` utility function |
| `src/hooks/use-saved-words.ts` | Add `screenshot` to `SaveInput` interface, pass to `saveWord()` |
| `src/pages/Watch.tsx` | Capture frame in `saveCurrentSentence()` and `saveWordFromToken()`, pass to `save()` |
| `src/components/app/WordDialog.tsx` | Use shared `captureFrame()`, upload screenshot on update path |

---

### Task 1: Extract video frame capture into reusable utility

**Files:**
- Modify: `src/lib/player.ts`

The frame capture logic in `WordDialog.tsx` (lines 89-115) needs to be reused in Watch.tsx quick-save paths. Extract it into a standalone async function.

- [ ] **Step 1: Add captureFrame function to player.ts**

In `src/lib/player.ts`, add the following after the `PlayerHandle` interface:

```typescript
/**
 * Capture the current video frame as a JPEG blob.
 * Returns null if the player is unavailable or frame capture fails.
 */
export async function captureFrame(
  playerRef: React.RefObject<PlayerHandle | null>,
): Promise<Blob | null> {
  try {
    const player = playerRef.current?.getInternalPlayer?.();
    if (!player || player.videoWidth <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = player.videoWidth;
    canvas.height = player.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(player, 0, 0);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        "image/jpeg",
        0.85,
      );
    });
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/player.ts
git commit -m "refactor: extract video frame capture into reusable captureFrame utility"
```

---

### Task 2: Add screenshot parameter to useSavedWords hook

**Files:**
- Modify: `src/hooks/use-saved-words.ts:6-13` (SaveInput interface)
- Modify: `src/hooks/use-saved-words.ts:59-68` (save method)

The hook's `SaveInput` interface lacks a `screenshot` field, so quick-save callers can't pass screenshots.

- [ ] **Step 1: Add screenshot to SaveInput interface**

In `src/hooks/use-saved-words.ts`, update the `SaveInput` interface (lines 6-13) to:

```typescript
interface SaveInput {
  word: string;
  display: string;
  definition?: string;
  example?: string;
  sourceTitle?: string;
  language?: string;
  screenshot?: Blob;
}
```

- [ ] **Step 2: Pass screenshot through to saveWord**

In `src/hooks/use-saved-words.ts`, update the `save` callback (lines 59-68) to:

```typescript
const save = useCallback(
  async (input: SaveInput) => {
    const res = await saveWord(input);
    if (res.saved) {
      const fresh = await localApi.words.list();
      setWords(fresh);
    }
    return res;
  },
  [],
);
```

This works because `saveWord()` in `study.ts` already accepts `screenshot` in its `SaveWordInput` and the hook's `SaveInput` now includes it. The `saveWord` function handles the upload internally.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-saved-words.ts
git commit -m "feat: add screenshot parameter to useSavedWords save hook"
```

---

### Task 3: Capture screenshots in Watch.tsx quick-save paths

**Files:**
- Modify: `src/pages/Watch.tsx:397-408` (saveWordFromToken)
- Modify: `src/pages/Watch.tsx:461-481` (saveCurrentSentence)

Both quick-save paths call `save()` without capturing a video frame.

- [ ] **Step 1: Add import for captureFrame**

In `src/pages/Watch.tsx`, find the existing import from `@/lib/player` (line 5 area) and add `captureFrame`:

```typescript
import { captureFrame, type PlayerHandle } from "@/lib/player";
```

If there's no existing import from `@/lib/player`, add one. The import for `PlayerHandle` may already exist on a different line — merge them.

- [ ] **Step 2: Update saveWordFromToken to capture screenshot**

In `src/pages/Watch.tsx`, replace `saveWordFromToken` (lines 397-408) with:

```typescript
const saveWordFromToken = async (tokenWord: string, raw: string, lineText: string) => {
  playerRef.current?.pauseVideo();
  if (!subtitle) return;
  const screenshot = await captureFrame(playerRef);
  void save({
    word: tokenWord,
    display: raw,
    example: lineText,
    sourceTitle: subtitle.title,
    language: subtitle.language,
    screenshot: screenshot ?? undefined,
  });
  toast.success(`Saved "${raw}"`);
};
```

- [ ] **Step 3: Update saveCurrentSentence to capture screenshot**

In `src/pages/Watch.tsx`, replace `saveCurrentSentence` (lines 461-481) with:

```typescript
const saveCurrentSentence = async () => {
  if (!activeLine || !subtitle) return;
  const screenshot = await captureFrame(playerRef);
  let count = 0;
  for (const token of tokenize(activeLine.text)) {
    if (!token.word) continue;
    if (isSaved(token.word)) continue;
    void save({
      word: token.word,
      display: token.text,
      example: activeLine.text,
      sourceTitle: subtitle.title,
      language: subtitle.language,
      screenshot: screenshot ?? undefined,
    });
    count++;
  }
  toast.success(
    count > 0
      ? `Saved ${count} new ${count === 1 ? "word" : "words"} from this sentence`
      : "All words in this sentence are already saved",
  );
};
```

Note: The screenshot is captured once before the loop, so all words from the same sentence share the same video frame.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/Watch.tsx
git commit -m "feat: capture video screenshot in quick-save paths"
```

---

### Task 4: Fix WordDialog update path to upload screenshot

**Files:**
- Modify: `src/components/app/WordDialog.tsx:178-189` (existing word save path)

When updating an existing word, `save()` calls `localApi.words.save()` directly and never uploads the captured screenshot.

- [ ] **Step 1: Update WordDialog to use captureFrame and upload on update**

In `src/components/app/WordDialog.tsx`, add the import for `captureFrame`:

```typescript
import { captureFrame } from "@/lib/player";
```

Then replace the `save` function (lines 172-214) with:

```typescript
const save = async () => {
  if (!selection) return;
  setIsSaving(true);
  try {
    const normalizedWord = displayWord.trim().toLowerCase();
    const display = displayWord.trim() || selection.display;
    if (existing) {
      await localApi.words.save({
        word: normalizedWord,
        display,
        definition,
        example,
        sourceTitle: selection.sourceTitle,
        language: selection.language,
        translation: selection.translation,
      });
      // Upload screenshot for existing word update
      if (screenshot && existing._id) {
        localApi.words.uploadScreenshot(existing._id, screenshot).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent("motus:word-saved"));
      toast.success("Word updated");
    } else {
      const res = await saveWord({
        word: normalizedWord,
        display,
        definition,
        example,
        sourceTitle: selection.sourceTitle,
        language: selection.language,
        translation: selection.translation,
        screenshot: screenshot ?? undefined,
      });
      if (res.saved) toast.success("Saved — Anki card generated automatically");
      if (res.skipped) {
        onOpenChange(false);
        return;
      }
    }
    onOpenChange(false);
    onSaved?.();
  } catch {
    toast.error("Could not save the word.");
  } finally {
    setIsSaving(false);
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/app/WordDialog.tsx
git commit -m "fix: upload screenshot when updating existing word in WordDialog"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 2: Lint check**

Run: `npm run lint` (or project-equivalent)
Expected: No new errors

- [ ] **Step 3: Manual test — quick-save with screenshot**

1. Start the app and navigate to Watch screen with a video file
2. Play the video, press `S` to save the current sentence
3. Go to Vocabulary page → verify saved words show screenshot thumbnails
4. Go to Practice page → verify flashcards show screenshots

- [ ] **Step 4: Manual test — token click with screenshot**

1. On Watch screen, click a word in the subtitle overlay
2. Verify WordDialog opens with screenshot thumbnail
3. Save → verify screenshot appears in Vocabulary and Practice

- [ ] **Step 5: Manual test — update existing word**

1. Click a word that's already saved
2. WordDialog opens with existing screenshot (if any)
3. Update the definition, click "Update"
4. Verify the screenshot is uploaded and visible in Vocabulary/Practice

- [ ] **Step 6: Final commit (if needed)**

```bash
git add -A
git commit -m "fix: ensure screenshots are captured in all word save paths"
```

---

## Summary

| Task | What it builds | Files touched |
|------|---------------|---------------|
| 1 | Reusable `captureFrame()` utility | `src/lib/player.ts` |
| 2 | `screenshot` param in `useSavedWords` hook | `src/hooks/use-saved-words.ts` |
| 3 | Screenshots in quick-save paths | `src/pages/Watch.tsx` |
| 4 | Screenshot upload on word update | `src/components/app/WordDialog.tsx` |
| 5 | Verification | — |
