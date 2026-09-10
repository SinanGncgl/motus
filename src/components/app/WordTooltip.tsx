import { SpeakerButton } from "@/components/app/SpeakerButton";
import { offlineLookup } from "@/lib/offline-dictionary";
import { cn } from "@/lib/utils";
import { BookmarkCheck, Plus, X } from "lucide-react";
import { useState, useMemo, type ReactNode } from "react";

interface Props {
  word: string; // normalized word (lowercase)
  display: string; // raw text as shown
  example: string;
  lang?: string;
  saved?: boolean;
  onSave?: () => void;
  onRemove?: () => void;
  onOpenDialog?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Inline, self-contained word widget: shows a compact popover with the
 * offline definition on hover (desktop) / tap (touch), plus quick "save" and
 * "details" actions. Keeps learners in context — no page navigation.
 */
export function WordTooltip({
  word: _word,
  display,
  example: _example,
  lang,
  saved,
  onSave,
  onRemove,
  onOpenDialog,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const entry = useMemo(() => offlineLookup(display), [display]);

  return (
    <span
      className={cn("relative inline-block", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="rounded px-0.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpenDialog?.();
        }}
      >
        {children}
      </button>
      {open && (
        <span
          className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-xl border bg-popover p-3 text-left shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-popover-foreground">
              {display}
            </span>
            <SpeakerButton
              text={display}
              lang={lang}
              label="Pronounce"
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            />
          </span>
          <span className="mt-1.5 block text-[13px] leading-5 text-popover-foreground/90">
            {entry?.definition ?? (
              <span className="italic text-muted-foreground">
                No offline definition — open for details.
              </span>
            )}
          </span>
          {entry?.example && (
            <span className="mt-1.5 block border-t border-border/60 pt-1.5 text-[11px] leading-4 text-muted-foreground">
              “{entry.example}”
            </span>
          )}
          <span className="mt-2.5 flex items-center gap-2 border-t border-border/60 pt-2.5">
            {saved ? (
              <>
                <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                  <BookmarkCheck className="size-3" /> Saved
                </span>
                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                      setOpen(false);
                    }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3" /> Remove
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave?.();
                  setOpen(false);
                }}
                className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="size-3" /> Save word
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDialog?.();
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Details
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
