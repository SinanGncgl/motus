#!/usr/bin/env python3
"""Server-side Whisper transcription using faster-whisper with SSE progress."""
import sys
import json
import os
import subprocess
import traceback

def transcribe(audio_path, language=None, model_size="tiny"):
    from faster_whisper import WhisperModel

    # Validate file exists
    if not os.path.isfile(audio_path):
        print(json.dumps({"status": "error", "message": f"File not found: {audio_path}"}), flush=True)
        sys.exit(1)

    # Validate file is not empty
    file_size = os.path.getsize(audio_path)
    if file_size < 1024:
        print(json.dumps({"status": "error", "message": f"Audio file too small ({file_size} bytes) — may be corrupted"}), flush=True)
        sys.exit(1)

    # Validate file is a real audio file using ffprobe
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", audio_path],
            capture_output=True, text=True, timeout=10
        )
        fmt_info = json.loads(probe.stdout)
        format_name = fmt_info.get("format", {}).get("format_name", "")
        duration = float(fmt_info.get("format", {}).get("duration", 0))
        print(json.dumps({"status": "loading", "message": f"Audio format: {format_name}, duration: {duration:.1f}s, size: {file_size} bytes"}), flush=True)
        if duration <= 0:
            print(json.dumps({"status": "error", "message": "Audio file has no detectable duration — file may be corrupted"}), flush=True)
            sys.exit(1)
    except FileNotFoundError:
        print(json.dumps({"status": "loading", "message": "ffprobe not found, skipping audio validation"}), flush=True)
    except Exception as e:
        print(json.dumps({"status": "loading", "message": f"Audio validation warning: {e}"}), flush=True)

    # Report loading stage
    print(json.dumps({"status": "loading", "message": f"Loading Whisper {model_size} model…"}), flush=True)
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Failed to load Whisper model: {e}"}), flush=True)
        sys.exit(1)

    print(json.dumps({"status": "transcribing", "message": "Transcribing…"}), flush=True)

    try:
        segments, info = model.transcribe(audio_path, language=language, beam_size=5)
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Transcription failed: {e}"}), flush=True)
        sys.exit(1)

    lines = []
    total_duration = info.duration if info.duration else 0
    for seg in segments:
        lines.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip()
        })
        # Report progress based on audio position
        if total_duration > 0:
            pct = min(100, int((seg.end / total_duration) * 100))
        else:
            pct = min(100, len(lines) * 2)
        print(json.dumps({
            "status": "progress",
            "percent": pct,
            "line_count": len(lines),
            "current_text": seg.text.strip()[:80]
        }), flush=True)

    print(json.dumps({
        "status": "done",
        "language": info.language,
        "lines": lines
    }), flush=True)

if __name__ == "__main__":
    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "auto" else None
    model_size = sys.argv[3] if len(sys.argv) > 3 else "tiny"
    try:
        transcribe(audio_path, language, model_size)
    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"status": "error", "message": str(e), "traceback": tb[-500:]}), flush=True)
        sys.exit(1)
