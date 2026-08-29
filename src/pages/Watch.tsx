import { FilePlayer } from "@/components/app/FilePlayer";
import { SpeakerButton } from "@/components/app/SpeakerButton";
import {
  TranscribeFile,
  type TranscribedFile,
} from "@/components/app/TranscribeFile";
import { TranscriptLine } from "@/components/app/TranscriptLine";
import { WordTooltip } from "@/components/app/WordTooltip";
import { saveWord } from "@/lib/study";
import { translateLine } from "@/lib/translate";
import { Languages } from "lucide-react";
import { WordDialog, type WordSelection } from "@/components/app/WordDialog";
import { YouTubePlayer } from "@/components/app/YouTubePlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localApi, type LocalSubtitle } from "@/lib/local-api";
import { settings } from "@/lib/settings";
import { tokenize } from "@/lib/subtitles";
import {
  transcribeErrorMessage,
  transcribeFile,
  type TranscribeProgress,
} from "@/lib/transcribe";
import { LANGUAGES, languageLabel, speak } from "@/lib/tts";
import { cn } from "@/lib/utils";
import type { PlayerHandle } from "@/lib/player";
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
  ArrowLeft,
  Captions,
  CaptionsOff,
  Clapperboard,
  Copy,
  Download,
  Link2,
  Loader2,
  Play,
  RotateCcw,
  Focus,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const GRAB_STAGE_LABELS: Record<TranscribeProgress["stage"], string> = {
  decoding: "Reading audio…",
  downloading: "Downloading speech model…",
  loading: "Preparing…",
  transcribing: "Transcribing… (this can take a moment)",
};

export default function Watch() {
  const { subtitleId } = useParams<{ subtitleId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!subtitleId) {
      navigate("/subtitles", { replace: true });
    }
  }, [subtitleId, navigate]);

  if (!subtitleId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <WatchContent id={subtitleId} />;
}

