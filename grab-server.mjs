#!/usr/bin/env node
/**
 * Local companion for the language-learning app.
 *
 * Grabs a YouTube video's audio with yt-dlp (which works from your own,
 * non-blocked residential IP) and serves the bytes to the app over
 * localhost with CORS — so the browser can transcribe it automatically with
 * on-device Whisper. No API key, no manual file handling.
 *
 * One-time setup (install yt-dlp):
 *   macOS:      brew install yt-dlp
 *   Linux:      pip install -U yt-dlp
 *   Windows:    winget install yt-dlp.yt-dlp
 *
 * Run (from the project root):
 *   bun run grab        — or —   node grab-server.mjs
 *
 * Then paste a YouTube link in the app and choose "Grab audio & transcribe".
 *
 * If YouTube bot-walls a video even from home (rare), let yt-dlp use your
 * browser's login session:
 *   GRAB_COOKIES_FROM_BROWSER=chrome bun run grab
 * (also accepts firefox, edge, safari, etc.)
 */

import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.GRAB_PORT ?? 8788);
const HOST = "127.0.0.1";

// Find best audio format ID for a given language using yt-dlp --dump-json
// NOTE: Do NOT pass --cookies-from-browser here — logged-in sessions only serve HLS combined streams.
async function findAudioFormat(url, lang) {
  const args = ["--dump-json", "--no-playlist", url];
  return new Promise((resolve) => {
    const p = spawn("yt-dlp", args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => { stdout += d.toString(); });
    p.stderr.on("data", (d) => { stderr += d.toString(); });
    p.on("close", (code) => {
      try {
        const data = JSON.parse(stdout);
        const langCode = lang.split("-")[0];
        const langFormats = (data.formats || []).filter(
          (f) => f.language && f.language.toLowerCase().startsWith(langCode)
        );
        const audioFormats = langFormats.filter(
          (f) => (f.ext === "m4a" || f.ext === "webm") && (!f.vcodec || f.vcodec === "none")
        );
        audioFormats.sort((a, b) => {
          if (a.ext === "m4a" && b.ext !== "m4a") return -1;
          if (a.ext !== "m4a" && b.ext === "m4a") return 1;
          return (b.tbr || 0) - (a.tbr || 0);
        });
        const best = audioFormats[0];
        console.log(`[findAudioFormat] lang=${lang} picked=${best ? best.format_id : "none"}`);
        resolve(best ? best.format_id : null);
      } catch (e) {
        console.log(`[findAudioFormat] error: ${e.message}`);
        resolve(null);
      }
    });
    p.on("error", () => resolve(null));
  });
}

/** Active temp directories keyed by grabId. Cleaned up after file is fetched. */
const activeGrabs = new Map();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Resolve the installed yt-dlp version, or null when it isn't installed. */
function ytDlpVersion() {
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", ["--version"], { windowsHide: true });
    let out = "";
    let done = false;
    const finish = (value) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", () => {});
    proc.on("error", () => finish(null)); // command not found
    proc.on("close", () => finish(out.trim() || null));
    setTimeout(() => finish(null), 5000); // yt-dlp --version is instant
  });
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

