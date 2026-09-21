# Verbformen.de Integration Design

## Overview

Integrate [verbformen.de](https://www.verbformen.de) (Netzverb Wörterbuch) into Motus so that when a user clicks any German word, they can open a detailed panel showing conjugation tables, example sentences, translations, and definitions scraped from verbformen.de.

## Goals

- Show full verb conjugation tables (Präsens, Präteritum, Konjunktiv, Partizip, etc.)
- Show example sentences (Beispiele) with English translations
- Show translations to the user's native language
- Show word definitions (Bedeutungen)
- Cache results locally so repeated lookups are instant
- Work for verbs, nouns, and adjectives

## Architecture

### Data Flow

```
User clicks word
  → WordTooltip shows base info + "Verbformen" button
  → Click button → opens VerbformenPanel (side panel/dialog)
  → Panel calls GET /api/verbformen/:word
  → Backend checks cache table → if miss, scrapes verbformen.de
  → Returns structured JSON → frontend renders
```

### Backend: `/api/verbformen/:word` Endpoint

**URL patterns on verbformen.de:**
- Verbs: `https://www.verbformen.de/konjugation/{word}.htm`
- Nouns: `https://www.verbformen.de/deklination/substantive/{word}.htm`
- Adjectives: `https://www.verbformen.de/deklination/adjektive/{word}.htm`

**Strategy:** Try verb URL first (most common for language learning). If 404, try noun, then adjective. Cache whatever succeeds.

**Scraping approach:** Use `fetch` + HTML parsing. The site is plain HTML with predictable structure. Parse using regex/string extraction (no heavy DOM parser needed — the structure is consistent).

**Response schema:**
```json
{
  "word": "lesen",
  "type": "verb",
  "level": "A1",
  "auxiliary": "haben",
  "irregular": true,
  "baseForm": "lesen",
  "pronunciation": {
    "infinitive": "/ˈleːzən/",
    "present": "/liːst/",
    "past": "/laːs/",
    "participle": "/ɡəˈleːzən/"
  },
  "conjugation": {
    "present": {
      "ich": "lese",
      "du": "liest",
      "er/sie/es": "liest",
      "wir": "lesen",
      "ihr": "lest",
      "sie/Sie": "lesen"
    },
    "past": {
      "ich": "las",
      "du": "lasest",
      "er/sie/es": "las",
      "wir": "lasen",
      "ihr": "last",
      "sie/Sie": "lasen"
    },
    "perfect": {
      "ich": "habe gelesen",
      "du": "hast gelesen",
      "er/sie/es": "hat gelesen",
      "wir": "haben gelesen",
      "ihr": "habt gelesen",
      "sie/Sie": "haben gelesen"
    },
    "konjunktiv2": {
      "ich": "läse",
      "du": "läsest",
      "er/sie/es": "läse",
      "wir": "läsen",
      "ihr": "läset",
      "sie/Sie": "läsen"
    },
    "imperativ": {
      "du": "lies",
      "wir": "lesen wir",
      "ihr": "lest",
      "Sie": "lesen Sie"
    },
    "partizipI": "lesend",
    "partizipII": "gelesen",
    "infinitivI": "lesen",
    "infinitivII": "gelesen haben"
  },
  "examples": [
    {
      "german": "Ich lese oft.",
      "english": "I often read."
    },
    {
      "german": "Tom liest langsam.",
      "english": "Tom reads slowly."
    }
  ],
  "translations": {
    "en": "read, lecture, glean",
    "tr": "okumak, seçmek",
    "es": "leer, dar una conferencia",
    "fr": "lire, capturer"
  },
  "definitions": [
    "Schriftzeichen, Worte und Texte wahrnehmen sowie im Gehirn verarbeiten und verstehen",
    "[Pflanzen] Dinge auswählen, um sie danach aufzusammeln"
  ]
}
```

**Caching:** New `verbformen_cache` table in PostgreSQL:
```sql
CREATE TABLE verbformen_cache (
  word TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  scraped_at BIGINT NOT NULL
);
```
Cache TTL: 30 days (re-scrape after expiry).

### Frontend: VerbformenPanel Component

**Location:** `src/components/app/VerbformenPanel.tsx`

**UI:** A slide-in side panel (like a sheet) or a dialog. Shows:
1. **Header:** Word + pronunciation + level badge + word type
2. **Conjugation section:** Collapsible tables for each tense/mood
3. **Examples section:** List of example sentences with translations
4. **Translations section:** Grid of translations by language
5. **Definitions section:** Numbered list of Bedeutungen

**Trigger:** A "Verbformen" button added to the existing `WordTooltip` component, next to the existing "dict.cc" link.

### Integration Points

1. **WordTooltip.tsx** — Add a "Verbformen" button (external link icon) that opens the panel
2. **local-server.mjs** — Add `/api/verbformen/:word` endpoint with scraping + caching logic
3. **local-api.ts** — Add `verbformen(word)` method to the API client
4. **New component:** `VerbformenPanel.tsx` — The detailed view panel

## Scope

### In scope
- Verb conjugation tables
- Example sentences
- Translations (all languages shown on verbformen.de)
- Definitions (Bedeutungen)
- Local caching in DB
- Works for verbs, nouns, and adjectives

### Out of scope
- Pre-crawling the entire site
- Offline-first mode (requires network for first lookup)
- Editing/correcting scraped data
- Audio pronunciation from verbformen.de (use existing TTS)

## Risk

- **Scraping fragility:** If verbformen.de changes their HTML structure, parsing breaks. Mitigation: keep parser modular, log failures gracefully, show "unavailable" state.
- **Rate limiting:** Verbformen.de may block frequent requests. Mitigation: local cache reduces requests, add reasonable delays.
- **Legal:** Site is CC BY-SA 4.0, so caching and displaying with attribution is permitted.
