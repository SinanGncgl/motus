import { useCallback, useEffect, useMemo, useState } from "react";
import { localApi, type LocalWord } from "@/lib/local-api";
import { saveWord } from "@/lib/study";
import { normalizeWord } from "@/lib/subtitles";

interface SaveInput {
  word: string;
  display: string;
  definition?: string;
  example?: string;
  sourceTitle?: string;
  language?: string;
  screenshot?: Blob;
}

/**
 * Reactive view of the user's saved vocabulary. Mirrors the server list in
 * local state so the transcript, vocabulary panel, and saved-word styling
 * update immediately on save/remove without refetching.
 */
export function useSavedWords() {
  const [words, setWords] = useState<LocalWord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    localApi.words
      .list()
      .then((w) => {
        if (!cancelled) setWords(w);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // word (normalized) -> saved entry
  const byWord = useMemo(() => {
    const map = new Map<string, LocalWord>();
    for (const w of words) {
      const key = normalizeWord(w.word || w.display);
      if (!map.has(key)) map.set(key, w);
    }
    return map;
  }, [words]);

  const isSaved = useCallback(
    (word: string) => byWord.has(normalizeWord(word)),
    [byWord],
  );

  const existing = useCallback(
    (word: string) => byWord.get(normalizeWord(word)) ?? null,
    [byWord],
  );

  const save = useCallback(
    async (input: SaveInput) => {
      const res = await saveWord(input);
      if (res.saved) {
        const fresh = await localApi.words.list();
        setWords(fresh);
      }
      return res;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    setWords((prev) => prev.filter((w) => w._id !== id));
    try {
      await localApi.words.remove(id);
    } catch {
      const fresh = await localApi.words.list();
      setWords(fresh);
    }
  }, []);

  return { words, ready, isSaved, existing, save, remove, refresh: async () => { const fresh = await localApi.words.list(); setWords(fresh); } };
}
