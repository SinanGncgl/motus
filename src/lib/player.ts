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
