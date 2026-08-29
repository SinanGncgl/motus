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
import { useSavedWords } from "@/hooks/use-saved-words";
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
  BookMarked,
  Bookmark,
  Captions,
  CaptionsOff,
  ChevronDown,
  ChevronsLeft,
  Clapperboard,
  Copy,
  Download,
  Focus,
  Gauge,
  HelpCircle,
  Link2,
  Loader2,
  Maximize2,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
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

type LearnMode = "watch" | "learn" | "listen" | "practice";

const MODES: { id: LearnMode; label: string; hint: string }[] = [
  { id: "watch", label: "Watch", hint: "Video only — minimal UI" },
  { id: "learn", label: "Learn", hint: "Transcript + translation + vocabulary" },
  { id: "listen", label: "Listen", hint: "German only — train your ear" },
  { id: "practice", label: "Practice", hint: "Hide words, test recall" },
];

const SPEEDS = [0.75, 1, 1.25] as const;

const SHORTCUTS: [string, string][] = [
  ["Space / K", "Play / pause"],
  ["←", "Previous sentence"],
  ["→", "Next sentence"],
  ["Home / 0", "Jump to start of current sentence"],
  ["R", "Replay current sentence (seek + play)"],
  ["S", "Save current sentence"],
  ["T", "Show / hide translation"],
  ["C", "Show / hide captions"],
  ["F", "Focus mode (hide chrome)"],
  ["X", "Copy sentence + translation"],
  ["A / B", "Set A–B loop start / end"],
  ["L", "Cycle learning mode"],
  ["1 / 2 / 3", "0.75× / 1× / 1.25×"],
  ["?", "Toggle this help"],
  ["Esc", "Close popovers"],
];

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
  const { words: savedWords, isSaved, existing, save, remove } = useSavedWords();

  useEffect(() => {
    void localApi.subtitles
      .get(id)
      .then(setSubtitle)
      .catch(() => setSubtitle(null));
  }, [id]);

  const playerRef = useRef<PlayerHandle | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mode, setMode] = useState<LearnMode>("learn");
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  // Per-line English translations (cached). Populated lazily.
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translatingRows, setTranslatingRows] = useState<Set<number>>(
    new Set(),
  );

  const [showTranslation, setShowTranslation] = useState(
    settings.get().autoTranslateCaptions,
  );
  const [wordDialogOpen, setWordDialogOpen] = useState(false);
  const [selection, setSelection] = useState<WordSelection | null>(null);

  // A-B loop
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  // PRACTICE mode reveal state
  const [practiceHide, setPracticeHide] = useState(true);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [revealAll, setRevealAll] = useState(false);

  // Learning stats
  const [reviewedLines, setReviewedLines] = useState<Set<number>>(new Set());

  // Attach-video form
  const [attachMode, setAttachMode] = useState<"youtube" | "file">("youtube");
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
    const map = new Map<string, (typeof savedWords)[number]>();
    for (const entry of savedWords) {
      const key = (entry.word || entry.display).toLowerCase();
      if (!map.has(key)) map.set(key, entry);
    }
    return map;
  }, [savedWords]);

  const hasTimestamps = (subtitle?.lines ?? []).some(
    (l) => l.start !== undefined,
  );
  const fileUrl = subtitle?.fileUrl;
  const hasMedia = Boolean(subtitle?.videoId || (subtitle?.fileId && fileUrl));

  const activeRow = useMemo(() => {
    if (!hasTimestamps) return null;
    const lines = subtitle?.lines ?? [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.start !== undefined && time >= line.start) {
        if (line.end === undefined || time < line.end) return i;
      }
    }
    if (lines.length > 0 && time < (lines[0].start ?? 0)) return 0;
    return null;
  }, [time, subtitle, hasTimestamps]);

  const activeLine =
    activeRow !== null ? subtitle?.lines[activeRow] : undefined;

  const activeProgress = useMemo(() => {
    if (activeRow === null) return undefined;
    const line = subtitle?.lines[activeRow];
    if (!line || line.start === undefined || line.end === undefined)
      return undefined;
    const span = line.end - line.start;
    if (span <= 0) return undefined;
    return Math.min(1, Math.max(0, (time - line.start) / span));
  }, [activeRow, subtitle, time]);

  // Keep duration fresh even when paused (poll on time tick).
  useEffect(() => {
    const d = playerRef.current?.getDuration?.();
    if (d && d > 0) setDuration(d);
  }, [time]);

  // Scroll the active line smoothly into view (within the transcript).
  useEffect(() => {
    if (activeRow === null || !transcriptOpen) return;
    const container = transcriptRef.current;
    const el = container?.querySelector(`[data-line="${activeRow}"]`);
    if (container && el instanceof HTMLElement) {
      const top =
        el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [activeRow, transcriptOpen]);

  // Translate a line on demand (cached). No-op without an endpoint.
  const translateRow = (row: number) => {
    const line = subtitle?.lines[row];
    if (!line || !settings.get().translationEndpoint) return;
    if (translations[row] !== undefined || translatingRows.has(row)) return;
    setTranslatingRows((prev) => new Set(prev).add(row));
    const target = settings.get().nativeLanguage.slice(0, 2);
    translateLine(line.text, target)
      .then((r) => {
        if (r.ok && r.text) {
          setTranslations((prev) => ({ ...prev, [row]: r.text }) as Record<number, string>);
        }
      })
      .finally(() =>
        setTranslatingRows((prev) => {
          const n = new Set(prev);
          n.delete(row);
          return n;
        }),
      );
  };

  // Auto-translate the active line so the captions overlay + transcript stay useful.
  useEffect(() => {
    if (activeRow === null) return;
    translateRow(activeRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRow, subtitle?.language]);

  useEffect(() => {
    if (playerRef.current?.setPlaybackRate) {
      try {
        playerRef.current.setPlaybackRate(playbackRate);
      } catch {
        /* ignore */
      }
    }
  }, [playbackRate, playerReady]);

  // Auto-pause at the end of the active caption line.
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

  // A-B loop: jump back to A when passing B.
  useEffect(() => {
    if (loopA === null || loopB === null || !playerReady) return;
    const poll = window.setInterval(() => {
      const t = playerRef.current?.getCurrentTime() ?? 0;
      if (t >= loopB) playerRef.current?.seekTo(loopA, true);
    }, 200);
    return () => window.clearInterval(poll);
  }, [loopA, loopB, playerReady]);

  // Resume where the user left off.
  useEffect(() => {
    if (!playerReady || !playerRef.current || restoredRef.current) return;
    restoredRef.current = true;
    const pos = subtitle?.lastPosition;
    if (pos !== undefined && pos > 5) playerRef.current.seekTo(pos, true);
  }, [playerReady, subtitle?.lastPosition]);

  // Persist playback position.
  const savePosition = () => {
    if (!subtitle || !playerRef.current) return;
    void localApi.subtitles.update(subtitle._id, {
      lastPosition: Math.round(playerRef.current.getCurrentTime()),
    });
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

  const saveWordFromToken = (tokenWord: string, raw: string, lineText: string) => {
    if (!subtitle) return;
    void save({
      word: tokenWord,
      display: raw,
      example: lineText,
      sourceTitle: subtitle.title,
      language: subtitle.language,
    });
    toast.success(`Saved “${raw}”`);
  };

  const seekToLine = (row: number) => {
    const line = subtitle?.lines[row];
    if (line?.start !== undefined && playerRef.current) {
      playerRef.current.seekTo(line.start, true);
      playerRef.current.playVideo();
      setReviewedLines((prev) => new Set(prev).add(row));
    }
  };

  const goToPrevLine = () => {
    if (!hasTimestamps || activeRow === null) return;
    for (let i = activeRow - 1; i >= 0; i--) {
      if (subtitle?.lines[i]?.start !== undefined) {
        seekToLine(i);
        return;
      }
    }
    seekToLine(0);
  };

  const goToNextLine = () => {
    if (!hasTimestamps || activeRow === null) return;
    for (let i = activeRow + 1; i < (subtitle?.lines.length ?? 0); i++) {
      if (subtitle?.lines[i]?.start !== undefined) {
        seekToLine(i);
        return;
      }
    }
  };

  // Jump to the start of the current (or first) sentence WITHOUT forcing playback.
  const seekToCurrentStart = () => {
    if (!hasTimestamps) return;
    const row = activeRow ?? 0;
    const line = subtitle?.lines[row];
    if (line?.start !== undefined && playerRef.current) {
      playerRef.current.seekTo(line.start, true);
    }
  };

  const replayLine = () => {
    const line =
      activeRow !== null ? subtitle?.lines[activeRow] : undefined;
    if (line?.start !== undefined && playerRef.current) {
      playerRef.current.seekTo(line.start, true);
      playerRef.current.playVideo();
      if (activeRow !== null)
        setReviewedLines((prev) => new Set(prev).add(activeRow));
    }
  };

  const saveCurrentSentence = () => {
    if (!activeLine || !subtitle) return;
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
      });
      count++;
    }
    toast.success(
      count > 0
        ? `Saved ${count} new ${count === 1 ? "word" : "words"} from this sentence`
        : "All words in this sentence are already saved",
    );
  };

  const copyCurrentSentence = async () => {
    if (!activeLine) {
      toast.message("Nothing to copy yet — play a sentence first");
      return;
    }
    const translation = translations[activeRow ?? -1];
    const payload = translation
      ? `${activeLine.text}\n${translation}`
      : activeLine.text;
    const ok = await copyToClipboard(payload);
    if (ok) toast.success("Copied sentence + translation");
    else toast.error("Couldn't copy to clipboard");
  };

  const cycleMode = () => {
    const order: LearnMode[] = ["watch", "learn", "listen", "practice"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      const player = playerRef.current;
      switch (e.key) {
        case " ":
          if (!player) return;
          e.preventDefault();
          if (playing) player.pauseVideo();
          else player.playVideo();
          break;
        case "ArrowRight":
          e.preventDefault();
          goToNextLine();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goToPrevLine();
          break;
        case "r":
        case "R":
          replayLine();
          break;
        case "s":
        case "S":
          saveCurrentSentence();
          break;
        case "t":
        case "T":
          setShowTranslation((v) => !v);
          break;
        case "l":
        case "L":
          cycleMode();
          break;
        case "1":
          setPlaybackRate(0.75);
          break;
        case "2":
          setPlaybackRate(1);
          break;
        case "3":
          setPlaybackRate(1.25);
          break;
        case "k":
        case "K":
          if (!player) return;
          e.preventDefault();
          if (playing) player.pauseVideo();
          else player.playVideo();
          break;
        case "c":
        case "C":
          e.preventDefault();
          setShowCaptions((v) => !v);
          break;
        case "f":
        case "F":
          e.preventDefault();
          setFocusMode((v) => !v);
          break;
        case "x":
        case "X":
          e.preventDefault();
          void copyCurrentSentence();
          break;
        case "a":
        case "A":
          if (!player) return;
          e.preventDefault();
          setLoopA(player.getCurrentTime());
          break;
        case "b":
        case "B":
          if (!player) return;
          e.preventDefault();
          setLoopB(player.getCurrentTime());
          break;
        case "Home":
        case "0":
          if (!player) return;
          e.preventDefault();
          seekToCurrentStart();
          break;
        case "Escape":
          setHelpOpen(false);
          setWordDialogOpen(false);
          if (focusMode) setFocusMode(false);
          break;
        case "?":
          setHelpOpen((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeLine, mode, focusMode, subtitle?.language]);

  // Detect local grabber when attach fails.
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
      const result = await transcribeFile(file, {
        language: attachLang,
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
      await localApi.subtitles.update(subtitle._id, {
        fileId: storageId,
        language: attachLang,
        lines: result.lines,
        fileName: file.name,
      });
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
        (error.message.startsWith("GRAB") || error.message.startsWith("YTDLP"))
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
      await localApi.subtitles.update(subtitle._id, {
        fileId: result.fileId,
        language: attachLang,
        lines: result.lines,
      });
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

  // ---- Learning stats ----
  const wordsSavedHere = savedWords.filter(
    (w) => w.sourceTitle === subtitle?.title,
  ).length;
  const totalUniqueWords = useMemo(() => {
    const set = new Set<string>();
    for (const line of subtitle?.lines ?? []) {
      for (const t of tokenize(line.text)) {
        if (t.word) set.add(t.word);
      }
    }
    return set.size;
  }, [subtitle]);

  const videoElapsed = duration > 0 ? time / duration : 0;

  return (
    <div className="flex flex-col gap-5">
      {!focusMode && (
        <header className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            className="w-fit cursor-pointer gap-2 pl-0 text-muted-foreground"
            onClick={() => navigate("/subtitles")}
          >
            <ArrowLeft className="size-4" /> Subtitles
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {subtitle?.title ?? "Watch"}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="gap-1.5">
                  <Clapperboard className="size-3" />
                  {subtitle?.videoId
                    ? "Video synced"
                    : subtitle?.fileId
                      ? "Transcribed video"
                      : "No video yet"}
                </Badge>
                <Badge variant="outline">{languageLabel(subtitle?.language)}</Badge>
                <span>
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
              <BookMarked className="size-4" /> Practice cards
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
        <div
          className={
            focusMode
              ? "mx-auto flex w-full max-w-4xl flex-col gap-3"
              : "flex flex-col gap-5"
          }
        >
          {/* VIDEO */}
          <section className="flex min-w-0 flex-col gap-3">
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

                  {/* Netflix-style captions overlay (visible in all modes) */}
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
                                    saveWordFromToken(
                                      token.word,
                                      token.text,
                                      activeLine.text,
                                    )
                                  }
                                  onRemove={() => {
                                    const entry = existing(token.word);
                                    if (entry?._id) void remove(entry._id);
                                  }}
                                  onOpenDialog={() =>
                                    openWord(
                                      token.word,
                                      token.text,
                                      activeLine.text,
                                    )
                                  }
                                  className={
                                    savedByWord.has(token.word)
                                      ? "font-semibold"
                                      : ""
                                  }
                                >
                                  <span className="mx-[1px] text-white">
                                    {token.text}
                                  </span>
                                </WordTooltip>
                              ) : (
                                <span key={i} className="text-white">
                                  {token.text}
                                </span>
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
                            onClick={() => setShowTranslation((v) => !v)}
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-md",
                              showTranslation
                                ? "bg-white/25 text-white"
                                : "text-white hover:bg-white/20",
                            )}
                            aria-label="Toggle translation"
                            aria-pressed={showTranslation}
                          >
                            {translatingRows.has(activeRow ?? -1) ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Languages className="size-4" />
                            )}
                          </button>
                        </div>
                        {showTranslation &&
                          translations[activeRow ?? -1] && (
                            <p className="mt-1.5 text-sm italic text-white/80">
                              {translations[activeRow ?? -1]}
                            </p>
                          )}
                        {activeProgress !== undefined && (
                          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                            <div
                              className="h-full rounded-full bg-teal-400"
                              style={{ width: `${Math.round(activeProgress * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Learning controls */}
                <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm">
                  {/* Row 1: transport + progress */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="cursor-pointer"
                      onClick={goToPrevLine}
                      disabled={!hasTimestamps}
                      aria-label="Previous sentence"
                    >
                      <SkipBack className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="cursor-pointer"
                      onClick={replayLine}
                      disabled={!hasTimestamps || !activeLine}
                      aria-label="Replay current sentence"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="cursor-pointer"
                      onClick={seekToCurrentStart}
                      disabled={!hasTimestamps}
                      aria-label="Start of current sentence"
                      title="Start of sentence (Home)"
                    >
                      <ChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="cursor-pointer"
                      onClick={goToNextLine}
                      disabled={!hasTimestamps}
                      aria-label="Next sentence"
                    >
                      <SkipForward className="size-4" />
                    </Button>

                    {/* Progress: time / duration + bar */}
                    <div className="flex min-w-[160px] flex-1 items-center gap-2 px-1">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatClock(time)}
                        {duration > 0 && (
                          <span className="text-muted-foreground/60">
                            {" "}
                            / {formatClock(duration)}
                          </span>
                        )}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-200"
                          style={{ width: `${Math.round(videoElapsed * 100)}%` }}
                        />
                      </div>
                    </div>

                    {loopA !== null && loopB !== null && (
                      <Badge variant="secondary" className="gap-1">
                        <Repeat className="size-3" /> A-B
                      </Badge>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer"
                      onClick={() => setHelpOpen(true)}
                      aria-label="Keyboard shortcuts"
                    >
                      <HelpCircle className="size-4" />
                    </Button>
                  </div>

                  {/* Row 2: mode selector + speed + toggles */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
                      {MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          title={m.hint}
                          onClick={() => setMode(m.id)}
                          className={cn(
                            "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            mode === m.id
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
                      {SPEEDS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setPlaybackRate(r)}
                          className={cn(
                            "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                            playbackRate === r
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Gauge className="size-3" />
                          {r}×
                        </button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant={showCaptions ? "secondary" : "outline"}
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      onClick={() => setShowCaptions((v) => !v)}
                      aria-pressed={showCaptions}
                    >
                      {showCaptions ? (
                        <Captions className="size-4" />
                      ) : (
                        <CaptionsOff className="size-4" />
                      )}
                      {showCaptions ? "CC" : "CC off"}
                    </Button>

                    <Button
                      type="button"
                      variant={showTranslation ? "secondary" : "outline"}
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      onClick={() => setShowTranslation((v) => !v)}
                      aria-pressed={showTranslation}
                    >
                      <Languages className="size-4" />🇩🇪→🇬🇧
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      onClick={() => void copyCurrentSentence()}
                      aria-label="Copy sentence + translation"
                      title="Copy sentence + translation (X)"
                    >
                      <Copy className="size-4" />Copy
                    </Button>

                    {hasTimestamps && (
                      <Button
                        type="button"
                        variant={
                          loopA !== null && loopB !== null
                            ? "secondary"
                            : "outline"
                        }
                        size="sm"
                        className="cursor-pointer gap-1.5"
                        onClick={() => {
                          if (loopA !== null && loopB !== null) {
                            setLoopA(null);
                            setLoopB(null);
                          } else if (loopA === null) {
                            setLoopA(playerRef.current?.getCurrentTime() ?? 0);
                            toast.success("Loop start set — press again for end");
                          } else {
                            setLoopB(playerRef.current?.getCurrentTime() ?? 0);
                          }
                        }}
                        title="Set A-B loop on the current sentence"
                      >
                        <Repeat className="size-4" /> Loop
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      onClick={() => setFocusMode((v) => !v)}
                    >
                      <Focus className="size-4" />
                      {focusMode ? "Exit" : "Focus"}
                    </Button>
                  </div>

                  {/* PRACTICE options */}
                  {mode === "practice" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        Practice:
                      </span>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={practiceHide}
                          onChange={(e) => {
                            setPracticeHide(e.target.checked);
                            setRevealAll(false);
                            setRevealedWords(new Set());
                          }}
                          className="accent-primary"
                        />
                        Hide words
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 cursor-pointer gap-1 px-2 text-[11px]"
                        onClick={() => {
                          setRevealAll(true);
                          const all = new Set<string>();
                          for (const l of subtitle.lines)
                            for (const t of tokenize(l.text))
                              if (t.word) all.add(t.word);
                          setRevealedWords(all);
                        }}
                      >
                        <Maximize2 className="size-3" /> Reveal all
                      </Button>
                      <span>Tap a hidden word to reveal it.</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* No video yet */
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
                                <Progress
                                  value={grabProgress.percent ?? 0}
                                  className="h-1.5"
                                />
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
                              Grab server found, but yt-dlp isn't installed. Run{" "}
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
                              locally. Then retry — Motus will download the audio
                              and generate the SRT automatically.
                            </span>
                          ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-fit cursor-pointer gap-1.5 px-2 text-[11px]"
                          onClick={() => {
                            void copyToClipboard(ytDlpAudioCommand(attachUrl)).then(
                              (ok) =>
                                toast.success(
                                  ok
                                    ? "Command copied — paste it in a terminal to grab the audio"
                                    : "Couldn't copy automatically — select the command manually",
                                ),
                            );
                          }}
                        >
                          <Copy className="size-3" /> Copy yt-dlp command
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

            {/* Learning progress strip */}
            {hasMedia && hasTimestamps && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="size-3.5 text-primary" />
                  <span className="font-medium text-foreground">
                    {wordsSavedHere}
                  </span>{" "}
                  new words
                </span>
                <span className="flex items-center gap-1.5">
                  <BookMarked className="size-3.5 text-primary" />
                  <span className="font-medium text-foreground">
                    {reviewedLines.size}
                  </span>{" "}
                  sentences reviewed
                </span>
                <span className="ml-auto">
                  {totalUniqueWords > 0 && (
                    <>
                      <span className="font-medium text-foreground">
                        {wordsSavedHere}/{totalUniqueWords}
                      </span>{" "}
                      vocabulary coverage
                    </>
                  )}
                </span>
              </div>
            )}
          </section>

          {/* TRANSCRIPT + VOCABULARY */}
          {mode !== "watch" && (
            <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
              {/* Transcript */}
              <div className="min-w-0">
                <div className="flex items-center justify-between px-1 pb-2">
                  <button
                    type="button"
                    onClick={() => setTranscriptOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        !transcriptOpen && "-rotate-90",
                      )}
                    />
                    Transcript
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {mode === "listen"
                      ? "German only — listen first"
                      : mode === "practice"
                        ? "Hide & reveal to test yourself"
                        : "Tap a line to jump · tap a word to save"}
                  </p>
                </div>
                {transcriptOpen && (
                  <div
                    ref={transcriptRef}
                    className={cn(
                      "relative space-y-1 overflow-y-auto rounded-2xl border bg-card p-3 shadow-sm",
                      focusMode ? "max-h-[32vh]" : "max-h-[52vh]",
                    )}
                  >
                    {subtitle.lines.map((line, i) => {
                      const showTranslationForLine =
                        showTranslation &&
                        mode !== "listen" &&
                        (translations[i] !== undefined || translatingRows.has(i));
                      const hidden = new Set<string>();
                      if (mode === "practice" && practiceHide && !revealAll) {
                        for (const t of tokenize(line.text))
                          if (t.word && !revealedWords.has(t.word))
                            hidden.add(t.word);
                      }
                      return (
                        <TranscriptLine
                          key={`${line.index}-${i}`}
                          text={line.text}
                          rowId={i}
                          time={
                            line.start !== undefined
                              ? formatClock(line.start)
                              : undefined
                          }
                          lang={subtitle.language}
                          isActive={activeRow === i}
                          progress={activeRow === i ? activeProgress : undefined}
                          translation={
                            mode === "listen"
                              ? null
                              : translations[i] ?? null
                          }
                          showTranslation={showTranslationForLine}
                          savedWords={new Set(savedByWord.keys())}
                          hiddenWords={hidden}
                          onWordClick={openWord}
                          onWordSave={saveWordFromToken}
                          onLineClick={
                            hasTimestamps && line.start !== undefined
                              ? () => seekToLine(i)
                              : undefined
                          }
                          onReplay={
                            hasTimestamps && line.start !== undefined
                              ? () => {
                                  playerRef.current?.seekTo(line.start!, true);
                                  playerRef.current?.playVideo();
                                  setReviewedLines((prev) =>
                                    new Set(prev).add(i),
                                  );
                                }
                              : undefined
                          }
                          onToggleSave={() => {
                            const already = savedWords.filter(
                              (w) => w.sourceTitle === subtitle.title,
                            );
                            if (already.length > 0) {
                              for (const w of already) void remove(w._id);
                              toast.success("Unsaved this video's words");
                            } else {
                              saveCurrentSentence();
                            }
                          }}
                          onCopy={() => {
                            const translation = translations[i];
                            const payload = translation
                              ? `${line.text}\n${translation}`
                              : line.text;
                            void copyToClipboard(payload).then((ok) =>
                              ok
                                ? toast.success("Copied sentence + translation")
                                : toast.error("Couldn't copy to clipboard"),
                            );
                          }}
                          saved={false}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Vocabulary panel */}
              <aside className="min-w-0">
                <div className="sticky top-4 rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      <BookMarked className="size-4" /> Vocabulary
                    </h2>
                    <Badge variant="secondary">{savedWords.length}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {wordsSavedHere} from this video
                  </p>

                  {savedWords.length === 0 ? (
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">
                      Tap any German word to save it. Saved words appear here and
                      become practice cards automatically.
                    </p>
                  ) : (
                    <ul className="mt-3 max-h-[44vh] space-y-1 overflow-y-auto pr-1">
                      {savedWords.map((w) => (
                        <li
                          key={w._id}
                          className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openWord(
                                w.word,
                                w.display,
                                w.example || "",
                              )
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-sm font-medium text-foreground">
                              {w.display}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {w.definition || "—"}
                            </span>
                          </button>
                          <SpeakerButton
                            text={w.display}
                            lang={w.language}
                            label={`Pronounce ${w.display}`}
                            className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                          <button
                            type="button"
                            onClick={() => void remove(w._id)}
                            className="size-6 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Remove from vocabulary"
                            aria-label={`Remove ${w.display}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </section>
          )}
        </div>
      )}

      <WordDialog
        open={wordDialogOpen}
        onOpenChange={setWordDialogOpen}
        selection={selection}
        existing={selection ? (existing(selection.word) ?? null) : null}
      />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" /> Keyboard shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {SHORTCUTS.map(([k, d]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2"
              >
                <kbd className="rounded-md border bg-background px-2 py-0.5 font-mono text-xs">
                  {k}
                </kbd>
                <span className="text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
