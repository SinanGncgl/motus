import type { PlayerHandle } from "@/lib/player";
import { useEffect, useRef } from "react";

interface FilePlayerProps {
  src: string;
  /** Filled in once the video element exists, so the parent can seek. */
  playerRef: React.MutableRefObject<PlayerHandle | null>;
  onReady?: () => void;
  /** Called continuously with the current playback time in seconds. */
  onTime?: (seconds: number) => void;
  /** Called when playback starts/pauses/ends. */
  onPlayStateChange?: (playing: boolean) => void;
  className?: string;
}

/**
 * HTML5 video player for transcribed/uploaded files, exposing the same
 * control surface as the YouTube player so the Watch page can drive either.
 */
export function FilePlayer({
  src,
  playerRef,
  onReady,
  onTime,
  onPlayStateChange,
  className,
}: FilePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onReadyRef = useRef(onReady);
  const onTimeRef = useRef(onTime);
  const onPlayStateRef = useRef(onPlayStateChange);
  onReadyRef.current = onReady;
  onTimeRef.current = onTime;
  onPlayStateRef.current = onPlayStateChange;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handle: PlayerHandle = {
      seekTo: (seconds) => {
        video.currentTime = seconds;
      },
      playVideo: () => {
        void video.play().catch(() => undefined);
      },
      pauseVideo: () => video.pause(),
      getCurrentTime: () => video.currentTime,
      getDuration: () => (Number.isFinite(video.duration) ? video.duration : 0),
      setPlaybackRate: (rate: number) => { video.playbackRate = rate; },
      getVolume: () => video.volume,
      setVolume: (vol: number) => { video.volume = vol; },
      isMuted: () => video.muted,
      mute: () => { video.muted = true; },
      unmute: () => { video.muted = false; },
      getInternalPlayer: () => video,
    };
    playerRef.current = handle;

    const onMeta = () => onReadyRef.current?.();
    const onPlay = () => onPlayStateRef.current?.(true);
    const onPause = () => onPlayStateRef.current?.(false);
    const onEnded = () => onPlayStateRef.current?.(false);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    const timer = window.setInterval(
      () => onTimeRef.current?.(video.currentTime),
      250,
    );

    return () => {
      window.clearInterval(timer);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      playerRef.current = null;
    };
  }, [src, playerRef]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      playsInline
      preload="metadata"
      onClick={() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) void video.play().catch(() => undefined);
        else video.pause();
      }}
    />
  );
}
