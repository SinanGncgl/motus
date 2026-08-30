# Enhanced Word Save from Watch Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When saving a word from the Watch screen, auto-capture a video screenshot, pre-fill the definition with the sentence translation, and produce a rich Anki card with context.

**Architecture:** Extend the WordDialog to accept a video ref + translation, auto-capture frames via canvas, upload screenshots to the server, and format enhanced card backs with context.

**Tech Stack:** React, TypeScript, Canvas API (frame capture), Node.js (file storage), PostgreSQL (existing schema)

---

## File Map

| File | Change |
|------|--------|
| `src/components/app/WordSelection` type in `WordDialog.tsx` | Add `translation?` and `contextSentence?` fields |
| `src/components/app/WordDialog.tsx` | Add screenshot capture, preview thumbnail, pre-fill definition, context sentence display |
| `src/pages/Watch.tsx` | Pass `videoRef`, current translation, source sentence to `openWord()` and WordDialog |
| `src/lib/local-api.ts` | Add `uploadScreenshot(wordId, blob)` method |
| `src/lib/study.ts` | Update `SaveWordInput` to accept `screenshot` blob, upload after save |
| `local-server.mjs` | Add `POST /api/words/:id/screenshot`, `GET /api/screenshots/:id.jpg`, cleanup on delete |

---

### Task 1: Add screenshot upload to server

**Files:**
- Modify: `local-server.mjs:1-15` (add SCREENSHOTS_DIR)
- Modify: `local-server.mjs:292-319` (add screenshot POST + GET + cleanup)
- Modify: `local-server.mjs:316-319` (cleanup on DELETE)

- [ ] **Step 1: Add SCREENSHOTS_DIR constant**

In `local-server.mjs`, after line 13 (`const UPLOAD_DIR = ...`), add:

```javascript
const SCREENSHOTS_DIR = join(DATA_DIR, "screenshots");
```

After the existing `await mkdir(UPLOAD_DIR, { recursive: true });` (line 30), add:

```javascript
await mkdir(SCREENSHOTS_DIR, { recursive: true });
```

- [ ] **Step 2: Add screenshot upload endpoint**

In `local-server.mjs`, after the word DELETE handler (after line 319, before the `return fail(res, 404, "Not found")` on line 320), add:

```javascript
      // Screenshot upload for a saved word
      if (req.method === "POST" && p[0] === "api" && p[1] === "words" && p[2] && p[3] === "screenshot") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (buf.length > 2 * 1024 * 1024) return fail(res, 413, "Screenshot too large (max 2MB)");
        const filePath = join(SCREENSHOTS_DIR, `${p[2]}.jpg`);
        await writeFile(filePath, buf);
        return send(res, 200, { ok: true });
      }
```

- [ ] **Step 3: Add screenshot static serving**

In `local-server.mjs`, near the top of the request handler (after the static file serving for `dist/`, around line 130-140 area), add a new route before the existing static file catch-all. Find the section that serves `dist/` files and add before it:

```javascript
    // Serve word screenshots
    if (req.method === "GET" && path.startsWith("/api/screenshots/")) {
      const fileName = path.slice("/api/screenshots/".length);
      if (!fileName || fileName.includes("..")) return fail(res, 400, "Invalid path");
      const filePath = join(SCREENSHOTS_DIR, fileName);
      try {
        const data = await readFile(filePath);
        cors(res);
        res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
        return res.end(data);
      } catch {
        return fail(res, 404, "Screenshot not found");
      }
    }
```

- [ ] **Step 4: Add screenshot cleanup on word delete**

In the word DELETE handler (line 316-319), add screenshot cleanup before the DB delete:

```javascript
      if (req.method === "DELETE") {
        await q("DELETE FROM anki_cards WHERE saved_word_id = $1", [p[2]]);
        await q("DELETE FROM saved_words WHERE id = $1 AND user_id = $2", [p[2], uid]);
        // Clean up screenshot file if it exists
        unlink(join(SCREENSHOTS_DIR, `${p[2]}.jpg`)).catch(() => {});
        return send(res, 200, { ok: true });
```

