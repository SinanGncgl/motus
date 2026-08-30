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
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: "text" }),
    });
    if (res.status === 501) return { ok: false, error: "not-configured" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { translatedText?: string };
    if (!data.translatedText) return { ok: false, error: "no-text" };
    return { ok: true, text: data.translatedText };
  } catch {
    return { ok: false, error: "network" };
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
  const endpoint = translationEndpoint || "http://127.0.0.1:5001/translate";
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
  // Server proxy first (no key in the browser, no CORS). Fall back to a
  // user-configured endpoint if the proxy isn't set up.
  const server = await translateViaServer(text, targetLang, sourceLang);
  if (server.ok) return server;
  if (server.error !== "not-configured") return server; // real error, don't mask
  return translateViaEndpoint(text, targetLang, sourceLang);
}
