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
    if (!player || player.videoWidth <= 0) {
      console.log("[captureFrame] no player or video not ready", { player: !!player, videoWidth: player?.videoWidth });
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = player.videoWidth;
    canvas.height = player.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(player, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        "image/jpeg",
        0.85,
      );
    });
    console.log("[captureFrame] captured", { width: canvas.width, height: canvas.height, blobSize: blob?.size });
    return blob;
  } catch (e) {
    console.log("[captureFrame] error", e);
    return null;
  }
}

/**
 * Capture a region of the screen using the Screen Capture API.
 * Shows the browser tab picker, then crops to the given element's bounding rect.
 * Returns null if the user cancels or capture fails.
 */
export async function captureScreenCrop(
  targetEl: HTMLElement,
): Promise<Blob | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" } as MediaTrackConstraints,
      audio: false,
    });
    const track = stream.getVideoTracks()[0];

    // Capture a frame from the stream using a video element
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Wait a frame for the video to render
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    track.stop();

    const rect = targetEl.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) { video.srcObject = null; return null; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.srcObject = null;

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });
  } catch {
    return null;
  }
}
