# Offline Whisper model setup for Motus

Motus transcribes audio on-device with Whisper (via transformers.js). Use this model:

**`onnx-community/whisper-tiny`**

It is the smallest multilingual Whisper model and the best starting point for local use (roughly 40–75 MB depending on the quantized files).

## Recommended model download

On a machine with internet access, clone/download the model repository from:

<https://huggingface.co/onnx-community/whisper-tiny>

> **Note:** HuggingFace Hub downloads use symlinks that point to a `blobs/` cache directory. Before building, replace symlinks with real files:
>
> ```bash
> rm -rf public/models/onnx-community/whisper-tiny
> cp -RL models/onnx-community/whisper-tiny public/models/onnx-community/
> ```
>
> Verify no symlinks remain:
> ```bash
> find public/models/onnx-community/whisper-tiny -type l | wc -l  # should be 0
> ```

Place the complete downloaded repository contents at:

```text
public/models/onnx-community/whisper-tiny/
```

The directory must contain the model configuration/tokenizer files and the ONNX model file, not just a single `.bin` or `.onnx` file. Do not rename the directory.

`start.sh` copies this into `dist/models` (with real files, no symlinks) during the build.

Motus tries the bundled local model first at `/models/onnx-community/whisper-tiny`. If it is not present, it falls back to Hugging Face and its mirror.

## Running locally

```bash
# 1. Build the frontend (also copies the whisper model into dist)
./start.sh

# Or run the servers manually:
# Build
bun run build
# Local server (serves app + models + API)
PORT=8787 DATA_DIR=~/.motus DIST_DIR=./dist node local-server.mjs
# Grab server (YouTube audio downloader)
GRAB_COOKIES_FROM_BROWSER=chrome PORT=8788 node grab-server.mjs
```

The app auto-detects the grab server at `http://127.0.0.1:8788`.

## yt-dlp format selection note

Both servers grab the audio-only stream and re-encode it to **MP3** (`-x --audio-format mp3`). MP3 is what every browser's `decodeAudioData` can decode reliably — the previous AAC-in-MP4 container was rejected by the browser, which surfaced as "Couldn't read that file in your browser."

```bash
-f bestaudio[ext=m4a]/bestaudio/best -x --audio-format mp3
```

If YouTube returns 403 Forbidden (bot-walling), set `GRAB_COOKIES_FROM_BROWSER=chrome|firefox|safari` so yt-dlp uses your browser's login session. Both `grab-server.mjs` and `local-server.mjs` honor this env var.

## Model choices

- `whisper-tiny`: recommended for a laptop and quick learning clips.
- `whisper-base`: better accuracy, larger/slower; use after `tiny` works.
- `whisper-small`: best of the configured choices, but substantially larger and slower.

The app's `fast` mode tries the bundled `whisper-tiny` first, then falls back to `whisper-base`. `accurate` tries `whisper-small`, `base`, then `tiny`. Use the `onnx/decoder_model_quantized.onnx` and `onnx/encoder_model_quantized.onnx` variants when a smaller local model is needed; keeping the full folder is also fine.
