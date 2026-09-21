# Verbformen.de Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate verbformen.de so users can click any German word and see full conjugation tables, examples, translations, and definitions in a side panel.

**Architecture:** Backend scrapes verbformen.de on-demand, caches results in PostgreSQL. Frontend shows a Sheet (side panel) triggered from the existing WordTooltip. The scraper handles verbs, nouns, and adjectives by trying each URL pattern.

**Tech Stack:** Node.js (local-server.mjs), PostgreSQL (pg module), React, TypeScript, Tailwind CSS, existing Sheet UI component

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/app/VerbformenPanel.tsx` | Side panel component displaying scraped data |
| Modify | `local-server.mjs:75-165` | Add `verbformen_cache` table to schema |
| Modify | `local-server.mjs:860+` | Add `/api/verbformen/:word` endpoint |
| Modify | `src/lib/local-api.ts:82-84` | Add `verbformen(word)` API method |
| Modify | `src/components/app/WordTooltip.tsx:200-210` | Add "Verbformen" button |

---

### Task 1: Add verbformen_cache table to database schema

**Files:**
- Modify: `local-server.mjs:156-165` (after word_group_members table)

- [ ] **Step 1: Add the cache table to the SCHEMA string**

Find the line `CREATE TABLE IF NOT EXISTS word_group_members (` and its closing `);`. After that block (after line 164), add:

```sql
CREATE TABLE IF NOT EXISTS verbformen_cache (
  word TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  scraped_at BIGINT NOT NULL
);
```

- [ ] **Step 2: Verify the server starts without errors**

Run: `node local-server.mjs` in the project root (or just check syntax with `node --check local-server.mjs`)
Expected: No syntax errors, server starts normally

- [ ] **Step 3: Commit**

```bash
git add local-server.mjs
git commit -m "feat: add verbformen_cache table to schema"
```

---

### Task 2: Add `/api/verbformen/:word` backend endpoint

**Files:**
- Modify: `local-server.mjs:860+` (after the `/api/dictionary/de` handler, around line 861)

- [ ] **Step 1: Add the verbformen scraping endpoint**

After the `/api/dictionary/de` handler block (line 861: `return send(res, 200, { definition: "", baseForm: word });`), add:

```javascript
    // Verbformen.de integration — scrape conjugation, examples, translations, definitions
    {
      const verbformenMatch = req.url?.match(/^\/api\/verbformen\/([^/]+)$/);
      if (req.method === "GET" && u && verbformenMatch) {
        const word = decodeURIComponent(verbformenMatch[1]).trim().toLowerCase();
        if (!word) return send(res, 200, null);

        // Check cache first (30-day TTL)
        const cached = await q1(
          "SELECT data, scraped_at FROM verbformen_cache WHERE word = $1",
          [word]
        );
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        if (cached && Date.now() - cached.scraped_at < THIRTY_DAYS) {
          return send(res, 200, cached.data);
        }

        // Scrape verbformen.de — try verb, noun, adjective in order
        const urls = [
          { url: `https://www.verbformen.de/konjugation/${encodeURIComponent(word)}.htm`, type: "verb" },
          { url: `https://www.verbformen.de/deklination/substantive/${encodeURIComponent(word)}.htm`, type: "noun" },
          { url: `https://www.verbformen.de/deklination/adjektive/${encodeURIComponent(word)}.htm`, type: "adjective" },
        ];

        let result = null;
        for (const { url, type } of urls) {
          try {
            const r = await fetch(url, {
              headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Motus/1.0" },
              redirect: "follow",
            });
            if (!r.ok) continue;
            const html = await r.text();
            result = parseVerbformen(html, word, type);
            if (result) break;
          } catch { /* try next URL */ }
        }

        if (!result) return send(res, 200, null);

        // Cache the result
        await q(
          "INSERT INTO verbformen_cache (word, data, scraped_at) VALUES ($1, $2, $3) ON CONFLICT (word) DO UPDATE SET data = $2, scraped_at = $3",
          [word, JSON.stringify(result), Date.now()]
        );

        return send(res, 200, result);
      }
    }
