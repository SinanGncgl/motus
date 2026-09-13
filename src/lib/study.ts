import { localApi, type LocalWord } from "@/lib/local-api";
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
  translation?: string; // sentence translation for card back
  screenshot?: Blob; // video frame capture
}

/**
 * Save a word as a vocabulary card, respecting the "include common words"
 * setting. Common function words are skipped by default so the SRS deck stays
 * high-value. Returns { skipped, saved } so callers can react.
 */
export async function saveWord(input: SaveWordInput): Promise<{
  skipped: boolean;
  saved: boolean;
  wordId?: string;
}> {
  const common = isCommonWord(input.display);
  if (common && !settings.get().includeCommonWords) {
    toast.info(
      `"${input.display}" is a common word and was skipped. Turn on "Include common words" in Settings to save it.`,
    );
    return { skipped: true, saved: false };
  }
  try {
    const result = await localApi.words.save({
      word: input.word,
      display: input.display,
      definition: input.definition ?? "",
      example: input.example ?? "",
      sourceTitle: input.sourceTitle,
      language: input.language,
      translation: input.translation ?? "",
    });
    // Upload screenshot if provided (await to ensure file exists on disk)
    if (input.screenshot && result.wordId) {
      await localApi.words.uploadScreenshot(result.wordId, input.screenshot).catch(() => {
        // Screenshot upload is best-effort; don't block word save
      });
    }
    // Notify all components that a word was saved (cross-page refresh)
    window.dispatchEvent(new CustomEvent("motus:word-saved"));
    return { skipped: false, saved: true, wordId: result.wordId };
  } catch {
    toast.error("Could not save the word.");
    return { skipped: false, saved: false };
  }
}

export interface ClozeItem {
  wordId: string;
  cardId: string;
  display: string;
  sentence: string;
}

export interface DictationItem {
  wordId: string;
  cardId: string;
  display: string;
  sentence: string;
}

/** Build cloze items from saved words that have a usable example sentence. */
export function buildClozeItems(words: LocalWord[], cards?: Array<{ id: string; _id?: string; front: string }>): ClozeItem[] {
  const cardByWord = new Map<string, string>();
  if (cards) {
    for (const c of cards) {
      const front = c.front.toLowerCase();
      if (!cardByWord.has(front)) cardByWord.set(front, c.id || c._id || "");
    }
  }
  const items: ClozeItem[] = [];
  for (const w of words) {
    const ex = (w.example || "").trim();
    if (!ex) continue;
    const normalized = w.display.trim().toLowerCase();
    const re = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i");
    if (!re.test(ex)) continue;
    const sentence = ex.replace(re, " ____ ");
    const cardId = cardByWord.get(normalized) || w._id;
    items.push({ wordId: w._id, cardId, display: w.display, sentence });
  }
  return shuffle(items);
}

/** Build dictation items: speak the example, type what you hear. */
export function buildDictationItems(words: LocalWord[], cards?: Array<{ id: string; _id?: string; front: string }>): DictationItem[] {
  const cardByWord = new Map<string, string>();
  if (cards) {
    for (const c of cards) {
      const front = c.front.toLowerCase();
      if (!cardByWord.has(front)) cardByWord.set(front, c.id || c._id || "");
    }
  }
  const items = words
    .filter((w) => (w.example || "").trim().length > 0)
    .map((w) => ({
      wordId: w._id,
      cardId: cardByWord.get(w.display.trim().toLowerCase()) || w._id,
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
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/[-–—().,!?;:'"]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

export function answerMatches(userInput: string, correctAnswer: string): { correct: boolean; distance?: number } {
  const normalizedInput = normalizeText(userInput);
  const normalizedAnswer = normalizeText(correctAnswer);

  // Exact match after normalization
  if (normalizedInput === normalizedAnswer) return { correct: true, distance: 0 };

  // Levenshtein distance for typo tolerance (max 2 edits)
  const distance = levenshtein(normalizedInput, normalizedAnswer);
  if (distance <= 2) return { correct: true, distance };

  // Partial match: only if lengths are similar (within 2 chars)
  if (Math.abs(normalizedInput.length - normalizedAnswer.length) <= 2) {
    if (normalizedAnswer.includes(normalizedInput) || normalizedInput.includes(normalizedAnswer)) {
      return { correct: true, distance };
    }
  }

  return { correct: false, distance };
}

export async function getSavedWords(): Promise<LocalWord[]> {
  return localApi.words.list();
}
