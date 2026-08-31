import { SpeakerButton } from "@/components/app/SpeakerButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localApi } from "@/lib/local-api";
import { offlineLookup } from "@/lib/offline-dictionary";
import { saveWord } from "@/lib/study";
import { BookmarkCheck, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface WordSelection {
  word: string;
  display: string;
  example: string;
  sourceTitle?: string;
  language?: string;
  translation?: string;
  contextSentence?: string;
}

interface SavedWordEntry {
  _id: string;
  word: string;
  display: string;
  definition: string;
  example: string;
  sourceTitle?: string;
  language?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: WordSelection | null;
  existing?: SavedWordEntry | null;
  onSaved?: () => void;
  videoRef?: React.RefObject<{
    getCurrentTime: () => number;
    getInternalPlayer: () => HTMLVideoElement | null;
  } | null>;
}

export function WordDialog({
  open,
  onOpenChange,
  selection,
  existing,
  onSaved,
  videoRef,
}: Props) {
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [displayWord, setDisplayWord] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [lookupSource, setLookupSource] = useState<null | "offline" | "online">(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selection) return;
    setDisplayWord(existing?.display ?? selection.display);
    setDefinition(existing?.definition ?? "");
    setExample(existing?.example ?? selection.example);
    setLookupDone(Boolean(existing));
    setLookupFailed(false);
    setLookupSource(null);
    setScreenshot(null);
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
    }
    setScreenshotUrl(null);

    // Auto-capture video frame
    if (videoRef?.current) {
      try {
        const player = videoRef.current.getInternalPlayer?.();
        if (player && player.videoWidth > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = player.videoWidth;
          canvas.height = player.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(player, 0, 0);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  setScreenshot(blob);
                  setScreenshotUrl(URL.createObjectURL(blob));
                }
              },
              "image/jpeg",
              0.85,
            );
          }
        }
      } catch {
        // Video frame capture is best-effort
      }
    }

    // Pre-fill definition with sentence translation if no existing definition
    if (!existing?.definition && selection.translation) {
      setDefinition(selection.translation);
      setLookupDone(true);
      setLookupSource(null);
      return;
    }

    if (existing) return;

    // Lookup definition (offline first, then online)
    let cancelled = false;
    const offline = offlineLookup(selection.word);
    if (offline) {
      setDefinition(offline.definition);
      if (!selection.example && offline.example) setExample(offline.example);
      setLookupSource("offline");
      setLookupDone(true);
      return;
    }
    let cancelled2 = false;
    setIsLookingUp(true);
    localApi
      .dictionary(selection.word)
      .then((r) => {
        if (cancelled2) return;
        if (r?.definition) {
          setDefinition(r.definition);
          setLookupSource("online");
        } else {
          setLookupFailed(true);
        }
        if (r?.example && !selection.example) setExample(r.example);
      })
      .catch(() => {
        if (!cancelled2) setLookupFailed(true);
      })
      .finally(() => {
        if (!cancelled2) {
          setIsLookingUp(false);
          setLookupDone(true);
        }
      });
    return () => {
      cancelled = true;
      cancelled2 = true;
    };
  }, [open, selection, existing, videoRef]);

  useEffect(() => {
    return () => {
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    };
  }, [screenshotUrl]);

  const save = async () => {
    if (!selection) return;
    setIsSaving(true);
    try {
      const normalizedWord = displayWord.trim().toLowerCase();
      const display = displayWord.trim() || selection.display;
      if (existing) {
        await localApi.words.save({
          word: normalizedWord,
          display,
          definition,
          example,
          sourceTitle: selection.sourceTitle,
          language: selection.language,
          translation: selection.translation,
        });
        if (screenshot && existing._id) {
          localApi.words.uploadScreenshot(existing._id, screenshot).catch(() => {});
        }
        window.dispatchEvent(new CustomEvent("motus:word-saved"));
        toast.success("Word updated");
      } else {
        const res = await saveWord({
          word: normalizedWord,
          display,
          definition,
          example,
          sourceTitle: selection.sourceTitle,
          language: selection.language,
          translation: selection.translation,
          screenshot: screenshot ?? undefined,
        });
        if (res.saved) toast.success("Saved — Anki card generated automatically");
        if (res.skipped) {
          onOpenChange(false);
          return;
        }
      }
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("Could not save the word.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Input
              value={displayWord}
              onChange={(e) => setDisplayWord(e.target.value)}
              className="h-auto w-auto flex-1 bg-primary/10 text-primary font-semibold text-lg border-none focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="Word"
            />
            {selection && (
              <SpeakerButton
                text={displayWord || selection.display}
                lang={selection.language ?? existing?.language}
                label="Pronounce word"
              />
            )}
            {screenshotUrl && (
              <img
                src={screenshotUrl}
                alt="Screenshot"
                className="ml-auto h-[68px] w-[120px] rounded-md border object-cover cursor-pointer"
                onClick={() =>
                  screenshotUrl && window.open(screenshotUrl, "_blank")
                }
                title="Click to view full size"
              />
            )}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? "Already in your vocabulary — update it locally."
              : "Save this word and a local Anki card is generated automatically."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {selection?.contextSentence && displayWord && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wide">
                Context
              </span>
              <p className="mt-1">
                {selection.contextSentence
                  .split(
                    new RegExp(
                      `(${displayWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                      "i",
                    ),
                  )
                  .map((part, i) =>
                    part.toLowerCase() === displayWord.toLowerCase() ? (
                      <strong
                        key={i}
                        className="text-foreground font-medium"
                      >
                        {part}
                      </strong>
                    ) : (
                      part
                    ),
                  )}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="word-definition">Definition</Label>
              {isLookingUp && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Looking it up…
                </span>
              )}
              {!isLookingUp && lookupDone && !definition && (
                <Badge variant={lookupFailed ? "outline" : "secondary"}>
                  {lookupFailed ? "Offline — add your own" : ""}
                </Badge>
              )}
              {lookupSource === "offline" && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3" />
                  Offline dictionary
                </Badge>
              )}
            </div>
            <Textarea
              id="word-definition"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Type the meaning in your own words"
              className="min-h-20 resize-none"
            />
            {lookupFailed && (
              <p className="text-[11px] text-muted-foreground">
                Online dictionary is unreachable (you appear to be offline). The
                offline starter dictionary covers common words; for anything
                else, add your own definition — it still generates an Anki card.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="word-example">Example sentence</Label>
            <Textarea
              id="word-example"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={isSaving || !definition}>
            {isSaving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <BookmarkCheck className="mr-2 size-4" />
            )}
            {existing ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
