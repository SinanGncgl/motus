import { SpeakerButton } from "@/components/app/SpeakerButton";
import { offlineLookup } from "@/lib/offline-dictionary";
import { localApi } from "@/lib/local-api";
import { cn } from "@/lib/utils";
import { BookmarkCheck, ExternalLink, Plus, X } from "lucide-react";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";

interface Props {
  word: string;
  display: string;
  example: string;
  lang?: string;
  saved?: boolean;
  onSave?: () => void;
  onRemove?: () => void;
  onOpenDialog?: () => void;
  children: ReactNode;
  className?: string;
}

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
  const [baseForm, setBaseForm] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const tooltipW = 320;
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    if (left < 8) left = 8;
    if (left + tooltipW > vw - 8) left = vw - tooltipW - 8;
    const above = rect.bottom + 200 > window.innerHeight;
    setTooltipStyle({
      position: "fixed",
      ...(above
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      left,
      width: tooltipW,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (!open || !lang || lang !== "de") return;
    let cancelled = false;
    localApi.dictionaryDe(display).then((res) => {
      if (!cancelled && res?.baseForm && res.baseForm !== display) {
        setBaseForm(res.baseForm);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, display, lang]);

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-block", className)}
    >
      <button
        type="button"
        className="rounded px-0.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children}
      </button>
      {open && (
        <span
          ref={popupRef}
          className="z-[100] rounded-xl border bg-popover p-3 text-left shadow-xl"
          style={tooltipStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-popover-foreground">
              {display}
            </span>
            <span className="flex items-center gap-1">
              <SpeakerButton
                text={display}
                lang={lang}
                label="Pronounce"
                className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </span>
          </span>

          {baseForm && (
            <span className="mt-1 block text-[12px] text-muted-foreground">
              base form: <span className="font-medium text-foreground/80">{baseForm}</span>
            </span>
          )}

          <span className="mt-1.5 block text-[13px] leading-5 text-popover-foreground/90">
            {entry?.definition ?? (
              <span className="italic text-muted-foreground">
                No offline definition available.
              </span>
            )}
          </span>

          {entry?.example && (
            <span className="mt-1.5 block border-t border-border/60 pt-1.5 text-[11px] leading-4 text-muted-foreground">
              &ldquo;{entry.example}&rdquo;
            </span>
          )}

          <span className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
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
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
                className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
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
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Details
            </button>
            <a
              href={`https://www.dict.cc/?s=${encodeURIComponent(baseForm || display)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              <ExternalLink className="size-3" /> dict.cc
            </a>
          </span>
        </span>
      )}
    </span>
  );
}
