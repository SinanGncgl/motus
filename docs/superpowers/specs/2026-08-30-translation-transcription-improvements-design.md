# Translation & Transcription Quality — Design Spec

## Problem

The current translation pipeline (LibreTranslate) produces low-quality, literal translations. The transcription pipeline only uses whisper-tiny (~75MB), the smallest/least accurate Whisper model, and the "accurate" mode is broken (same model as "fast").

## Goals

1. **Better transcription** — Use whisper-base for "accurate" mode (2-3x better accuracy, ~142MB)
2. **Better translation** — Add DeepL API as a higher-quality alternative to LibreTranslate
3. **Faster repeat translations** — Cache translations in localStorage (30-day TTL)

## Non-Goals

- Server-side transcription (keeps audio on-device)
- Replacing LibreTranslate entirely (it stays as free offline fallback)
- Translation of full subtitle files (line-by-line is sufficient for now)

## Architecture

### Transcription

- **"fast" mode**: whisper-tiny (75MB, fast, lower accuracy) — unchanged
- **"accurate" mode**: whisper-base (142MB, 2-3x better accuracy) with whisper-tiny fallback
- Model download: remote from HuggingFace on first use, then cached by browser
- UI: quality selector in TranscribeFile component ("Fast (tiny)" / "Accurate (base)")
- Watch page defaults to "accurate" mode

### Translation

- **Service selector** in Settings: "LibreTranslate (local, free)" or "DeepL (higher quality)"
- DeepL free tier: 500k chars/month, requires free API key from deepl.com
- Server proxy handles API key securely (key stored in localStorage, sent to same-origin server only)
- Fallback chain: DeepL → LibreTranslate server proxy → LibreTranslate endpoint
- DeepL auto-detects source language when set to "auto"

### Translation Caching

- Key: `sourceText:sourceLang:targetLang`
- Storage: localStorage, max 5000 entries, 30-day TTL
- Eviction: oldest-first when over limit
- Watch page checks cache before making API calls

## User Flow

### Transcription
1. User opens Watch page → uploads a video/audio file
2. TranscribeFile shows quality selector ("Fast" / "Accurate")
3. User selects quality → uploads file
4. Model downloads (first time only, ~142MB for base)
5. Transcription runs, returns subtitle lines

### Translation
1. User goes to Settings → selects "DeepL" as translation service
2. User pastes their DeepL API key (free from deepl.com)
3. In Watch page, clicking translate on a line calls DeepL
4. Translation result is cached in localStorage
5. Same line translated again → instant from cache

## Data Model

### Settings additions
- `translationService: "libretranslate" | "deepl"` (default: "libretranslate")

### localStorage cache
- Key: `motus.translation-cache.v1`
- Value: `Record<string, { text: string, result: string, ts: number }>`
- Max 5000 entries, 30-day TTL

## API Endpoints

- `POST /api/translate` — existing LibreTranslate proxy (unchanged)
- `POST /api/translate-deepl` — new DeepL proxy endpoint
  - Body: `{ q: string, source: string, target: string, api_key: string }`
  - Response: `{ translatedText: string }`

## Security

- DeepL API key stored in localStorage (device-local, never sent to third parties)
- Server proxy forwards key to DeepL API only, over HTTPS
- No key logging, no key persistence on server
