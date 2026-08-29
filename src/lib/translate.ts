// Optional sentence translation using a user-provided, LibreTranslate-compatible
// endpoint. Entirely opt-in: if no endpoint/key is configured (the common
// offline case), callers should show a friendly "not configured" message.

import { settings } from "@/lib/settings";

export interface TranslateResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export async function translateLine(
  text: string,
  targetLang = "en",
): Promise<TranslateResult> {
  const { translationEndpoint, translationApiKey } = settings.get();
  if (!translationEndpoint) {
    return { ok: false, error: "not-configured" };
  }
  try {
    const res = await fetch(translationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
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
