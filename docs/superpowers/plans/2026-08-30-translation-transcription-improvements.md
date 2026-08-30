# Translation & Transcription Quality Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve translation quality by adding DeepL API support and translation caching, and improve transcription quality by adding a larger Whisper model for "accurate" mode.

**Architecture:** Three independent improvements: (1) Add whisper-base as the "accurate" transcription model with UI to select model quality, (2) Add DeepL API as a higher-quality translation backend alongside LibreTranslate, (3) Cache translations in localStorage to avoid re-translating the same lines.

**Tech Stack:** TypeScript, React, transformers.js (whisper-base ONNX), DeepL REST API, localStorage

---

### Task 1: Add whisper-base model for "accurate" transcription

**Files:**
- Modify: `src/lib/transcribe.ts` (MODEL_CHAIN, add download of whisper-base)
- Modify: `start.sh` (copy whisper-base model to dist)
- Modify: `src/components/app/TranscribeFile.tsx` (add model quality selector)
- Modify: `src/pages/Watch.tsx` (pass model option to transcribeFile)

**Note:** whisper-base (~142MB) must be downloaded first. Since `allowRemoteModels=false`, we need to vendor it like whisper-tiny. However, the models are large and not in git. We'll use the transformers.js remote download path for the first transcription, then it gets cached by the browser. To support this we need to temporarily enable remote models for the whisper-base download only, OR we pre-download it into `public/models/onnx-community/whisper-base/`.

**Approach:** We'll pre-download the model files using a script, then bundle them like whisper-tiny. For now, the plan will use the remote download path with a fallback to tiny if base fails.

- [ ] **Step 1: Update MODEL_CHAIN to include whisper-base**

In `src/lib/transcribe.ts`, update lines 74-77:

```typescript
const MODEL_CHAIN: Record<TranscribeModel, string[]> = {
  fast: ["onnx-community/whisper-tiny"],
  accurate: ["onnx-community/whisper-base", "onnx-community/whisper-tiny"],
};
```

- [ ] **Step 2: Enable remote model fallback for whisper-base download**

Since whisper-base isn't bundled locally yet, we need to allow remote download. In `src/lib/transcribe.ts`, update `createTranscriber` to try remote hosts when local model isn't found. Change line 96 from `env.allowRemoteModels = false` to allow remote fallback:

```typescript
async function createTranscriber(model: string): Promise<unknown> {
  const { env, pipeline } = await getTransformers();
  console.log("[Motus] createTranscriber", { model, localModelPath: env.localModelPath, allowRemoteModels: env.allowRemoteModels, allowLocalModels: env.allowLocalModels });
  let lastError: unknown;
  // Try local first, then remote hosts
  for (const host of [LOCAL_MODEL_HOST, DEFAULT_HOST, MIRROR_HOST]) {
    if (host !== LOCAL_MODEL_HOST) env.remoteHost = host;
    env.allowRemoteModels = host !== LOCAL_MODEL_HOST;
    try {
      return await pipeline("automatic-speech-recognition", model, {
        dtype: "fp16",
        revision: "motus-local-v3",
        progress_callback: (p: {
          status?: string;
          loaded?: number;
          total?: number;
        }) => {
          if (!progressHandler) return;
          if (
            p.status === "progress" &&
            typeof p.loaded === "number" &&
            typeof p.total === "number" &&
            p.total > 0
          ) {
            progressHandler({
              stage: "downloading",
              percent: Math.min(
                100,
                Math.round((p.loaded / p.total) * 100),
              ),
            });
          } else if (p.status === "ready") {
            progressHandler({ stage: "loading" });
          }
        },
      });
    } catch (error) {
      lastError = error;
      console.error("[Motus] model load failed for", model, "→", error);
    }
  }
  const detail =
    lastError instanceof Error
      ? lastError.message
      : typeof lastError === "string"
        ? lastError
        : JSON.stringify(lastError);
  throw new Error(`MODEL_DOWNLOAD_FAILED: ${detail}`);
}
```

- [ ] **Step 3: Add model quality selector to TranscribeFile**

