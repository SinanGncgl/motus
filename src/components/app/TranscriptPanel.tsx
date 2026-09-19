import { TranscriptLine } from "@/components/app/TranscriptLine";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokenize } from "@/lib/subtitles";
import type { LocalSubtitle } from "@/lib/local-api";

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
  hasTimestamps: boolean;
  transcriptOpen: boolean;
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
  hasTimestamps,
  transcriptOpen,
  onWordClick,
  onWordSave,
  onLineSeek,
  onReplayLine,
  onToggleSaveLine,
  onCopyLine,
  onTranslateLine,
  onSetTranscriptOpen,
  transcriptRef,
}: TranscriptPanelProps) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => onSetTranscriptOpen(!transcriptOpen)}
          className="flex items-center gap-1 px-1 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              !transcriptOpen && "-rotate-90",
            )}
          />
          Transcript
        </button>
        {transcriptOpen && (
          <div
            ref={transcriptRef}
            className="relative space-y-0.5 overflow-y-auto rounded-xl border bg-card p-2 shadow-sm lg:flex-1 lg:min-h-0"
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
    </section>
  );
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
