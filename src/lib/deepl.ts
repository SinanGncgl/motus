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
