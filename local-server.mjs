#!/usr/bin/env node
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { homedir } from "node:os";
import { spawn, execFile } from "node:child_process";
import pg from "pg";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR ?? join(homedir(), ".motus");
const UPLOAD_DIR = join(DATA_DIR, "uploads");
const SCREENSHOTS_DIR = join(DATA_DIR, "screenshots");
const DIST_DIR = process.env.DIST_DIR ?? join(process.cwd(), "dist");
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://sinang@127.0.0.1:5432/motus";
const MAX_BODY = 60 * 1024 * 1024;
// Base the app uses to reach the local server (same-origin in the browser).
const GRAB_BASE = process.env.GRAB_BASE ?? "";
// Optional LibreTranslate server. Defaults to a self-hosted instance on
// localhost:5000 (started via `libretranslate`), so translation works with zero
// config. Override with LIBRETRANSLATE_URL. The API key stays server-side.
const LIBRETRANSLATE_URL = (
  process.env.LIBRETRANSLATE_URL ?? "http://127.0.0.1:5001"
).replace(/\/+$/, "");
// Optional API key. The bundled self-hosted launch runs LibreTranslate WITHOUT
// --api-keys (open access, local-only), so no key is needed by default. Set
// LIBRETRANSLATE_KEY only when pointing at a managed/keyed instance.
const LIBRETRANSLATE_KEY = process.env.LIBRETRANSLATE_KEY ?? "";

await mkdir(UPLOAD_DIR, { recursive: true });
await mkdir(SCREENSHOTS_DIR, { recursive: true });
const pool = new pg.Pool({ connectionString: DATABASE_URL });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT, email TEXT, image TEXT, is_anonymous BOOLEAN
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT
);
CREATE TABLE IF NOT EXISTS subtitles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT,
  video_id TEXT,
  video_type TEXT,
  file_id TEXT,
  file_name TEXT,
  language TEXT,
  lines_json TEXT NOT NULL DEFAULT '[]',
  created_at BIGINT,
  updated_at BIGINT,
  last_position DOUBLE PRECISION
);
CREATE TABLE IF NOT EXISTS saved_words (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  display TEXT,
  definition TEXT,
  example TEXT,
  source_title TEXT,
  language TEXT,
  translation TEXT,
  created_at BIGINT,
  updated_at BIGINT
);
CREATE TABLE IF NOT EXISTS anki_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  saved_word_id TEXT NOT NULL,
  front TEXT,
  back TEXT,
  box INTEGER DEFAULT 0,
  due_at BIGINT,
  last_reviewed_at BIGINT,
  created_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_sub_user ON subtitles(user_id);
