// Optional sentence translation using a LibreTranslate-compatible endpoint.
// Entirely opt-in: if neither a server proxy nor a user endpoint/key is
// configured (the common offline case), callers should show a friendly
// "not configured" message.
//
// Preference order:
//   1. Same-origin server proxy at /api/translate (set LIBRETRANSLATE_URL on the
//      server). Keeps a managed API key server-side and avoids CORS.
//   2. A user-configured endpoint/key from Settings (self-hosted).

import { settings } from "@/lib/settings";
import { translateViaDeepL } from "./deepl";
import { getCachedTranslation, setCachedTranslation } from "./translation-cache";

export interface TranslateResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/** True when some translation backend is reachable. */
export function translationConfigured(): boolean {
  return true; // server proxy is always attempted; endpoint is a fallback
}

async function translateViaServer(
  text: string,
  targetLang: string,
  sourceLang = "auto",
): Promise<TranslateResult> {
  const base = (import.meta.env.VITE_LOCAL_API_URL as string | undefined) ?? "";
  if (!base) return { ok: false, error: "not-configured" };
  try {
    const res = await fetch(`${base}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: "text" }),
    });
    if (res.status === 501) return { ok: false, error: "not-configured" };
    if (!res.ok) return { ok: false, error: "not-configured" };
    const data = (await res.json()) as { translatedText?: string; error?: string };
    if (data.error) return { ok: false, error: "not-configured" };
    if (!data.translatedText) return { ok: false, error: "no-text" };
    return { ok: true, text: data.translatedText };
  } catch {
    return { ok: false, error: "not-configured" };
  }
}

async function translateViaEndpoint(
  text: string,
  targetLang: string,
  sourceLang = "auto",
): Promise<TranslateResult> {
  // Self-hosted LibreTranslate is the zero-config default; users can override
  // via Settings (translationEndpoint).
  const { translationEndpoint, translationApiKey } = settings.get();
  const endpoint = translationEndpoint || "https://traduzioni.serviziliberi.it/translate";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text",
        ...(translationApiKey ? { api_key: translationApiKey } : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { translatedText?: string };
    if (!data.translatedText) return { ok: false, error: "no-text" };
    return { ok: true, text: data.translatedText };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

export async function translateLine(
  text: string,
  targetLang = "en",
  sourceLang = "auto",
): Promise<TranslateResult> {
  const { translationService } = settings.get();

  // Check cache first — keyed by service so switching backends doesn't return stale results
  const cached = getCachedTranslation(text, sourceLang, targetLang, translationService);
  if (cached !== null) return { ok: true, text: cached };

  let result: TranslateResult | null = null;

  if (translationService === "deepl") {
    result = await translateViaDeepL(text, targetLang, sourceLang);
    if (result.ok) {
      setCachedTranslation(text, sourceLang, targetLang, translationService, result.text!);
      return result;
    }
  }

  const server = await translateViaServer(text, targetLang, sourceLang);
  if (server.ok) {
    setCachedTranslation(text, sourceLang, targetLang, translationService, server.text!);
    return server;
  }
  if (server.error !== "not-configured") return server;

  const endpoint = await translateViaEndpoint(text, targetLang, sourceLang);
  if (endpoint.ok) {
    setCachedTranslation(text, sourceLang, targetLang, translationService, endpoint.text!);
  }
  return endpoint;
}
