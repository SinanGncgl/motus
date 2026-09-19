/**
 * Speech-to-text transcription.
 *
 * Uses server-side faster-whisper (Python) for reliable transcription.
 * The file is uploaded to the server, transcribed there, and the timestamped
 * lines are returned. No browser-side model loading needed.
 */

import type { SubtitleLine } from "./subtitles";
import { localApi } from "./local-api";

export type TranscribeStage =
  | "grabbing"
  | "decoding"
  | "downloading"
  | "loading"
  | "transcribing";

export interface TranscribeProgress {
  stage: TranscribeStage;
  percent?: number;
  note?: string;
}

export type OnTranscribeProgress = (progress: TranscribeProgress) => void;

export type TranscribeModel = "fast" | "accurate" | "best";

export interface TranscribeResult {
  lines: SubtitleLine[];
  text: string;
}

export interface TranscribeOptions {
  language?: string;
  model?: TranscribeModel;
  onProgress?: OnTranscribeProgress;
}

/** Transcribe an audio/video file via the server (faster-whisper) with SSE progress. */
export async function transcribeFile(
  file: File,
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const { language, model = "accurate", onProgress } = options;

  if (file.size > 500 * 1024 * 1024) {
    throw new Error("TOO_LARGE_FILE");
  }
  if (!/^(audio|video)\//.test(file.type)) {
    throw new Error("UNSUPPORTED_TYPE");
  }

  onProgress?.({ stage: "decoding" });
  const { storageId } = await localApi.upload(file);
  onProgress?.({ stage: "downloading", percent: 0, note: `Loading Whisper ${model} model…` });

  const result = await localApi.transcribeFileSSE(storageId, language, model, (p) => {
    if (p.status === "loading") {
      onProgress?.({ stage: "downloading", note: p.message || "Loading model…" });
    } else if (p.status === "transcribing") {
      onProgress?.({ stage: "transcribing", percent: p.percent, note: `${p.line_count || 0} lines transcribed` });
    } else if (p.status === "progress") {
      onProgress?.({ stage: "transcribing", percent: p.percent, note: `${p.line_count || 0} lines · ${p.current_text || ""}` });
    }
  });

  const lines: SubtitleLine[] = (result.lines || []).map((l, i) => ({
    index: i + 1,
    start: l.start,
    end: l.end,
    text: l.text,
  }));

  if (lines.length === 0) throw new Error("EMPTY_RESULT");
  return { lines, text: lines.map((l) => l.text).join(" ") };
}

/** Human-friendly message for a transcribeFile error code. */
export function transcribeErrorMessage(error: unknown): string {
  console.error("[Motus] transcribe error:", error);
  if (error instanceof Error) {
    switch (error.message) {
      case "TOO_LARGE_FILE":
        return "That file is over 500 MB — try a shorter clip.";
      case "UNSUPPORTED_TYPE":
        return "That file type isn't supported. Upload a video or audio file (MP4, WebM, MP3, M4A, WAV…).";
      case "TOO_LONG":
        return "That's over 2 hours long — try a shorter clip.";
      case "DECODE_FAILED":
        return "Couldn't read that file in your browser. Try MP4, WebM, MP3, M4A or WAV.";
      case "EMPTY_RESULT":
        return "No speech was detected in that file.";
      case "UPLOAD_FAILED":
        return "Couldn't upload the file — check your connection.";
      default:
        return `Transcription failed — ${error.message}`;
    }
  }
  return "Transcription failed — unknown error.";
}
