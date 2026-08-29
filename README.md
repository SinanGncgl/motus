# Motus

Motus is a private, local-first language learning workspace. Turn videos and subtitles into vocabulary and spaced-repetition cards.

## Run with Docker

```bash
docker compose up --build
```

Open <http://localhost:8787>.

The container includes the local API, persistent storage, FFmpeg, and `yt-dlp`. Data is stored in the `motus-data` Docker volume.

## Run without Docker

Install `yt-dlp` and FFmpeg, then build and start the local server:

```bash
bun install
bun run build
bun run local
```

For automatic YouTube audio downloads, run the companion grabber in a second terminal:

```bash
bun run grab
```

Motus will download the audio locally and transcribe it with Whisper in the browser. No cloud account or API key is required.

## Features

- Local JSON database and file storage
- YouTube audio download through `yt-dlp`
- In-browser Whisper transcription with timestamps
- Clickable transcript words and dictionary definitions
- Automatic Anki cards and spaced repetition practice
- Dark, single-user workspace
