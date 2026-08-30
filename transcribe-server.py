#!/usr/bin/env python3
"""Server-side Whisper transcription using faster-whisper with SSE progress."""
import sys
import json
import os

def transcribe(audio_path, language=None, model_size="tiny"):
    from faster_whisper import WhisperModel

    # Report loading stage
    print(json.dumps({"status": "loading", "message": f"Loading Whisper {model_size} model…"}), flush=True)
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(json.dumps({"status": "transcribing", "message": "Transcribing…"}), flush=True)

    segments, info = model.transcribe(audio_path, language=language, beam_size=5)

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
    transcribe(audio_path, language, model_size)
