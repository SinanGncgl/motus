# App Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce from 8 pages to 5 focused pages by removing Landing, Stats, Subtitles as separate pages and merging their essential content into Dashboard.

**Architecture:** Extract the subtitle creation dialog from Subtitles.tsx into a standalone component. Rebuild Dashboard to include subtitle library grid + creation modal + stats from old Stats page. Update navigation and routes.

**Tech Stack:** React, TypeScript, React Router, shadcn/ui components

---

## File Map

| File | Action |
|------|--------|
| `src/pages/Landing.tsx` | Delete |
| `src/pages/Stats.tsx` | Delete |
| `src/pages/Subtitles.tsx` | Delete |
| `src/pages/Auth.tsx` | Delete |
| `src/components/RequireAuth.tsx` | Delete |
| `src/components/LogoDropdown.tsx` | Delete |
| `src/components/app/NewSubtitleDialog.tsx` | Create — extracted from Subtitles.tsx |
| `src/pages/Dashboard.tsx` | Rewrite — add subtitle grid, creation modal, stats |
| `src/main.tsx` | Update routes |
| `src/components/app/AppShell.tsx` | Update NAV_ITEMS |
| `src/pages/Watch.tsx` | Update back button |
| `src/pages/Practice.tsx` | Update empty state links |
| `src/pages/Words.tsx` | Update empty state links |

---

### Task 1: Extract NewSubtitleDialog component

**Files:**
- Create: `src/components/app/NewSubtitleDialog.tsx`

- [ ] **Step 1: Create the NewSubtitleDialog component**

Create `src/components/app/NewSubtitleDialog.tsx` by extracting the dialog code from `src/pages/Subtitles.tsx` (lines 589-870 approximately). This is the "New subtitle" dialog with YouTube, Upload, and Paste SRT modes.

