import { cn } from "@/lib/utils";
import { tokenize } from "@/lib/subtitles";
import React from "react";
import { Bookmark, BookmarkCheck, Copy, Languages, RotateCcw } from "lucide-react";

interface TranscriptLineProps {
  text: string;
  /** Array position, used for scroll targeting. */
  rowId: number;
  /** Clock label override (e.g. line start time). */
  time?: string;
  lang?: string | null;
  isActive?: boolean;
  /** 0..1 elapsed fraction of the line, shown as a thin progress bar. */
  progress?: number;
  /** English translation (secondary). */
  translation?: string | null;
  showTranslation?: boolean;
  savedWords: Set<string>;
  /** Words hidden/revealed (PRACTICE mode). */
  hiddenWords?: Set<string>;
  onWordClick: (word: string, raw: string, lineText: string) => void;
  onWordSave?: (word: string, raw: string, lineText: string) => void;
  /** Called when the line is clicked (e.g. seek the video). */
  onLineClick?: () => void;
  /** Replay the spoken sentence. */
  onReplay?: () => void;
  /** Toggle saving the whole sentence as words. */
  onToggleSave?: () => void;
  saved?: boolean;
  /** Copy the sentence (+ translation) to the clipboard. */
  onCopy?: () => void;
  /** Translate this sentence on demand. */
  onTranslate?: () => void;
}

/**
 * One interactive sentence block in the transcript. German is dominant;
 * the English translation is visually secondary. The active line gets a
 * subtle background, a left accent bar, and stronger typography.
 */
export const TranscriptLine = React.memo(function TranscriptLine({
  text,
  rowId,
  time,
  lang: _lang,
  isActive = false,
  progress,
  translation,
  showTranslation = true,
  savedWords,
  hiddenWords,
  onWordClick,
  onWordSave: _onWordSave,
  onLineClick,
  onReplay,
  onToggleSave,
  onCopy,
  onTranslate,
  saved = false,
}: TranscriptLineProps) {
  return (
    <div
      id={`line-${rowId}`}
      data-line={rowId}
      onClick={onLineClick}
      className={cn(
        "group relative scroll-mt-4 border-l-2 pl-3 pr-2 py-2.5 transition-colors duration-200",
        onLineClick && "cursor-pointer",
        isActive
          ? "border-l-[#00ff88] bg-primary/[0.07] text-[#00ff88] shadow-[0_0_5px_#00ff8840]"
          : "border-l-transparent hover:bg-accent/50",
      )}
    >
      <div className="flex items-center gap-2">
        {time !== undefined && (
          <span
            className={cn(
              "shrink-0 select-none font-mono text-[11px] tabular-nums",
              isActive ? "text-primary" : "text-muted-foreground/60",
            )}
          >
            {time}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          {onReplay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReplay();
              }}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Replay sentence"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave();
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                saved
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-label={saved ? "Sentence saved" : "Save sentence"}
              aria-pressed={saved}
            >
              {saved ? (
                <BookmarkCheck className="size-3.5" />
              ) : (
                <Bookmark className="size-3.5" />
              )}
            </button>
          )}
          {onCopy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Copy sentence + translation"
              title="Copy sentence + translation"
            >
              <Copy className="size-3.5" />
            </button>
          )}
          {onTranslate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTranslate();
              }}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Translate sentence"
              title="Translate this sentence"
            >
              <Languages className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <p
        className={cn(
          "mt-1 min-w-0 break-words font-mono text-[17px] leading-8 tracking-wide",
          isActive ? "font-medium text-foreground" : "text-foreground/85",
        )}
      >
        {tokenize(text).map((token, i) =>
          token.word ? (
            hiddenWords?.has(token.word) ? (
              <span
                key={i}
                className="mx-[1px] rounded bg-muted px-1.5 text-transparent select-none"
                title={token.text}
              >
                {token.text}
              </span>
            ) : (
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
                  "mx-[1px] cursor-pointer rounded px-0.5 py-0.5 transition-colors",
                  savedWords.has(token.word)
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {token.text}
              </span>
            )
          ) : (
            <span key={i}>{token.text}</span>
          ),
        )}
      </p>

      {showTranslation && translation && (
        <p className="mt-1 text-[14px] leading-6 text-[#ff00ff]">
          {translation === "__failed__" ? (
            <span className="italic text-muted-foreground/50">Translation unavailable</span>
          ) : (
            translation
          )}
        </p>
      )}

      {isActive && progress !== undefined && (
        <div className="pointer-events-none absolute inset-x-2 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
});