In `src/components/app/TranscribeFile.tsx`, add a model selection state and pass it to `transcribeFile`:

```typescript
import { transcribeErrorMessage, transcribeFile, type TranscribeModel, type TranscribeProgress } from "@/lib/transcribe";
```

Add state for model selection:

```typescript
const [model, setModel] = useState<TranscribeModel>("fast");
```

Update the transcribeFile call (line 37) to pass the model:

```typescript
const result = await transcribeFile(file, { language, model, onProgress: setBusy });
```

Add a model selector in the UI before the file input:

```tsx
<div className="flex items-center gap-2 mb-2">
  <label className="text-sm text-muted-foreground">Quality:</label>
  <Select value={model} onValueChange={(v) => setModel(v as TranscribeModel)}>
    <SelectTrigger className="w-32 h-8">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="fast">Fast (tiny)</SelectItem>
      <SelectItem value="accurate">Accurate (base)</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Add necessary imports:

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

- [ ] **Step 4: Pass model option in Watch.tsx transcribeFile calls**

In `src/pages/Watch.tsx`, find both `transcribeFile` calls (lines 637 and 668) and add `model: "accurate"` (or expose a selector — for now use "accurate" as default since Watch is the main use case):

```typescript
const result = await transcribeFile(file, {
  language,
  model: "accurate",
  onProgress: (p) => setProgress(p),
});
```

- [ ] **Step 5: Update start.sh to handle whisper-base model (optional pre-download)**

Add to `start.sh` after the whisper-tiny copy block:

```bash
# Also copy whisper-base if present
if [[ -d "public/models/onnx-community/whisper-base" ]]; then
  rm -rf "$DIST_DIR/models/v1/onnx-community/whisper-base"
  cp -R public/models/onnx-community/whisper-base "$DIST_DIR/models/v1/onnx-community/whisper-base"
  echo "    whisper-base model copied"
fi
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add whisper-base model for accurate transcription mode"
```

---

### Task 2: Add DeepL API translation backend

**Files:**
- Create: `src/lib/deepl.ts` (DeepL API client)
- Modify: `src/lib/translate.ts` (integrate DeepL as preferred backend)
- Modify: `src/lib/settings.ts` (add translationService setting)
- Modify: `src/pages/Settings.tsx` (add service selector UI)
- Modify: `local-server.mjs` (add /api/translate-deepl endpoint)

**Approach:** DeepL free API (api-free.deepl.com) supports 500k chars/month. User provides their own API key. The server proxy handles the key securely. We'll add a translation service selector (LibreTranslate / DeepL) in Settings.

- [ ] **Step 1: Add translationService setting**

In `src/lib/settings.ts`, add to `AppSettings` interface:

```typescript
/** Translation service to use: "libretranslate" or "deepl". */
translationService: "libretranslate" | "deepl";
```

Add default:

```typescript
translationService: "libretranslate",
```

- [ ] **Step 2: Add DeepL proxy endpoint to local-server.mjs**

After the existing `/api/translate` endpoint (around line 537), add:

```javascript
// DeepL translation proxy (free API: api-free.deepl.com)
if (req.method === "POST" && path === "/api/translate-deepl") {
  const a = await body(req);
  const deeplKey = LIBRETRANSLATE_KEY || ""; // Reuse the key field for DeepL
  if (!deeplKey) {
    return send(res, 400, { error: "NO_DEEPL_KEY", message: "Set a DeepL API key in Settings" });
  }
  try {
    const isFree = deeplKey.endsWith(":fx");
    const baseUrl = isFree ? "https://api-free.deepl.com" : "https://api.deepl.com";
    const res2 = await fetch(`${baseUrl}/v2/translate`, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${deeplKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [a.q],
        source_lang: (a.source ?? "auto").toUpperCase().slice(0, 2),
        target_lang: (a.target ?? "EN").toUpperCase().slice(0, 2),
      }),
    });
    const data = await res2.json().catch(() => ({}));
    if (!res2.ok) return send(res, res2.status, { error: "DEEPL_FAILED", message: data?.message ?? `HTTP ${res2.status}` });
    const translated = data?.translations?.[0]?.text ?? "";
    return send(res, 200, { translatedText: translated });
  } catch (e) {
    return send(res, 502, { error: "DEEPL_UPSTREAM", message: e instanceof Error ? e.message : "upstream error" });
  }
}
```

Note: We reuse the `LIBRETRANSLATE_KEY` env var for DeepL key (server-side only). The user sets the key in Settings UI and it gets passed via the server proxy.

Actually, the key needs to reach the server. Currently the server proxy doesn't receive the key from the browser — it uses `LIBRETRANSLATE_KEY` env var. For DeepL, the user provides the key in Settings. We need to either:
- (a) Pass the key from the browser to the server proxy (but we said keys don't reach the browser)
- (b) Have the user set the key as an env var

Let me go with option (a) — the key is stored in localStorage (Settings) and sent to our own same-origin server proxy. This is fine since it's localhost-only.

Update the endpoint to accept key in request body:

```javascript
if (req.method === "POST" && path === "/api/translate-deepl") {
  const a = await body(req);
  const deeplKey = a.api_key || LIBRETRANSLATE_KEY || "";
  if (!deeplKey) {
    return send(res, 400, { error: "NO_DEEPL_KEY", message: "Set a DeepL API key in Settings" });
  }
  // ... rest of the handler
}
```

- [ ] **Step 3: Create DeepL client in src/lib/deepl.ts**

```typescript
import { settings } from "@/lib/settings";
import type { TranslateResult } from "./translate";

