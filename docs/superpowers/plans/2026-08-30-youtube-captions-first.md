# YouTube Captions First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user pastes a YouTube URL, try YouTube's built-in captions first (instant, accurate). Only fall back to audio download + Whisper transcription when captions are unavailable.

**Architecture:** The server already has a `transcript()` function that fetches YouTube's auto-captions. We'll call it first in the Watch page flow. If captions exist, use them directly. If not, fall back to the existing grab + transcribe pipeline. Add a UI toggle so users can choose "YouTube captions" vs "Whisper transcription" mode.

**Tech Stack:** TypeScript, React, existing local-server.mjs `/api/transcript` endpoint

---

### Task 1: Try YouTube captions before audio download

**Files:**
- Modify: `src/pages/Watch.tsx` (handleAttachVideo, handleGrabAndTranscribe)

**Steps:**

- [ ] **Step 1: Add YouTube captions attempt before grab in handleAttachVideo**

In `src/pages/Watch.tsx`, update `handleAttachVideo` to try YouTube captions first. Replace the function body (lines 628-664) with:

```typescript
  const handleAttachVideo = async () => {
    if (!subtitle) return;
    const videoId = extractYouTubeId(attachUrl);
    if (!videoId) {
      setAttachError("That doesn't look like a valid YouTube link.");
      return;
    }
    setIsAttaching(true);
    setAttachError(null);
    setAttachErrorCode(null);
    setGrabProgress(null);
    try {
      // Step 1: Try YouTube's built-in captions (instant, no download needed)
      setGrabProgress({ stage: "transcribing", note: "Checking for YouTube captions…" });
      try {
        const ytCaptions = await localApi.transcript(videoId, attachLang);
        if (ytCaptions.lines && ytCaptions.lines.length > 0) {
          await localApi.subtitles.update(subtitle._id, {
            videoId,
            language: attachLang,
            lines: ytCaptions.lines,
          });
          setAttachUrl("");
          toast.success(
            `YouTube captions loaded (${ytCaptions.lines.length} lines) — no download needed!`,
          );
          return;
        }
      } catch {
        // No YouTube captions available — fall through to Whisper
      }

      // Step 2: No YouTube captions — download audio and transcribe with Whisper
      setGrabProgress(null);
      const file = await grabYouTubeAudioStream(attachUrl, setGrabProgress);
      setGrabProgress({ stage: "decoding" });
      const result = await transcribeFile(file, {
        language: attachLang,
        model: attachModel,
        onProgress: setGrabProgress,
      });
      const { storageId } = await localApi.upload(file);
      await localApi.subtitles.update(subtitle._id, {
        videoId,
        fileId: storageId,
        fileName: file.name,
        language: attachLang,
        lines: result.lines,
      });
      setAttachUrl("");
      toast.success(
        `Audio downloaded and transcribed (${result.lines.length} lines) — enjoy!`,
      );
    } catch (error) {
      setAttachErrorCode("GRAB_FAILED");
      setAttachError(grabErrorMessage(error));
    } finally {
      setIsAttaching(false);
    }
  };
```

- [ ] **Step 2: Add same YouTube captions attempt to handleGrabAndTranscribe**

In `src/pages/Watch.tsx`, update `handleGrabAndTranscribe` (lines 666-708) with the same YouTube-first pattern:

```typescript
  const handleGrabAndTranscribe = async () => {
    if (!subtitle || !attachUrl.trim()) return;
    setAttachError(null);
    setAttachErrorCode(null);
    setIsGrabbing(true);
    setGrabProgress(null);
    try {
      const videoId = extractYouTubeId(attachUrl);

      // Step 1: Try YouTube's built-in captions
      if (videoId) {
        setGrabProgress({ stage: "transcribing", note: "Checking for YouTube captions…" });
        try {
          const ytCaptions = await localApi.transcript(videoId, attachLang);
          if (ytCaptions.lines && ytCaptions.lines.length > 0) {
            await localApi.subtitles.update(subtitle._id, {
              videoId,
              language: attachLang,
              lines: ytCaptions.lines,
            });
            setAttachUrl("");
            toast.success(
              `YouTube captions loaded (${ytCaptions.lines.length} lines) — no download needed!`,
            );
            return;
          }
        } catch {
          // No YouTube captions — fall through to Whisper
        }
      }

      // Step 2: Download audio and transcribe with Whisper
      setGrabProgress(null);
      const file = await grabYouTubeAudioStream(attachUrl, setGrabProgress);
      const result = await transcribeFile(file, {
        language: attachLang,
        model: attachModel,
        onProgress: setGrabProgress,
      });
      const { storageId } = await localApi.upload(file);
      await localApi.subtitles.update(subtitle._id, {
        videoId: videoId ?? undefined,
        fileId: storageId,
        fileName: file.name,
        language: attachLang,
        lines: result.lines,
      });
      setAttachUrl("");
      toast.success(
        `Audio downloaded and transcribed (${result.lines.length} lines) — enjoy!`,
      );
    } catch (error) {
      const msg = grabErrorMessage(error);
      if (msg.includes("UPLOAD_FAILED")) {
        setAttachErrorCode("UPLOAD_FAILED");
        setAttachError("Audio was transcribed but couldn't be saved — try again.");
      } else {
        setAttachErrorCode("GRAB_FAILED");
        setAttachError(msg);
      }
    } finally {
      setIsGrabbing(false);
    }
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Watch.tsx && git commit -m "feat: try YouTube captions before falling back to Whisper transcription"
```

