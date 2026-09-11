import { FilePlayer } from "@/components/app/FilePlayer";
import { SpeakerButton } from "@/components/app/SpeakerButton";
import { TranscriptPanel } from "@/components/app/TranscriptPanel";
import { VideoControls } from "@/components/app/VideoControls";
import {
  TranscribeFile,
  type TranscribedFile,
} from "@/components/app/TranscribeFile";
import { WordTooltip } from "@/components/app/WordTooltip";
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  type TranscribeModel,
  type TranscribeProgress,
} from "@/lib/transcribe";
import { LANGUAGES, languageLabel } from "@/lib/tts";
import { useSavedWords } from "@/hooks/use-saved-words";
import { cn } from "@/lib/utils";
import { captureFrame, captureScreenCrop, type PlayerHandle } from "@/lib/player";
import {
  copyToClipboard,
  detectLocalGrabber,
  extractYouTubeId,
  grabErrorMessage,
  grabYouTubeAudioStream,
  type GrabHealth,
  ytDlpAudioCommand,
} from "@/lib/youtube";
import {
  ArrowLeft,
  BookMarked,
  Clapperboard,
  Copy,
  Download,
  HelpCircle,
  Link2,
  Loader2,
  Play,
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

function TranscriptSkeleton({ lines = 15 }: { lines?: number }) {
  return (
    <div className="space-y-1 rounded-2xl border bg-card p-3 shadow-sm">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-start gap-2 border-l-2 border-l-transparent pl-3 pr-2 py-2.5">
          <Skeleton className="h-3 w-10 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-full" style={{ width: `${60 + Math.random() * 30}%` }} />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Watch() {
  const { subtitleId } = useParams<{ subtitleId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!subtitleId) {
      navigate("/dashboard", { replace: true });
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
  const { words: savedWords, isSaved, existing, save, remove, refresh } = useSavedWords();

  useEffect(() => {
    void localApi.subtitles
      .get(id)
      .then(setSubtitle)
      .catch(() => setSubtitle(null));
  }, [id]);

  const playerRef = useRef<PlayerHandle | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
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
  const [translateTarget, setTranslateTarget] = useState(
    settings.get().nativeLanguage,
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
  const [attachModel, setAttachModel] = useState<TranscribeModel>("best");
  const [transcribeMode, setTranscribeMode] = useState<"auto" | "youtube" | "whisper">("auto");
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

  const savedWordsSet = useMemo(() => new Set(savedByWord.keys()), [savedByWord]);

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
      if (line && line.start !== undefined && time >= line.start) {
        if (line.end === undefined || time < line.end) return i;
      }
    }
    if (lines.length > 0 && time < (lines[0]?.start ?? 0)) return 0;
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

  // Translate a line on demand (cached). The server proxy (/api/translate)
  // handles the unconfigured case gracefully, so we don't gate on a local
  // endpoint here.
  const translateRow = (row: number) => {
    const line = subtitle?.lines[row];
    if (!line) return;
    if (translations[row] !== undefined || translatingRows.has(row)) return;
    const target = translateTarget.slice(0, 2);
    const userSource = settings.get().sourceLanguage;
    const source = userSource !== "auto" ? userSource : (subtitle?.language?.slice(0, 2) || "auto");

    setTranslatingRows((prev) => new Set(prev).add(row));
    translateLine(line.text, target, source)
      .then((r) => {
        if (r.ok && r.text) {
          setTranslations((prev) => ({ ...prev, [row]: r.text }) as Record<number, string>);
        } else {
          // Mark as failed so the UI can show a retry option
          setTranslations((prev) => ({ ...prev, [row]: "__failed__" }) as Record<number, string>);
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
    const timer = setTimeout(() => {
      translateRow(activeRow);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRow, subtitle?.language, translateTarget]);

  // Clear cached translations when target language changes
  useEffect(() => {
    setTranslations({});
  }, [translateTarget]);

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

  // Refresh saved words when a word is saved from any source
  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener("motus:word-saved", handler);
    return () => window.removeEventListener("motus:word-saved", handler);
  }, [refresh]);

  const openWord = (tokenWord: string, raw: string, lineText: string) => {
    playerRef.current?.pauseVideo();
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

  const saveWordFromToken = async (tokenWord: string, raw: string, lineText: string) => {
    playerRef.current?.pauseVideo();
    if (!subtitle) return;
    let screenshot = await captureFrame(playerRef);
    // For YouTube videos, captureFrame returns null (CORS). Use screen capture.
    if (!screenshot && subtitle.videoId && videoContainerRef.current) {
      screenshot = await captureScreenCrop(videoContainerRef.current);
    }
    await save({
      word: tokenWord,
      display: raw,
      example: lineText,
      sourceTitle: subtitle.title,
      language: subtitle.language,
      screenshot: screenshot ?? undefined,
    });
    toast.success(`Saved "${raw}"`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const existingEntry = existing(tokenWord);
          if (existingEntry?._id) {
            await remove(existingEntry._id);
            toast.info(`Removed "${raw}"`);
          }
        },
      },
    });
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

  const saveCurrentSentence = async () => {
    if (!activeLine || !subtitle) return;
    let screenshot = await captureFrame(playerRef);
    // For YouTube videos, use screen capture
    if (!screenshot && subtitle.videoId && videoContainerRef.current) {
      screenshot = await captureScreenCrop(videoContainerRef.current);
    }
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
    const next = order[(order.indexOf(mode) + 1) % order.length]!;
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

  /** Try to load YouTube's built-in captions. Returns true if captions were loaded. */
  const tryYoutubeCaptions = async (videoId: string, lang: string): Promise<boolean> => {
    try {
      const ytCaptions = await localApi.transcript(videoId, lang);
      if (ytCaptions.lines && ytCaptions.lines.length > 0 && subtitle) {
        await localApi.subtitles.update(subtitle._id, {
          videoId,
          language: lang,
          lines: ytCaptions.lines,
        });
        setAttachUrl("");
        toast.success(
          `YouTube captions loaded (${ytCaptions.lines.length} lines) — no download needed!`,
        );
        return true;
      }
    } catch {
      // No YouTube captions available
    }
    return false;
  };

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
      // Step 1: Try YouTube's built-in captions (unless user chose Whisper-only)
      if (transcribeMode !== "whisper") {
        setGrabProgress({ stage: "transcribing", note: "Checking for YouTube captions…" });
        if (await tryYoutubeCaptions(videoId, attachLang)) return;
        if (transcribeMode === "youtube") {
          setAttachError("This video doesn't have YouTube captions available. Try 'Auto' mode for Whisper fallback.");
          return;
        }
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
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "UPLOAD_FAILED") {
        setAttachErrorCode("UPLOAD_FAILED");
        setAttachError("Audio was transcribed but couldn't be saved — try again.");
      } else if (msg.startsWith("GRAB") || msg.startsWith("YTDLP") || msg.startsWith("INVALID")) {
        setAttachErrorCode("GRAB_FAILED");
        setAttachError(grabErrorMessage(error));
      } else {
        setAttachErrorCode("TRANSCRIBE_FAILED");
        setAttachError(transcribeErrorMessage(error));
      }
    } finally {
      setIsAttaching(false);
      setGrabProgress(null);
    }
  };

  const handleGrabAndTranscribe = async () => {
    if (!subtitle || !attachUrl.trim()) return;
    setAttachError(null);
    setAttachErrorCode(null);
    setIsGrabbing(true);
    setGrabProgress(null);
    try {
      const videoId = extractYouTubeId(attachUrl);

      // Step 1: Try YouTube's built-in captions (unless user chose Whisper-only)
      if (videoId && transcribeMode !== "whisper") {
        setGrabProgress({ stage: "transcribing", note: "Checking for YouTube captions…" });
        if (await tryYoutubeCaptions(videoId, attachLang)) return;
        if (transcribeMode === "youtube") {
          setAttachError("This video doesn't have YouTube captions available. Try 'Auto' mode for Whisper fallback.");
          return;
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
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "UPLOAD_FAILED") {
        setAttachErrorCode("UPLOAD_FAILED");
        setAttachError("Audio was transcribed but couldn't be saved — try again.");
      } else if (msg.startsWith("GRAB") || msg.startsWith("YTDLP") || msg.startsWith("INVALID")) {
        setAttachErrorCode("GRAB_FAILED");
        setAttachError(grabErrorMessage(error));
      } else {
        setAttachErrorCode("TRANSCRIBE_FAILED");
        setAttachError(transcribeErrorMessage(error));
      }
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
  const wordsSavedHere = useMemo(() => savedWords.filter((w) => w.sourceTitle === subtitle?.title).length, [savedWords, subtitle?.title]);
  const totalUniqueWords = useMemo(() => {
    const set = new Set<string>();
    for (const line of subtitle?.lines ?? []) {
      for (const t of tokenize(line.text)) {
        if (t.word) set.add(t.word);
      }
    }
    return set.size;
  }, [subtitle]);

  const activeLineTokens = useMemo(() => {
    if (!activeLine) return [];
    return tokenize(activeLine.text);
  }, [activeLine?.text]);

  return (
    <div className="flex flex-col gap-5">
      {!focusMode && (
        <header className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            className="w-fit cursor-pointer gap-2 pl-0 text-muted-foreground"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="size-4" /> Dashboard
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
        <TranscriptSkeleton />
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
              onClick={() => navigate("/dashboard")}
              className="cursor-pointer"
            >
              Back to dashboard
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
                <div ref={videoContainerRef} className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-lg">
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
                          <p className="font-mono text-lg leading-7 text-[#00ff88] shadow-[0_0_5px_#00ff8840]">
                            {activeLineTokens.map((token, i) =>
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
                                  <span className="mx-[1px] text-[#00ff88]">
                                    {token.text}
                                  </span>
                                </WordTooltip>
                              ) : (
                                <span key={i} className="text-[#00ff88]">
                                  {token.text}
                                </span>
                              ),
                            )}
                          </p>
                          <SpeakerButton
                            text={activeLine.text}
                            lang={subtitle.language}
                            label="Pronounce current line"
                            className="shrink-0 text-[#00ff88] hover:bg-[#00ff88]/20 hover:text-[#00ff88]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTranslation((v) => !v)}
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-md",
                              showTranslation
                                ? "bg-[#00ff88]/25 text-[#00ff88]"
                                : "text-[#00ff88] hover:bg-[#00ff88]/20",
                            )}
                            aria-label="Toggle translation"
                            aria-pressed={showTranslation}
                          >
                            {translatingRows.has(activeRow ?? -1) ? (
                              <Loader2 className="size-4 animate-spin text-[#00ff88]" />
                            ) : (
                              <Languages className="size-4" />
                            )}
                          </button>
                        </div>
                        {showTranslation &&
                          translations[activeRow ?? -1] && (
                            <p className="mt-1.5 font-mono text-sm italic text-[#ff00ff]">
                              {translations[activeRow ?? -1]}
                            </p>
                          )}
                        {activeProgress !== undefined && (
                          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-[#00ff88]/20">
                            <div
                              className="h-full rounded-full bg-[#00ff88] shadow-[0_0_5px_#00ff8840]"
                              style={{ width: `${Math.round(activeProgress * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <VideoControls
                  hasTimestamps={hasTimestamps}
                  time={time}
                  duration={duration}
                  playing={playing}
                  mode={mode}
                  playbackRate={playbackRate}
                  showCaptions={showCaptions}
                  showTranslation={showTranslation}
                  translateTarget={translateTarget}
                  loopA={loopA}
                  loopB={loopB}
                  focusMode={focusMode}
                  practiceHide={practiceHide}
                  onPrevLine={goToPrevLine}
                  onNextLine={goToNextLine}
                  onReplay={replayLine}
                  onSeekToStart={seekToCurrentStart}
                  onSetPlaybackRate={setPlaybackRate}
                  onSetMode={setMode}
                  onToggleCaptions={() => setShowCaptions((v) => !v)}
                  onToggleTranslation={() => setShowTranslation((v) => !v)}
                  onSetTranslateTarget={(v) => {
                    setTranslateTarget(v);
                    setTranslations({});
                  }}
                  onCopy={() => void copyCurrentSentence()}
                  onSetLoopA={setLoopA}
                  onSetLoopB={setLoopB}
                  onSetFocusMode={(v) => setFocusMode(v)}
                  onSetHelpOpen={setHelpOpen}
                  onSetPracticeHide={setPracticeHide}
                  onRevealAll={() => {
                    setRevealAll(true);
                    const all = new Set<string>();
                    for (const l of subtitle!.lines)
                      for (const t of tokenize(l.text))
                        if (t.word) all.add(t.word);
                    setRevealedWords(all);
                  }}
                />
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
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Model:</Label>
                      <Select value={attachModel} onValueChange={(v) => setAttachModel(v as TranscribeModel)}>
                        <SelectTrigger className="h-8 w-auto text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="fast">Fast (tiny)</SelectItem>
                           <SelectItem value="accurate">Accurate (base)</SelectItem>
                           <SelectItem value="best">Best (large-v3)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Progress bar — always visible during transcription */}
                    {(isAttaching || isGrabbing || (attachErrorCode === "GRAB_FAILED" && grabProgress)) && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Loader2 className="size-3 animate-spin" />
                          {grabProgress
                            ? GRAB_STAGE_LABELS[grabProgress.stage]
                            : isAttaching
                              ? "Downloading audio and transcribing…"
                              : "Working…"}
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
                    )}
                    {attachError && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {attachError}
                        </p>
                        {attachErrorCode === "GRAB_FAILED" && !isGrabbing && !grabProgress && (
                          grabHealth?.ok && grabHealth.ytDlp ? (
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
                          )
                        )}
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
            <TranscriptPanel
              subtitle={subtitle}
              activeRow={activeRow}
              activeProgress={activeProgress}
              translations={translations}
              translatingRows={translatingRows}
              showTranslation={showTranslation}
              mode={mode}
              practiceHide={practiceHide}
              revealAll={revealAll}
              revealedWords={revealedWords}
              savedWordsSet={savedWordsSet}
              savedWords={savedWords}
              wordsSavedHere={wordsSavedHere}
              hasTimestamps={hasTimestamps}
              transcriptOpen={transcriptOpen}
              focusMode={focusMode}
              onWordClick={openWord}
              onWordSave={saveWordFromToken}
              onLineSeek={seekToLine}
              onReplayLine={(row, start) => {
                playerRef.current?.seekTo(start, true);
                playerRef.current?.playVideo();
                setReviewedLines((prev) => new Set(prev).add(row));
              }}
              onToggleSaveLine={() => {
                const already = savedWords.filter((w) => w.sourceTitle === subtitle.title);
                if (already.length > 0) {
                  for (const w of already) void remove(w._id);
                  toast.success("Unsaved this video's words");
                } else {
                  saveCurrentSentence();
                }
              }}
              onCopyLine={(row) => {
                const line = subtitle.lines[row];
                if (!line) return;
                const translation = translations[row];
                const payload = translation ? `${line.text}\n${translation}` : line.text;
                void copyToClipboard(payload).then((ok) =>
                  ok ? toast.success("Copied sentence + translation") : toast.error("Couldn't copy to clipboard"),
                );
              }}
              onTranslateLine={translateRow}
              onRemoveWord={(id) => void remove(id)}
              onSetTranscriptOpen={setTranscriptOpen}
              transcriptRef={transcriptRef}
            />
          )}
        </div>
      )}

      <WordDialog
        open={wordDialogOpen}
        onOpenChange={setWordDialogOpen}
        selection={selection}
        existing={selection ? (existing(selection.word) ?? null) : null}
        videoRef={playerRef}
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
