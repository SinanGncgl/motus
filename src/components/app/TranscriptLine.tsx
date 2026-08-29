import { SpeakerButton } from "@/components/app/SpeakerButton";
import { cn } from "@/lib/utils";
import { formatClock, tokenize } from "@/lib/subtitles";

interface TranscriptLineProps {
  text: string;
  /** Array position, used for scroll targeting. */
  rowId: number;
  /** SRT index to show (optional). */
  lineIndex?: number;
  /** Clock label override (e.g. line start time). */
  time?: string;
  lang?: string | null;
  isActive?: boolean;
  /** 0..1 elapsed fraction of the line, shown as a thin progress bar. */
  progress?: number;
  savedWords: Set<string>;
  onWordClick: (word: string, raw: string, lineText: string) => void;
  /** Called when the line is clicked (e.g. seek the video). */
  onLineClick?: () => void;
  showSpeaker?: boolean;
}

export function TranscriptLine({
  text,
  rowId,
  lineIndex,
  time,
  lang,
  isActive = false,
  progress,
  savedWords,
  onWordClick,
  onLineClick,
  showSpeaker = true,
}: TranscriptLineProps) {
  return (
    <div
      id={`line-${rowId}`}
      data-line={rowId}
      onClick={onLineClick}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors",
        onLineClick && "cursor-pointer hover:bg-accent/60",
        isActive && "bg-primary/5 ring-1 ring-primary/20",
      )}
    >
      {time !== undefined && (
        <span className="mt-1 w-12 shrink-0 select-none font-mono text-[11px] leading-5 text-muted-foreground/70">
          {time}
        </span>
      )}
      <p
        className={cn(
          "min-w-0 flex-1 break-words text-[16px] leading-7",
          isActive ? "text-foreground" : "text-foreground/90",
        )}
      >
        {tokenize(text).map((token, i) =>
          token.word ? (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onWordClick(token.word, token.text, text);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onWordClick(token.word, token.text, text);
                }
              }}
              className={cn(
                "mx-[1px] cursor-pointer rounded-md px-0.5 py-0.5 transition-colors",
                savedWords.has(token.word)
                  ? "bg-primary/10 font-medium text-primary"
                  : "hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none",
              )}
            >
              {token.text}
            </span>
          ) : (
            <span key={i}>{token.text}</span>
          ),
        )}
      </p>
      {lineIndex !== undefined && (
        <span className="mt-1 hidden shrink-0 text-[11px] text-muted-foreground/60 sm:block">
          {lineIndex}
        </span>
      )}
      {isActive && progress !== undefined && (
        <div className="pointer-events-none absolute inset-x-2 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {showSpeaker && (
        <span className="mt-0.5 shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <SpeakerButton text={text} lang={lang} label="Pronounce line" />
        </span>
      )}
    </div>
  );
}

export function lineClock(start?: number): string | undefined {
  return start !== undefined ? formatClock(start) : undefined;
}