---

### Task 2: Add transcription mode toggle in Watch UI

**Files:**
- Modify: `src/pages/Watch.tsx` (add mode state, toggle UI)

**Steps:**

- [ ] **Step 1: Add transcription mode state**

In `src/pages/Watch.tsx`, add a state for the transcription mode after the `attachModel` state (around line 205):

```typescript
  const [transcribeMode, setTranscribeMode] = useState<"auto" | "youtube" | "whisper">("auto");
```

- [ ] **Step 2: Update handleAttachVideo to respect the mode**

At the beginning of `handleAttachVideo`, after the videoId extraction, add mode-based logic. The YouTube captions attempt should be skipped if mode is "whisper", and the Whisper fallback should be skipped if mode is "youtube":

Replace the try block in handleAttachVideo with:

```typescript
    try {
      // Step 1: Try YouTube's built-in captions (unless user chose Whisper-only)
      if (transcribeMode !== "whisper") {
        setGrabProgress({ stage: "transcribing", note: "Checking for YouTube captions…" });
        try {
          const ytCaptions = await localApi.transcript(videoId, attachLang);
          if (ytCaptions.lines && ytCaptions.lines.length > 0) {
            await localApi.subtitles.update(subtitle._id, {
              videoId,
              language: attachLang,
              lines: ytCaptions.lines,
            });
            setAttachUrl("");
            toast.success(
              `YouTube captions loaded (${ytCaptions.lines.length} lines) — no download needed!`,
            );
            return;
          }
          if (transcribeMode === "youtube") {
            setAttachError("This video doesn't have YouTube captions available.");
            return;
          }
        } catch {
          if (transcribeMode === "youtube") {
            setAttachError("This video doesn't have YouTube captions available.");
            return;
          }
        }
      }

      // Step 2: Download audio and transcribe with Whisper (unless user chose YouTube-only)
      if (transcribeMode !== "youtube") {
        setGrabProgress(null);
        const file = await grabYouTubeAudioStream(attachUrl, setGrabProgress);
        setGrabProgress({ stage: "decoding" });
        const result = await transcribeFile(file, {
          language: attachLang,
          model: attachModel,
          onProgress: setGrabProgress,
        });
        const { storageId } = await localApi.upload(file);
        await localApi.subtitles.update(subtitle._id, {
          videoId,
          fileId: storageId,
          fileName: file.name,
          language: attachLang,
          lines: result.lines,
        });
        setAttachUrl("");
        toast.success(
          `Audio downloaded and transcribed (${result.lines.length} lines) — enjoy!`,
        );
      }
    } catch (error) {
```

Do the same for `handleGrabAndTranscribe`.

- [ ] **Step 3: Add mode selector UI**

Find the model selector div (the `<div className="flex items-center gap-2">` with the Model label) and add a mode selector before it:

```tsx
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Source:</Label>
                      <Select value={transcribeMode} onValueChange={(v) => setTranscribeMode(v as typeof transcribeMode)}>
                        <SelectTrigger className="h-8 w-auto text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (captions first)</SelectItem>
                          <SelectItem value="youtube">YouTube captions only</SelectItem>
                          <SelectItem value="whisper">Whisper only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Watch.tsx && git commit -m "feat: add transcription source toggle (Auto/YouTube/Whisper)"
```

---

### Task 3: Update progress messages for YouTube captions flow

**Files:**
- Modify: `src/pages/Watch.tsx` (GRAB_STAGE_LABELS, progress display)

**Steps:**

- [ ] **Step 1: Add a "checking captions" stage label**

In `src/pages/Watch.tsx`, update `GRAB_STAGE_LABELS` (around line 89) to include a note about checking captions. The current labels are:

```typescript
const GRAB_STAGE_LABELS: Record<TranscribeProgress["stage"], string> = {
  decoding: "Decoding audio…",
  downloading: "Downloading model…",
  loading: "Preparing transcription…",
  transcribing: "Transcribing audio…",
};
```

The `transcribing` stage is already used for both "checking YouTube captions" and "Whisper transcribing". The `note` field in `TranscribeProgress` handles the distinction. No change needed to the labels object.

- [ ] **Step 2: Show the note in progress display**

The progress display already shows `grabProgress` notes. Verify that the note from `{ stage: "transcribing", note: "Checking for YouTube captions…" }` is displayed. Find the progress display section and ensure it shows the note:

```tsx
{grabProgress
  ? GRAB_STAGE_LABELS[grabProgress.stage]
  : isAttaching
    ? "Downloading audio and transcribing…"
    : "Working…"}
{grabProgress?.note && (
  <span className="ml-auto text-muted-foreground">{grabProgress.note}</span>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Watch.tsx && git commit -m "fix: show caption-checking progress note during YouTube transcription"
```

---

### Task 4: Final verification

- [ ] **Step 1: Verify all TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 2: Verify build succeeds**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Final commit if needed**

```bash
git add -A && git commit -m "chore: final verification of YouTube captions-first flow"
```
