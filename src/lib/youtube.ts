/**
 * YouTube helpers: extract a video id from any common link format and load
 * the official IFrame Player API (no API key required for embedding).
 */

export interface YouTubePlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  setPlaybackRate(rate: number): void;
  getVolume(): number;
  setVolume(volume: number): void;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

export interface YouTubeApi {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Extract the 11-char YouTube video id from a watch/shorts/embed/youtu.be link. */
export function extractYouTubeId(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match?.[1] ?? null;
}

/**
 * The yt-dlp command that grabs a video's audio as an m4a file, ready to drop
 * into the app's transcribe box. Uses the lowest-bitrate audio stream (itag
 * 139) — tiny download, perfect for speech transcription.
 */
export function ytDlpAudioCommand(url: string): string {
  const videoId = extractYouTubeId(url);
  const target = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : url.trim();
  return `yt-dlp -f 139 -o audio.m4a "${target}"`;
}

/**
 * Local companion server (see grab-server.mjs) that grabs YouTube audio with
 * yt-dlp from the user's own non-blocked IP. Loopback is exempt from
 * mixed-content blocking, so an https page may fetch http://127.0.0.1.
 */
export const GRAB_SERVER_URL = "";

export interface GrabHealth {
  ok: boolean;
  ytDlp: boolean;
  version?: string;
}

/** True when the local grab companion is reachable (returns its health). */
export async function detectLocalGrabber(
  timeoutMs = 1500,
): Promise<GrabHealth | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${GRAB_SERVER_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as GrabHealth;
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

/**
 * Ask the local grab companion to download a YouTube video's audio and
 * return it as an m4a File, ready for on-device transcription.
 */
export async function grabYouTubeAudio(url: string): Promise<File> {
  const res = await fetch(`${GRAB_SERVER_URL}/grab`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    if (data?.error === "YTDLP_MISSING") {
      throw new Error(`YTDLP_MISSING:${data.message ?? ""}`);
    }
    if (data?.error === "YTDLP_FAILED") {
      throw new Error(`YTDLP_FAILED:${data.message ?? ""}`);
    }
    if (data?.error === "INVALID_URL") {
      throw new Error("GRAB_INVALID_URL");
    }
    throw new Error("GRAB_FAILED");
  }
  const blob = await res.blob();
  if (blob.size < 1024) {
    throw new Error("GRAB_EMPTY");
  }
  return new File([blob], "audio.mp3", { type: "audio/mpeg" });
}

export interface GrabProgressEvent {
  stage: "grabbing" | "downloading" | "loading";
  percent: number;
}

/**
 * Stream a YouTube audio grab with real progress. Opens an SSE connection to
 * `/grab-stream`, reports download/transcode progress through `onProgress`,
 * then fetches the finished audio binary and resolves it as a File. Falls
 * back to the buffered `grabYouTubeAudio` when the server doesn't support
 * streaming (older companion) so nothing regresses.
 */
export async function grabYouTubeAudioStream(
  url: string,
  onProgress?: (p: GrabProgressEvent) => void,
  language?: string,
): Promise<File> {
  const esRef: { current: EventSource | null } = { current: null };
  try {
    const langParam = language && language !== "auto" ? `&lang=${encodeURIComponent(language.split("-")[0] || language)}` : "";
    const result = await new Promise<File>((resolve, reject) => {
      esRef.current = new EventSource(`${GRAB_SERVER_URL}/grab-stream?url=${encodeURIComponent(url)}${langParam}`);
      const es = esRef.current;
      const close = () => {
        try {
          esRef.current?.close();
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        // If the stream died before "done" (e.g. old server without SSE),
        // reject so the caller can fall back to the buffered endpoint.
        close();
        reject(new Error("GRAB_STREAM_UNSUPPORTED"));
      };
      es.addEventListener("progress", (ev) => {
        try {
          const p = JSON.parse((ev as MessageEvent).data) as GrabProgressEvent;
          onProgress?.(p);
        } catch {
          /* ignore malformed event */
        }
      });
      es.addEventListener("error", (ev) => {
        close();
        try {
          const d = JSON.parse((ev as MessageEvent).data) as {
            code?: string;
            message?: string;
          };
          if (d.code === "YTDLP_MISSING") reject(new Error(`YTDLP_MISSING:${d.message ?? ""}`));
          else if (d.code === "INVALID_URL") reject(new Error("GRAB_INVALID_URL"));
          else if (d.code === "GRAB_EMPTY") reject(new Error("GRAB_EMPTY"));
          else reject(new Error(`YTDLP_FAILED:${d.message ?? ""}`));
        } catch {
          reject(new Error("GRAB_FAILED"));
        }
      });
      es.addEventListener("done", async (ev) => {
        close();
        try {
          const d = JSON.parse((ev as MessageEvent).data) as { fileUrl?: string };
          const fileUrl = d.fileUrl ?? null;
          if (!fileUrl) {
            reject(new Error("GRAB_FAILED"));
            return;
          }
          const res = await fetch(fileUrl);
          if (!res.ok) {
            reject(new Error("GRAB_FAILED"));
            return;
          }
          const blob = await res.blob();
          if (blob.size < 1024) {
            reject(new Error("GRAB_EMPTY"));
            return;
          }
          resolve(new File([blob], "audio.mp3", { type: "audio/mpeg" }));
        } catch (err) {
          reject(err instanceof Error ? err : new Error("GRAB_FAILED"));
        }
      });
    });
    return result;
  } catch (err) {
    // Fall back to the buffered endpoint for older servers / non-SSE failure.
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        /* ignore */
      }
    }
    if (
      err instanceof Error &&
      (err.message === "GRAB_STREAM_UNSUPPORTED" ||
        err.message === "GRAB_INVALID_URL")
    ) {
      if (err.message === "GRAB_INVALID_URL") throw err;
    }
    onProgress?.({ stage: "downloading", percent: 0 });
    return grabYouTubeAudio(url);
  }
}

/** Human-friendly message for a grabYouTubeAudio error code. */
export function grabErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.startsWith("YTDLP_MISSING")) {
      return (
        error.message.slice("YTDLP_MISSING:".length) ||
        "yt-dlp isn't installed on this machine."
      );
    }
    if (error.message.startsWith("YTDLP_FAILED")) {
      return (
        error.message.slice("YTDLP_FAILED:".length) ||
        "yt-dlp couldn't grab that video's audio."
      );
    }
    switch (error.message) {
      case "GRAB_INVALID_URL":
        return "That isn't a YouTube link.";
      case "GRAB_EMPTY":
        return "Couldn't grab that video's audio — check the link and try again.";
      case "GRAB_FAILED":
        return "The local grabber couldn't fetch that video — check that it's still running.";
      default:
        return "Couldn't grab the audio. Check your local grab server and try again.";
    }
  }
  return "Couldn't grab the audio. Check your local grab server and try again.";
}

/** Copy text to the clipboard with a legacy fallback for non-secure contexts. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

/** Load the YouTube IFrame API once and resolve when ready. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) {
    return apiPromise;
  }
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) {
        resolve(window.YT);
      }
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}
