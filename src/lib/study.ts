import { localApi, type LocalWord } from "@/lib/local-api";
import { normalizeWord } from "@/lib/subtitles";
import { settings } from "@/lib/settings";
import { isCommonWord } from "@/lib/stopwords";
import { toast } from "sonner";

export type PracticeMode = "flashcard" | "cloze" | "dictation";

export interface SaveWordInput {
  word: string; // normalized
  display: string; // raw
  definition?: string;
  example?: string;
  sourceTitle?: string;
  language?: string;
}

/**
 * Save a word as a vocabulary card, respecting the "include common words"
 * setting. Common function words are skipped by default so the SRS deck stays
 * high-value. Returns { skipped, saved } so callers can react.
 */
export async function saveWord(input: SaveWordInput): Promise<{
  skipped: boolean;
  saved: boolean;
}> {
  const common = isCommonWord(input.display);
  if (common && !settings.get().includeCommonWords) {
    toast.info(
      `"${input.display}" is a common word and was skipped. Turn on "Include common words" in Settings to save it.`,
    );
    return { skipped: true, saved: false };
  }
  try {
    await localApi.words.save({
      word: input.word,
      display: input.display,
      definition: input.definition ?? "",
      example: input.example ?? "",
      sourceTitle: input.sourceTitle,
      language: input.language,
    });
    return { skipped: false, saved: true };
  } catch {
    toast.error("Could not save the word.");
    return { skipped: false, saved: false };
  }
}

export interface ClozeItem {
  wordId: string;
  display: string; // the word to fill in
  sentence: string; // example sentence with the target replaced by a blank
}

export interface DictationItem {
  wordId: string;
  display: string;
  sentence: string; // sentence to listen to and type
}

/** Build cloze items from saved words that have a usable example sentence. */
export function buildClozeItems(words: LocalWord[]): ClozeItem[] {
  const items: ClozeItem[] = [];
  for (const w of words) {
    const ex = (w.example || "").trim();
    if (!ex) continue;
    const normalized = w.display.trim().toLowerCase();
    const re = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i");
    if (!re.test(ex)) continue;
    const sentence = ex.replace(re, " ____ ");
    items.push({ wordId: w._id, display: w.display, sentence });
  }
  return shuffle(items);
}

/** Build dictation items: speak the example, type what you hear. */
export function buildDictationItems(words: LocalWord[]): DictationItem[] {
  const items = words
    .filter((w) => (w.example || "").trim().length > 0)
    .map((w) => ({
      wordId: w._id,
      display: w.display,
      sentence: w.example!.trim(),
    }));
  return shuffle(items);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Loose match for typed answers (ignores case, surrounding punctuation). */
export function answerMatches(typed: string, target: string): boolean {
  const clean = (s: string) => normalizeWord(s).trim().toLowerCase();
  const t = clean(typed);
  const g = clean(target);
  if (!t || !g) return false;
  if (t === g) return true;
  return t.includes(g) || g.includes(t);
}

export async function getSavedWords(): Promise<LocalWord[]> {
  return localApi.words.list();
}
