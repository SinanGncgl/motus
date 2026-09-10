const CACHE_KEY = "motus.translation-cache.v2";
const MAX_ENTRIES = 5000;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  text: string;
  result: string;
  ts: number;
  svc: string;
}

// In-memory mirror — avoids repeated JSON.parse on hot paths (subtitle lines).
let memCache: Record<string, CacheEntry> | null = null;

function cacheKey(text: string, source: string, target: string, svc: string): string {
  return `${svc}:${source}:${target}:${text}`;
}

function readCache(): Record<string, CacheEntry> {
  if (memCache) return memCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    memCache = raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    memCache = {};
  }
  return memCache;
}

function persistCache(): void {
  if (!memCache) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(memCache));
  } catch {
    /* quota / private-mode */
  }
}

function evictIfNeeded(cache: Record<string, CacheEntry>): void {
  const keys = Object.keys(cache);
  if (keys.length <= MAX_ENTRIES) return;
  const sorted = keys.sort((a, b) => cache[a]!.ts - cache[b]!.ts);
  for (const k of sorted.slice(0, keys.length - MAX_ENTRIES)) {
    delete cache[k];
  }
}

export function getCachedTranslation(
  text: string,
  source: string,
  target: string,
  service: string,
): string | null {
  const cache = readCache();
  const key = cacheKey(text, source, target, service);
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    delete cache[key];
    persistCache();
    return null;
  }
  return entry.result;
}

export function setCachedTranslation(
  text: string,
  source: string,
  target: string,
  service: string,
  result: string,
): void {
  const cache = readCache();
  const key = cacheKey(text, source, target, service);
  cache[key] = { text, result, ts: Date.now(), svc: service };
  evictIfNeeded(cache);
  persistCache();
}

/** Invalidate all cached translations (e.g. when switching services). */
export function clearTranslationCache(): void {
  memCache = {};
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
