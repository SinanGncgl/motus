# Enhanced Word Save from Watch Screen

## Problem

When learning vocabulary from video content, users need rich context to remember words. Currently, saving a word from the Watch screen produces a basic card (word + definition). The user has to manually add context like the sentence the word appeared in, its translation, or a visual reference. This friction means most saved cards lack the context needed for effective retention.

## Goal

Create a **perfect Anki card** for every word saved from the Watch screen, with zero manual effort. Each card should include:

- The word in its original sentence (highlighted)
- A screenshot of the video frame where the word appeared
- The English definition
- The sentence translation

## Design

### 1. Auto-Capture Video Frame

When the WordDialog opens, automatically capture the current video frame:

```typescript
function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85));
}
```

- Triggered in WordDialog's `useEffect` when `open && selection` and `videoRef` is available
- Stored as a JPEG blob (~100-200KB at 0.85 quality)
- Shown as a small preview thumbnail in the WordDialog (120x68px, 16:9)

### 2. Pre-fill Definition with Sentence Translation

When the WordDialog opens, if a sentence translation is available:

- Pre-fill the **definition** textarea with the sentence translation
- The user can edit it freely before saving
- If no translation exists (auto-translate off), leave the field empty as before

This gives the user the translation as a starting point, which they can refine into a personal definition.

### 3. Enhanced Card Format

The Anki card back is reformatted to include richer context:

**Front:** `front` field = word display text (unchanged)

**Back:** `back` field = structured block:
```
[definition]

Context: [original sentence with word bolded]
Translation: [sentence translation]
```

Example for word "Schule" in sentence "Ich gehe zur Schule":
```
school

Context: Ich gehe zur **Schule**
Translation: I go to school
```

### 4. Screenshot Storage

Screenshots are stored on disk and referenced by saved word ID:

- **Upload endpoint:** `POST /api/words/:id/screenshot` — accepts `image/jpeg` body, saves to `~/.motus/screenshots/<id>.jpg`
- **Static serving:** `GET /api/screenshots/:id.jpg` — serves from the same directory
- **Cleanup:** When a word is deleted, its screenshot file is also deleted
- **Size limit:** 2MB max per screenshot

### 5. WordDialog UI Changes

The WordDialog gains:

1. **Screenshot preview** — Small thumbnail (120x68px) shown in the header area next to the word, with a camera icon. Clicking it opens the full-size image.
2. **Pre-filled definition** — Definition textarea starts with the sentence translation (if available)
3. **Context sentence** — Displayed below the definition as read-only reference text (the original sentence with the word highlighted)

Layout:
```
┌─────────────────────────────────────────┐
│ [Word] [Speaker] [📸 thumbnail]         │
│ "Save this word and a local Anki card"  │
│                                         │
│ Context: Ich gehe zur Schule            │  ← read-only, word highlighted
│                                         │
│ Definition                              │
│ ┌─────────────────────────────────────┐ │
│ │ I go to school                      │ │  ← pre-filled, editable
│ └─────────────────────────────────────┘ │
│                                         │
│ Example sentence                        │
│ ┌─────────────────────────────────────┐ │
│ │ Ich gehe zur Schule.                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Cancel]  [Save word]                   │
└─────────────────────────────────────────┘
```

### 6. Data Flow

```
User clicks word in overlay/transcript
  → Watch.tsx openWord() fires
    → Passes: videoRef, translations[activeRow], subtitle.lines[activeRow].text
  → WordDialog opens with selection + context
    → useEffect triggers:
      1. captureFrame(videoRef.current) → stores blob in local state
      2. Pre-fills definition from translation (if available)
      3. Shows context sentence (original line with word highlighted)
    → User edits definition if needed, clicks Save
  → saveWord() called with:
    - word, display, definition, example, sourceTitle, language
    - screenshot: Blob (new parameter)
  → POST /api/words (existing) creates saved_word + anki_card
  → POST /api/words/:id/screenshot uploads the blob
  → Server stores file, links to saved_word
```

## Files to Change

| File | Change |
|------|--------|
| `src/components/app/WordDialog.tsx` | Add screenshot capture, preview, pre-fill definition, context sentence display |
| `src/pages/Watch.tsx` | Pass `videoRef`, current translation, and source sentence text to `openWord()` |
| `src/components/app/TranscriptLine.tsx` | No changes needed (already passes word info) |
| `src/lib/local-api.ts` | Add `uploadScreenshot(id, blob)` method |
| `src/lib/study.ts` | Update `saveWord()` to accept and pass screenshot blob |
| `local-server.mjs` | Add `POST /api/words/:id/screenshot` endpoint, `GET /api/screenshots/:id.jpg` static serving, screenshot cleanup on word delete |

## Edge Cases

- **No video element** (e.g., audio-only): Skip screenshot, no thumbnail shown
- **No translation available**: Definition textarea starts empty (current behavior)
- **Existing word being updated**: Show existing screenshot if any, allow re-capture
- **Screenshot upload fails**: Word still saves (definition + context are the primary value)
- **Private browsing / quota exceeded**: Catch storage errors gracefully, word still saves

## Testing

1. Click a word in overlay with auto-translate ON → verify definition pre-filled with translation
2. Click a word in overlay with auto-translate OFF → verify definition empty
3. Verify screenshot thumbnail appears in WordDialog
4. Click thumbnail → verify full-size image opens
5. Save word → verify screenshot file exists on disk
6. Check card back in practice mode → verify formatted block with definition, context, translation
7. Delete word → verify screenshot file is cleaned up
8. Test with audio-only content (no video) → verify graceful fallback
