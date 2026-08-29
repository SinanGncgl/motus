/**
 * On-device speech-to-text using open-source Whisper via transformers.js.
 *
 * The transcription runs entirely in the user's browser (WebAssembly or
 * WebGPU) — no API key, no server round-trip, and the audio never leaves the
 * device. The model is downloaded from the Hugging Face Hub on first use and
 * cached by the browser afterwards.
 *
 * Reliability:
 * - transformers.js is imported lazily, only when a transcription actually
 *   starts, so the heavy engine never blocks pages that don't need it.
 * - Nothing depends on a third-party CDN: the ONNX runtime WASM files are
 *   served from the app's own origin (/wasm).
 * - If the Hugging Face Hub is unreachable (blocked or down), the model
 *   download retries through the hf-mirror.com mirror.
 * - If a model fails to load entirely, we degrade to a smaller Whisper
 *   variant so transcription still works.
 */

import type { SubtitleLine } from "./subtitles";

export type TranscribeStage =
  | "decoding"
  | "downloading"
  | "loading"
  | "transcribing";

export interface TranscribeProgress {
  stage: TranscribeStage;
  /** 0..100 while the model is downloading. */
  percent?: number;
  /** Optional note shown under the stage label (e.g. model fallback). */
  note?: string;
}

export type OnTranscribeProgress = (progress: TranscribeProgress) => void;

// BCP-47 tags (as used in the language picker) → Whisper language names.
const WHISPER_LANGUAGE: Record<string, string> = {
  "en-US": "english",
  "en-GB": "english",
  "es-ES": "spanish",
  "fr-FR": "french",
  "de-DE": "german",
  "it-IT": "italian",
  "pt-PT": "portuguese",
  "nl-NL": "dutch",
  "pl-PL": "polish",
  "sv-SE": "swedish",
  "ru-RU": "russian",
  "hi-IN": "hindi",
  "ja-JP": "japanese",
  "ko-KR": "korean",
  "zh-CN": "chinese",
  "ar-SA": "arabic",
  "tr-TR": "turkish",
};

/** Whisper language name for a BCP-47 tag, or undefined (auto-detect). */
export function whisperLanguage(code?: string): string | undefined {
  if (!code) return undefined;
  return WHISPER_LANGUAGE[code];
}

export type TranscribeModel = "fast" | "accurate";

// int8-quantized multilingual Whisper models, biggest first. If one fails to
// load (network/DNS issues), we degrade down the chain so the user still gets
// a transcript instead of an error.
// Local-only setup: only whisper-tiny is bundled under /models/v1/, and
// allowRemoteModels is disabled, so the chain must not reference models that
// aren't present locally (base/small) — doing so throws MODEL_DOWNLOAD_FAILED
// before the tiny fallback can run.
const MODEL_CHAIN: Record<TranscribeModel, string[]> = {
  fast: ["onnx-community/whisper-tiny"],
  accurate: ["onnx-community/whisper-tiny"],
};

const DEFAULT_HOST = "https://huggingface.co/";
const MIRROR_HOST = "https://hf-mirror.com/";
const LOCAL_MODEL_HOST = "/models/v1/";

// The transformers.js module is loaded lazily (see getTransformers) so the
// ~1 MB engine is only fetched when a transcription actually starts.
type TransformersModule = typeof import("@huggingface/transformers");
let transformersModule: TransformersModule | null = null;

/** Point the ONNX runtime at the WASM files vendored in /public/wasm. */
function configureEnv(env: TransformersModule["env"]): void {
  if (typeof window === "undefined") return;
  env.allowLocalModels = true;
  env.localModelPath = LOCAL_MODEL_HOST;
  // Only use the locally-served models — never fall back to Hugging Face or
  // its mirror (they're unreachable in this offline/local setup, and a silent
  // fallback produces a confusing "couldn't download the speech model" error).
  env.allowRemoteModels = false;
  // The Safari variant matches what transformers.js would pick
  // (single-threaded build, no asyncify).
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const suffix = isSafari ? "" : ".asyncify";
  const base = new URL(
    `${import.meta.env.BASE_URL}wasm/`,
    window.location.origin,
  ).href;
  const wasmEnv = env.backends.onnx.wasm;
  if (wasmEnv) {
    wasmEnv.wasmPaths = {
      mjs: `${base}ort-wasm-simd-threaded${suffix}.mjs`,
      wasm: `${base}ort-wasm-simd-threaded${suffix}.wasm`,
    };
  }
}

async function getTransformers(): Promise<TransformersModule> {
  if (!transformersModule) {
    const mod = await import("@huggingface/transformers");
    configureEnv(mod.env);
    transformersModule = mod;
  }
  return transformersModule;
}

// Successful pipeline instances are cached per model so repeat transcriptions
// reuse the loaded model (and its browser cache) instead of re-downloading.
const transcriberCache = new Map<string, Promise<unknown>>();
let progressHandler: OnTranscribeProgress | null = null;

