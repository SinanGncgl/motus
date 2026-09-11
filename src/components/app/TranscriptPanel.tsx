import { useMemo, useState } from "react";
import { TranscriptLine } from "@/components/app/TranscriptLine";
import { SpeakerButton } from "@/components/app/SpeakerButton";
import { Badge } from "@/components/ui/badge";
import { BookMarked, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { cyberChamfer } from "@/lib/cyberpunk";
import { tokenize } from "@/lib/subtitles";
import type { LocalSubtitle, LocalWord } from "@/lib/local-api";

type LearnMode = "watch" | "learn" | "listen" | "practice";

interface TranscriptPanelProps {
  subtitle: LocalSubtitle;
  activeRow: number | null;
  activeProgress: number | undefined;
  translations: Record<number, string>;
  translatingRows: Set<number>;
  showTranslation: boolean;
  mode: LearnMode;
  practiceHide: boolean;
  revealAll: boolean;
  revealedWords: Set<string>;
  savedWordsSet: Set<string>;
  savedWords: LocalWord[];
  wordsSavedHere: number;
  hasTimestamps: boolean;
  transcriptOpen: boolean;
  focusMode: boolean;
  onWordClick: (word: string, raw: string, lineText: string) => void;
  onWordSave: (word: string, raw: string, lineText: string) => void;
  onLineSeek: (row: number) => void;
  onReplayLine: (row: number, start: number) => void;
  onToggleSaveLine: (row: number) => void;
  onCopyLine: (row: number) => void;
  onTranslateLine: (row: number) => void;
  onRemoveWord: (id: string) => void;
  onSetTranscriptOpen: (open: boolean) => void;
  transcriptRef: React.RefObject<HTMLDivElement | null>;
}

export function TranscriptPanel({
  subtitle,
  activeRow,
  activeProgress,
  translations,
  translatingRows,
  showTranslation,
  mode,
  practiceHide,
  revealAll,
  revealedWords,
  savedWordsSet,
  savedWords,
  wordsSavedHere,
  hasTimestamps,
  transcriptOpen,
  focusMode,
  onWordClick,
  onWordSave,
  onLineSeek,
  onReplayLine,
  onToggleSaveLine,
  onCopyLine,
  onTranslateLine,
  onRemoveWord,
  onSetTranscriptOpen,
  transcriptRef,
  }: TranscriptPanelProps) {
  const [vocabOpen, setVocabOpen] = useState(false);

  const vocabularyItems = useMemo(() => {
    return savedWords.map((w) => (
      <li
        key={w._id}
        className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
      >
        <button
          type="button"
          onClick={() =>
            onWordClick(
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
          onClick={() => onRemoveWord(w._id)}
          className="size-6 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Remove from vocabulary"
          aria-label={`Remove ${w.display}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </li>
    ));
  }, [savedWords, onWordClick, onRemoveWord]);

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      {/* Transcript */}
      <div className="min-w-0">
        <div className="flex items-center justify-between px-1 pb-2">
          <button
            type="button"
            onClick={() => onSetTranscriptOpen(!transcriptOpen)}
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
              "relative space-y-1 overflow-y-auto rounded-2xl border bg-[#0a0a0f] p-3 shadow-sm",
              focusMode ? "max-h-[32vh]" : "max-h-[52vh]",
            )}
          >
            <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.15)_2px,rgba(0,0,0,0.15)_4px)]" />

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
                  savedWords={savedWordsSet}
                  hiddenWords={hidden}
                  onWordClick={onWordClick}
                  onWordSave={onWordSave}
                  onLineClick={
                    hasTimestamps && line.start !== undefined
                      ? () => onLineSeek(i)
                      : undefined
                  }
                  onReplay={
                    hasTimestamps && line.start !== undefined
                      ? () => onReplayLine(i, line.start!)
                      : undefined
                  }
                  onToggleSave={() => onToggleSaveLine(i)}
                  onCopy={() => onCopyLine(i)}
                  onTranslate={() => onTranslateLine(i)}
                  saved={false}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Vocabulary panel */}
      <aside className="min-w-0">
          <div className={cn("sticky top-4 rounded-2xl border border-[#00ff8830] bg-card p-4 shadow-sm", cyberChamfer())}>
          <button
            type="button"
            onClick={() => setVocabOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-2xl border bg-card p-3 shadow-sm lg:hidden"
          >
            <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <BookMarked className="size-4" /> Vocabulary
            </span>
            <Badge variant="secondary">{savedWords.length}</Badge>
          </button>
          <div className="hidden items-center justify-between lg:flex">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <BookMarked className="size-4" /> Vocabulary
            </h2>
            <Badge variant="secondary">{savedWords.length}</Badge>
          </div>

          <div className={`${vocabOpen ? "block" : "hidden"} lg:block`}>
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
                {vocabularyItems}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
