const BASE = (import.meta.env.VITE_LOCAL_API_URL as string | undefined) ?? "";
const SESSION_KEY = "motus.local.session";

export interface LocalUser { id: string; name?: string; email?: string; image?: string; isAnonymous?: boolean }
export interface LocalLine { index: number; start?: number; end?: number; text: string }
export interface LocalSubtitle { _id: string; id?: string; title: string; sourceType: "srt" | "plain"; videoId?: string; fileId?: string; fileName?: string; fileUrl?: string; language?: string; lines: LocalLine[]; updatedAt: number; lastPosition?: number; collection?: string }
export interface LocalWord { _id: string; id?: string; word: string; display: string; definition: string; example: string; sourceTitle?: string; language?: string; cardBox: number; cardDueAt: number | null }
export interface LocalCard { id: string; _id?: string; front: string; back: string; box: number; dueAt: number }

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
  cards: { due: () => request<LocalCard[]>("/api/cards/due"), dueCount: () => request<number>("/api/cards/due-count"), rate: (cardId: string, rating: string) => request<void>("/api/cards/rate", { method: "POST", body: JSON.stringify({ cardId, rating }) }) },
  transcript: (videoId: string, lang?: string) => request<{ videoId: string; lines: LocalLine[] }>("/api/transcript", { method: "POST", body: JSON.stringify({ videoId, lang }) }),
  dictionary: (word: string) => request<{ definition: string; example: string } | null>("/api/dictionary", { method: "POST", body: JSON.stringify({ word }) }),
  upload: async (file: File) => { const response = await fetch(`${BASE}/api/uploads`, { method: "POST", headers: headers({ "Content-Type": file.type || "application/octet-stream", "X-File-Name": file.name }), body: file }); if (!response.ok) throw new Error("UPLOAD_FAILED"); return response.json() as Promise<{ storageId: string; fileName: string }>; },
  grab: (url: string) => request<{ storageId: string; fileName: string; fileUrl: string }>("/api/grab", { method: "POST", body: JSON.stringify({ url }) }),
};

export { SESSION_KEY };
