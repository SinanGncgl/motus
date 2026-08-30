const CACHE_KEY = "motus.translation-cache.v1";
const MAX_ENTRIES = 5000;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  text: string;
  result: string;
  ts: number;
}

function cacheKey(text: string, source: string, target: string): string {
  return `${source}:${target}:${text}`;
}

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>): void {
  try {
    // Evict oldest entries if over limit
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => cache[a].ts - cache[b].ts);
      for (const k of sorted.slice(0, keys.length - MAX_ENTRIES)) {
        delete cache[k];
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / private-mode */
  }
}

export function getCachedTranslation(
  text: string,
  source: string,
  target: string,
): string | null {
  const cache = readCache();
  const entry = cache[cacheKey(text, source, target)];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    delete cache[cacheKey(text, source, target)];
    writeCache(cache);
    return null;
  }
  return entry.result;
}

export function setCachedTranslation(
  text: string,
  source: string,
  target: string,
  result: string,
): void {
  const cache = readCache();
  cache[cacheKey(text, source, target)] = { text, result, ts: Date.now() };
  writeCache(cache);
}