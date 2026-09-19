import { cn } from "@/lib/utils";
import { tokenize } from "@/lib/subtitles";
import React from "react";
import { Bookmark, BookmarkCheck, Copy, Languages, RotateCcw } from "lucide-react";
import { WordTooltip } from "@/components/app/WordTooltip";

interface TranscriptLineProps {
  text: string;
  rowId: number;
  time?: string;
  lang?: string | null;
  isActive?: boolean;
  progress?: number;
  translation?: string | null;
  showTranslation?: boolean;
  savedWords: Set<string>;
  hiddenWords?: Set<string>;
  onWordClick: (word: string, raw: string, lineText: string) => void;
  onWordSave?: (word: string, raw: string, lineText: string) => void;
  onLineClick?: () => void;
  onReplay?: () => void;
  onToggleSave?: () => void;
  saved?: boolean;
  onCopy?: () => void;
  onTranslate?: () => void;
}

export const TranscriptLine = React.memo(function TranscriptLine({
  text,
  rowId,
  time,
  lang,
  isActive = false,
  progress,
  translation,
  showTranslation = true,
  savedWords,
  hiddenWords,
  onWordClick,
  onWordSave,
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
        "group relative scroll-mt-4 rounded-md border-l-2 px-2 py-1 transition-colors duration-150",
        onLineClick && "cursor-pointer",
        isActive
          ? "border-l-primary bg-primary/10"
          : "border-l-transparent hover:bg-muted/50",
      )}
    >
      <div className="flex items-start gap-1.5">
        {/* Timestamp */}
        {time !== undefined && (
          <span
            className={cn(
              "shrink-0 select-none pt-0.5 font-mono text-[10px] tabular-nums leading-5",
              isActive ? "text-primary" : "text-muted-foreground/50",
            )}
          >
            {time}
          </span>
        )}

        {/* Text + translation */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "min-w-0 break-words text-sm leading-5 tracking-wide",
              isActive ? "font-medium text-foreground" : "text-foreground/80",
            )}
          >
            {tokenize(text).map((token, i) =>
              token.word ? (
                hiddenWords?.has(token.word) ? (
                  <span
                    key={i}
                    className="mx-[1px] rounded bg-muted px-1 text-[13px] text-transparent select-none"
                    title={token.text}
                  >
                    {token.text}
                  </span>
                ) : (
                  <WordTooltip
                    key={i}
                    word={token.word}
                    display={token.text}
                    example={text}
                    lang={lang ?? undefined}
                    saved={savedWords.has(token.word)}
                    onSave={onWordSave ? () => onWordSave(token.word, token.text, text) : undefined}
                    onOpenDialog={() => onWordClick(token.word, token.text, text)}
                  >
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onWordClick(token.word, token.text, text);
                      }}
                      className={cn(
                        "cursor-pointer rounded px-0.5 transition-colors",
                        savedWords.has(token.word)
                          ? "bg-primary/10 font-medium text-primary"
                          : "hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      )}
                    >
                      {token.text}
                    </span>
                  </WordTooltip>
                )
              ) : (
                <span key={i}>{token.text}</span>
              ),
            )}
          </p>

          {showTranslation && translation && (
            <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground/60">
              {translation === "__failed__" ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTranslate?.(); }}
                  className="cursor-pointer italic text-muted-foreground/40 underline-offset-2 hover:underline"
                >
                  Translation unavailable — click to retry
                </button>
              ) : (
                translation
              )}
            </p>
          )}
        </div>

        {/* Action buttons — always visible, compact */}
        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
          {onReplay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReplay();
              }}
              className="flex size-5 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Replay sentence"
            >
              <RotateCcw className="size-3" />
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
                "flex size-5 items-center justify-center rounded transition-colors",
                saved
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
              )}
              aria-label={saved ? "Sentence saved" : "Save sentence"}
              aria-pressed={saved}
            >
              {saved ? (
                <BookmarkCheck className="size-3" />
              ) : (
                <Bookmark className="size-3" />
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
              className="flex size-5 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Copy sentence"
            >
              <Copy className="size-3" />
            </button>
          )}
          {onTranslate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTranslate();
              }}
              className="flex size-5 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Translate sentence"
            >
              <Languages className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar for active line */}
      {isActive && progress !== undefined && (
        <div className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
});