```

- [ ] **Step 2: Add the `parseVerbformen` helper function**

Before the `createServer` call (search for `const server = createServer`), add this parsing function:

```javascript
function parseVerbformen(html, word, type) {
  const result = { word, type, level: null, auxiliary: null, irregular: false, baseForm: word };

  // Extract CEFR level (A1, A2, B1, B2, C1, C2)
  const levelMatch = html.match(/<span[^>]*>\s*(A[12]|B[12]|C[12])\s*<\/span>/i);
  if (levelMatch) result.level = levelMatch[1];

  // Extract auxiliary verb for verbs
  if (type === "verb") {
    const auxMatch = html.match(/(haben|sein)\s*<\/span>/i);
    if (auxMatch) result.auxiliary = auxMatch[1].toLowerCase();
    result.irregular = /unregelmäßig/i.test(html);
  }

  // Extract pronunciation
  const pronunciations = [];
  const pronRegex = /\/[^/]+\/(?:\s*·\s*\/[^/]+\/)*/g;
  const pronSection = html.match(/<p[^>]*class="[^"]*srt[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  if (pronSection) {
    const matches = pronSection[1].matchAll(/\/([^/]+)\//g);
    for (const m of matches) pronunciations.push(`/${m[1]}/`);
  }
  if (pronunciations.length > 0) result.pronunciation = pronunciations;

  // Extract conjugation tables
  if (type === "verb") {
    result.conjugation = {};

    // Present tense
    const presentMatch = html.match(/Präsens([\s\S]*?)(?:Präteritum|<\/section)/i);
    if (presentMatch) {
      result.conjugation.present = parseConjugationTable(presentMatch[1]);
    }

    // Past tense
    const pastMatch = html.match(/Präteritum([\s\S]*?)(?:Perfekt|Konjunktiv|<\/section)/i);
    if (pastMatch) {
      result.conjugation.past = parseConjugationTable(pastMatch[1]);
    }

    // Perfect
    const perfMatch = html.match(/Perfekt([\s\S]*?)(?:Plusquam|Futur|<\/section)/i);
    if (perfMatch) {
      result.conjugation.perfect = parseConjugationTable(perfMatch[1]);
    }

    // Konjunktiv II
    const konj2Match = html.match(/Konjunktiv II([\s\S]*?)(?:Imperativ|<\/section)/i);
    if (konj2Match) {
      result.conjugation.konjunktiv2 = parseConjugationTable(konj2Match[1]);
    }

    // Imperative
    const impMatch = html.match(/Imperativ([\s\S]*?)(?:Infinitiv|Partizip|<\/section)/i);
    if (impMatch) {
      result.conjugation.imperative = parseConjugationTable(impMatch[1]);
    }

    // Partizip
    const partizipMatch = html.match(/Partizip I[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?Partizip II[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (partizipMatch) {
      result.conjugation.partizipI = cleanHtml(partizipMatch[1]);
      result.conjugation.partizipII = cleanHtml(partizipMatch[2]);
    }
  }

  // Extract examples (Beispiele)
  result.examples = [];
  const exempelSection = html.match(/Beispiele[\s\S]*?<section[^>]*>([\s\S]*?)<\/section>/i);
  if (exempelSection) {
    const exampleBlocks = exempelSection[1].matchAll(/<p[^>]*class="[^"]*beispieltext[^"]*"[^>]*>([\s\S]*?)<\/p>/gi);
    for (const block of exampleBlocks) {
      const text = cleanHtml(block[1]).trim();
      if (text) result.examples.push(text);
    }
  }

  // Extract translations
  result.translations = {};
  const transSection = html.match(/Übersetzungen[\s\S]*?<section[^>]*>([\s\S]*?)<\/section>/i);
  if (transSection) {
    const langBlocks = transSection[1].matchAll(/<img[^>]*alt="([^"]*)"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi);
    for (const block of langBlocks) {
      const lang = block[1].trim().toLowerCase();
      const text = cleanHtml(block[2]).trim();
      if (lang && text && lang !== "deutsch") {
        result.translations[lang] = text;
      }
    }
  }

  // Extract definitions (Bedeutungen)
  result.definitions = [];
  const defSection = html.match(/Bedeutungen[\s\S]*?<section[^>]*>([\s\S]*?)<\/section>/i);
  if (defSection) {
    const defs = defSection[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    for (const d of defs) {
      const text = cleanHtml(d[1]).trim();
      if (text && text.length > 5 && !text.startsWith("»")) {
        result.definitions.push(text);
      }
    }
  }

  return result;
}

function parseConjugationTable(html) {
  const rows = {};
  // Match patterns like "ich lese" or "du liest"
  const rowMatches = html.matchAll(/(?:ich|du|er|wir|ihr|sie|Sie)\s+[\s\S]*?<\/td>/gi);
  // Fallback: extract all text content and parse pronoun + form pairs
  const text = cleanHtml(html);
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(ich|du|er\/sie\/es|wir|ihr|sie\/Sie)\s+(.+)$/i);
    if (m) {
      const pronoun = m[1].toLowerCase();
      rows[pronoun] = m[2].trim();
    }
  }
  return Object.keys(rows).length > 0 ? rows : null;
}

function cleanHtml(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#[0-9]+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 3: Verify server starts without errors**

Run: `node --check local-server.mjs`
Expected: No syntax errors

- [ ] **Step 4: Test the endpoint manually**

Start the server, then run:
```bash
curl -s http://localhost:8787/api/verbformen/lesen | head -c 500
```
Expected: JSON with conjugation data, examples, translations

- [ ] **Step 5: Commit**

```bash
git add local-server.mjs
git commit -m "feat: add verbformen.de scraping endpoint with caching"
```

---

### Task 3: Add `verbformen()` method to frontend API client

**Files:**
- Modify: `src/lib/local-api.ts:82-84` (after the `dictionaryDe` method)

- [ ] **Step 1: Add the verbformen method**

After line 83 (`return request<{ definition: string; baseForm: string } | null>("/api/dictionary/de", { method: "POST", body: JSON.stringify({ word }) });`), add:

```typescript
  verbformen: async (word: string) => {
    return request<{
      word: string;
      type: string;
      level: string | null;
      auxiliary: string | null;
      irregular: boolean;
      baseForm: string;
      pronunciation: string[];
      conjugation: Record<string, Record<string, string> | null>;
      examples: string[];
      translations: Record<string, string>;
      definitions: string[];
    } | null>(`/api/verbformen/${encodeURIComponent(word)}`);
  },
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit` (or check in your IDE)
Expected: No new TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/local-api.ts
git commit -m "feat: add verbformen API client method"
```

---

### Task 4: Create VerbformenPanel component

**Files:**
- Create: `src/components/app/VerbformenPanel.tsx`

- [ ] **Step 1: Create the VerbformenPanel component**

```tsx
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { localApi } from "@/lib/local-api";
import { Loader2, ExternalLink, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";

interface ConjugationData {
  word: string;
  type: string;
  level: string | null;
  auxiliary: string | null;
  irregular: boolean;
  baseForm: string;
  pronunciation: string[];
  conjugation: Record<string, Record<string, string> | null>;
  examples: string[];
  translations: Record<string, string>;
  definitions: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: string;
}

export function VerbformenPanel({ open, onOpenChange, word }: Props) {
  const [data, setData] = useState<ConjugationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !word) return;
    setLoading(true);
    setError(false);
    setData(null);
    localApi
      .verbformen(word)
      .then((res) => {
        if (res) setData(res);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open, word]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="size-4" />
            {data?.word ?? word}
          </SheetTitle>
          <SheetDescription>
            {data
              ? `${data.type.charAt(0).toUpperCase() + data.type.slice(1)}${data.level ? ` · ${data.level}` : ""}${data.irregular ? " · irregular" : ""}`
              : "Loading from verbformen.de…"}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>Could not load data from verbformen.de.</p>
            <a
              href={`https://www.verbformen.de/konjugation/${encodeURIComponent(word)}.htm`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open on verbformen.de <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-5 pb-6">
            {/* Pronunciation */}
            {data.pronunciation && data.pronunciation.length > 0 && (
              <Section title="Aussprache">
                <p className="text-sm text-muted-foreground">
                  {data.pronunciation.join(" · ")}
                </p>
              </Section>
            )}

            {/* Conjugation tables */}
            {data.conjugation && Object.keys(data.conjugation).length > 0 && (
              <Section title="Konjugation">
                {Object.entries(data.conjugation).map(([tense, forms]) =>
                  forms ? (
                    <div key={tense} className="mb-3">
                      <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {tenseLabel(tense)}
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {Object.entries(forms).map(([pronoun, form]) => (
                          <div key={pronoun} className="contents">
                            <span className="text-muted-foreground">{pronoun}</span>
                            <span className="font-medium">{form}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </Section>
            )}

            {/* Definitions */}
            {data.definitions.length > 0 && (
              <Section title="Bedeutungen">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {data.definitions.map((def, i) => (
                    <li key={i} className="text-foreground/90">{def}</li>
                  ))}
                </ol>
              </Section>
            )}

            {/* Examples */}
            {data.examples.length > 0 && (
              <Section title="Beispiele">
                <ul className="space-y-2 text-sm">
                  {data.examples.map((ex, i) => (
                    <li key={i} className="rounded-md bg-muted/50 px-3 py-2 italic text-foreground/80">
                      &ldquo;{ex}&rdquo;
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Translations */}
            {Object.keys(data.translations).length > 0 && (
              <Section title="Übersetzungen">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.translations).map(([lang, text]) => (
                    <Badge key={lang} variant="secondary" className="text-xs">
                      {lang}: {text}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Link to full page */}
            <a
              href={`https://www.verbformen.de/${data.type === "verb" ? "konjugation" : data.type === "noun" ? "deklination/substantive" : "deklination/adjektive"}/${encodeURIComponent(data.baseForm)}.htm`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              View full details on verbformen.de
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function tenseLabel(tense: string): string {
  const labels: Record<string, string> = {
    present: "Präsens",
    past: "Präteritum",
    perfect: "Perfekt",
    plusquam: "Plusquamperfekt",
    futur1: "Futur I",
    futur2: "Futur II",
    konjunktiv1: "Konjunktiv I",
    konjunktiv2: "Konjunktiv II",
    imperative: "Imperativ",
    partizipI: "Partizip I",
    partizipII: "Partizip II",
    infinitivI: "Infinitiv I",
    infinitivII: "Infinitiv II",
  };
  return labels[tense] ?? tense.charAt(0).toUpperCase() + tense.slice(1);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/app/VerbformenPanel.tsx
git commit -m "feat: add VerbformenPanel component"
```

---

### Task 5: Add Verbformen button to WordTooltip

**Files:**
- Modify: `src/components/app/WordTooltip.tsx:5-6` (imports)
- Modify: `src/components/app/WordTooltip.tsx:200-210` (action buttons)

- [ ] **Step 1: Add BookOpen import**

Add `BookOpen` to the lucide-react import on line 5:

```tsx
import { BookmarkCheck, ExternalLink, Plus, BookOpen, X } from "lucide-react";
```

- [ ] **Step 2: Add state for verbformen panel**

After line 36 (`const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});`), add:

```tsx
const [verbformenOpen, setVerbformenOpen] = useState(false);
```

- [ ] **Step 3: Add Verbformen button in the tooltip actions**

After the dict.cc link (line 209: `</a>`), before the closing `</span>` on line 210, add:

```tsx
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVerbformenOpen(true);
                setOpen(false);
              }}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              <BookOpen className="size-3" /> Verbformen
            </button>
```

- [ ] **Step 4: Import and render VerbformenPanel**

Add import at the top of the file (after line 4):

```tsx
import { VerbformenPanel } from "@/components/app/VerbformenPanel";
```

Before the closing `</span>` of the component's return (after line 212, before line 213 `);`), add:

```tsx
      <VerbformenPanel
        open={verbformenOpen}
        onOpenChange={setVerbformenOpen}
        word={baseForm || display}
      />
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Test the full flow**

Start the dev server (`npm run dev`), open the app, navigate to a subtitle with German text, click a word, and verify:
1. Tooltip shows the "Verbformen" button
2. Clicking it opens the side panel
3. Panel shows loading spinner, then conjugation data

- [ ] **Step 7: Commit**

```bash
git add src/components/app/WordTooltip.tsx src/components/app/VerbformenPanel.tsx
git commit -m "feat: add Verbformen button to WordTooltip"
```

---

### Task 6: Integration test and polish

**Files:**
- Verify: `local-server.mjs`
- Verify: `src/lib/local-api.ts`
- Verify: `src/components/app/VerbformenPanel.tsx`
- Verify: `src/components/app/WordTooltip.tsx`

- [ ] **Step 1: Test with different word types**

Test the endpoint with:
```bash
# Verb
curl -s http://localhost:8787/api/verbformen/lesen | python3 -m json.tool | head -20

# Noun
curl -s http://localhost:8787/api/verbformen/Tag | python3 -m json.tool | head -20

# Adjective
curl -s http://localhost:8787/api/verbformen/schoen | python3 -m json.tool | head -20

# Unknown word
curl -s http://localhost:8787/api/verbformen/xyznotaword | python3 -m json.tool
```

- [ ] **Step 2: Verify caching works**

Run the same word twice and check the second is instant:
```bash
time curl -s http://localhost:8787/api/verbformen/lesen > /dev/null
time curl -s http://localhost:8787/api/verbformen/lesen > /dev/null
```
Expected: Second call is significantly faster (< 10ms)

- [ ] **Step 3: Verify error handling**

Test with a word that doesn't exist on verbformen.de:
```bash
curl -s http://localhost:8787/api/verbformen/xyznotaword123
```
Expected: Returns `null` gracefully

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish verbformen integration"
```
