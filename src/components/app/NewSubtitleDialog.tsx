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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { localApi } from "@/lib/local-api";
import { parseSubtitleText, type SubtitleLine } from "@/lib/subtitles";
import {
  transcribeErrorMessage,
  transcribeFile,
  type TranscribeModel,
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
import { toast } from "sonner";

const GRAB_STAGE_LABELS: Record<TranscribeProgress["stage"], string> = {
  decoding: "Reading audio…",
  downloading: "Downloading speech model…",
  loading: "Preparing…",
  transcribing: "Transcribing… (this can take a moment)",
};

function formatSubtitleTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface NewSubtitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function NewSubtitleDialog({
  open,
  onOpenChange,
  onCreated,
}: NewSubtitleDialogProps) {
  const [mode, setMode] = useState<"youtube" | "upload" | "paste">("youtube");
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [rawText, setRawText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [collection, setCollection] = useState("");
  const [fetchedFile, setFetchedFile] = useState<TranscribedFile | null>(null);
  const [fetched, setFetched] = useState<{
    videoId: string;
    lines: SubtitleLine[];
  } | null>(null);
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
  const [whisperModel, setWhisperModel] = useState<TranscribeModel>("best");

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
      await localApi.subtitles.create({
        title:
          title || (useFile ? fetchedFile!.fileName : "Untitled subtitles"),
        sourceType: useFetched || useFile ? "srt" : parsed.sourceType,
        lines,
        videoId: videoId ?? undefined,
        fileId: useFile ? undefined : undefined,
        language,
        collection: collection.trim() || undefined,
      });
      onOpenChange(false);
      setTitle("");
      setCollection("");
      setYoutubeUrl("");
      setRawText("");
      setFetched(null);
      setFetchedFile(null);
      setFetchError(null);
      onCreated?.();
      toast.success("Subtitles loaded successfully.");
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
        model: whisperModel,
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
      <DialogContent className="sm:max-w-2xl">
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
            <div className="flex flex-col gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="subtitle-whisper-model">Whisper model</Label>
                  <Select value={whisperModel} onValueChange={(v) => setWhisperModel(v as TranscribeModel)}>
                    <SelectTrigger id="subtitle-whisper-model" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="fast">Fast (tiny)</SelectItem>
                    <SelectItem value="accurate">Accurate (base)</SelectItem>
                    <SelectItem value="best">Best (large-v3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                    {grabProgress?.percent !== undefined && (
                      <span className="ml-auto tabular-nums text-foreground/70">
                        {grabProgress.percent}%
                      </span>
                    )}
                  </div>
                  {(grabProgress?.stage === "downloading" || grabProgress?.stage === "transcribing") && grabProgress.percent !== undefined && (
                    <Progress
                      value={grabProgress.percent}
                      className="h-1.5"
                    />
                  )}
                  {grabProgress?.note && (
                    <p className="text-[11px] text-muted-foreground truncate">{grabProgress.note}</p>
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
                      <code className="rounded bg-muted px-1">
                        brew install yt-dlp
                      </code>
                      .
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Start the grab server with{" "}
                      <code className="rounded bg-muted px-1">
                        bun run grab
                      </code>{" "}
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
                  <SelectTrigger
                    id="subtitle-language-paste"
                    className="w-full"
                  >
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
                <Label htmlFor="subtitle-text">
                  Subtitle text (SRT or plain)
                </Label>
                <Textarea
                  id="subtitle-text"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    "Paste SRT here…\n\n1\n00:00:01,000 --> 00:00:04,000\nHello there! How are you?\n\n2\n00:00:04,500 --> 00:00:07,000\nI'm learning new words today."
                  }
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
            onClick={() => onOpenChange(false)}
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
  );
}
