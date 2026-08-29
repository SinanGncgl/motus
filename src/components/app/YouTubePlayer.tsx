import type { PlayerHandle } from "@/lib/player";
import { loadYouTubeApi, type YouTubePlayer } from "@/lib/youtube";
import { useEffect, useRef } from "react";

interface YouTubePlayerProps {
  videoId: string;
  /** Filled in once the player is ready, so the parent can seek. */
  playerRef: React.MutableRefObject<PlayerHandle | null>;
  onReady?: () => void;
  /** Called continuously with the current playback time in seconds. */
  onTime?: (seconds: number) => void;
  /** Called when playback starts/pauses/ends. */
  onPlayStateChange?: (playing: boolean) => void;
  className?: string;
}

/**
 * Embeds a YouTube video and reports its playback time. No API key needed —
 * uses the free IFrame Player API.
 */
export function YouTubePlayer({
  videoId,
  playerRef,
  onReady,
  onTime,
  onPlayStateChange,
  className,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onTimeRef = useRef(onTime);
  const onPlayStateRef = useRef(onPlayStateChange);
  onReadyRef.current = onReady;
  onTimeRef.current = onTime;
  onPlayStateRef.current = onPlayStateChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;
    let player: YouTubePlayer | null = null;
    let timer: number | undefined;

    loadYouTubeApi()
      .then((YT) => {
        if (disposed || !container) return;
        player = new YT.Player(container, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              onReadyRef.current?.();
            },
            onStateChange: (event) => {
              if (disposed) return;
              onPlayStateRef.current?.(event.data === 1);
            },
            onError: () => {
              playerRef.current = null;
            },
          },
        });
        timer = window.setInterval(() => {
          if (!disposed && player && playerRef.current) {
            onTimeRef.current?.(player.getCurrentTime());
          }
        }, 250);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (timer !== undefined) window.clearInterval(timer);
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // player may not have been created yet
      }
      if (container) container.innerHTML = "";
    };
  }, [videoId, playerRef]);

  return <div ref={containerRef} className={className} />;
}
