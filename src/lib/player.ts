import type React from "react";

/**
 * The minimal player surface the Watch page drives (play/pause/seek/time).
 * Both the YouTube iframe player and the HTML5 file player implement it.
 */
export interface PlayerHandle {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  /** Total media duration in seconds, if known. Optional. */
  getDuration?(): number;
  /** Set playback speed (0.5, 1, 1.25, …). Optional; may be a no-op. */
  setPlaybackRate?(rate: number): void;
  /** Return the underlying <video> element for frame capture, if available. */
  getInternalPlayer(): HTMLVideoElement | null;
}

/**
 * Capture the current video frame as a JPEG blob.
 * Returns null if the player is unavailable or frame capture fails.
 */
export async function captureFrame(
  playerRef: React.RefObject<PlayerHandle | null>,
): Promise<Blob | null> {
  try {
    const player = playerRef.current?.getInternalPlayer?.();
    if (!player || player.videoWidth <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = player.videoWidth;
    canvas.height = player.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(player, 0, 0);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        "image/jpeg",
        0.85,
      );
    });
  } catch {
    return null;
  }
}
