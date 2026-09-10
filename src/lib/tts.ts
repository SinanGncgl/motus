/**
 * Browser text-to-speech helpers (Web Speech API — no keys, works offline-ish
 * with the OS voices). Used to pronounce words and subtitle lines.
 */

export interface LanguageOption {
  code: string; // BCP-47 tag
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-PT", label: "Portuguese" },
  { code: "nl-NL", label: "Dutch" },
  { code: "pl-PL", label: "Polish" },
  { code: "sv-SE", label: "Swedish" },
  { code: "ru-RU", label: "Russian" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ar-SA", label: "Arabic" },
  { code: "tr-TR", label: "Turkish" },
];

export function languageLabel(code?: string | null): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code ?? "English (US)";
}

export function isSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const primary = lang.split("-")[0]!.toLowerCase();
  const base = voices.find((v) => v.lang.toLowerCase().startsWith(primary));
  return base ?? null;
}

/** Speak a phrase. Any currently playing speech is replaced. */
export function speak(text: string, lang = "en-US", rate = 0.92): void {
  if (!isSpeechAvailable() || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang;
    }
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis is best-effort; never break the UI over it.
  }
}

export function stopSpeaking(): void {
  if (!isSpeechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

/** Prime voice loading early (voices arrive asynchronously). */
export function warmVoices(): void {
  if (!isSpeechAvailable()) return;
  window.speechSynthesis.getVoices();
}