async function createTranscriber(model: string): Promise<unknown> {
  const { env, pipeline } = await getTransformers();
  console.log("[Motus] createTranscriber", { model, localModelPath: env.localModelPath, allowRemoteModels: env.allowRemoteModels, allowLocalModels: env.allowLocalModels });
  // Prefer a model bundled by the local Docker image, then use the public
  // hubs as a fallback for development installs.
  let lastError: unknown;
  for (const host of [LOCAL_MODEL_HOST, DEFAULT_HOST, MIRROR_HOST]) {
    if (host !== LOCAL_MODEL_HOST) env.remoteHost = host;
    try {
      return await pipeline("automatic-speech-recognition", model, {
        dtype: "fp32",
        // Force a fresh model cache entry. transformers.js keys its Cache
        // Storage model cache by model id + revision (not the local path), so
        // a corrupt cached model from an earlier broken state would otherwise
        // be reused forever and the load would fail without ever hitting the
        // server. Bumping the revision invalidates that cache.
        revision: "motus-local-v2",
        progress_callback: (p: {
          status?: string;
          loaded?: number;
          total?: number;
        }) => {
          if (!progressHandler) return;
          if (
            p.status === "progress" &&
            typeof p.loaded === "number" &&
            typeof p.total === "number" &&
            p.total > 0
          ) {
            progressHandler({
              stage: "downloading",
              percent: Math.min(
                100,
                Math.round((p.loaded / p.total) * 100),
              ),
            });
          } else if (p.status === "ready") {
            progressHandler({ stage: "loading" });
          }
        },
      });
    } catch (error) {
      lastError = error;
      console.error("[Motus] model load failed for", model, "→", error);
    }
  }
  // Surface the real underlying cause (which file/URL failed) instead of the
  // generic Hugging Face message, so failures are debuggable in the console.
  const detail =
    lastError instanceof Error
      ? lastError.message
      : typeof lastError === "string"
        ? lastError
        : JSON.stringify(lastError);
  throw new Error(`MODEL_DOWNLOAD_FAILED: ${detail}`);
}

function loadTranscriber(model: string): Promise<unknown> {
  let promise = transcriberCache.get(model);
  if (!promise) {
    promise = createTranscriber(model).catch((error) => {
      transcriberCache.delete(model);
      throw error;
    });
    transcriberCache.set(model, promise);
  }
  return promise;
}

/** Decode the file and resample to 16 kHz mono (what Whisper expects). */
async function decodeAudioFile(
  file: File,
): Promise<{ samples: Float32Array; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtor();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const duration = decoded.duration;
    const targetRate = 16000;
    const length = Math.max(1, Math.ceil(duration * targetRate));
    const offline = new OfflineAudioContext(1, length, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return { samples: rendered.getChannelData(0), duration };
  } finally {
    void ctx.close();
  }
}

export interface TranscribeResult {
  lines: SubtitleLine[];
  text: string;
}

export interface TranscribeOptions {
  language?: string;
  model?: TranscribeModel;
  onProgress?: OnTranscribeProgress;
}

/** Transcribe an audio/video file entirely in the browser. */
export async function transcribeFile(
  file: File,
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const { language, model = "fast", onProgress } = options;

  if (file.size > 500 * 1024 * 1024) {
    throw new Error("TOO_LARGE_FILE");
  }
  if (!/^(audio|video)\//.test(file.type)) {
    throw new Error("UNSUPPORTED_TYPE");
  }

  onProgress?.({ stage: "decoding" });
  let samples: Float32Array;
  let duration: number;
  try {
    ({ samples, duration } = await decodeAudioFile(file));
  } catch (error) {
    console.error("[Motus] Audio decode failed", error);
    throw new Error("DECODE_FAILED");
  }
  if (duration > 2 * 60 * 60) {
    throw new Error("TOO_LONG");
  }

  progressHandler = onProgress ?? null;
  try {
    onProgress?.({ stage: "downloading", percent: 0 });
    const chain = MODEL_CHAIN[model];
    let transcriber: unknown;
    let usedFallback = false;
    for (let i = 0; i < chain.length; i++) {
      try {
        transcriber = await loadTranscriber(chain[i]);
        break;
      } catch {
        if (i < chain.length - 1) {
          usedFallback = true;
          onProgress?.({
            stage: "downloading",
            percent: 0,
            note: `Main model unavailable — using a smaller one`,
          });
        } else {
          throw new Error("MODEL_DOWNLOAD_FAILED");
        }
      }
    }
    onProgress?.({
      stage: "transcribing",
      note: usedFallback
        ? "Using a smaller model — slightly less accurate"
        : undefined,
    });

    const mod = await getTransformers();
    const lang = whisperLanguage(language);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = await (transcriber as (input: Float32Array, opts: Record<string, unknown>) => Promise<any>)(
      samples,
      {
        task: "transcribe",
        language: lang,
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      },
    );

    const chunks = output?.chunks as
      | Array<{ timestamp: [number, number]; text: string }>
      | undefined;

    const lines: SubtitleLine[] = [];
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        const text = (chunk?.text ?? "").trim();
        if (!text) continue;
        const start = Array.isArray(chunk?.timestamp)
          ? Math.round((chunk.timestamp[0] ?? 0) * 100) / 100
          : undefined;
        const end = Array.isArray(chunk?.timestamp)
          ? Math.round((chunk.timestamp[1] ?? 0) * 100) / 100
          : undefined;
        lines.push({
          index: lines.length + 1,
          start,
          end,
          text,
        });
      }
    } else if (typeof output?.text === "string" && output.text.trim()) {
      lines.push({ index: 1, text: output.text.trim() });
    }

    if (lines.length === 0) {
      throw new Error("EMPTY_RESULT");
    }
    return { lines, text: typeof output?.text === "string" ? output.text : "" };
  } finally {
    progressHandler = null;
  }
}

/** Human-friendly message for a transcribeFile error code. */
export function transcribeErrorMessage(error: unknown): string {
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
      case "MODEL_DOWNLOAD_FAILED":
        return `Couldn't load the local speech model. ${error.message.replace("MODEL_DOWNLOAD_FAILED: ", "")}`;
      default:
        return "Transcription failed — check your connection and try again.";
    }
  }
  return "Transcription failed — check your connection and try again.";
}
