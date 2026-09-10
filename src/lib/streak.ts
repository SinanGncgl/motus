// Daily study streak + review-count tracking, stored locally. Used by the
// Dashboard goal widget and the Practice session summary.

const KEY = "motus.streak.v1";

interface StreakData {
  // ISO date (YYYY-MM-DD) -> number of cards reviewed that day.
  history: Record<string, number>;
  bestStreak: number;
}

function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function read(): StreakData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StreakData;
  } catch {
    /* fall through */
  }
  return { history: {}, bestStreak: 0 };
}

function write(d: StreakData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export const streak = {
  /** Record `n` reviewed cards for today (adds to existing count). */
  record(n: number) {
    const d = read();
    const t = todayStr();
    d.history[t] = (d.history[t] ?? 0) + n;
    // Recompute current streak ending today.
    let s = 0;
    let cursor = new Date();
    while (true) {
      const key = todayStr(cursor);
      if ((d.history[key] ?? 0) > 0) {
        s += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    if (s > d.bestStreak) d.bestStreak = s;
    write(d);
    return d;
  },
  /** Current consecutive-day streak (ending today or yesterday). */
  current(): number {
    const d = read();
    let s = 0;
    let cursor = new Date();
    // Allow the streak to be "alive" if today or yesterday had activity.
    if ((d.history[todayStr(cursor)] ?? 0) === 0) {
      cursor.setDate(cursor.getDate() - 1);
      if ((d.history[todayStr(cursor)] ?? 0) === 0) return 0;
    }
    while (true) {
      const key = todayStr(cursor);
      if ((d.history[key] ?? 0) > 0) {
        s += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return s;
  },
  reviewedToday(): number {
    const d = read();
    return d.history[todayStr()] ?? 0;
  },
  best(): number {
    return read().bestStreak;
  },
  /** Last 14 days of review counts for a sparkline. */
  lastDays(n = 14): number[] {
    const d = read();
    const out: number[] = [];
    const cursor = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const c = new Date(cursor);
      c.setDate(cursor.getDate() - i);
      out.push(d.history[todayStr(c)] ?? 0);
    }
    return out;
  },
};

/* ------------------------------------------------------------------ *
 * Session accuracy tracking.
 * Stores the result of the most recent practice session so the Dashboard
 * can show "last session: 18/20 correct" and the Practice page can surface
 * a richer completion summary than just a raw card count.
 * ------------------------------------------------------------------ */

const SESSION_KEY = "motus.session.v1";

export interface SessionSummary {
  reviewed: number;
  correct: number;
  incorrect: number;
  accuracy: number; // 0..100
  at: number; // epoch ms
}

function readSession(): SessionSummary | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionSummary;
  } catch {
    return null;
  }
}

function writeSession(s: SessionSummary) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const session = {
  /** Persist a finished practice session. */
  record(reviewed: number, correct: number) {
    const incorrect = Math.max(0, reviewed - correct);
    const summary: SessionSummary = {
      reviewed,
      correct,
      incorrect,
      accuracy: reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0,
      at: Date.now(),
    };
    writeSession(summary);
    sessionHistory.add(summary);
    return summary;
  },
  last(): SessionSummary | null {
    return readSession();
  },
};

/* ------------------------------------------------------------------ *
 * Session history – persistent list of all past sessions.
 * ------------------------------------------------------------------ */

const HISTORY_KEY = "motus.session-history.v1";

export const sessionHistory = {
  getAll(): SessionSummary[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  },
  add(record: SessionSummary) {
    const history = this.getAll();
    history.push(record);
    if (history.length > 50) history.splice(0, history.length - 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  },
  lastDays(days: number): SessionSummary[] {
    const cutoff = Date.now() - days * 86400000;
    return this.getAll().filter((s) => s.at >= cutoff);
  },
};