The component should:
- Accept props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onCreated?: () => void`
- Contain all the creation state (title, youtubeUrl, language, rawText, mode, etc.)
- Contain all the creation logic (handleCreate, handleGrabAndTranscribe)
- Call `onCreated()` after successful creation (so parent can refresh)
- Use the same imports from Subtitles.tsx (localApi, parseSubtitleText, transcribeFile, etc.)

Here is the complete component to create:

```tsx
import {
  TranscribeFile,
  TranscribedChip,
  type TranscribedFile,
} from "@/components/app/TranscribeFile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localApi } from "@/lib/local-api";
import { parseSubtitleText, type SubtitleLine } from "@/lib/subtitles";
import {
  transcribeErrorMessage,
  transcribeFile,
  type TranscribeProgress,
} from "@/lib/transcribe";
import { LANGUAGES } from "@/lib/tts";
import {
  detectLocalGrabber,
  extractYouTubeId,
  grabErrorMessage,
  grabYouTubeAudioStream,
  type GrabHealth,
} from "@/lib/youtube";
import {
  Captions,
  Download,
  FileText,
  Link2,
  Loader2,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const GRAB_STAGE_LABELS: Record<TranscribeProgress["stage"], string> = {
  decoding: "Reading audio…",
  downloading: "Downloading speech model…",
  loading: "Preparing…",
  transcribing: "Transcribing… (this can take a moment)",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function NewSubtitleDialog({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [rawText, setRawText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [collection, setCollection] = useState("");
  const [mode, setMode] = useState<"youtube" | "upload" | "paste">("youtube");

  const [fetchedFile, setFetchedFile] = useState<TranscribedFile | null>(null);
  const [fetched, setFetched] = useState<{
    videoId: string;
    lines: SubtitleLine[];
  } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [grabHealth, setGrabHealth] = useState<GrabHealth | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabError, setGrabError] = useState<string | null>(null);
  const [grabProgress, setGrabProgress] = useState<TranscribeProgress | null>(
    null,
  );

  const videoId = youtubeUrl.trim()
    ? (extractYouTubeId(youtubeUrl) ?? null)
    : null;

  useEffect(() => {
    if (!videoId) {
      setGrabHealth(null);
      return;
    }
    let cancelled = false;
    const check = () => {
      detectLocalGrabber().then((health) => {
        if (!cancelled) setGrabHealth(health);
      });
    };
    setGrabHealth(null);
    check();
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [videoId]);

  const handleCreate = async () => {
    const parsed = parseSubtitleText(rawText);
    const useFetched = Boolean(
      videoId && fetched && fetched.videoId === videoId,
    );
    const useFile = fetchedFile !== null;
    const lines = useFetched
      ? fetched!.lines
      : useFile
        ? fetchedFile!.lines
        : parsed.lines;
    if (lines.length === 0) {
      toast.error("Paste some subtitle text first (SRT or plain text).");
      return;
    }
    if (lines.length > 4000) {
      toast.error("That subtitle is too long (over 4,000 lines).");
      return;
    }
    const totalChars = lines.reduce((n, l) => n + l.text.length, 0);
    if (totalChars > 400_000) {
      toast.error(
        "That subtitle is too large — try a shorter episode or movie.",
      );
      return;
    }
    if (youtubeUrl.trim() && !videoId) {
      toast.error("That doesn't look like a valid YouTube link.");
      return;
    }
    setIsCreating(true);
    try {
      const created = await localApi.subtitles.create({
        title:
          title || (useFile ? fetchedFile!.fileName : "Untitled subtitles"),
        sourceType: useFetched || useFile ? "srt" : parsed.sourceType,
        lines,
        videoId: videoId ?? undefined,
        language,
        collection: collection.trim() || undefined,
      });
      onCreated?.();
      onOpenChange(false);
      setTitle("");
      setCollection("");
      setYoutubeUrl("");
      setRawText("");
      setFetched(null);
      setFetchedFile(null);
      setFetchError(null);
      if (videoId || useFile) {
        navigate(`/watch/${created._id}`);
        toast.success(
          useFile
            ? "Transcribed & synced — tap any word to save it"
            : "Captions synced to the video — tap any word to save it",
        );
      } else {
        toast.success(
          `Loaded ${lines.length} lines — tap any word to save it`,
        );
      }
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("TOO_MANY_LINES")) {
        toast.error("That subtitle is too long (over 4,000 lines).");
      } else if (msg.includes("TOO_LARGE")) {
        toast.error(
          "That subtitle is too large — try a shorter episode or movie.",
        );
      } else {
        toast.error("Could not load subtitles. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleGrabAndTranscribe = async () => {
    if (!youtubeUrl.trim()) return;
    setGrabError(null);
    setIsGrabbing(true);
    try {
      const file = await grabYouTubeAudioStream(youtubeUrl, setGrabProgress);
      const result = await transcribeFile(file, {
        language,
        onProgress: setGrabProgress,
      });
      setGrabProgress({ stage: "loading" });
      const { storageId, fileName } = await localApi.upload(file);
      setFetchedFile({
        lines: result.lines,
        fileId: String(storageId),
        fileName,
      });
      setFetched({ videoId: videoId ?? "audio", lines: result.lines });
      if (!title.trim()) setTitle(`YouTube video — ${videoId ?? "audio"}`);
      setFetchError(null);
    } catch (error) {
      let message: string;
      if (error instanceof Error && error.message === "UPLOAD_FAILED") {
        message = "Couldn't save the audio — try again.";
      } else if (
        error instanceof Error &&
        (error.message.startsWith("GRAB") ||
          error.message.startsWith("YTDLP"))
      ) {
        message = grabErrorMessage(error);
      } else {
        message = transcribeErrorMessage(error);
      }
      setGrabError(message);
    } finally {
      setIsGrabbing(false);
      setGrabProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add subtitles</DialogTitle>
          <DialogDescription>
            Paste a YouTube link to auto-fetch captions, upload a video or
            audio file to transcribe it, or paste an SRT — then learn with
            video and audio.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="subtitle-title">Title</Label>
            <Input
              id="subtitle-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Grand Budapest Hotel — S01E03"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subtitle-collection">Collection (optional)</Label>
            <Input
              id="subtitle-collection"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="e.g. Spanish Netflix, Work vocabulary"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["youtube", "YouTube link", Link2],
              ["upload", "Upload file", Video],
              ["paste", "Paste SRT", FileText],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  mode === key
                    ? "border-primary bg-primary/5 text-primary"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          {mode === "youtube" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="subtitle-youtube">YouTube link</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="subtitle-youtube"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subtitle-language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="subtitle-language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {videoId && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              {fetched?.videoId === videoId ? (
                <span className="flex flex-1 items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Captions className="size-3.5" />
                  Transcript ready — {fetched.lines.length} lines
                </span>
              ) : isGrabbing || grabProgress ? (
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {grabProgress
                      ? GRAB_STAGE_LABELS[grabProgress.stage]
                      : "Grabbing audio from YouTube…"}
                    {grabProgress?.stage === "downloading" &&
                      grabProgress.percent !== undefined && (
                        <span className="ml-auto tabular-nums text-foreground/70">
                          {grabProgress.percent}%
                        </span>
                      )}
                  </div>
                  {grabProgress?.stage === "downloading" && (
                    <Progress value={grabProgress.percent ?? 0} className="h-1.5" />
                  )}
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Grab the audio and transcribe it on your device.
                  </span>
                  {grabError ? (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {grabError}
                    </span>
                  ) : fetchError ? (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {fetchError.message}
                    </span>
                  ) : null}
                  {grabHealth?.ok && grabHealth.ytDlp ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 w-fit cursor-pointer gap-1.5 px-2.5 text-xs"
                      onClick={() => void handleGrabAndTranscribe()}
                    >
                      <Download className="size-3.5" />
                      Grab audio &amp; transcribe
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Start the grab server to enable one-click grabs.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {mode === "upload" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="upload-language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="upload-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fetchedFile ? (
                <TranscribedChip
                  result={fetchedFile}
                  onClear={() => setFetchedFile(null)}
                />
              ) : (
                <TranscribeFile
                  language={language}
                  onTranscribed={(result) => {
                    setFetchedFile(result);
                    if (!title.trim()) setTitle(result.fileName);
                  }}
                />
              )}
            </div>
          )}
          {mode === "paste" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="subtitle-text">Subtitle text</Label>
              <textarea
                id="subtitle-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Paste SRT or plain text here…\n\n00:00:01,000 --> 00:00:04,000\nHello, welcome to the show."}
                className="min-h-[160px] rounded-md border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isCreating || isGrabbing}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Captions className="size-4" />
            )}
            {isCreating ? "Creating…" : "Add subtitles"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/app/NewSubtitleDialog.tsx
git commit -m "feat: extract NewSubtitleDialog as standalone component"
```

---

### Task 2: Rebuild Dashboard with subtitle library + stats

**Files:**
- Modify: `src/pages/Dashboard.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Dashboard.tsx**

Replace the entire `src/pages/Dashboard.tsx` with this enhanced version that includes:
- Welcome header + action buttons (without "New subtitle" navigate — opens modal instead)
- Daily goal + streak (existing)
- Stat cards (existing)
- Subtitle library grid with collection filtering + "New subtitle" button
- SRS box distribution bar (from old Stats page)
- 14-day review forecast chart (from old Stats page)
- Recent words list (existing)

```tsx
import { NewSubtitleDialog } from "@/components/app/NewSubtitleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useLocalWords, useDueCount, useLocalSubtitles } from "@/hooks/use-local-data";
import { settings } from "@/lib/settings";
import { session, streak } from "@/lib/streak";
import { languageLabel } from "@/lib/tts";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Captions,
  Clapperboard,
  Flame,
  GraduationCap,
  Library,
  Play,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { localApi } from "@/lib/local-api";
import { toast } from "sonner";

const BOX_LABELS = ["New", "Learning", "Young", "Mature", "Mastered"];
const BOX_COLORS = [
  "bg-slate-400",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-primary",
];

function daysUntil(ts: number | null): number | null {
  if (ts === null) return null;
  const now = Date.now();
  return Math.ceil((ts - now) / 86_400_000);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [words, refreshWords] = useLocalWords();
  const [dueCount] = useDueCount();
  const [subtitles, refreshSubtitles] = useLocalSubtitles();
  const navigate = useNavigate();
  const [newSubOpen, setNewSubOpen] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);

  const goal = settings.get().dailyGoal;
  const reviewedToday = streak.reviewedToday();
  const currentStreak = streak.current();
  const bestStreak = streak.best();
  const last14 = useMemo(() => streak.lastDays(14), [words, reviewedToday]);
  const lastSession = useMemo(() => session.last(), [words, reviewedToday]);

  const mastered = (words ?? []).filter((w) => w.cardBox >= 3).length;
  const goalPct = Math.min(100, Math.round((reviewedToday / goal) * 100));

  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const s of subtitles ?? []) {
      if (s.collection) set.add(s.collection);
    }
    return [...set].sort();
  }, [subtitles]);

  const filteredSubs = useMemo(() => {
    const list = subtitles ?? [];
    if (!collectionFilter) return list;
    return list.filter((s) => s.collection === collectionFilter);
  }, [subtitles, collectionFilter]);

  const recent = (words ?? []).slice(0, 5);

  const srsStats = useMemo(() => {
    const list = words ?? [];
    const total = list.length;
    const byBox = [0, 0, 0, 0, 0];
    const dueByDay: number[] = new Array(14).fill(0);
    for (const w of list) {
      const box = Math.max(0, Math.min(4, w.cardBox));
      byBox[box]++;
      const d = daysUntil(w.cardDueAt);
      if (d !== null && d >= 0 && d < 14) dueByDay[d]++;
    }
    return { total, byBox, dueByDay };
  }, [words]);

  const handleDeleteSub = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await localApi.subtitles.remove(id);
    await refreshSubtitles();
    toast.success("Subtitle deleted");
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Your vocabulary studio
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Learn from subtitles, save words, and practice automatically generated
          cards — entirely on this computer.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button type="button" className="cursor-pointer gap-2" onClick={() => setNewSubOpen(true)}>
          <Plus className="size-4" /> New subtitle
        </Button>
        <Button type="button" variant="outline" className="cursor-pointer gap-2" onClick={() => navigate("/practice")}>
          <GraduationCap className="size-4" /> Start reviewing
        </Button>
        <Button type="button" variant="outline" className="cursor-pointer gap-2" onClick={() => navigate("/words")}>
          <Library className="size-4" /> My words
        </Button>
      </div>

      {/* Daily goal + streak */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-5 text-primary" /> Daily goal
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {reviewedToday} / {goal} reviewed
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {goalPct >= 100
                ? "Goal reached — nice work today!"
                : `${goal - reviewedToday} more cards to hit your daily goal.`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="size-5 text-orange-500" /> Streak
            </CardTitle>
            {lastSession && lastSession.reviewed > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Last session {lastSession.accuracy}%
              </span>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{currentStreak}</p>
            <p className="text-sm text-muted-foreground">
              day streak · best {bestStreak}
            </p>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {last14.map((n, i) => {
                const max = Math.max(1, ...last14);
                const intensity = n === 0 ? 0 : 0.25 + (n / max) * 0.75;
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="h-7 w-full rounded-md"
                      style={{
                        backgroundColor:
                          n === 0
                            ? "var(--muted)"
                            : `color-mix(in oklch, var(--primary) ${Math.round(intensity * 100)}%, transparent)`,
                      }}
                      title={`${n} reviewed`}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {i === 0 ? "now" : i === 7 ? "1w" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Library className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{words?.length ?? 0}</p>
          <p className="text-sm text-muted-foreground">Words saved</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <GraduationCap className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{dueCount ?? 0}</p>
          <p className="text-sm text-muted-foreground">Cards due</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{mastered}</p>
          <p className="text-sm text-muted-foreground">Mastered</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Captions className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{subtitles?.length ?? 0}</p>
          <p className="text-sm text-muted-foreground">Subtitles</p>
        </div>
      </div>

      {/* Subtitle library */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Your subtitles</h2>
          <Button type="button" size="sm" className="cursor-pointer gap-1.5" onClick={() => setNewSubOpen(true)}>
            <Plus className="size-3.5" /> New
          </Button>
        </div>
        {collections.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCollectionFilter(null)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                !collectionFilter
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              All
            </button>
            {collections.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCollectionFilter(c)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  collectionFilter === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {filteredSubs.length === 0 ? (
          <Empty className="rounded-2xl border bg-card/40">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Captions className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No subtitles yet</EmptyTitle>
              <EmptyDescription>
                Add a YouTube link, upload a video, or paste an SRT to get started.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" className="cursor-pointer gap-2" onClick={() => setNewSubOpen(true)}>
                <Plus className="size-4" /> Add subtitles
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSubs.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => navigate(`/watch/${s._id}`)}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {s.videoId ? (
                  <img src={`https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                ) : s.fileId ? (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted/60"><Video className="size-6 text-muted-foreground" /></span>
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted/60"><Clapperboard className="size-6 text-muted-foreground" /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {s.lines.length} lines · {languageLabel(s.language)}
                    {s.collection && <><span className="text-border">·</span>{s.collection}</>}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${s.title}`}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteSub(s._id, s.title);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SRS distribution */}
      {srsStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" /> Card maturity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {srsStats.byBox.map((count, i) => (
                <div
                  key={i}
                  className={`${BOX_COLORS[i]} h-full`}
                  style={{ width: `${srsStats.total ? (count / srsStats.total) * 100 : 0}%` }}
                  title={`${BOX_LABELS[i]}: ${count}`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {BOX_LABELS.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 p-3">
                  <span className={`size-2.5 rounded-full ${BOX_COLORS[i]}`} />
                  <span className="text-lg font-semibold">{srsStats.byBox[i]}</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 14-day forecast */}
      {srsStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" /> Reviews due (next 14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {srsStats.dueByDay.map((n, i) => {
                const max = Math.max(1, ...srsStats.dueByDay);
                const h = Math.max(6, Math.round((n / max) * 110));
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{n || ""}</span>
                    <div
                      className="w-full rounded-t-md bg-primary/70"
                      style={{ height: h }}
                      title={`Day +${i}: ${n} due`}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {i === 0 ? "now" : `+${i}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent words */}
      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Library className="size-4 text-primary" /> Recent words
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {recent.map((w) => (
                <li key={w._id} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="font-normal">{w.display}</Badge>
                  <span className="truncate text-muted-foreground">{w.definition || "—"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {dueCount === 0 && (words?.length ?? 0) > 0 && (
        <Empty className="rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles className="size-6" />
            </EmptyMedia>
            <EmptyTitle>All caught up</EmptyTitle>
            <EmptyDescription>
              No cards are due right now. Add a subtitle to save more words.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setNewSubOpen(true)} className="cursor-pointer gap-2">
              <Plus className="size-4" /> Add subtitles
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <NewSubtitleDialog
        open={newSubOpen}
        onOpenChange={setNewSubOpen}
        onCreated={() => { void refreshSubtitles(); void refreshWords(); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: rebuild Dashboard with subtitle library, stats, and creation modal"
```

---

### Task 3: Update routes and navigation

**Files:**
- Modify: `src/main.tsx` (update routes)
- Modify: `src/components/app/AppShell.tsx` (update nav items)

- [ ] **Step 1: Update main.tsx routes**

In `src/main.tsx`, make these changes:

1. Add `import { Navigate } from "react-router";` to the imports
2. Remove the lazy imports for `Landing`, `Subtitles`, and `Stats`
3. Remove their routes
4. Add a redirect from `/` to `/dashboard`

The final Routes section should be:

```tsx
<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<LocalRoute><Dashboard /></LocalRoute>} />
  <Route path="/words" element={<LocalRoute><Words /></LocalRoute>} />
  <Route path="/practice" element={<LocalRoute><Practice /></LocalRoute>} />
  <Route path="/watch/:subtitleId" element={<LocalRoute><Watch /></LocalRoute>} />
  <Route path="/settings" element={<LocalRoute><Settings /></LocalRoute>} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

- [ ] **Step 2: Update AppShell navigation**

In `src/components/app/AppShell.tsx`, update the `NAV_ITEMS` array to remove Subtitles and Stats:

```typescript
const NAV_ITEMS=[
  {to:"/dashboard",label:"Dashboard",icon:LayoutDashboard},
  {to:"/words",label:"Words",icon:Library},
  {to:"/practice",label:"Practice",icon:GraduationCap},
  {to:"/settings",label:"Settings",icon:SettingsIcon}
];
```

Also remove the `BarChart3` and `Captions` imports from lucide-react if they're no longer used.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/components/app/AppShell.tsx
git commit -m "feat: update routes and navigation for 5-page app"
```

---

### Task 4: Update cross-page references

**Files:**
- Modify: `src/pages/Watch.tsx` (back button)
- Modify: `src/pages/Practice.tsx` (empty state links)
- Modify: `src/pages/Words.tsx` (empty state links)

- [ ] **Step 1: Update Watch back button**

In `src/pages/Watch.tsx`, find the back button that navigates to `/subtitles`. Change it to navigate to `/dashboard`:

Find: `onClick={() => navigate("/subtitles")}`
Replace with: `onClick={() => navigate("/dashboard")}`

- [ ] **Step 2: Update Practice empty state**

In `src/pages/Practice.tsx`, find any link to `/subtitles`. Change it to `/dashboard`.

- [ ] **Step 3: Update Words empty state**

In `src/pages/Words.tsx`, find any link to `/subtitles`. Change it to `/dashboard`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/Watch.tsx src/pages/Practice.tsx src/pages/Words.tsx
git commit -m "feat: update cross-page references to use /dashboard"
```

---

### Task 5: Delete dead code

**Files:**
- Delete: `src/pages/Landing.tsx`
- Delete: `src/pages/Stats.tsx`
- Delete: `src/pages/Subtitles.tsx`
- Delete: `src/pages/Auth.tsx`
- Delete: `src/components/RequireAuth.tsx`
- Delete: `src/components/LogoDropdown.tsx`

- [ ] **Step 1: Delete files**

```bash
rm src/pages/Landing.tsx src/pages/Stats.tsx src/pages/Subtitles.tsx src/pages/Auth.tsx src/components/RequireAuth.tsx src/components/LogoDropdown.tsx
```

- [ ] **Step 2: Verify no remaining imports reference deleted files**

Run: `npx tsc -b --noEmit`
Expected: No errors (if there are errors, they reference deleted files — remove those imports)

- [ ] **Step 3: Verify no remaining route references**

Run: `grep -r "/subtitles\|/stats\|/auth" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".d.ts"`
Expected: No matches (except possibly comments)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove Landing, Stats, Subtitles, Auth pages and dead components"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 2: Verify navigation flow**

Check that:
1. `/` redirects to `/dashboard`
2. Dashboard shows subtitle grid, stats, creation modal
3. Sidebar shows only: Dashboard, Words, Practice, Settings
4. Watch back button goes to `/dashboard`
5. Practice/Words empty states link to `/dashboard`

- [ ] **Step 3: Final commit if needed**

```bash
git add -A && git commit -m "feat: app simplification — 5 focused pages" --allow-empty
```

---

## Summary

| Task | What it builds | Files touched |
|------|---------------|---------------|
| 1 | NewSubtitleDialog component | New file |
| 2 | Dashboard with subtitle library + stats | Dashboard.tsx |
| 3 | Routes + navigation | main.tsx, AppShell.tsx |
| 4 | Cross-page references | Watch.tsx, Practice.tsx, Words.tsx |
| 5 | Delete dead code | 6 files deleted |
| 6 | Verification | — |