export async function translateViaDeepL(
  text: string,
  targetLang = "en",
  sourceLang = "auto",
): Promise<TranslateResult> {
  const { translationApiKey } = settings.get();
  if (!translationApiKey) return { ok: false, error: "no-key" };

  try {
    const res = await fetch("/api/translate-deepl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        api_key: translationApiKey,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { translatedText?: string };
    if (!data.translatedText) return { ok: false, error: "no-text" };
    return { ok: true, text: data.translatedText };
  } catch {
    return { ok: false, error: "network" };
  }
}
```

- [ ] **Step 4: Update translateLine to use selected service**

In `src/lib/translate.ts`, update `translateLine`:

```typescript
import { translateViaDeepL } from "./deepl";

export async function translateLine(
  text: string,
  targetLang = "en",
  sourceLang = "auto",
): Promise<TranslateResult> {
  const { translationService } = settings.get();

  // DeepL is preferred when selected and key is provided
  if (translationService === "deepl") {
    const deepl = await translateViaDeepL(text, targetLang, sourceLang);
    if (deepl.ok) return deepl;
    // Fall through to LibreTranslate if DeepL fails
  }

  // Server proxy first (no key in the browser, no CORS). Fall back to a
  // user-configured endpoint if the proxy isn't set up.
  const server = await translateViaServer(text, targetLang, sourceLang);
  if (server.ok) return server;
  if (server.error !== "not-configured") return server;
  return translateViaEndpoint(text, targetLang, sourceLang);
}
```

- [ ] **Step 5: Add service selector to Settings.tsx**

Add state:

```typescript
const [translationSvc, setTranslationSvc] = useState(settings.get().translationService);
```

Update save function to include:

```typescript
translationService: translationSvc,
```

Add a new section or add to existing "Online enhancements" section:

```tsx
<div className="flex flex-col gap-2 rounded-xl border bg-card/60 p-3">
  <Label>Translation service</Label>
  <Select value={translationSvc} onValueChange={(v) => setTranslationSvc(v as "libretranslate" | "deepl")}>
    <SelectTrigger className="w-full sm:w-56">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="libretranslate">LibreTranslate (local, free)</SelectItem>
      <SelectItem value="deepl">DeepL (higher quality, free tier)</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    DeepL produces much better translations. Get a free API key at{" "}
    <a href="https://www.deepl.com/pro-api" target="_blank" rel="noreferrer" className="underline">deepl.com</a>{" "}
    (500k chars/month free). When DeepL is selected, the API key field below is used for DeepL.
  </p>
</div>
```

Update the API key help text to mention DeepL:

```tsx
<p className="text-xs text-muted-foreground">
  For DeepL: paste your free API key here. For LibreTranslate: leave empty (uses local instance). Get a DeepL key at{" "}
  <a href="https://www.deepl.com/pro-api" target="_blank" rel="noreferrer" className="underline">deepl.com</a>.
</p>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add DeepL API translation as higher-quality alternative"
```

---

### Task 3: Add translation caching in localStorage

**Files:**
- Create: `src/lib/translation-cache.ts` (cache module)
- Modify: `src/lib/translate.ts` (use cache)
- Modify: `src/pages/Watch.tsx` (hydrate from cache on load)

**Approach:** Cache translations keyed by `sourceText:sourceLang:targetLang` → translated text. Store in localStorage with a 30-day expiry. Max 5000 entries to avoid quota issues.

- [ ] **Step 1: Create translation cache module**

Create `src/lib/translation-cache.ts`:

```typescript
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
      const sorted = keys.sort((a, b) => (cache[a].ts - cache[b].ts));
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
    delete cache[entry.text]; // stale
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
```

- [ ] **Step 2: Use cache in translateLine**

In `src/lib/translate.ts`, import and use the cache:

```typescript
import { getCachedTranslation, setCachedTranslation } from "./translation-cache";

export async function translateLine(
  text: string,
  targetLang = "en",
  sourceLang = "auto",
): Promise<TranslateResult> {
  // Check cache first
  const cached = getCachedTranslation(text, sourceLang, targetLang);
  if (cached !== null) return { ok: true, text: cached };

  const { translationService } = settings.get();

  let result: TranslateResult | null = null;

  if (translationService === "deepl") {
    result = await translateViaDeepL(text, targetLang, sourceLang);
    if (result.ok) {
      setCachedTranslation(text, sourceLang, targetLang, result.text!);
      return result;
    }
  }

  const server = await translateViaServer(text, targetLang, sourceLang);
  if (server.ok) {
    setCachedTranslation(text, sourceLang, targetLang, server.text!);
    return server;
  }
  if (server.error !== "not-configured") return server;

  const endpoint = await translateViaEndpoint(text, targetLang, sourceLang);
  if (endpoint.ok) {
    setCachedTranslation(text, sourceLang, targetLang, endpoint.text!);
  }
  return endpoint;
}
```

- [ ] **Step 3: Hydrate Watch.tsx translations from cache**

In `src/pages/Watch.tsx`, when setting up translations, check cache first. Update the `translateRow` function (around line 271):

```typescript
const translateRow = (row: number) => {
  const line = subtitle?.lines[row];
  if (!line) return;
  if (translations[row] !== undefined || translatingRows.has(row)) return;
  const target = translateTarget.slice(0, 2);
  const userSource = settings.get().sourceLanguage;
  const source = userSource !== "auto" ? userSource : (subtitle?.language?.slice(0, 2) || "auto");

  // Check cache first
  const cached = getCachedTranslation(line.text, source, target);
  if (cached !== null) {
    setTranslations((prev) => ({ ...prev, [row]: cached }) as Record<number, string>);
    return;
  }

  setTranslatingRows((prev) => new Set(prev).add(row));
  translateLine(line.text, target, source)
    .then((r) => {
      if (r.ok && r.text) {
        setTranslations((prev) => ({ ...prev, [row]: r.text }) as Record<number, string>);
      }
    })
    .finally(() =>
      setTranslatingRows((prev) => {
        const n = new Set(prev);
        n.delete(row);
        return n;
      }),
    );
};
```

Add import:

```typescript
import { getCachedTranslation } from "@/lib/translation-cache";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: cache translations in localStorage for instant repeat lookups"
```

---

### Task 4: Final integration test and cleanup

- [ ] **Step 1: Verify all TypeScript compiles**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 2: Verify dev server starts**

```bash
npx vite build 2>&1 | tail -5
```

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: final integration of translation/transcription improvements"
```
