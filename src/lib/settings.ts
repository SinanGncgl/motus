// Lightweight local settings store (no backend). Persisted to localStorage so
// preferences survive reloads. All study settings are device-local by design.

export interface AppSettings {
  /** When false (default), common/function words are skipped when saving cards. */
  includeCommonWords: boolean;
  /** Target reviews per day for the streak/goal widget. */
  dailyGoal: number;
  /** Auto-pause playback after each caption line (shadowing practice). */
  autoPausePerLine: boolean;
  /** Auto-translate the active caption line into your native language. */
  autoTranslateCaptions: boolean;
  /** Source language for translation (BCP-47 tag, or "auto" for auto-detect). */
  sourceLanguage: string;
  /** Target language for translation (BCP-47 tag). */
  nativeLanguage: string;
  /** Optional translation API key (online enhancement, user-provided). */
  translationApiKey: string;
  /** Optional LibreTranslate-compatible endpoint for sentence translation. */
  translationEndpoint: string;
}

const KEY = "motus.settings.v1";

const DEFAULTS: AppSettings = {
  includeCommonWords: false,
  dailyGoal: 20,
  autoPausePerLine: false,
  autoTranslateCaptions: false,
  sourceLanguage: "auto",
  nativeLanguage: "en",
  translationApiKey: "",
  translationEndpoint: "",
};

function read(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(s: AppSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export const settings = {
  get: read,
  update(patch: Partial<AppSettings>): AppSettings {
    const next = { ...read(), ...patch };
    write(next);
    return next;
  },
};
