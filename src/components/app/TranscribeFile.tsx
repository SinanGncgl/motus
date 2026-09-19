import { CheckCircle2, FileAudio, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { SubtitleLine } from "@/lib/subtitles";
import { localApi } from "@/lib/local-api";
import { transcribeErrorMessage, transcribeFile, type TranscribeProgress, type TranscribeModel } from "@/lib/transcribe";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface TranscribedFile {
  lines: SubtitleLine[];
  fileId: string;
  fileName: string;
}

interface TranscribeFileProps {
  language: string;
  onTranscribed: (result: TranscribedFile) => void;
  onError?: (message: string) => void;
  className?: string;
}

const STAGE_LABELS: Record<TranscribeProgress["stage"], string> = {
  grabbing: "Grabbing audio from YouTube…",
  decoding: "Reading audio…",
  downloading: "Downloading speech model…",
  loading: "Preparing…",
  transcribing: "Transcribing… (this can take a moment)",
};

export function TranscribeFile({ language, onTranscribed, onError, className }: TranscribeFileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<TranscribeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<TranscribeModel>("best");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const result = await transcribeFile(file, { language, model, onProgress: setBusy });
      setBusy({ stage: "loading" });
      const { storageId } = await localApi.upload(file);
      onTranscribed({ lines: result.lines, fileId: storageId, fileName: file.name });
    } catch (e) {
      const message = e instanceof Error && e.message === "UPLOAD_FAILED"
        ? "Couldn't save the file — try again."
        : transcribeErrorMessage(e);
      setError(message);
      onError?.(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm text-muted-foreground">Quality:</label>
        <Select value={model} onValueChange={(v) => setModel(v as TranscribeModel)}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fast">Fast (tiny)</SelectItem>
            <SelectItem value="accurate">Accurate (base)</SelectItem>
            <SelectItem value="best">Best (large-v3)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <input ref={inputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      {busy ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{STAGE_LABELS[busy.stage]}</p>
            {busy.note && <p className="mt-0.5 text-[11px] text-muted-foreground">{busy.note}</p>}
            {busy.stage === "downloading" && busy.percent !== undefined && <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${busy.percent}%` }} /></div>}
            {busy.stage === "downloading" && <p className="mt-1 text-[11px] text-muted-foreground">One-time download (~{model === "best" ? "3100" : model === "accurate" ? "280" : "145"} MB), cached afterwards</p>}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload className="size-5" /></span>
          <span className="text-sm font-medium">Upload a video or audio file to transcribe</span>
          <span className="text-xs text-muted-foreground">MP4, WebM, MP3, M4A, WAV — transcription runs in your browser, free &amp; private</span>
        </button>
      )}
      {error && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{error}</p>}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70"><FileAudio className="size-3" />Uses open-source Whisper — no API key needed, audio never leaves your device</p>
    </div>
  );
}

export function TranscribedChip({ result, onClear }: { result: TranscribedFile; onClear: () => void }) {
  return <div className="flex items-center gap-2 rounded-lg border bg-emerald-500/5 px-3 py-2"><CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span className="min-w-0 flex-1 truncate text-xs font-medium text-emerald-700 dark:text-emerald-300">Transcribed {result.lines.length} lines from “{result.fileName}”</span><button type="button" onClick={onClear} className="shrink-0 cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline">Clear</button></div>;
}
