import type { PlayerHandle } from "@/lib/player";
import { loadYouTubeApi, type YouTubePlayer } from "@/lib/youtube";
import { useEffect, useRef } from "react";

interface YouTubePlayerProps {
  videoId: string;
  playerRef: React.MutableRefObject<PlayerHandle | null>;
  onReady?: () => void;
  onTime?: (seconds: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  className?: string;
}

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
              const yt = event.target;
              playerRef.current = {
                seekTo: (s) => yt.seekTo(s, true),
                playVideo: () => yt.playVideo(),
                pauseVideo: () => yt.pauseVideo(),
                getCurrentTime: () => yt.getCurrentTime(),
                getDuration: () => yt.getDuration(),
                setPlaybackRate: (rate) => yt.setPlaybackRate(rate),
                getVolume: () => yt.getVolume() / 100,
                setVolume: (vol) => yt.setVolume(vol * 100),
                isMuted: () => yt.isMuted(),
                mute: () => yt.mute(),
                unmute: () => yt.unMute(),
                getInternalPlayer: () => null,
              };
              onReadyRef.current?.();
              // Disable pointer events on iframe so overlays receive clicks
              setTimeout(() => {
                const iframe = container.querySelector("iframe") as HTMLElement | null;
                if (iframe) {
                  iframe.style.pointerEvents = "none";
                }
              }, 0);
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
        let lastReported = -1;
        const tick = () => {
          if (disposed) return;
          if (player && playerRef.current) {
            const t = player.getCurrentTime();
            if (Math.abs(t - lastReported) > 0.02) {
              lastReported = t;
              onTimeRef.current?.(t);
            }
          }
          timer = requestAnimationFrame(tick);
        };
        timer = requestAnimationFrame(tick);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (timer !== undefined) cancelAnimationFrame(timer);
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // player may not have been created yet
      }
      if (container) container.innerHTML = "";
    };
  }, [videoId, playerRef]);

  return <div ref={containerRef} className={className} tabIndex={-1} />;
}