function WatchContent({ id }: { id: string }) {
  const navigate = useNavigate();
  const [subtitle, setSubtitle] = useState<LocalSubtitle | null | undefined>();
  const [savedWords, setSavedWords] = useState<Awaited<ReturnType<typeof localApi.words.list>>>();
  useEffect(() => { void Promise.all([localApi.subtitles.get(id), localApi.words.list()]).then(([s,w]) => { setSubtitle(s); setSavedWords(w); }).catch(() => setSubtitle(null)); }, [id]);

  const playerRef = useRef<PlayerHandle | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const [time, setTime] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [translatedLine, setTranslatedLine] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(
    settings.get().autoTranslateCaptions,
  );
  const [wordDialogOpen, setWordDialogOpen] = useState(false);
  const [selection, setSelection] = useState<WordSelection | null>(null);

  // Attach-video form (shown when the subtitle has no media yet)
  const [attachMode, setAttachMode] = useState<"youtube" | "file">(
    "youtube",
  );
  const [attachUrl, setAttachUrl] = useState("");
  const [attachLang, setAttachLang] = useState("en-US");
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachErrorCode, setAttachErrorCode] = useState<string | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabHealth, setGrabHealth] = useState<GrabHealth | null>(null);
  const [grabProgress, setGrabProgress] = useState<TranscribeProgress | null>(
    null,
  );

  const savedByWord = useMemo(() => {
    const map = new Map<string, NonNullable<typeof savedWords>[number]>();
    for (const entry of savedWords ?? []) {
      if (!map.has(entry.word)) map.set(entry.word, entry);
    }
    return map;
  }, [savedWords]);

  const hasTimestamps = (subtitle?.lines ?? []).some(
    (l) => l.start !== undefined,
  );

  const fileUrl = subtitle?.fileUrl;
  const hasMedia = Boolean(subtitle?.videoId || (subtitle?.fileId && fileUrl));

  // The active line while the video plays (null for plain-text subtitles).
  const activeRow = useMemo(() => {
    if (!hasTimestamps) return null;
    const lines = subtitle?.lines ?? [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.start !== undefined && time >= line.start) {
        if (line.end === undefined || time < line.end) {
          return i;
        }
      }
    }
    // Before the first timestamp: show the first line.
    if (lines.length > 0 && time < (lines[0].start ?? 0)) {
      return 0;
    }
    return null;
  }, [time, subtitle, hasTimestamps]);

  const activeLine =
    activeRow !== null ? subtitle?.lines[activeRow] : undefined;

  // 0..1 elapsed fraction of the active line.
  const activeProgress = useMemo(() => {
    if (activeRow === null) return undefined;
    const line = subtitle?.lines[activeRow];
    if (!line || line.start === undefined || line.end === undefined) {
      return undefined;
    }
    const span = line.end - line.start;
    if (span <= 0) return undefined;
    return Math.min(1, Math.max(0, (time - line.start) / span));
  }, [activeRow, subtitle, time]);

  // Scroll the transcript container (not the page) to the active line.
  useEffect(() => {
    if (activeRow === null) return;
    const container = transcriptRef.current;
    const el = container?.querySelector(`[data-line="${activeRow}"]`);
    if (container && el instanceof HTMLElement) {
      const top =
        el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [activeRow]);

  // Auto-translate the active caption line when the in-line translation is on.
  useEffect(() => {
    if (!showTranslation || !activeLine) return;
    if (!settings.get().translationEndpoint) return;
    setIsTranslating(true);
    translateLine(activeLine.text, settings.get().nativeLanguage.slice(0, 2)).then(
      (r) => {
        if (r.ok && r.text) setTranslatedLine(r.text);
        else setTranslatedLine(null);
      },
    ).finally(() => setIsTranslating(false));
  }, [showTranslation, activeRow, activeLine, subtitle?.language]);
  useEffect(() => {
    if (playerRef.current?.setPlaybackRate) {
      try { playerRef.current.setPlaybackRate(playbackRate); } catch { /* ignore */ }
    }
  }, [playbackRate, playerReady]);

  // When auto-pause is enabled, pause at the end of the active caption line.
  const autoPausePerLine = settings.get().autoPausePerLine;
  useEffect(() => {
    if (!autoPausePerLine || !playerReady || activeRow === null) return;
    const line = subtitle?.lines[activeRow];
    if (!line || line.end === undefined) return;
    const poll = window.setInterval(() => {
      const t = playerRef.current?.getCurrentTime() ?? 0;
      if (t >= line.end! - 0.05) {
        playerRef.current?.pauseVideo();
        window.clearInterval(poll);
      }
    }, 200);
    return () => window.clearInterval(poll);
  }, [autoPausePerLine, playerReady, activeRow, subtitle]);

  // Resume where the user left off, once the player is ready.
  useEffect(() => {
    if (!playerReady || !playerRef.current || restoredRef.current) return;
    restoredRef.current = true;
    const pos = subtitle?.lastPosition;
    if (pos !== undefined && pos > 5) {
      playerRef.current.seekTo(pos, true);
    }
  }, [playerReady, subtitle?.lastPosition]);

  // Persist the playback position while watching.
  const savePosition = () => {
    if (!subtitle || !playerRef.current) return;
    void localApi.subtitles.update(subtitle._id, { lastPosition: Math.round(playerRef.current.getCurrentTime()) });
  };
  useEffect(() => {
    if (!subtitle || !playerReady) return;
    const timer = setInterval(savePosition, 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitle, playerReady]);
  useEffect(() => {
    return () => {
      if (subtitle && playerRef.current) {
        void localApi.subtitles.update(subtitle._id, {
          lastPosition: Math.round(playerRef.current.getCurrentTime()),
        });
      }
    };
  }, [subtitle]);

  const openWord = (tokenWord: string, raw: string, lineText: string) => {
    if (!subtitle) return;
    setSelection({
      word: tokenWord,
      display: raw,
      example: lineText,
      sourceTitle: subtitle.title,
      language: subtitle.language,
    });
    setWordDialogOpen(true);
  };

  const seekToLine = (row: number) => {
    const line = subtitle?.lines[row];
    if (line?.start !== undefined && playerRef.current) {
      playerRef.current.seekTo(line.start, true);
      playerRef.current.playVideo();
    }
  };

  const replayLine = () => {
    const line =
      activeRow !== null ? subtitle?.lines[activeRow] : undefined;
    if (line?.start !== undefined && playerRef.current) {
      playerRef.current.seekTo(line.start, true);
      playerRef.current.playVideo();
    }
  };

  // Keyboard shortcuts: Space play/pause, ←/→ seek, S speak, C captions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const player = playerRef.current;
      if (!player) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (playing) player.pauseVideo();
          else player.playVideo();
          break;
        case "ArrowRight":
          e.preventDefault();
          player.seekTo(player.getCurrentTime() + 5, true);
          break;
        case "ArrowLeft":
          e.preventDefault();
          player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
          break;
        case "s":
        case "S":
          if (activeLine) speak(activeLine.text, subtitle?.language);
          break;
        case "c":
        case "C":
          setShowCaptions((v) => !v);
          break;
        case "f":
        case "F":
          setFocusMode((v) => !v);
          break;
        case "Escape":
          if (focusMode) setFocusMode(false);
          break;
        case "?":
          setHelpOpen((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, activeLine, subtitle?.language]);

  // When YouTube blocks server caption fetching, detect the local grab
  // companion so we can offer a one-click "grab audio & transcribe".
  useEffect(() => {
    if (attachErrorCode !== "GRAB_FAILED") {
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
    // Re-check so the button appears as soon as the user starts the local
    // grabber — no need to hit "Try again".
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [attachErrorCode]);

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
    try {
      const file = await grabYouTubeAudioStream(attachUrl, setGrabProgress);
      setGrabProgress({ stage: "decoding" });
      const result = await transcribeFile(file, { language: attachLang, onProgress: setGrabProgress });
      const { storageId } = await localApi.upload(file);
      await localApi.subtitles.update(subtitle._id, { videoId, fileId: storageId, fileName: file.name, language: attachLang, lines: result.lines });
      setAttachUrl("");
      toast.success(`Audio downloaded and transcribed (${result.lines.length} lines) — enjoy!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      setAttachErrorCode("GRAB_FAILED");
      setAttachError(grabErrorMessage(error));
    } finally {
      setIsAttaching(false);
    }
  };

  const handleGrabAndTranscribe = async () => {
    if (!subtitle || !attachUrl.trim()) return;
    setAttachError(null);
    setAttachErrorCode(null);
    setIsGrabbing(true);
    try {
      const file = await grabYouTubeAudioStream(attachUrl, setGrabProgress);
      const result = await transcribeFile(file, {
        language: attachLang,
        onProgress: setGrabProgress,
      });

      setGrabProgress({ stage: "loading" });
      const { storageId } = await localApi.upload(file);
      await localApi.subtitles.update(subtitle._id, { fileId: storageId, language: attachLang, lines: result.lines, fileName: file.name });
      setAttachUrl("");
      toast.success(
        `Transcribed ${result.lines.length} lines — tap any word to save it`,
      );
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
      setAttachError(message);
      setAttachErrorCode("GRAB_FAILED");
    } finally {
      setIsGrabbing(false);
      setGrabProgress(null);
    }
  };

  const handleFileAttached = async (result: TranscribedFile) => {
    if (!subtitle) return;
    setIsAttaching(true);
    try {
      await localApi.subtitles.update(subtitle._id, { fileId: result.fileId, language: attachLang, lines: result.lines });
      toast.success(
        `Transcribed ${result.lines.length} lines — tap any word to save it`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Couldn't save the transcription — try again.");
    } finally {
      setIsAttaching(false);
    }
  };

  const wordsSavedHere =
    savedWords?.filter((w) => w.sourceTitle === subtitle?.title).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {!focusMode && (
      <header className="flex flex-col gap-4">
        <Button
          type="button"
          variant="ghost"
          className="w-fit cursor-pointer gap-2 pl-0 text-muted-foreground"
          onClick={() => navigate("/subtitles")}
        >
          <ArrowLeft className="size-4" />
          Subtitles
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {subtitle?.title ?? "Watch"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Clapperboard className="size-3" />
                {subtitle?.videoId
                  ? "Video synced"
                  : subtitle?.fileId
                    ? "Transcribed video"
                    : "No video yet"}
              </Badge>
              <Badge variant="outline">
                {languageLabel(subtitle?.language)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {subtitle?.lines.length ?? 0} lines · {wordsSavedHere} saved
                here
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer gap-2"
            onClick={() => navigate("/practice")}
          >
            <Captions className="size-4" />
            Practice cards
          </Button>
        </div>
      </header>
      )}

      {subtitle === undefined ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : subtitle === null ? (
        <Empty className="min-h-[400px] rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyTitle>Subtitle not found</EmptyTitle>
            <EmptyDescription>
              It may have been deleted, or you don't have access to it.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              onClick={() => navigate("/subtitles")}
              className="cursor-pointer"
            >
              Back to subtitles
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className={focusMode ? "mx-auto flex w-full max-w-5xl flex-col gap-3" : "flex flex-col gap-6"}>
          {/* Video + captions + controls */}
          <section className="flex min-w-0 flex-col gap-4">
            {hasMedia ? (
              <>
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-lg">
                  {subtitle.videoId ? (
                    <YouTubePlayer
                      videoId={subtitle.videoId}
                      playerRef={playerRef}
                      onReady={() => setPlayerReady(true)}
                      onTime={setTime}
                      onPlayStateChange={setPlaying}
                      className="h-full w-full"
                    />
                  ) : (
                    <FilePlayer
                      src={fileUrl ?? ""}
                      playerRef={playerRef}
                      onReady={() => setPlayerReady(true)}
                      onTime={setTime}
                      onPlayStateChange={setPlaying}
                      className="h-full w-full"
                    />
                  )}
                  {!playerReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <Loader2 className="size-5 animate-spin text-white/60" />
                    </div>
                  )}

                  {/* Netflix-style overlay captions */}
                  {showCaptions && activeLine && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
                      <div className="pointer-events-auto max-w-[92%] rounded-xl bg-black/70 px-4 py-2.5 shadow-lg backdrop-blur-sm">
                        <div className="flex items-start gap-2">
                          <p className="text-lg font-medium leading-7 text-white">
                            {tokenize(activeLine.text).map((token, i) =>
                              token.word ? (
                                <WordTooltip
                                  key={i}
                                  word={token.word}
                                  display={token.text}
                                  example={activeLine.text}
                                  lang={subtitle.language}
                                  saved={savedByWord.has(token.word)}
                                  onSave={() =>
                                    void saveWord({
                                      word: token.word,
                                      display: token.text,
                                      example: activeLine.text,
                                      sourceTitle: subtitle.title,
                                      language: subtitle.language,
                                    })
                                  }
                                  onOpenDialog={() =>
                                    openWord(token.word, token.text, activeLine.text)
                                  }
                                  className={savedByWord.has(token.word) ? "font-semibold" : ""}
                                >
                                  <span className="mx-[1px] text-white">{token.text}</span>
                                </WordTooltip>
                              ) : (
                                <span key={i} className="text-white">{token.text}</span>
                              ),
                            )}
                          </p>
                          <SpeakerButton
                            text={activeLine.text}
                            lang={subtitle.language}
                            label="Pronounce current line"
                            className="shrink-0 text-white hover:bg-white/20 hover:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (showTranslation && translatedLine) {
                                setShowTranslation(false);
                                setTranslatedLine(null);
                              } else {
                                setShowTranslation(true);
                              }
                            }}
                            className={`flex size-8 shrink-0 items-center justify-center rounded-md ${showTranslation ? "bg-white/25 text-white" : "text-white hover:bg-white/20"}`}
                            aria-label="Toggle translation"
                            aria-pressed={showTranslation}
                          >
                            {isTranslating ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
                          </button>
                        </div>
                        {showTranslation && translatedLine && (
                          <p className="mt-1.5 text-sm italic text-white/80">{translatedLine}</p>
                        )}
                        {activeProgress !== undefined && (
                          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                            <div
                              className="h-full rounded-full bg-teal-400"
                              style={{
                                width: `${Math.round(activeProgress * 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Control bar */}
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-sm">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer gap-2"
                    onClick={() => setShowCaptions((v) => !v)}
                  >
                    {showCaptions ? (
                      <CaptionsOff className="size-4" />
                    ) : (
                      <Captions className="size-4" />
                    )}
                    {showCaptions ? "Hide captions" : "Show captions"}
                  </Button>
                  <Button
                    type="button"
                    variant={showTranslation ? "secondary" : "outline"}
                    size="sm"
                    className="cursor-pointer gap-2"
                    onClick={() => setShowTranslation((v) => !v)}
                    aria-pressed={showTranslation}
                  >
                    <Languages className="size-4" />
                    {showTranslation ? "Translation on" : "Translate"}
                  </Button>
                  {hasTimestamps && activeLine && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer gap-2"
                      onClick={replayLine}
                    >
                      <RotateCcw className="size-4" />
                      Replay line
                    </Button>
                  )}
                  {hasTimestamps && activeLine && (
                    <SpeakerButton
                      text={activeLine.text}
                      lang={subtitle.language}
                      label="Pronounce current line"
                    />
                  )}
                  <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-0.5">
                    {[0.75, 1, 1.25, 1.5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setPlaybackRate(r)}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${playbackRate === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {r}×</button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer gap-2"
                    onClick={() => setFocusMode((v) => !v)}
                  >
                    <Focus className="size-4" />
                    {focusMode ? "Exit focus" : "Focus"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer gap-2"
                    onClick={() => setHelpOpen(true)}
                    aria-label="Keyboard shortcuts"
                  >
                    <HelpCircle className="size-4" />
                    <span className="hidden sm:inline">Shortcuts</span>
                  </Button>
                  <span className="ml-auto hidden text-[11px] text-muted-foreground md:block">
                    Space play/pause · ← → seek · S speak · C captions · F focus
                  </span>
                </div>
              </>
            ) : (
              /* No video yet — paste a link or upload a file */
              <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Link2 className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold tracking-tight">
                      Watch this with a video
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Paste a YouTube link to auto-fetch captions, or upload a
                      video/audio file to transcribe it automatically.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Select value={attachLang} onValueChange={setAttachLang}>
                    <SelectTrigger className="w-full sm:w-44">
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
                  <div className="flex gap-1 rounded-lg bg-muted/70 p-1">
                    <button
                      type="button"
                      onClick={() => setAttachMode("youtube")}
                      className={cn(
                        "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        attachMode === "youtube"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      YouTube link
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachMode("file")}
                      className={cn(
                        "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        attachMode === "file"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Upload &amp; transcribe
                    </button>
                  </div>
                </div>

                {attachMode === "youtube" ? (
                  <>
                    <Input
                      value={attachUrl}
                      onChange={(e) => {
                        setAttachUrl(e.target.value);
                        setAttachError(null);
                        setAttachErrorCode(null);
                      }}
                      placeholder="https://www.youtube.com/watch?v=…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAttachVideo();
                      }}
                    />
                    {attachError && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {attachError}
                        </p>
                        {attachErrorCode === "GRAB_FAILED" &&
                          (isGrabbing || grabProgress ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Loader2 className="size-3 animate-spin" />
                                {grabProgress
                                  ? GRAB_STAGE_LABELS[grabProgress.stage]
                                  : "Downloading audio and generating subtitles…"}
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
                          ) : grabHealth?.ok && grabHealth.ytDlp ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 w-fit cursor-pointer gap-1.5 px-2.5 text-xs"
                              onClick={() => void handleGrabAndTranscribe()}
                            >
                              <Download className="size-3.5" />
                              Retry download &amp; transcribe automatically
                            </Button>
                          ) : grabHealth?.ok && !grabHealth.ytDlp ? (
                            <span className="text-[11px] text-muted-foreground">
                              Grab server found, but yt-dlp isn't installed.
                              Run{" "}
                              <code className="rounded bg-muted px-1">
                                brew install yt-dlp
                              </code>{" "}
                              then refresh.
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Start the local server with{" "}
                              <code className="rounded bg-muted px-1">
                                bun run grab
                              </code>{" "}
                              locally. Then retry — Motus will download the audio and generate the SRT automatically.
                            </span>
                          ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-fit cursor-pointer gap-1.5 px-2 text-[11px]"
                          onClick={() => {
                            void copyToClipboard(
                              ytDlpAudioCommand(attachUrl),
                            ).then((ok) => {
                              toast.success(
                                ok
                                  ? "Command copied — paste it in a terminal to grab the audio"
                                  : "Couldn't copy automatically — select the command manually",
                              );
                            });
                          }}
                        >
                          <Copy className="size-3" />
                          Copy yt-dlp command
                        </Button>
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={() => void handleAttachVideo()}
                      disabled={isAttaching || !attachUrl.trim()}
                      className="cursor-pointer gap-2 self-start"
                    >
                      {isAttaching ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4 fill-current" />
                      )}
                      {isAttaching
                        ? "Generating captions…"
                        : "Attach video & generate captions"}
                    </Button>
                  </>
                ) : (
                  <TranscribeFile
                    language={attachLang}
                    onTranscribed={handleFileAttached}
                  />
                )}
              </div>
            )}

            {/* Plain-text hint */}
            {subtitle.videoId && !hasTimestamps && (
              <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
                This subtitle has no timestamps, so captions can't sync to the
                video. You can still tap words and listen to lines.
              </div>
            )}
          </section>

          {/* Transcript — docked at the bottom, always available (collapsible). */}
          <section className="min-w-0">
            <div className="flex items-center justify-between px-2 pb-2">
              <button
                type="button"
                onClick={() => setTranscriptOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown className={cn("size-4 transition-transform", !transcriptOpen && "-rotate-90")} />
                Transcript
              </button>
              {hasTimestamps && (
                <p className="text-xs text-muted-foreground">
                  Tap a line to jump the video
                </p>
              )}
            </div>
            {transcriptOpen && (
            <div
              ref={transcriptRef}
              className={cn("relative space-y-1 overflow-y-auto rounded-2xl border bg-card p-3 shadow-sm", focusMode ? "max-h-[32vh]" : "max-h-[45vh]")}
            >
              {subtitle.lines.map((line, i) => (
                <TranscriptLine
                  key={`${line.index}-${i}`}
                  text={line.text}
                  rowId={i}
                  lineIndex={line.index}
                  time={
                    line.start !== undefined
                      ? formatClockCompact(line.start)
                      : undefined
                  }
                  lang={subtitle.language}
                  isActive={activeRow === i}
                  progress={activeRow === i ? activeProgress : undefined}
                  savedWords={new Set(savedByWord.keys())}
                  onWordClick={openWord}
                  onLineClick={
                    hasTimestamps && line.start !== undefined
                      ? () => seekToLine(i)
                      : undefined
                  }
                />
              ))}
            </div>
            )}
          </section>
        </div>
      )}

      <WordDialog
        open={wordDialogOpen}
        onOpenChange={setWordDialogOpen}
        selection={selection}
        existing={
          selection ? (savedByWord.get(selection.word) ?? null) : null
        }
      />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" /> Keyboard shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {[
              ["Space", "Play / pause"],
              ["← / →", "Seek back / forward 5s"],
              ["S", "Speak the current line"],
              ["C", "Show / hide captions"],
              ["F", "Toggle focus mode"],
              ["?", "Show this help"],
              ["Esc", "Exit focus mode / close"],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                <kbd className="rounded-md border bg-background px-2 py-0.5 font-mono text-xs">{k}</kbd>
                <span className="text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatClockCompact(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
