/**
 * Subtitle parsing, word tokenization, and Anki export helpers.
 */

export interface SubtitleLine {
  index: number;
  start?: number; // seconds
  end?: number; // seconds
  text: string;
}

export interface Token {
  text: string; // raw text as it appears (e.g. "Hello,")
  word: string; // normalized word form, "" for punctuation
}

/** Normalize a raw token into a dictionary-friendly lowercase word. */
export function normalizeWord(raw: string): string {
  // Keep letters (incl. unicode) and internal apostrophes/hyphens.
  const match = raw.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u);
  return match ? match[0].toLowerCase() : "";
}

/** Split a line into tokens; punctuation tokens have word = "". */
export function tokenize(text: string): Token[] {
  const parts = text.match(/\S+/g) ?? [];
  return parts.map((part) => {
    const word = normalizeWord(part);
    return { text: part, word };
  });
}

/** Parse an SRT timestamp like `00:00:01,500` into seconds. */
function parseTimestamp(ts: string): number | undefined {
  const match = ts.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return undefined;
  const [, h, m, s, ms] = match;
  return (
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
  );
}

/** Compact m:ss / h:mm:ss clock for UI timestamps. */
export function formatClock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

export function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total % 1) * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
}

/**
 * Parse SRT subtitle text into lines. Falls back to treating the input as
 * plain text (one line per paragraph) when it doesn't look like SRT.
 */
export function parseSubtitleText(raw: string): {
  sourceType: "srt" | "plain";
  lines: SubtitleLine[];
} {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return { sourceType: "plain", lines: [] };

  const looksLikeSrt = /^\d+\s*\n\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}/m.test(
    text,
  );

  if (looksLikeSrt) {
    const blocks = text.split(/\n{2,}/);
    const lines: SubtitleLine[] = [];
    for (const block of blocks) {
      const parts = block.split("\n").map((p) => p.trim());
      const indexMatch = parts[0]?.match(/^\d+$/);
      if (!indexMatch) continue;
      const timeMatch = parts[1]?.match(
        /(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/,
      );
      if (!timeMatch) continue;
      const lineText = parts
        .slice(2)
        .filter(Boolean)
        .join(" ")
        .replace(/<[^>]+>/g, ""); // strip basic html-ish tags
      if (!lineText) continue;
      lines.push({
        index: Number(parts[0]),
        start: parseTimestamp(timeMatch[1]!),
        end: parseTimestamp(timeMatch[2]!),
        text: lineText,
      });
    }
    if (lines.length > 0) {
      return { sourceType: "srt", lines };
    }
  }

  // Plain text: each non-empty line becomes one subtitle line.
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((lineText, i) => ({
      index: i + 1,
      text: lineText,
    }));
  return { sourceType: "plain", lines };
}

/** Escape a value for TSV (tab-separated) import into Anki. */
function escapeTsv(value: string): string {
  const cleaned = value.replace(/[\t\n\r]+/g, " ").trim();
  if (/[\t"]/.test(cleaned)) {
    return `"${cleaned.replace(/"/g, '""')}"`;
  }
  return cleaned;
}

/**
 * Build Anki-importable TSV (front\tback per line) from saved words.
 * Anki's "Basic" note type can import this via File → Import.
 */
export function buildAnkiTsv(
  rows: Array<{ front: string; back: string }>,
): string {
  const header = ["Front", "Back"].join("\t");
  const body = rows.map((r) => `${escapeTsv(r.front)}\t${escapeTsv(r.back)}`);
  return [header, ...body].join("\n");
}

export function downloadFile(
  filename: string,
  content: string,
  mime = "text/tab-separated-values",
) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
