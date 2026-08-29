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
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.GRAB_PORT ?? 8788);
const HOST = "127.0.0.1";

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
    const proc = spawn("yt-dlp", args, { windowsHide: true });
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

  json(res, 404, { error: "NOT_FOUND" });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🎧 Local grab server listening on http://${HOST}:${PORT}\n`);
  console.log("  The app detects it automatically. Paste a YouTube link and\n");
  console.log('  choose "Grab audio & transcribe" — no key, no manual steps.\n');
});
