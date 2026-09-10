import { useCallback, useEffect, useRef, useState } from "react";
import { localApi, type LocalCard, type LocalSubtitle, type LocalWord } from "@/lib/local-api";
import { settings } from "@/lib/settings";

function useResource<T>(load: () => Promise<T>, staleMs = 30_000) {
  const [data, setData] = useState<T | undefined>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastFetchRef = useRef(0);

  const refresh = useCallback(async () => {
    lastFetchRef.current = Date.now();
    setData(await loadRef.current());
  }, []);

  useEffect(() => {
    // Always fetch on mount
    void refresh();
    // Refetch if stale (every 30 seconds by default)
    const interval = setInterval(() => {
      if (Date.now() - lastFetchRef.current > staleMs) {
        void refresh();
      }
    }, staleMs);
    return () => clearInterval(interval);
  }, []);

  return [data, refresh] as const;
}

export function useLocalSubtitles() {
  return useResource<LocalSubtitle[]>(localApi.subtitles.list);
}

export function useLocalWords() {
  return useResource<LocalWord[]>(localApi.words.list);
}

export function useDueCards() {
  return useResource<LocalCard[]>(() => localApi.cards.due(settings.get().newCardsPerDay));
}

export function useDueCount() {
  return useResource<number>(localApi.cards.dueCount);
}