- [ ] **Step 5: Verify server starts**

Run: `node local-server.mjs &` (or check existing server log)
Expected: Server starts without errors, `screenshots/` dir created in `~/.motus/`

- [ ] **Step 6: Commit**

```bash
git add local-server.mjs
git commit -m "feat: add screenshot upload and serving for word cards"
```

---

### Task 2: Add screenshot upload to client API

**Files:**
- Modify: `src/lib/local-api.ts:17` (add `uploadScreenshot` to words API)

- [ ] **Step 1: Add uploadScreenshot method**

In `src/lib/local-api.ts`, find the `words` object (line 17) and add a new method. The current `words` object is:

```typescript
words: { list: () => request<LocalWord[]>("/api/words"), save: (value: unknown) => request<{ wordId: string; created: boolean }>("/api/words", { method: "POST", body: JSON.stringify(value) }), update: (id: string, value: unknown) => request<void>(`/api/words/${id}`, { method: "PATCH", body: JSON.stringify(value) }), remove: (id: string) => request<void>(`/api/words/${id}`, { method: "DELETE" }) },
```

Replace with:

```typescript
words: {
  list: () => request<LocalWord[]>("/api/words"),
  save: (value: unknown) => request<{ wordId: string; created: boolean }>("/api/words", { method: "POST", body: JSON.stringify(value) }),
  update: (id: string, value: unknown) => request<void>(`/api/words/${id}`, { method: "PATCH", body: JSON.stringify(value) }),
  remove: (id: string) => request<void>(`/api/words/${id}`, { method: "DELETE" }),
  uploadScreenshot: async (wordId: string, blob: Blob) => {
    const token = localStorage.getItem(SESSION_KEY);
    const response = await fetch(`${BASE}/api/words/${wordId}/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", ...(token ? { "X-Local-Session": token } : {}) },
      body: blob,
    });
    if (!response.ok) throw new Error("SCREENSHOT_UPLOAD_FAILED");
    return response.json() as Promise<{ ok: boolean }>;
  },
},
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/local-api.ts
git commit -m "feat: add screenshot upload to client API"
```

---

### Task 3: Update saveWord to accept and upload screenshot

**Files:**
- Modify: `src/lib/study.ts:9-16` (update SaveWordInput)
- Modify: `src/lib/study.ts:23-48` (update saveWord function)

- [ ] **Step 1: Add screenshot and translation to SaveWordInput**

In `src/lib/study.ts`, update the `SaveWordInput` interface (lines 9-16):

```typescript
export interface SaveWordInput {
  word: string; // normalized
  display: string; // raw
  definition?: string;
  example?: string;
  sourceTitle?: string;
  language?: string;
  translation?: string; // sentence translation for card back
  screenshot?: Blob; // video frame capture
}
```

- [ ] **Step 2: Upload screenshot after word save, pass translation**

In `src/lib/study.ts`, update the `saveWord` function to handle the screenshot and pass translation. Replace lines 34-43:

```typescript
  try {
    const result = await localApi.words.save({
      word: input.word,
      display: input.display,
      definition: input.definition ?? "",
      example: input.example ?? "",
      sourceTitle: input.sourceTitle,
      language: input.language,
      translation: input.translation ?? "",
    });
    // Upload screenshot if provided (non-blocking — word is already saved)
    if (input.screenshot && result.wordId) {
      localApi.words.uploadScreenshot(result.wordId, input.screenshot).catch(() => {
        // Screenshot upload is best-effort; don't block word save
      });
    }
    return { skipped: false, saved: true };
  } catch {
    toast.error("Could not save the word.");
    return { skipped: false, saved: false };
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/study.ts
git commit -m "feat: upload screenshot after word save"
```

---

### Task 4: Update WordDialog with screenshot capture and context

**Files:**
- Modify: `src/components/app/WordDialog.tsx` (full rewrite)

- [ ] **Step 1: Update WordSelection interface and Props**

In `src/components/app/WordDialog.tsx`, update the interfaces (lines 13-15):

```typescript
export interface WordSelection {
  word: string;
  display: string;
  example: string;
  sourceTitle?: string;
  language?: string;
  translation?: string; // sentence translation from active line
  contextSentence?: string; // original sentence with the word
}

interface SavedWordEntry {
  _id: string;
  word: string;
  display: string;
  definition: string;
  example: string;
  sourceTitle?: string;
  language?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: WordSelection | null;
  existing?: SavedWordEntry | null;
  onSaved?: () => void;
  videoRef?: React.RefObject<{ getCurrentTime: () => number; getInternalPlayer: () => HTMLVideoElement | null } | null>;
}
```

- [ ] **Step 2: Add screenshot capture state and logic**

Replace the entire component implementation (lines 16-21) with the following. This adds:
- `screenshot` state (Blob | null)
- `screenshotUrl` state (object URL for preview)
- Auto-capture in useEffect when dialog opens
- Context sentence display
- Pre-fill definition from translation

```typescript
export function WordDialog({ open, onOpenChange, selection, existing, onSaved, videoRef }: Props) {
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [lookupSource, setLookupSource] = useState<null | "offline" | "online">(null);
  const [isSaving, setIsSaving] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Auto-capture video frame + pre-fill definition when dialog opens
  useEffect(() => {
    if (!open || !selection) return;

    // Reset states
    setDefinition(existing?.definition ?? "");
    setExample(existing?.example ?? selection.example);
    setLookupDone(Boolean(existing));
    setLookupFailed(false);
    setLookupSource(null);
    setScreenshot(null);
    setScreenshotUrl(null);

    // Capture video frame if videoRef is available
    if (videoRef?.current) {
      try {
        const player = videoRef.current.getInternalPlayer?.();
        if (player && player.videoWidth > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = player.videoWidth;
          canvas.height = player.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(player, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                setScreenshot(blob);
                setScreenshotUrl(URL.createObjectURL(blob));
              }
            }, "image/jpeg", 0.85);
          }
        }
      } catch {
        // Video frame capture is best-effort
      }
    }

    // Pre-fill definition with sentence translation (if available and no existing definition)
    if (!existing?.definition && selection.translation) {
      setDefinition(selection.translation);
      setLookupDone(true);
      setLookupSource(null);
      return;
    }

    if (existing) return;

    // Lookup definition (offline first, then online)
    let cancelled = false;
    const offline = offlineLookup(selection.word);
    if (offline) {
      setDefinition(offline.definition);
      if (!selection.example && offline.example) setExample(offline.example);
      setLookupSource("offline");
      setLookupDone(true);
      return;
    }
    let cancelled2 = false;
    setIsLookingUp(true);
    localApi.dictionary(selection.word).then((r) => {
      if (cancelled2) return;
      if (r?.definition) {
        setDefinition(r.definition);
        setLookupSource("online");
      } else {
        setLookupFailed(true);
      }
      if (r?.example && !selection.example) setExample(r.example);
    }).catch(() => {
      if (!cancelled2) setLookupFailed(true);
    }).finally(() => {
      if (!cancelled2) {
        setIsLookingUp(false);
        setLookupDone(true);
      }
    });
    return () => { cancelled = true; cancelled2 = true; };
  }, [open, selection, existing, videoRef]);

  // Cleanup object URL
  useEffect(() => {
    return () => { if (screenshotUrl) URL.revokeObjectURL(screenshotUrl); };
  }, [screenshotUrl]);

  const save = async () => {
    if (!selection) return;
    setIsSaving(true);
    try {
      if (existing) {
        await localApi.words.save({
          word: selection.word,
          display: selection.display,
          definition,
          example,
          sourceTitle: selection.sourceTitle,
          language: selection.language,
          translation: selection.translation,
        });
        toast.success("Word updated");
      } else {
        const res = await saveWord({
          word: selection.word,
          display: selection.display,
          definition,
          example,
          sourceTitle: selection.sourceTitle,
          language: selection.language,
          translation: selection.translation,
          screenshot: screenshot ?? undefined,
        });
        if (res.saved) toast.success("Saved — Anki card generated automatically");
        if (res.skipped) { onOpenChange(false); return; }
      }
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("Could not save the word.");
    } finally {
      setIsSaving(false);
    }
  };

  // Highlight the word in the context sentence
  const highlightedContext = selection?.contextSentence && selection?.display
    ? selection.contextSentence.replace(
        new RegExp(`(${selection.display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"),
        "**$1**"
      )
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-primary">
              {selection?.display ?? ""}
            </span>
            {selection && (
              <SpeakerButton text={selection.display} lang={selection.language ?? existing?.language} label="Pronounce word" />
            )}
            {screenshotUrl && (
              <img
                src={screenshotUrl}
                alt="Screenshot"
                className="ml-auto h-[68px] w-[120px] rounded-md border object-cover cursor-pointer"
                onClick={() => screenshotUrl && window.open(screenshotUrl, "_blank")}
                title="Click to view full size"
              />
            )}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? "Already in your vocabulary — update it locally."
              : "Save this word and a local Anki card is generated automatically."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {highlightedContext && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wide">Context</span>
              <p className="mt-1" dangerouslySetInnerHTML={{ __html: highlightedContext.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>') }} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="word-definition">Definition</Label>
              {isLookingUp && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />Looking it up…
                </span>
              )}
              {!isLookingUp && lookupDone && !definition && (
                <Badge variant={lookupFailed ? "outline" : "secondary"}>
                  {lookupFailed ? "Offline — add your own" : ""}
                </Badge>
              )}
              {lookupSource === "offline" && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3" />Offline dictionary
                </Badge>
              )}
            </div>
            <Textarea
              id="word-definition"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Type the meaning in your own words"
              className="min-h-20 resize-none"
            />
            {lookupFailed && (
              <p className="text-[11px] text-muted-foreground">
                Online dictionary is unreachable (you appear to be offline). The
                offline starter dictionary covers common words; for anything
                else, add your own definition — it still generates an Anki card.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="word-example">Example sentence</Label>
            <Textarea
              id="word-example"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <BookmarkCheck className="size-4" />}
            {existing ? "Update word" : "Save word"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/app/WordDialog.tsx
git commit -m "feat: auto-capture screenshot and pre-fill definition in WordDialog"
```

---

### Task 5: Pass videoRef and translation from Watch to WordDialog

**Files:**
- Modify: `src/pages/Watch.tsx:368-378` (update openWord)
- Modify: `src/pages/Watch.tsx:1570-1575` (pass videoRef to WordDialog)

- [ ] **Step 1: Update openWord to include translation**

In `src/pages/Watch.tsx`, update the `openWord` function (lines 368-378):

```typescript
  const openWord = (tokenWord: string, raw: string, lineText: string) => {
    if (!subtitle) return;
    const row = subtitle.lines.findIndex((l) => l.text === lineText);
    setSelection({
      word: tokenWord,
      display: raw,
      example: lineText,
      sourceTitle: subtitle.title,
      language: subtitle.language,
      translation: row >= 0 ? translations[row] : undefined,
      contextSentence: lineText,
    });
    setWordDialogOpen(true);
  };
```

- [ ] **Step 2: Pass videoRef to WordDialog**

In `src/pages/Watch.tsx`, update the WordDialog rendering (lines 1570-1575):

```typescript
      <WordDialog
        open={wordDialogOpen}
        onOpenChange={setWordDialogOpen}
        selection={selection}
        existing={selection ? (existing(selection.word) ?? null) : null}
        videoRef={playerRef}
      />
```

Note: `playerRef` is already defined in Watch.tsx and points to the video player component. The WordDialog uses `getInternalPlayer()` to access the underlying `<video>` element for frame capture.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/Watch.tsx
git commit -m "feat: pass videoRef and translation context to WordDialog"
```

---

### Task 6: Format enhanced Anki card back with context

**Files:**
- Modify: `local-server.mjs:281` (enhanced card back format)
- Modify: `local-server.mjs:289` (enhanced card back for new words)
- Modify: `local-server.mjs:311` (enhanced card back for updates)

- [ ] **Step 1: Update card back format for new words**

In `local-server.mjs`, find the INSERT into anki_cards (line 288-289). The current `back` field is:

```javascript
[cid, uid, wid, a.display || word, [a.definition, a.example].filter(Boolean).join("\n\n") || a.display || word, 0, now(), now()]);
```

Replace the `back` value with an enhanced format that includes context:

```javascript
[cid, uid, wid, a.display || word, formatCardBack(a, word), 0, now(), now()]);
```

- [ ] **Step 2: Update card back format for existing word updates**

In `local-server.mjs`, find the UPDATE anki_cards for existing words (line 281). The current code is:

```javascript
if (c) await q("UPDATE anki_cards SET front=$1, back=$2 WHERE id=$3", [a.display || existing.display || word, [a.definition, a.example].filter(Boolean).join("\n\n") || a.display || existing.display || word, c.id]);
```

Replace with:

```javascript
if (c) await q("UPDATE anki_cards SET front=$1, back=$2 WHERE id=$3", [a.display || existing.display || word, formatCardBack(a, existing.display || word), c.id]);
```

- [ ] **Step 3: Update card back for PATCH updates**

In `local-server.mjs`, find the PATCH handler's card update (line 311). The current code is:

```javascript
if (c) {
  if (upd.resetCard) {
    await q("UPDATE anki_cards SET box=0, due_at=$1, last_reviewed_at=NULL WHERE id=$2", [now(), c.id]);
  } else {
    await q("UPDATE anki_cards SET front=$1, back=$2 WHERE id=$3", [upd.display || w.display, [upd.definition, upd.example].filter(Boolean).join("\n\n") || upd.display || w.display, c.id]);
  }
}
```

Replace the `else` branch:

```javascript
  } else {
    await q("UPDATE anki_cards SET front=$1, back=$2 WHERE id=$3", [upd.display || w.display, formatCardBack(upd, w.display), c.id]);
  }