CREATE INDEX IF NOT EXISTS idx_word_user ON saved_words(user_id);
CREATE INDEX IF NOT EXISTS idx_card_user ON anki_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_card_word ON anki_cards(saved_word_id);
`;

const id = (p) => `${p}_${randomUUID()}`;
const now = () => Date.now();
function formatCardBack(a, fallbackWord) {
  const parts = [];
  if (a.definition) parts.push(a.definition);
  if (a.example) parts.push(`Context: ${a.example}`);
  if (a.translation) parts.push(`Translation: ${a.translation}`);
  if (a.sourceTitle) parts.push(`Source: ${a.sourceTitle}`);
  return parts.join("\n\n") || fallbackWord;
}

// Initialize schema + seed default user.
await pool.query(SCHEMA);
// Migration: add translation column to saved_words if missing
await pool.query("ALTER TABLE saved_words ADD COLUMN IF NOT EXISTS translation TEXT").catch(() => {});
await pool.query("ALTER TABLE anki_cards ADD COLUMN IF NOT EXISTS leech_count INTEGER DEFAULT 0").catch(() => {});
await pool.query("ALTER TABLE anki_cards ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'word'").catch(() => {});
await pool.query(
  "INSERT INTO users (id,name,email,image,is_anonymous) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
  ["local-user", "Local learner", "local@localhost", null, true],
);

// ---- query helpers ----
const q = (text, params = []) => pool.query(text, params);
const q1 = async (text, params = []) => (await pool.query(text, params)).rows[0] ?? null;

// ---- helpers ----
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Local-Session");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Cache-Control", "no-store");
}
function send(res, status, value, headers = {}) { cors(res); res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers }); res.end(JSON.stringify(value)); }
function fail(res, status, message) { send(res, status, { error: message }); }
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw new Error("BODY_TOO_LARGE"); chunks.push(chunk); }
  const raw = Buffer.concat(chunks);
  return (req.headers["content-type"] ?? "").includes("application/json") ? JSON.parse(raw.toString("utf8") || "{}") : raw;
}
async function currentUser(req) {
  const token = req.headers["x-local-session"];
  const row = token ? await q1("SELECT user_id FROM sessions WHERE token = $1", [token]) : null;
  const uid = row?.user_id ?? "local-user";
  const u = await q1("SELECT id,name,email,image,is_anonymous FROM users WHERE id = $1", [uid]);
  return u ? { id: u.id, name: u.name ?? undefined, email: u.email ?? undefined, image: u.image ?? undefined, isAnonymous: !!u.is_anonymous } : { id: "local-user", name: "Local learner", email: "local@localhost", isAnonymous: true };
}
function subtitleView(s) {
  return {
    _id: s.id,
    id: s.id,
    userId: s.user_id,
    title: s.title,
    sourceType: s.source_type,
    videoId: s.video_id,
    videoType: s.video_type,
    fileId: s.file_id,
    fileName: s.file_name,
    language: s.language,
    lines: typeof s.lines_json === "string" ? JSON.parse(s.lines_json || "[]") : (s.lines_json || []),
    lastPosition: s.last_position,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    fileUrl: s.file_name ? `/api/uploads/${s.file_name}` : undefined,
  };
}
async function words(uid) {
  const ws = await q("SELECT * FROM saved_words WHERE user_id = $1 ORDER BY updated_at DESC", [uid]);
  return Promise.all(ws.rows.map(async (w) => {
    const c = await q1("SELECT box, due_at FROM anki_cards WHERE saved_word_id = $1", [w.id]);
    const hasScreenshot = existsSync(join(SCREENSHOTS_DIR, `${w.id}.jpg`));
    return { _id: w.id, word: w.word, display: w.display, definition: w.definition, example: w.example, sourceTitle: w.source_title ?? undefined, language: w.language ?? undefined, translation: w.translation ?? undefined, screenshotUrl: hasScreenshot ? `/api/screenshots/${w.id}.jpg` : undefined, cardBox: c?.box ?? 0, cardDueAt: c?.due_at ?? null };
  }));
}
async function cards(uid) {
  const r = await q("SELECT id, front, back, box, due_at FROM anki_cards WHERE user_id = $1", [uid]);
  return r.rows.map((c) => ({ id: c.id, _id: c.id, front: c.front, back: c.back, box: c.box, dueAt: c.due_at }));
}

async function transcript(videoId, lang) {
  for (const language of [(lang || "en-US").split("-")[0], "en"]) {
    try {
      const r = await fetch(`https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${language}&fmt=json3`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) continue;
      const d = await r.json();
      const lines = (d.events ?? []).filter((e) => e.segs).map((e, i) => ({ index: i + 1, start: e.tStartMs / 1000, end: (e.tStartMs + (e.dDurationMs ?? 0)) / 1000, text: e.segs.map((s) => s.utf8 ?? "").join("").trim() })).filter((x) => x.text);
      if (lines.length) return lines;
    } catch { }
  }
  throw new Error("NO_CAPTIONS");
}
function ytDlp(url, output) {
  const args = ["-f", "bestaudio[ext=m4a]/bestaudio/best", "--no-playlist", "-x", "--audio-format", "mp3", "-o", output, url];
  const cookiesFrom = process.env.GRAB_COOKIES_FROM_BROWSER?.trim() ?? "";
  if (cookiesFrom) args.push("--cookies-from-browser", cookiesFrom);
  return new Promise((resolve, reject) => {
    const p = spawn("yt-dlp", args);
    let e = ""; p.stderr.on("data", (d) => (e += d));
    p.on("error", () => reject(new Error("YTDLP_MISSING")));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(e.slice(-1500) || "YTDLP_FAILED"))));
  });
}
/** Resolve the installed yt-dlp version, or null when it isn't installed. */
function ytDlpVersion() {
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", ["--version"], { windowsHide: true });
    let out = ""; let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", () => {});
    proc.on("error", () => finish(null));
    proc.on("close", () => finish(out.trim() || null));
    setTimeout(() => finish(null), 5000);
  });
}
async function staticFile(res, path) {
  const safe = path.replace(/^\/+/, "");
  const file = join(DIST_DIR, safe || "index.html");
  const isAsset = /^(models|assets|wasm)\//.test(safe);
  try {
    const data = await readFile(file); cors(res);
    res.writeHead(200, { "Content-Type": { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".html": "text/html", ".json": "application/json; charset=utf-8", ".onnx": "application/octet-stream" }[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    if (isAsset) return fail(res, 404, "Not found: " + safe);
    try { const data = await readFile(join(DIST_DIR, "index.html")); cors(res); res.writeHead(200, { "Content-Type": "text/html" }); res.end(data); }
    catch { fail(res, 404, "Frontend not built. Run bun run build first."); }
  }
}

const server = createServer(async (req, res) => {
  cors(res);
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, `http://${req.headers.host}`);
  const path = u.pathname;
  try {
    // Serve word screenshots
    if (req.method === "GET" && path.startsWith("/api/screenshots/")) {
      const fileName = path.slice("/api/screenshots/".length);
      if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) return fail(res, 400, "Invalid path");
      const filePath = join(SCREENSHOTS_DIR, fileName);
      try {
        const data = await readFile(filePath);
        cors(res);
        res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
        return res.end(data);
      } catch {
        return fail(res, 404, "Screenshot not found");
      }
    }
    if (!path.startsWith("/api/") && !path.startsWith("/grab") && path !== "/health") return staticFile(res, path);
    if (req.method === "GET" && (path === "/health" || path === "/api/health")) return send(res, 200, { ok: true, local: true, ytDlp: true, db: "postgres", dbUrl: DATABASE_URL });
    if (req.method === "POST" && path === "/api/auth/guest") {
      const token = randomUUID();
      await q("INSERT INTO sessions (token,user_id) VALUES ($1,$2) ON CONFLICT (token) DO UPDATE SET user_id = $2", [token, "local-user"]);
      return send(res, 200, { token, user: await currentUser(req) });
    }
    if (req.method === "GET" && path === "/api/auth/me") return send(res, 200, { user: await currentUser(req) });
    if (req.method === "POST" && path === "/api/auth/logout") return send(res, 200, { ok: true });
    const usr = await currentUser(req), uid = usr.id, p = path.split("/").filter(Boolean);

    if (req.method === "GET" && path === "/api/subtitles") {
      const rows = await q("SELECT * FROM subtitles WHERE user_id = $1 ORDER BY updated_at DESC", [uid]);
      return send(res, 200, rows.rows.map(subtitleView));
    }
    if (req.method === "POST" && path === "/api/subtitles") {
      const a = await body(req);
      const sid = id("sub");
      await q("INSERT INTO subtitles (id,user_id,title,source_type,video_id,video_type,file_id,file_name,language,lines_json,created_at,updated_at,last_position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [sid, uid, String(a.title || "Untitled subtitles"), a.sourceType || "plain", a.videoId || null, a.fileId ? "file" : a.videoId ? "youtube" : null, a.fileId || null, a.fileName || null, a.language || null, JSON.stringify(a.lines || []), now(), now(), 0]);
      return send(res, 200, subtitleView(await q1("SELECT * FROM subtitles WHERE id = $1", [sid])));
    }
    if (p[0] === "api" && p[1] === "subtitles" && p[2]) {
      const s = await q1("SELECT * FROM subtitles WHERE id = $1 AND user_id = $2", [p[2], uid]);
      if (!s) return fail(res, 404, "Subtitle not found");
      if (req.method === "GET") return send(res, 200, subtitleView(s));
      if (req.method === "PATCH") {
        const upd = await body(req);
        // Map camelCase client keys -> snake_case columns.
        const fieldMap = {
          title: "title", sourceType: "source_type", videoId: "video_id",
          videoType: "video_type", fileId: "file_id", fileName: "file_name",
          language: "language", lastPosition: "last_position",
        };
        const parts = []; const vals = [];
        for (const [clientKey, col] of Object.entries(fieldMap)) if (clientKey in upd) { parts.push(`${col} = $${parts.length + 1}`); vals.push(upd[clientKey]); }
        if ("lines" in upd) { parts.push(`lines_json = $${parts.length + 1}`); vals.push(JSON.stringify(upd.lines)); }
        if (parts.length) {
          const n = parts.length;
          parts.push(`updated_at = $${n + 1}::bigint`);
          vals.push(BigInt(now()));
          await q(`UPDATE subtitles SET ${parts.join(", ")} WHERE id = $${n + 2}::text AND user_id = $${n + 3}::text`, [...vals, p[2], uid]);
        }
        return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        await q("DELETE FROM subtitles WHERE id = $1 AND user_id = $2", [p[2], uid]);
        return send(res, 200, { ok: true });
      }
    }

    if (req.method === "GET" && path === "/api/uploads" && p[2]) {
      try { const data = await readFile(join(UPLOAD_DIR, p[2])); cors(res); res.writeHead(200, { "Content-Type": "audio/mpeg" }); res.end(data); } catch { fail(res, 404, "File not found"); } return;
    }
    if (req.method === "POST" && path === "/api/uploads") {
      const a = await body(req);
      const name = `${id("upload")}${extname(String(req.headers["x-file-name"] || ".m4a"))}`;
      await writeFile(join(UPLOAD_DIR, name), a);
      return send(res, 200, { storageId: name, fileName: name });
    }

    if (req.method === "GET" && path === "/api/words") return send(res, 200, await words(uid));
    if (req.method === "POST" && path === "/api/words") {
      const a = await body(req);
      const word = String(a.word).trim().toLowerCase();
      const existing = await q1("SELECT * FROM saved_words WHERE user_id = $1 AND word = $2", [uid, word]);
      if (existing) {
        await q("UPDATE saved_words SET display=$1, definition=$2, example=$3, source_title=$4, language=$5, translation=$6, updated_at=$7 WHERE id=$8",
          [a.display || existing.display || word, a.definition || existing.definition || "", a.example || existing.example || "", a.sourceTitle ?? existing.source_title ?? null, a.language ?? existing.language ?? null, a.translation ?? existing.translation ?? null, now(), existing.id]);
        const c = await q1("SELECT id FROM anki_cards WHERE saved_word_id = $1", [existing.id]);
        if (c) await q("UPDATE anki_cards SET front=$1, back=$2 WHERE id=$3", [a.display || existing.display || word, formatCardBack(a, existing.display || word), c.id]);
        return send(res, 200, { wordId: existing.id, created: false });
      }
      const wid = id("word");
      await q("INSERT INTO saved_words (id,user_id,word,display,definition,example,source_title,language,translation,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [wid, uid, word, a.display || word, a.definition || "", a.example || "", a.sourceTitle ?? null, a.language ?? null, a.translation ?? null, now(), now()]);
      const cid = id("card");
      await q("INSERT INTO anki_cards (id,user_id,saved_word_id,front,back,box,due_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [cid, uid, wid, a.display || word, formatCardBack(a, a.display || word), 0, now(), now()]);
      return send(res, 200, { wordId: wid, created: true });
    }
    if (p[0] === "api" && p[1] === "words" && p[2]) {
      const w = await q1("SELECT * FROM saved_words WHERE id = $1 AND user_id = $2", [p[2], uid]);
      if (!w) return fail(res, 404, "Word not found");
      if (req.method === "PATCH") {
        const upd = await body(req);
        const allowed = ["display", "definition", "example", "source_title", "language", "translation"];
        const parts = []; const vals = [];
        for (const k of allowed) if (k in upd) { parts.push(`${k} = $${parts.length + 1}`); vals.push(upd[k]); }
        if (parts.length) {
          const n = parts.length;
          parts.push(`updated_at = $${n + 1}::bigint`);
          vals.push(BigInt(now()));
          await q(`UPDATE saved_words SET ${parts.join(", ")} WHERE id = $${n + 2}::text AND user_id = $${n + 3}::text`, [...vals, p[2], uid]);
        }
        const c = await q1("SELECT id FROM anki_cards WHERE saved_word_id = $1", [p[2]]);
        if (c) {
          if (upd.resetCard) {
            await q("UPDATE anki_cards SET box=0, due_at=$1, last_reviewed_at=NULL WHERE id=$2", [now(), c.id]);
          } else {
            await q("UPDATE anki_cards SET front=$1, back=$2 WHERE id=$3", [upd.display || w.display, formatCardBack(upd, w.display), c.id]);
          }
        }
        return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        await q("DELETE FROM anki_cards WHERE saved_word_id = $1", [p[2]]);
        await q("DELETE FROM saved_words WHERE id = $1 AND user_id = $2", [p[2], uid]);
        unlink(join(SCREENSHOTS_DIR, `${p[2]}.jpg`)).catch(() => {});
        return send(res, 200, { ok: true });
      }
      // Screenshot upload for a saved word
      if (req.method === "POST" && p[0] === "api" && p[1] === "words" && p[2] && p[3] === "screenshot") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (buf.length > 2 * 1024 * 1024) return fail(res, 413, "Screenshot too large (max 2MB)");
        const safeId = p[2].replace(/[^a-zA-Z0-9_-]/g, "");
        const filePath = join(SCREENSHOTS_DIR, `${safeId}.jpg`);
        await writeFile(filePath, buf);
        return send(res, 200, { ok: true });
      }
      // Suspend a card (set due_at to +1 year)
      if (req.method === "POST" && path === "/api/cards/suspend") {
        const a = await body(req);
        const c = await q1("SELECT * FROM anki_cards WHERE id = $1 AND user_id = $2", [a.cardId, uid]);
        if (!c) return fail(res, 404, "Card not found");
        const oneYear = now() + 365 * 86400000;
        await q("UPDATE anki_cards SET due_at=$1 WHERE id=$2", [oneYear, c.id]);
        return send(res, 200, { ok: true });
      }
    }

    if (req.method === "GET" && path === "/api/cards/due") {
      const suspendCutoff = now() + 300 * 86400000;
      const due = await q(
        `SELECT c.id, c.front, c.back, c.box, c.due_at, c.leech_count, c.card_type, c.saved_word_id, c.last_reviewed_at, w.translation, w.definition, w.example, w.language
         FROM anki_cards c
         LEFT JOIN saved_words w ON c.saved_word_id = w.id
         WHERE c.user_id = $1 AND c.due_at <= $2 AND c.due_at < $3
         ORDER BY c.due_at ASC LIMIT 200`,
        [uid, now(), suspendCutoff],
      );
      return send(res, 200, due.rows.map((c) => {
        let back = c.back || "";
        if (c.translation && !back.includes("Translation:")) {
          const parts = [back, `Translation: ${c.translation}`].filter(Boolean);
          back = parts.join("\n\n");
        } else if (!c.translation && c.definition && !back.includes(c.definition)) {
          const parts = [];
          if (c.definition) parts.push(c.definition);
          if (c.example) parts.push(`Context: ${c.example}`);
          back = parts.join("\n\n") || c.front;
        }
        const hasScreenshot = c.saved_word_id && existsSync(join(SCREENSHOTS_DIR, `${c.saved_word_id}.jpg`));
        return {
          id: c.id,
          _id: c.id,
          front: c.front,
          back,
          box: c.box,
          dueAt: c.due_at,
          leechCount: c.leech_count || 0,
          cardType: c.card_type || "word",
          savedWordId: c.saved_word_id,
          screenshotUrl: hasScreenshot ? `/api/screenshots/${c.saved_word_id}.jpg` : undefined,
          language: c.language || undefined,
        };
      }));
    }
    if (req.method === "GET" && path === "/api/cards/due-count") {
      const suspendCutoff = now() + 300 * 86400000;
      const n = await q1("SELECT COUNT(*)::int AS n FROM anki_cards WHERE user_id = $1 AND due_at <= $2 AND due_at < $3", [uid, now(), suspendCutoff]);
      return send(res, 200, n?.n ?? 0);
    }
    if (req.method === "POST" && path === "/api/cards/rate") {
      const a = await body(req);
      const c = await q1("SELECT * FROM anki_cards WHERE id = $1 AND user_id = $2", [a.cardId, uid]);
      if (!c) return fail(res, 404, "Card not found");
      const intervals = [60000, 600000, 86400000, 259200000, 604800000, 1814400000];
      let newBox;
      let intervalMs;
      switch (a.rating) {
        case "again":
          newBox = 0;
          intervalMs = 60000;
          break;
        case "hard":
          newBox = c.box;
          intervalMs = Math.floor(intervals[c.box] * 0.5);
          break;
        case "good":
          newBox = Math.min(c.box + 1, 5);
          intervalMs = intervals[newBox];
          break;
        case "easy":
          newBox = Math.min(c.box + 2, 5);
          intervalMs = intervals[newBox];
          break;
        default:
          return fail(res, 400, "Invalid rating");
      }
      const dueAt = now() + intervalMs;
      const leechCount = a.rating === "again" ? (c.leech_count || 0) + 1 : 0;
      await q(
        "UPDATE anki_cards SET box=$1, due_at=$2, last_reviewed_at=$3, leech_count=$4 WHERE id=$5",
        [newBox, dueAt, now(), leechCount, c.id]
      );
      return send(res, 200, { ok: true, leech: leechCount >= 3 });
    }

    if (req.method === "POST" && path === "/api/transcript") { const a = await body(req); return send(res, 200, { videoId: a.videoId, lines: await transcript(a.videoId, a.lang) }); }

    // Server-side Whisper transcription via faster-whisper (SSE progress)
    if (req.method === "POST" && path === "/api/transcribe-file") {
      const a = await body(req);
      const filePath = join(UPLOAD_DIR, String(a.storageId || ""));
      try { await readFile(filePath); } catch { return fail(res, 404, "File not found — upload first"); }
      const MODEL_MAP = { fast: "tiny", accurate: "base", best: "large-v3-turbo" };
      const modelSize = MODEL_MAP[a.model] || "base";
      const lang = a.language && a.language !== "auto" ? a.language.split("-")[0] : "auto";
      // Stream progress via SSE, final result as JSON on the "done" event
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      const sse = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      let closed = false;
      const finish = () => { if (!closed) { closed = true; res.end(); } };
      req.on("close", () => { closed = true; });
      const py = spawn("python3", [join(process.cwd(), "transcribe-server.py"), filePath, lang, modelSize], { windowsHide: true });
      let buf = "";
      py.stdout.on("data", (chunk) => {
        buf += chunk.toString();
        // Process complete JSON lines
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.status === "done") {
              sse("done", { lines: msg.lines || [], language: msg.language });
              finish();
            } else {
              sse("progress", msg);
            }
          } catch { /* partial line, ignore */ }
        }
      });
      py.stderr.on("data", (d) => {
        const txt = d.toString();
        if (txt.includes("Downloading") || txt.includes("Downloading model")) {
          sse("progress", { status: "loading", message: txt.trim().slice(0, 200) });
        }
        console.error("[transcribe]", txt.trim().slice(0, 200));
      });
      py.on("error", (err) => {
        sse("error", { code: "TRANSCRIBE_FAILED", message: String(err.message || err) });
        finish();
      });
      py.on("close", (code) => {
        if (code !== 0 && !closed) {
          sse("error", { code: "TRANSCRIBE_FAILED", message: `Whisper exited with code ${code}` });
        }
        finish();
      });
      return;
    }
    if (req.method === "POST" && (path === "/grab" || path === "/api/grab")) {
      const a = await body(req);
      try {
        const name = `${id("youtube")}.mp3`;
        await ytDlp(a.url, join(UPLOAD_DIR, name));
        const data = await readFile(join(UPLOAD_DIR, name));
        cors(res); res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Disposition": 'inline; filename="audio.mp3"' });
        return res.end(data);
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes("403") || msg.includes("Forbidden")) return send(res, 502, { error: "YTDLP_FAILED", message: "YouTube blocked this download — try with GRAB_COOKIES_FROM_BROWSER set." });
        return send(res, 502, { error: "YTDLP_FAILED", message: msg.slice(-300) });
      }
    }
    // Streaming grab: emit real download progress over SSE, then hand back a
    // one-shot binary URL the client can fetch. Keeps the UX honest (no fake
    // indeterminate spinner) and still works with the existing buffered /grab.
    // Accepts GET (for EventSource) with ?url=, or POST with a JSON body.
    if ((req.method === "POST" || req.method === "GET") && path === "/grab-stream") {
      let url = "";
      if (req.method === "GET") {
        url = new URL(req.url, `http://${req.headers.host}`).searchParams.get("url")?.trim() ?? "";
      } else {
        const a = await body(req);
        url = typeof a?.url === "string" ? a.url.trim() : "";
      }
      if (!/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//.test(url)) {
        return send(res, 400, { error: "INVALID_URL", message: "That isn't a YouTube link." });
      }
      const name = `${id("youtube")}.mp3`;
      const outPath = join(UPLOAD_DIR, name);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      let sent = 0;
      const flush = (n) => { if (n > sent) { sent = n; send("progress", { stage: "downloading", percent: n }); } };
      const version = await ytDlpVersion();
      if (!version) {
        send("error", { code: "YTDLP_MISSING", message: "yt-dlp isn't installed. Run: brew install yt-dlp (or: pip install -U yt-dlp)" });
        return res.end();
      }
      const args = ["-f", "bestaudio[ext=m4a]/bestaudio/best", "--no-playlist", "-x", "--audio-format", "mp3", "--newline", "-o", outPath, url];
      const cookiesFrom = process.env.GRAB_COOKIES_FROM_BROWSER?.trim() ?? "";
      if (cookiesFrom) args.push("--cookies-from-browser", cookiesFrom);
      const p = spawn("yt-dlp", args, { windowsHide: true });
      let stderr = "";
      let closed = false;
      const finish = () => { if (!closed) { closed = true; res.end(); } };
      const cleanup = () => unlink(outPath).catch(() => {});
      const onErr = (d) => {
        const txt = d.toString();
        stderr += txt;
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
        const m = txt.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
        if (m) flush(Math.min(100, Math.round(Number(m[1]))));
        if (/\[download\]\s+Destination:/.test(txt)) send("progress", { stage: "downloading", percent: sent });
        if (/\[ExtractAudio\]\s+Destination:/.test(txt)) send("progress", { stage: "loading", percent: 100 });
      };
      p.stderr.on("data", onErr);
      p.on("error", (err) => {
        send("error", { code: "YTDLP_MISSING", message: String(err?.message || err) });
        finish();
      });
      p.on("close", async (code) => {
        if (code !== 0) {
          const tail = stderr.split("\n").map((l) => l.trim()).filter(Boolean).slice(-2).join(" · ") || "yt-dlp couldn't grab that video's audio.";
          send("error", { code: "YTDLP_FAILED", message: tail });
          cleanup();
          return finish();
        }
        try {
          await readFile(outPath);
          send("progress", { stage: "loading", percent: 100 });
          send("done", { fileUrl: `${GRAB_BASE}/grab-file/${name}` });
        } catch {
          send("error", { code: "GRAB_EMPTY", message: "Download finished but no audio file was produced." });
        }
        finish();
      });
      req.on("close", () => { if (!closed) { closed = true; p.kill("SIGTERM"); cleanup(); } });
      return;
    }
    // One-shot binary fetch for a completed streaming grab (see /grab-stream).
    if (req.method === "GET" && path.startsWith("/grab-file/")) {
      const name = decodeURIComponent(path.slice("/grab-file/".length));
      if (!/^[A-Za-z0-9_-]+\.mp3$/.test(name)) return fail(res, 400, "Bad filename");
      try {
        const data = await readFile(join(UPLOAD_DIR, name));
        cors(res);
        res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Disposition": 'inline; filename="audio.mp3"' });
        res.end(data);
        unlink(join(UPLOAD_DIR, name)).catch(() => {});
      } catch {
        fail(res, 404, "Not found");
      }
      return;
    }
    if (req.method === "POST" && path === "/api/dictionary") {
      const a = await body(req);
      try {
        const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(a.word)}`);
        const d = await r.json();
        const m = d?.[0]?.meanings?.[0];
        return send(res, 200, { definition: m?.definitions?.[0]?.definition || "", example: m?.definitions?.find((x) => x.example)?.example || "" });
      } catch { return send(res, 200, null); }
    }
    // Proxy sentence translation to the LibreTranslate server (defaults to a
    // self-hosted instance on localhost:5000). The API key never reaches the
    // browser and CORS is a non-issue.
    if (req.method === "POST" && path === "/api/translate") {
      const a = await body(req);
      try {
        const r = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: a.q,
            source: a.source ?? "auto",
            target: a.target ?? "en",
            format: a.format ?? "text",
            ...(LIBRETRANSLATE_KEY ? { api_key: LIBRETRANSLATE_KEY } : {}),
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return send(res, r.status, { error: "TRANSLATE_FAILED", message: data?.error ?? `HTTP ${r.status}` });
        return send(res, 200, { translatedText: data.translatedText ?? "" });
      } catch (e) {
        return send(res, 502, { error: "TRANSLATE_UPSTREAM", message: e instanceof Error ? e.message : "upstream error", hint: `Is LibreTranslate running at ${LIBRETRANSLATE_URL}? (try: pip install libretranslate && libretranslate)` });
      }
    }
    // DeepL translation proxy (free API: api-free.deepl.com)
    if (req.method === "POST" && path === "/api/translate-deepl") {
      const a = await body(req);
      const deeplKey = a.api_key || "";
      if (!deeplKey) {
        return send(res, 400, { error: "NO_DEEPL_KEY", message: "Set a DeepL API key in Settings" });
      }
      try {
        const isFree = deeplKey.endsWith(":fx");
        const baseUrl = isFree ? "https://api-free.deepl.com" : "https://api.deepl.com";
        const deeplRes = await fetch(`${baseUrl}/v2/translate`, {
          method: "POST",
          headers: {
            "Authorization": `DeepL-Auth-Key ${deeplKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: [a.q],
            source_lang: (a.source ?? "auto").toUpperCase().slice(0, 2),
            target_lang: (a.target ?? "EN").toUpperCase().slice(0, 2),
          }),
        });
        const data = await deeplRes.json().catch(() => ({}));
        if (!deeplRes.ok) return send(res, deeplRes.status, { error: "DEEPL_FAILED", message: data?.message ?? `HTTP ${deeplRes.status}` });
        const translated = data?.translations?.[0]?.text ?? "";
        return send(res, 200, { translatedText: translated });
      } catch (e) {
        return send(res, 502, { error: "DEEPL_UPSTREAM", message: e instanceof Error ? e.message : "upstream error" });
      }
    }
    return fail(res, 404, "Not found");
  } catch (e) {
    console.error(e);
    return fail(res, e.message === "NO_CAPTIONS" ? 404 : 500, e.message || "Server error");
  }
});

server.listen(PORT, HOST, () => console.log(`Motus local server (Postgres) listening on http://${HOST}:${PORT}`));
