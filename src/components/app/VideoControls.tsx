import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/tts";
import { cn } from "@/lib/utils";
import {
  Captions,
  CaptionsOff,
  Copy,
  Focus,
  Gauge,
  HelpCircle,
  Languages,
  Maximize2,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  Volume2,
  Volume1,
  Volume,
  VolumeX,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

type LearnMode = "watch" | "learn" | "listen" | "practice";

const MODES: { id: LearnMode; label: string; hint: string }[] = [
  { id: "watch", label: "Watch", hint: "Video only — minimal UI" },
  { id: "learn", label: "Learn", hint: "Transcript + translation + vocabulary" },
  { id: "listen", label: "Listen", hint: "German only — train your ear" },
  { id: "practice", label: "Practice", hint: "Hide words, test recall" },
];

const SPEEDS = [0.75, 1, 1.25] as const;

interface VideoControlsProps {
  hasTimestamps: boolean;
  time: number;
  duration: number;
  playing: boolean;
  mode: LearnMode;
  playbackRate: number;
  showCaptions: boolean;
  showTranslation: boolean;
  translateTarget: string;
  loopA: number | null;
  loopB: number | null;
  focusMode: boolean;
  practiceHide: boolean;
  volume: number;
  isMuted: boolean;
  onPrevLine: () => void;
  onNextLine: () => void;
  onReplay: () => void;
  onSeekToStart: () => void;
  onSeek: (time: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetMode: (mode: LearnMode) => void;
  onToggleCaptions: () => void;
  onToggleTranslation: () => void;
  onSetTranslateTarget: (target: string) => void;
  onCopy: () => void;
  onSetLoopA: (time: number | null) => void;
  onSetLoopB: (time: number | null) => void;
  onSetFocusMode: (focus: boolean) => void;
  onSetHelpOpen: (open: boolean) => void;
  onSetPracticeHide: (hide: boolean) => void;
  onRevealAll: () => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Generate evenly-spaced tick positions (0–1) for the time scale. */
function timeMarkers(duration: number): number[] {
  if (duration <= 0) return [];
  const interval = duration <= 60 ? 10 : duration <= 300 ? 30 : 60;
  const markers: number[] = [];
  for (let t = interval; t < duration; t += interval) {
    markers.push(t / duration);
  }
  return markers;
}

/** Generate labels for the start, quarter, half, three-quarter, and end. */
function timeLabels(duration: number): string[] {
  if (duration <= 0) return [];
  if (duration <= 60) {
    return ["0:00", formatClock(duration)];
  }
  return [
    "0:00",
    formatClock(duration * 0.25),
    formatClock(duration * 0.5),
    formatClock(duration * 0.75),
    formatClock(duration),
  ];
}

export function VideoControls({
  hasTimestamps,
  time,
  duration,
  mode,
  playbackRate,
  showCaptions,
  showTranslation,
  translateTarget,
  loopA,
  loopB,
  focusMode,
  practiceHide,
  volume,
  isMuted,
  onPrevLine,
  onNextLine,
  onReplay,
  onSeekToStart,
  onSeek,
  onSetPlaybackRate,
  onSetMode,
  onToggleCaptions,
  onToggleTranslation,
  onSetTranslateTarget,
  onCopy,
  onSetLoopA,
  onSetLoopB,
  onSetFocusMode,
  onSetHelpOpen,
  onSetPracticeHide,
  onRevealAll,
  onSetVolume,
  onToggleMute,
}: VideoControlsProps) {
  const videoElapsed = duration > 0 ? time / duration : 0;
  const scrubRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const seekFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!scrubRef.current || duration <= 0) return;
      const rect = scrubRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(pct * duration);
    },
    [duration, onSeek],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      seekFromEvent(e);
    },
    [seekFromEvent],
  );

  // Global mouse move/up for drag scrubbing
  const dragRef = useRef<{ onMove: (e: MouseEvent) => void; onUp: () => void } | null>(null);
  if (isDragging && !dragRef.current) {
    const onMove = (e: MouseEvent) => seekFromEvent(e);
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    dragRef.current = { onMove, onUp };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      {/* Row 1: transport + progress */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="cursor-pointer"
          onClick={onPrevLine}
          disabled={!hasTimestamps}
          aria-label="Previous sentence"
          title="Previous sentence (←)"
        >
          <SkipBack className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="cursor-pointer"
          onClick={onReplay}
          disabled={!hasTimestamps}
          aria-label="Replay current sentence"
          title="Replay sentence (R)"
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="cursor-pointer"
          onClick={onSeekToStart}
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
          onClick={onNextLine}
          disabled={!hasTimestamps}
          aria-label="Next sentence"
          title="Next sentence (→)"
        >
          <SkipForward className="size-4" />
        </Button>

        {/* Progress: time / duration + bar */}
        <div className="flex min-w-[160px] flex-1 items-center gap-2 px-1">
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatClock(time)}
          </span>
          <div
            ref={scrubRef}
            className="relative flex-1 cursor-pointer select-none"
            onMouseDown={handleMouseDown}
          >
            {/* Time markers */}
            {duration > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-px">
                {timeMarkers(duration).map((t) => (
                  <div
                    key={t}
                    className="h-2.5 w-px bg-muted-foreground/20"
                  />
                ))}
              </div>
            )}
            {/* Progress bar */}
            <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${Math.round(videoElapsed * 100)}%` }}
              />
              {/* Scrub handle */}
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary shadow-sm transition-opacity",
                  isDragging ? "size-3.5 opacity-100" : "size-2.5 opacity-0 group-hover/scrub:opacity-100",
                )}
                style={{ left: `${Math.round(videoElapsed * 100)}%` }}
              />
            </div>
            {/* Time labels */}
            {duration > 0 && (
              <div className="mt-0.5 flex justify-between px-px">
                {timeLabels(duration).map((label) => (
                  <span
                    key={label}
                    className="font-mono text-[9px] tabular-nums text-muted-foreground/40"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/60">
            {formatClock(duration)}
          </span>
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={isMuted ? "Unmute (M)" : "Mute (M)"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : volume < 0.5 ? (
              <Volume className="size-4" />
            ) : volume < 0.75 ? (
              <Volume1 className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onSetVolume(val);
              if (val > 0 && isMuted) {
                onToggleMute();
              }
            }}
            className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            aria-label="Volume"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
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
          onClick={() => onSetHelpOpen(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
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
              onClick={() => onSetMode(m.id)}
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
              onClick={() => onSetPlaybackRate(r)}
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
          onClick={onToggleCaptions}
          aria-pressed={showCaptions}
        >
          {showCaptions ? (
            <Captions className="size-4" />
          ) : (
            <CaptionsOff className="size-4" />
          )}
          {showCaptions ? "CC" : "CC off"}
        </Button>

        <Select
          value={translateTarget}
          onValueChange={onSetTranslateTarget}
        >
          <SelectTrigger
            className={cn(
              "h-8 w-auto gap-1.5 cursor-pointer",
              showTranslation
                ? "border-primary bg-primary/10"
                : "",
            )}
            aria-label="Translation target language"
          >
            <Languages className="size-4" />
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

        <Button
          type="button"
          variant={showTranslation ? "secondary" : "outline"}
          size="sm"
          className="cursor-pointer gap-1.5"
          onClick={onToggleTranslation}
          aria-pressed={showTranslation}
        >
          {showTranslation ? "Hide" : "Show"} T
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer gap-1.5"
          onClick={onCopy}
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
                onSetLoopA(null);
                onSetLoopB(null);
              } else if (loopA === null) {
                onSetLoopA(0);
              } else {
                onSetLoopB(0);
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
          onClick={() => onSetFocusMode(!focusMode)}
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
                onSetPracticeHide(e.target.checked);
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
            onClick={onRevealAll}
          >
            <Maximize2 className="size-3" /> Reveal all
          </Button>
          <span>Tap a hidden word to reveal it.</span>
        </div>
      )}
    </div>
  );
}