```

- [ ] **Step 4: Add formatCardBack helper function**

In `local-server.mjs`, near the other helper functions (after the `id()` function around line 88), add:

```javascript
function formatCardBack(a, fallbackWord) {
  const parts = [];
  if (a.definition) parts.push(a.definition);
  if (a.example) parts.push(`Context: ${a.example}`);
  if (a.translation) parts.push(`Translation: ${a.translation}`);
  return parts.join("\n\n") || fallbackWord;
}
```

- [ ] **Step 5: Verify server starts**

Run: `node local-server.mjs &` (or check logs)
Expected: Server starts without errors

- [ ] **Step 6: Commit**

```bash
git add local-server.mjs
git commit -m "feat: format Anki card back with definition, context, and translation"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 2: Manual test flow**

1. Start server: `LIBRETRANSLATE=1 ./start.sh`
2. Open app, navigate to Watch screen with a German subtitle
3. Play video, wait for a line to appear
4. Click the translate button → verify translation shows below the line
5. Click a word in the overlay
6. Verify WordDialog opens with:
   - Screenshot thumbnail in the header
   - Context sentence shown (original German sentence with word highlighted)
   - Definition pre-filled with the English translation
7. Edit definition if desired, click "Save word"
8. Go to Vocabulary page → verify the word appears
9. Go to Practice page → verify the card shows:
   - Front: the word
   - Back: definition + context sentence + translation

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: enhanced word save with screenshots and translation context"
```

---

## Summary

| Task | What it builds | Files touched |
|------|---------------|---------------|
| 1 | Server screenshot storage | `local-server.mjs` |
| 2 | Client upload API | `src/lib/local-api.ts` |
| 3 | saveWord screenshot support | `src/lib/study.ts` |
| 4 | WordDialog with capture + context | `src/components/app/WordDialog.tsx` |
| 5 | Watch → WordDialog data flow | `src/pages/Watch.tsx` |
| 6 | Enhanced card back format | `local-server.mjs` |
| 7 | Verification | — |
