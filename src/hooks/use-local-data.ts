import { useCallback, useEffect, useRef, useState } from "react";
import { localApi, type LocalCard, type LocalSubtitle, type LocalWord } from "@/lib/local-api";
import { settings } from "@/lib/settings";

function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const refresh = useCallback(async () => setData(await loadRef.current()), []);
  useEffect(() => { void refresh(); }, []);
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
