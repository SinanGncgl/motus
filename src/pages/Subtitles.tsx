import {
  TranscribeFile,
  TranscribedChip,
  type TranscribedFile,
} from "@/components/app/TranscribeFile";
import { TranscriptLine } from "@/components/app/TranscriptLine";
import { WordDialog, type WordSelection } from "@/components/app/WordDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { Textarea } from "@/components/ui/textarea";
import { useLocalSubtitles, useLocalWords } from "@/hooks/use-local-data";
import { localApi } from "@/lib/local-api";
import { parseSubtitleText, type SubtitleLine } from "@/lib/subtitles";
import {
  transcribeErrorMessage,
  transcribeFile,
  type TranscribeProgress,
} from "@/lib/transcribe";
import { LANGUAGES, languageLabel } from "@/lib/tts";
import { cn } from "@/lib/utils";
import {
  copyToClipboard,
  detectLocalGrabber,
  extractYouTubeId,
  grabErrorMessage,
  grabYouTubeAudio,
  grabYouTubeAudioStream,
  type GrabHealth,
  ytDlpAudioCommand,
} from "@/lib/youtube";
import {
  Captions,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Play,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const GRAB_STAGE_LABELS: Record<TranscribeProgress["stage"], string> = {
  decoding: "Reading audio…",
  downloading: "Downloading speech model…",
  loading: "Preparing…",
  transcribing: "Transcribing… (this can take a moment)",
};

export default function Subtitles() {
  const [subtitles, refreshSubtitles] = useLocalSubtitles();
  const [savedWords, refreshWords] = useLocalWords();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"youtube" | "upload" | "paste">("youtube");
  const [editOpen, setEditOpen] = useState(false);
  const [wordDialogOpen, setWordDialogOpen] = useState(false);
  const [selection, setSelection] = useState<WordSelection | null>(null);

  // Create form
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [rawText, setRawText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [collection, setCollection] = useState("");

  // Attach-video form
  const [editUrl, setEditUrl] = useState("");
  const [editLanguage, setEditLanguage] = useState("en-US");
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  // On-device transcription of an uploaded video/audio file
  const [fetchedFile, setFetchedFile] = useState<TranscribedFile | null>(null);

  // Auto-fetched captions for the pasted YouTube link
  const [fetched, setFetched] = useState<{
    videoId: string;
    lines: SubtitleLine[];
  } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [grabHealth, setGrabHealth] = useState<GrabHealth | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabError, setGrabError] = useState<string | null>(null);
  const [grabProgress, setGrabProgress] = useState<TranscribeProgress | null>(
    null,
  );

  const videoId = youtubeUrl.trim()
    ? (extractYouTubeId(youtubeUrl) ?? null)
    : null;

  // NOTE: we deliberately do NOT auto-start grabbing/transcribing when a link
  // is pasted — the user clicks "Grab audio & transcribe" so they stay in
  // control of the (heavy) on-device Whisper step.

  // Detect the local grab companion whenever a valid YouTube link is present,
  // so we can offer a one-click "Grab audio & transcribe" button. We no longer
  // auto-start the (heavy) pipeline — the user clicks the button.
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
    // Re-check so the button appears as soon as the grabber starts.
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [videoId]);

  const selected =
    subtitles?.find((s) => s._id === selectedId) ??
    subtitles?.[0] ??
    null;

  const savedByWord = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<typeof savedWords>[number]
    >();
    for (const entry of savedWords ?? []) {
      if (!map.has(entry.word)) map.set(entry.word, entry);
    }
    return map;
  }, [savedWords]);

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
        fileId: useFile ? undefined : undefined,
        language,
        collection: collection.trim() || undefined,
      });
      await refreshSubtitles();
      setDialogOpen(false);
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
        setSelectedId(created._id);
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

      // Upload the grabbed audio so the Watch page can play it back.
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

  const openEdit = () => {
    if (!selected) return;
    setEditUrl(
      selected.videoId
        ? `https://www.youtube.com/watch?v=${selected.videoId}`
        : "",
    );
    setEditLanguage(selected.language ?? "en-US");
    setEditOpen(true);
  };

  const handleSaveVideo = async () => {
    if (!selected) return;
    let videoId: string | undefined;
    if (editUrl.trim()) {
      videoId = extractYouTubeId(editUrl) ?? undefined;
      if (!videoId) {
        toast.error("That doesn't look like a valid YouTube link.");
        return;
      }
    }
    setIsSavingVideo(true);
    try {
      await localApi.subtitles.update(selected._id, {
        id: selected._id,
        videoId,
        language: editLanguage,
      });
      setEditOpen(false);
      toast.success(
        videoId
          ? "Video attached — open Watch to learn with it"
          : "Video removed — subtitles still available",
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not save the video link.");
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await localApi.subtitles.remove(id); await refreshSubtitles();
      if (selectedId === id) setSelectedId(null);
      toast.success(`Deleted “${name}” — saved words are kept`);
    } catch (error) {
      console.error(error);
      toast.error("Could not delete the subtitle.");
    }
  };

  const openWord = (tokenWord: string, raw: string, lineText: string) => {
    if (!selected) return;
    setSelection({
      word: tokenWord,
      display: raw,
      example: lineText,
      sourceTitle: selected.title,
      language: selected.language,
    });
    setWordDialogOpen(true);
  };

  const wordsSavedHere =
    savedWords?.filter((w) => w.sourceTitle === selected?.title).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subtitles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your clips and transcripts. Open one, then tap any word to save it
            to your vocabulary.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="cursor-pointer gap-2"
        >
          <Plus className="size-4" />
          New subtitle
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Library */}
        <aside className="flex flex-col gap-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your library
          </p>
          {subtitles && subtitles.length > 0 && (() => {
            const collections = Array.from(new Set(subtitles.map((x) => x.collection).filter(Boolean))) as string[];
            if (collections.length === 0) return null;
            return (
              <div className="mb-3 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setCollectionFilter(null)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${collectionFilter === null ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>All</button>
                {collections.map((c) => (
                  <button key={c} type="button" onClick={() => setCollectionFilter(c)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${collectionFilter === c ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{c}</button>
                ))}
              </div>
            );
          })()}
          {subtitles === undefined ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : subtitles.length === 0 ? (
            null
          ) : (
            <div className="flex flex-col gap-2">
              {(subtitles ?? []).filter((sub) => !collectionFilter || sub.collection === collectionFilter).map((sub) => (
                <div
                  key={sub._id}
                  className={cn(
                    "group relative cursor-pointer rounded-xl border p-3 transition-colors",
                    selected?._id === sub._id
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-accent/60",
                  )}
                  onClick={() => setSelectedId(sub._id)}
                >
                  {sub.videoId ? (
                    <div className="relative mb-2 overflow-hidden rounded-lg">
                      <img
                        src={`https://i.ytimg.com/vi/${sub.videoId}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        className="h-20 w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="size-5 fill-current" />
                      </span>
                    </div>
                  ) : sub.fileId ? (
                    <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-muted/60">
                      <Video className="size-6 text-muted-foreground" />
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">
                      {sub.title}
                    </p>
                    <button
                      type="button"
                      aria-label={`Delete ${sub.title}`}
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(sub._id, sub.title);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {sub.fileId ? (
                      <Video className="size-3" />
                    ) : sub.videoId ? (
                      <Clapperboard className="size-3" />
                    ) : sub.sourceType === "srt" ? (
                      <Clock3 className="size-3" />
                    ) : (
                      <FileText className="size-3" />
                    )}
                    {sub.lines.length} lines
                    <span className="text-border">•</span>
                    {languageLabel(sub.language)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {(sub.videoId || sub.fileId) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 cursor-pointer gap-1.5 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/watch/${sub._id}`);
                        }}
                      >
                        <Play className="size-3 fill-current" />
                        Watch
                      </Button>
                    )}
                    <span
                      className="text-[11px] text-muted-foreground/70"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {new Date(sub.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Transcript */}
        <section className="min-w-0">
          {selected ? (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex flex-col gap-3 border-b bg-card/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    {selected.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selected.sourceType === "srt" ? "SRT" : "Plain text"} •{" "}
                    {selected.lines.length} lines •{" "}
                    {languageLabel(selected.language)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {wordsSavedHere} saved here
                  </Badge>
                  {selected.videoId || selected.fileId ? (
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      onClick={() => navigate(`/watch/${selected._id}`)}
                    >
                      <Play className="size-3.5 fill-current" />
                      Watch with video
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer gap-1.5"
                      onClick={openEdit}
                    >
                      <Link2 className="size-3.5" />
                      Attach video
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-[62vh] overflow-y-auto px-4 py-4 sm:px-5">
                <div className="space-y-1">
                  {selected.lines.map((line, i) => (
                    <TranscriptLine
                      key={`${line.index}-${i}`}
                      text={line.text}
                      rowId={i}
                      lineIndex={line.index}
                      time={
                        line.start !== undefined
                          ? formatSubtitleTime(line.start)
                          : undefined
                      }
                      lang={selected.language}
                      savedWords={new Set(savedByWord.keys())}
                      onWordClick={openWord}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Empty className="h-full min-h-[420px] rounded-2xl border bg-card/40">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Captions className="size-6" />
                </EmptyMedia>
                <EmptyTitle>
                  {subtitles && subtitles.length > 0 ? "No subtitle selected" : "No subtitles yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {subtitles && subtitles.length > 0
                    ? "Pick one from your library on the left to start learning."
                    : "Use “New subtitle” above to add one — paste a YouTube link, upload a video, or paste an SRT. You choose the method in the next step."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>

      {/* New subtitle dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              <p className="text-[11px] text-muted-foreground">
                Group related subtitles so you can focus your study later.
              </p>
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
                    Transcript ready — {fetched.lines.length} lines with
                    timestamps
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
                      Grab the audio and transcribe it on your device to build
                      subtitles with timestamps.
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
                        Grab audio &amp; transcribe automatically
                      </Button>
                    ) : grabHealth?.ok && !grabHealth.ytDlp ? (
                      <span className="text-[11px] text-muted-foreground">
                        Grab server found, but yt-dlp isn't installed. Run{" "}
                        <code className="rounded bg-muted px-1">brew install yt-dlp</code>.
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Start the grab server with{" "}
                        <code className="rounded bg-muted px-1">bun run grab</code>{" "}
                        to enable one-click grabs.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {videoId && fetched?.videoId === videoId && (
              <div className="rounded-lg border bg-card/60 p-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Preview — {fetched.lines.length} lines (scroll to read all)
                </p>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1 text-xs">
                  {fetched.lines.map((l, i) => (
                    <p key={i} className="flex gap-2 text-muted-foreground">
                      <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground/70">
                        {formatSubtitleTime(l.start ?? 0)}
                      </span>
                      <span className="leading-5">{l.text}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
            {mode === "upload" && (
              <>
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
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  upload a video or audio file — Whisper transcribes it
                </span>
              </div>
            </div>
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
              </>
            )}

            {mode === "paste" && (
              <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="subtitle-language-paste">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="subtitle-language-paste" className="w-full">
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="subtitle-text">Subtitle text (SRT or plain)</Label>
              <Textarea
                id="subtitle-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste SRT here…\n\n1\n00:00:01,000 --> 00:00:04,000\nHello there! How are you?\n\n2\n00:00:04,500 --> 00:00:07,000\nI'm learning new words today."
                className="max-h-[40vh] min-h-48 resize-y font-mono text-xs leading-5"
              />
            </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={isCreating}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="cursor-pointer gap-2"
            >
              {isCreating && <Loader2 className="size-4 animate-spin" />}
              {(videoId && fetched?.videoId === videoId) || fetchedFile
                ? "Save & watch"
                : "Load subtitles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach / change video dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selected?.videoId ? "Change video & language" : "Attach a video"}
            </DialogTitle>
            <DialogDescription>
              Paste a YouTube link to learn with video and audio. The
              transcript lines will sync to the video's timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-youtube">YouTube link</Label>
              <div className="relative">
                <Video className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="edit-youtube"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to remove the video.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-language">Language</Label>
              <Select value={editLanguage} onValueChange={setEditLanguage}>
                <SelectTrigger id="edit-language" className="w-full">
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
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={isSavingVideo}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveVideo}
              disabled={isSavingVideo}
              className="cursor-pointer gap-2"
            >
              {isSavingVideo && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WordDialog
        open={wordDialogOpen}
        onOpenChange={setWordDialogOpen}
        selection={selection}
        existing={
          selection ? (savedByWord.get(selection.word) ?? null) : null
        }
      />
    </div>
  );
}

function formatSubtitleTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
