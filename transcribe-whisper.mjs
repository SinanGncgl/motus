#!/usr/bin/env node
/**
 * whisper.cpp Node.js wrapper.
 * Calls whisper-cli with -oj -pp and parses stderr progress + JSON output.
 * Outputs JSON lines: progress events, then a final "done" event.
 *
 * Usage: node transcribe-whisper.mjs <audio-path> [language] [model-size]
 *   language: "auto", "en", "fr", etc. (default: auto)
 *   model-size: "tiny", "base", "large-v3-turbo" (default: base)
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const MODEL_DIR = join(homedir(), ".cache", "whisper-models");
const WHISPER_CLI = "/opt/homebrew/bin/whisper-cli";

const MODEL_MAP = {
  tiny: "ggml-tiny.bin",
  base: "ggml-base.bin",
  "large-v3-turbo": "ggml-large-v3-turbo.bin",
};

const audioPath = process.argv[2];
const language = process.argv[3] && process.argv[3] !== "auto" ? process.argv[3] : null;
const modelKey = process.argv[4] || "base";

if (!audioPath) {
  console.error("Usage: node transcribe-whisper.mjs <audio-path> [language] [model-size]");
  process.exit(1);
}

const modelFile = MODEL_MAP[modelKey];
if (!modelFile) {
  console.error(`Unknown model: ${modelKey}. Use: ${Object.keys(MODEL_MAP).join(", ")}`);
  process.exit(1);
}

const modelPath = join(MODEL_DIR, modelFile);
if (!existsSync(modelPath)) {
  console.error(`Model not found: ${modelPath}`);
  process.exit(1);
}

const outFile = audioPath.replace(/\.[^.]+$/, "");

const args = [
  "-f", audioPath,
  "-m", modelPath,
  "-oj",                          // JSON output
  "-of", outFile,                 // output file path (without extension)
  "-pp",                          // print progress to stderr
  "-np",                          // no prints (suppress non-essential stderr)
  "--no-prints",
  "-t", "4",                      // threads
];
if (language) {
  args.push("-l", language);
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

emit({ status: "loading", message: `Loading Whisper ${modelKey} model…` });

const proc = execFile(WHISPER_CLI, args, { timeout: 600_000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
  // Clean up the output file that whisper-cli creates
  const jsonOut = outFile + ".json";
  if (existsSync(jsonOut)) {
    try {
      const raw = readFileSync(jsonOut, "utf8");
      const parsed = JSON.parse(raw);
      const segments = parsed.transcription?.segments || [];
      const lang = parsed.result?.language || language || "en";
      const lines = segments.map((s) => ({
        start: Math.round(s.t0 / 1000 * 100) / 100,
        end: Math.round(s.t1 / 1000 * 100) / 100,
        text: (s.text || "").trim(),
      }));
      emit({ status: "done", language: lang, lines });
    } catch (e) {
      emit({ status: "error", message: `Failed to parse whisper output: ${e.message}` });
    }
    try { unlinkSync(jsonOut); } catch {}
    return;
  }

  if (err) {
    emit({ status: "error", message: stderr || err.message });
  } else {
    emit({ status: "error", message: "No output from whisper-cli" });
  }
});

// Parse stderr for progress events
let stderrBuf = "";
proc.stderr?.on("data", (chunk) => {
  stderrBuf += chunk.toString();
  const lines = stderrBuf.split("\n");
  stderrBuf = lines.pop() || "";
  for (const line of lines) {
    // Match: whisper_print_progress_callback: progress =  15%
    const m = line.match(/progress\s*=\s*(\d+)%/);
    if (m) {
      emit({ status: "progress", percent: parseInt(m[1], 10), message: `Transcribing… ${m[1]}%` });
    }
    // Match: system_info: ...
    if (line.includes("system_info")) {
      emit({ status: "loading", message: "Initializing whisper.cpp…" });
    }
  }
});
