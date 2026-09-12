import { useCallback, useEffect, useRef, useState } from "react";
import { localApi, type LocalCard, type LocalSubtitle, type LocalWord } from "@/lib/local-api";
import { settings } from "@/lib/settings";

function useResource<T>(load: () => Promise<T>, staleMs = 30_000) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastFetchRef = useRef(0);

  const refresh = useCallback(async () => {
    lastFetchRef.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const result = await loadRef.current();
      setData(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      if (Date.now() - lastFetchRef.current > staleMs) {
        void refresh();
      }
    }, staleMs);
    return () => clearInterval(interval);
  }, []);

  return [data, refresh, { error, loading }] as const;
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

export type ResourceResult<T> = readonly [T | undefined, () => Promise<void>, { error: string | null; loading: boolean }];
