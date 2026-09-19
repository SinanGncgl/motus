# German Word Lookup & Infinitive Form Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Look up on dict.cc" link in the word tooltip, and save the actual dictionary (infinitive) form when saving German words.

**Architecture:** Two independent features — (1) a lookup link that opens dict.cc in a new tab, (2) a server-side German dictionary API call on word save to fetch the base form.

---

## Task 1: Add "Look up on dict.cc" link to WordTooltip

**Files:**
- Modify: `src/components/app/WordTooltip.tsx`

- [ ] **Step 1: Add external dictionary link**

In `WordTooltip.tsx`, add a button/link below the existing "Save" / "Details" buttons that opens `https://www.dict.cc/?s={word}` in a new tab.

```tsx
// Add after the existing action buttons in WordTooltip
<a
  href={`https://www.dict.cc/?s=${encodeURIComponent(word)}`}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
>
  <ExternalLink className="size-3" />
  Look up on dict.cc
</a>
```

Import `ExternalLink` from `lucide-react`.

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: PASS

---

## Task 2: Add German dictionary API endpoint to server

**Files:**
- Modify: `local-server.mjs`

- [ ] **Step 1: Add `/api/dictionary/de` endpoint**

After the existing English dictionary endpoint (around line 753), add a German dictionary endpoint that queries `https://api.dictionaryapi.dev/api/v2/entries/de/{word}` or falls back to returning the word as-is.

```javascript
// German dictionary lookup
if (req.method === "POST" && path === "/api/dictionary/de") {
  const a = await body(req);
  const word = String(a.word || "").trim();
  if (!word) return send(res, 200, null);
  
  try {
    // Try Wiktionary API for German
    const r = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
    if (r.ok) {
      const d = await r.json();
      const de = d?.de;
      if (de) {
        // Look for noun/verb/adjective forms
        const all = [...(de.noun || []), ...(de.verb || []), ...(de.adjective || [])];
        const def = all[0]?.definitions?.[0]?.definition || "";
        // Extract base form from part of speech headers
        const baseForm = de.verb?.[0]?.title?.replace(/^To /, "").toLowerCase() || word;
        return send(res, 200, { definition: def, baseForm });
      }
    }
  } catch {}
  
  // Fallback: return word as-is
  return send(res, 200, { definition: "", baseForm: word });
}
```

- [ ] **Step 2: Add client API function**

In `src/lib/local-api.ts`, add to the `dictionary` namespace:

```typescript
dictionaryDe: async (word: string) => {
  return request<{ definition: string; baseForm: string } | null>(
    "/api/dictionary/de",
    { method: "POST", body: JSON.stringify({ word }) }
  );
},
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: PASS

---

## Task 3: Use base form when saving German words

**Files:**
- Modify: `src/pages/Watch.tsx` (saveWordFromToken)

- [ ] **Step 1: Fetch base form on save for German words**

In `saveWordFromToken` in Watch.tsx, after the word is saved, if the language is German, call the German dictionary API to get the base form and update the word if different.

```typescript
const saveWordFromToken = async (tokenWord: string, raw: string, lineText: string) => {
  playerRef.current?.pauseVideo();
  if (!subtitle) return;
  
  let screenshot = await captureFrame(playerRef);
  if (!screenshot && subtitle.videoId && videoContainerRef.current) {
    screenshot = await captureScreenCrop(videoContainerRef.current);
  }
  
  // For German, try to get the base/infinitive form
  let wordToSave = tokenWord;
  let displayToSave = raw;
  if (subtitle.language === "de") {
    try {
      const lookup = await localApi.dictionaryDe(tokenWord);
      if (lookup?.baseForm && lookup.baseForm !== tokenWord) {
        wordToSave = lookup.baseForm;
      }
    } catch {}
  }
  
  await save({
    word: wordToSave,
    display: displayToSave,
    example: lineText,
    sourceTitle: subtitle.title,
    language: subtitle.language,
    screenshot: screenshot ?? undefined,
  });
  
  // ... toast
};
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: PASS