const server = createServer(async (req, res) => {
  cors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.method === "GET" && req.url === "/health") {
    const version = await ytDlpVersion();
    json(res, 200, { ok: true, ytDlp: Boolean(version), version });
    return;
  }

  if (req.method === "POST" && req.url === "/grab") {
    const body = await readJsonBody(req);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (
      !/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//.test(url)
    ) {
      json(res, 400, {
        error: "INVALID_URL",
        message: "That isn't a YouTube link.",
      });
      return;
    }

    const version = await ytDlpVersion();
    if (!version) {
      json(res, 500, {
        error: "YTDLP_MISSING",
        message:
          "yt-dlp isn't installed. Run: brew install yt-dlp  (or: pip install -U yt-dlp)",
      });
      return;
    }

    // Grab the small audio-only stream into a temp file and extract to m4a
    // so the browser can play it cleanly.
    const args = ["-f", "bestaudio[ext=m4a]/bestaudio/best", "--no-playlist", "-x", "--audio-format", "mp3"];
    const cookiesFrom = process.env.GRAB_COOKIES_FROM_BROWSER?.trim() ?? "";
    if (cookiesFrom) args.push("--cookies-from-browser", cookiesFrom);

    const dir = await mkdtemp(join(tmpdir(), "grab-"));
    const outFile = join(dir, "audio.mp3");
    args.push("-o", outFile, url);

    console.log(`[grab] downloading ${url}`);
    const proc = spawn("yt-dlp", args, { windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    const exitCode = await new Promise((resolve) =>
      proc.on("close", resolve),
    );

    console.log(`[grab] yt-dlp exited with code ${exitCode}`);
    if (exitCode === 0) {
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="audio.mp3"',
      });
      const stream = createReadStream(outFile);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
      const cleanup = () =>
        rm(dir, { recursive: true, force: true }).catch(() => {});
      res.once("finish", cleanup);
      res.once("close", cleanup);
      return;
    }

    await rm(dir, { recursive: true, force: true }).catch(() => {});
    const tail = stderr
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-2)
      .join(" · ");
    json(res, 502, {
      error: "YTDLP_FAILED",
      message:
        tail ||
        "yt-dlp couldn't grab that video's audio — check the link and try again.",
    });
    return;
  }

  // ── GET /grab-stream?url=...  ── SSE streaming grab ────────────────────
  if (req.method === "GET" && req.url?.startsWith("/grab-stream")) {
    const parsed = new URL(req.url, `http://${HOST}:${PORT}`);
    const url = (parsed.searchParams.get("url") ?? "").trim();
    const lang = (parsed.searchParams.get("lang") ?? "").trim();
    if (
      !/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//.test(url)
    ) {
      json(res, 400, { error: "INVALID_URL", message: "That isn't a YouTube link." });
      return;
    }
    const version = await ytDlpVersion();
    if (!version) {
      json(res, 500, {
        error: "YTDLP_MISSING",
        message: "yt-dlp isn't installed. Run: brew install yt-dlp",
      });
      return;
    }

    // SSE headers
    cors(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const grabId = randomUUID();
    const dir = await mkdtemp(join(tmpdir(), "grab-"));
    const outFile = join(dir, "audio.mp3");
    const cookiesFrom = process.env.GRAB_COOKIES_FROM_BROWSER?.trim() ?? "";

    // If a language is specified, find the right audio format first
    let formatArg = "bestaudio[ext=m4a]/bestaudio/best";
    let useSpecificFormat = false;
    if (lang && lang !== "auto") {
      const formatId = await findAudioFormat(url, lang);
      if (formatId) {
        formatArg = formatId;
        useSpecificFormat = true;
      }
    }

    const args = [
      "-f", formatArg,
      "--no-playlist", "-x", "--audio-format", "mp3",
      "--newline",           // one progress line per percent
      "--no-console-title",  // clean stderr
    ];
    // DASH formats (used for language selection) aren't available with cookies
    if (cookiesFrom && !useSpecificFormat) args.push("--cookies-from-browser", cookiesFrom);
    args.push("-o", outFile, url);

    console.log(`[grab-stream] downloading ${url}`);
    send("progress", { stage: "downloading", percent: 0 });
    const proc = spawn("yt-dlp", args, { windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let lastPercent = -1;

    proc.stdout.on("data", (d) => {
      const lines = String(d).split("\n");
      for (const line of lines) {
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) {
          const pct = Math.floor(parseFloat(m[1]));
          if (pct !== lastPercent) {
            lastPercent = pct;
            send("progress", { stage: "downloading", percent: pct });
          }
        }
      }
    });
    proc.stderr.on("data", (d) => {
      const lines = String(d).split("\n");
      for (const line of lines) {
        // yt-dlp outputs: [download]  42.3% of   1.23MiB at  2.34MiB/s ETA 00:00
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) {
          const pct = Math.floor(parseFloat(m[1]));
          if (pct !== lastPercent) {
            lastPercent = pct;
            send("progress", { stage: "downloading", percent: pct });
          }
        }
      }
    });

    const exitCode = await new Promise((resolve) => proc.on("close", resolve));
    console.log(`[grab-stream] yt-dlp exited with code ${exitCode}`);

    if (exitCode !== 0) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      send("error", { code: "YTDLP_FAILED", message: "yt-dlp couldn't grab that video's audio." });
      res.end();
      return;
    }

    if (!existsSync(outFile)) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      send("error", { code: "GRAB_EMPTY", message: "No audio file produced." });
      res.end();
      return;
    }

    // Register for file serving, then tell the client where to fetch it
    activeGrabs.set(grabId, { dir, outFile, timer: setTimeout(() => {
      activeGrabs.delete(grabId);
      rm(dir, { recursive: true, force: true }).catch(() => {});
    }, 60_000) }); // auto-cleanup after 60s

    const fileUrl = `/grab-file/${grabId}`;
    send("done", { fileUrl });
    res.end();
    return;
  }

  // ── GET /grab-file/:id  ── Serve a temp file from a grab-stream ────────
  if (req.method === "GET" && req.url?.startsWith("/grab-file/")) {
    const grabId = req.url.slice("/grab-file/".length);
    const entry = activeGrabs.get(grabId);
    if (!entry) {
      json(res, 404, { error: "NOT_FOUND" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": 'inline; filename="audio.mp3"',
    });
    const stream = createReadStream(entry.outFile);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    res.once("finish", () => {
      clearTimeout(entry.timer);
      activeGrabs.delete(grabId);
      rm(entry.dir, { recursive: true, force: true }).catch(() => {});
    });
    return;
  }

  json(res, 404, { error: "NOT_FOUND" });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🎧 Local grab server listening on http://${HOST}:${PORT}\n`);
  console.log("  The app detects it automatically. Paste a YouTube link and\n");
  console.log('  choose "Grab audio & transcribe" — no key, no manual steps.\n');
});
