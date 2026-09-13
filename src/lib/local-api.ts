import type { LocalUser, LocalLine, LocalSubtitle, LocalWord, LocalCard, CardRateResult, LocalWordGroup } from "@/types";
export type { LocalUser, LocalLine, LocalSubtitle, LocalWord, LocalCard, CardRateResult, LocalWordGroup };

const BASE = (import.meta.env.VITE_LOCAL_API_URL as string | undefined) ?? "";
const SESSION_KEY = "motus.local.session";
const dictionaryCache = new Map<string, { definition: string; example: string } | null>();

function headers(extra: HeadersInit = {}) { const token = localStorage.getItem(SESSION_KEY); return { "Content-Type": "application/json", ...(token ? { "X-Local-Session": token } : {}), ...extra }; }
async function request<T>(path: string, options: RequestInit = {}) { const response = await fetch(`${BASE}${path}`, { ...options, headers: headers(options.headers) }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `Request failed (${response.status})`); } return response.json() as Promise<T>; }

export const localApi = {
  async ensureSession() { if (!localStorage.getItem(SESSION_KEY)) { const result = await request<{ token: string }>("/api/auth/guest", { method: "POST" }); localStorage.setItem(SESSION_KEY, result.token); } return request<{ user: LocalUser }>("/api/auth/me"); },
  logout() { localStorage.removeItem(SESSION_KEY); },
  subtitles: { list: () => request<LocalSubtitle[]>("/api/subtitles"), get: (id: string) => request<LocalSubtitle>(`/api/subtitles/${id}`), create: (value: unknown) => request<LocalSubtitle>("/api/subtitles", { method: "POST", body: JSON.stringify(value) }), update: (id: string, value: unknown) => request<void>(`/api/subtitles/${id}`, { method: "PATCH", body: JSON.stringify(value) }), remove: (id: string) => request<void>(`/api/subtitles/${id}`, { method: "DELETE" }) },
  words: {
    list: () => request<LocalWord[]>("/api/words"),
    save: (value: unknown) => request<{ wordId: string; created: boolean }>("/api/words", { method: "POST", body: JSON.stringify(value) }),
    update: (id: string, value: unknown) => request<void>(`/api/words/${id}`, { method: "PATCH", body: JSON.stringify(value) }),
    remove: (id: string) => request<void>(`/api/words/${id}`, { method: "DELETE" }),
    uploadScreenshot: async (wordId: string, blob: Blob) => {
      const token = localStorage.getItem(SESSION_KEY);
      const response = await fetch(`${BASE}/api/words/${wordId}/screenshot`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg", ...(token ? { "X-Local-Session": token } : {}) },
        body: blob,
      });
      if (!response.ok) throw new Error("SCREENSHOT_UPLOAD_FAILED");
      return response.json() as Promise<{ ok: boolean }>;
    },
  },
  cards: { due: (newCardsLimit?: number, groupId?: string | null) => {
    const params = new URLSearchParams();
    if (newCardsLimit != null) params.set("newCardsLimit", String(newCardsLimit));
    if (groupId) params.set("groupId", groupId);
    const qs = params.toString();
    return request<LocalCard[]>(`/api/cards/due${qs ? `?${qs}` : ""}`);
  }, dueCount: () => request<number>("/api/cards/due-count"), nextDue: () => request<{ nextDue: number | null }>("/api/cards/next-due"), rate: (cardId: string, rating: string) => request<CardRateResult>("/api/cards/rate", { method: "POST", body: JSON.stringify({ cardId, rating }) }), suspend: (cardId: string) => request<void>("/api/cards/suspend", { method: "POST", body: JSON.stringify({ cardId }) }) },
  stats: {
    overview: () => request<{ totalWords: number; cardsDue: number; mastered: number; totalReviews: number; todayReviews: number; weeklyAccuracy: number }>("/api/stats/overview"),
    daily: () => request<{ days: Array<{ day_key: number; total: number; correct: number; again_count: number; hard_count: number }> }>("/api/stats/daily"),
    hardWords: () => request<{ words: Array<{ card_id: string; front: string; card_type: string; leech_count: number; ease_factor: number; review_count: number; again_count: number; word: string; display: string; definition: string }> }>("/api/stats/hard-words"),
    maturity: () => request<{ distribution: Array<{ box: number; count: number }> }>("/api/stats/maturity"),
  },
  transcript: (videoId: string, lang?: string) => request<{ videoId: string; lines: LocalLine[] }>("/api/transcript", { method: "POST", body: JSON.stringify({ videoId, lang }) }),
  groups: {
    list: () => request<{ groups: LocalWordGroup[] }>("/api/groups"),
    create: (name: string, color?: string) =>
      request<{ ok: boolean; id: string; name: string; color: string }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name, color }),
      }),
    update: (id: string, data: { name?: string; color?: string }) =>
      request<{ ok: boolean }>(`/api/groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/groups/${id}`, { method: "DELETE" }),
    addWords: (groupId: string, wordIds: string[]) =>
      request<{ ok: boolean; added: number }>(`/api/groups/${groupId}/words`, {
        method: "POST",
        body: JSON.stringify({ wordIds }),
      }),
    removeWord: (groupId: string, wordId: string) =>
      request<{ ok: boolean }>(`/api/groups/${groupId}/words/${wordId}`, {
        method: "DELETE",
      }),
    getWords: (groupId: string) =>
      request<{ words: any[] }>(`/api/groups/${groupId}/words`),
  },
  dictionary: async (word: string) => {
    const cached = dictionaryCache.get(word);
    if (cached !== undefined) return cached;
    if (dictionaryCache.size >= 500) {
      const oldest = dictionaryCache.keys().next().value;
      if (oldest !== undefined) dictionaryCache.delete(oldest);
    }
    const result = await request<{ definition: string; example: string } | null>("/api/dictionary", { method: "POST", body: JSON.stringify({ word }) });
    dictionaryCache.set(word, result);
    return result;
  },
  upload: async (file: File) => { const response = await fetch(`${BASE}/api/uploads`, { method: "POST", headers: headers({ "Content-Type": file.type || "application/octet-stream", "X-File-Name": file.name }), body: file }); if (!response.ok) throw new Error("UPLOAD_FAILED"); return response.json() as Promise<{ storageId: string; fileName: string }>; },
  grab: (url: string) => request<{ storageId: string; fileName: string; fileUrl: string }>("/api/grab", { method: "POST", body: JSON.stringify({ url }) }),
  transcribeFile: (storageId: string, language?: string, model?: string) => request<{ lines: LocalLine[]; language: string }>("/api/transcribe-file", { method: "POST", body: JSON.stringify({ storageId, language, model }) }),
  /** SSE-based transcription with progress events. */
  transcribeFileSSE: (storageId: string, language: string | undefined, model: string | undefined, onProgress: (p: { status: string; percent?: number; message?: string; line_count?: number; current_text?: string }) => void): Promise<{ lines: LocalLine[]; language: string }> => {
    const token = localStorage.getItem(SESSION_KEY);
    return new Promise((resolve, reject) => {
      fetch(`${BASE}/api/transcribe-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "X-Local-Session": token } : {}) },
        body: JSON.stringify({ storageId, language, model }),
      }).then((resp) => {
        if (!resp.ok) return resp.json().then((d) => { throw new Error(d.error || `HTTP ${resp.status}`); });
        if (!resp.body) return reject(new Error("No response body"));
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const process = () => {
          reader.read().then(({ done, value }) => {
            if (done) return;
            buf += decoder.decode(value, { stream: true });
            // Parse SSE events
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            let eventType = "";
            let eventData = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7).trim();
              else if (line.startsWith("data: ")) eventData = line.slice(6);
              else if (line === "" && eventType && eventData) {
                try {
                  const parsed = JSON.parse(eventData);
                  if (eventType === "done") { resolve(parsed); return; }
                  if (eventType === "error") { reject(new Error(parsed.message || "Transcription failed")); return; }
                  if (eventType === "progress") onProgress(parsed);
                } catch { /* skip */ }
                eventType = "";
                eventData = "";
              }
            }
            process();
          }).catch(reject);
        };
        process();
      }).catch(reject);
    });
  },
};

export { SESSION_KEY };
