#!/usr/bin/env bash
# Clean build + start everything (grab server + local app server) for Motus.
# Usage: ./start.sh
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8787}"
GRAB_PORT="${GRAB_PORT:-8788}"
DATA_DIR="${DATA_DIR:-$HOME/.motus}"
DIST_DIR="${DIST_DIR:-$PWD/dist}"
DATABASE_URL="${DATABASE_URL:-postgres://sinang@127.0.0.1:5432/motus}"

echo "==> Stopping any stale servers"
pkill -f "local-server.mjs" 2>/dev/null || true
pkill -f "grab-server.mjs"  2>/dev/null || true
sleep 1

echo "==> Clean build"
rm -rf dist
bun run build

echo "==> Copying Whisper model into dist (no symlinks)"
mkdir -p "$DIST_DIR/models/v1/onnx-community"
rm -rf "$DIST_DIR/models/v1/onnx-community/whisper-tiny"
cp -R public/models/onnx-community/whisper-tiny "$DIST_DIR/models/v1/onnx-community/whisper-tiny"
SYMLINKS=$(find "$DIST_DIR/models/v1" -type l | wc -l | tr -d ' ')
echo "    model symlinks in dist: $SYMLINKS (should be 0)"

echo "==> Starting grab server (port $GRAB_PORT)"
GRAB_COOKIES_FROM_BROWSER=chrome PORT="$GRAB_PORT" \
  nohup node grab-server.mjs > /tmp/motus-grab.log 2>&1 &
echo "    grab pid: $!"

echo "==> Starting local app server (port $PORT)"
PORT="$PORT" DATA_DIR="$DATA_DIR" DIST_DIR="$DIST_DIR" DATABASE_URL="$DATABASE_URL" \
  GRAB_COOKIES_FROM_BROWSER=chrome \
  nohup node local-server.mjs > /tmp/motus-local.log 2>&1 &
LOCAL_PID=$!
echo "    local pid: $LOCAL_PID"

echo "==> Waiting for server to come up"
for i in $(seq 1 30); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
    echo "==> Motus is live at http://localhost:$PORT"
    exit 0
  fi
  sleep 1
done

echo "!! Server did not respond on port $PORT within 30s. Last log lines:"
tail -n 20 /tmp/motus-local.log
exit 1
