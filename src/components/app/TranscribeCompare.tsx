import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";
import type { LocalLine } from "@/lib/local-api";

interface TranscribeCompareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  youtubeLines: LocalLine[];
  whisperLines: LocalLine[];
  onSelect: (lines: LocalLine[], source: "youtube" | "whisper") => void;
}

function wordCount(lines: LocalLine[]): number {
  return lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TranscribeCompare({
  open,
  onOpenChange,
  youtubeLines,
  whisperLines,
  onSelect,
}: TranscribeCompareProps) {
  const [selected, setSelected] = useState<"youtube" | "whisper">(
    youtubeLines.length >= whisperLines.length ? "youtube" : "whisper",
  );

  const youtubeWords = wordCount(youtubeLines);
  const whisperWords = wordCount(whisperLines);

  const handleConfirm = () => {
    if (selected === "youtube") {
      onSelect(youtubeLines, "youtube");
    } else {
      onSelect(whisperLines, "whisper");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Choose the better transcription</DialogTitle>
          <DialogDescription>
            Compare the two sources side by side, then pick the one with fewer errors.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden sm:flex-row">
          {/* YouTube side */}
          <CompareColumn
            label="YouTube Captions"
            lines={youtubeLines}
            lineCount={youtubeLines.length}
            words={youtubeWords}
            isSelected={selected === "youtube"}
            onSelect={() => setSelected("youtube")}
            otherLines={whisperLines}
          />

          {/* Divider */}
          <div className="hidden w-px bg-border sm:block" />
          <div className="h-px bg-border sm:hidden" />

          {/* Whisper side */}
          <CompareColumn
            label="Whisper"
            lines={whisperLines}
            lineCount={whisperLines.length}
            words={whisperWords}
            isSelected={selected === "whisper"}
            onSelect={() => setSelected("whisper")}
            otherLines={youtubeLines}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer gap-1.5"
            onClick={handleConfirm}
          >
            <Check className="size-3.5" />
            Use {selected === "youtube" ? "YouTube" : "Whisper"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompareColumn({
  label,
  lines,
  lineCount,
  words,
  isSelected,
  onSelect,
  otherLines,
}: {
  label: string;
  lines: LocalLine[];
  lineCount: number;
  words: number;
  isSelected: boolean;
  onSelect: () => void;
  otherLines: LocalLine[];
}) {
  const otherTexts = new Set(otherLines.map((l) => l.text.trim().toLowerCase()));

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 cursor-pointer flex-col transition-colors",
        isSelected && "bg-primary/5",
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-4 items-center justify-center rounded-full border-2 transition-colors",
              isSelected ? "border-primary bg-primary" : "border-muted-foreground/30",
            )}
          >
            {isSelected && <Check className="size-2.5 text-primary-foreground" />}
          </div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {lineCount} lines · {words} words
        </span>
      </div>

      {/* Line list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
        {lines.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/50 italic">
            No captions available
          </p>
        ) : (
          lines.map((line, i) => {
            const isDifferent = !otherTexts.has(line.text.trim().toLowerCase());
            return (
              <div
                key={i}
                className={cn(
                  "flex gap-2 border-b border-border/30 py-1 text-xs last:border-0",
                  isDifferent && "bg-amber-500/5",
                )}
              >
                <span className="shrink-0 tabular-nums text-muted-foreground/40">
                  {line.start !== undefined ? formatClock(line.start) : ""}
                </span>
                <span className="min-w-0 flex-1 break-words text-foreground/80">
                  {line.text}
                </span>
                {isDifferent && (
                  <span className="shrink-0 text-[10px] text-amber-500/60" title="Differs from other source">
                    ✦
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
