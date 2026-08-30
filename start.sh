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

# Launch a self-hosted LibreTranslate for sentence translation.
# Disable with LIBRETRANSLATE=0 ./start.sh (requires: pip install libretranslate
# into the project .venv — run `python3 -m venv .venv && .venv/bin/pip install libretranslate`).
# NOTE: macOS reserves port 5000 for AirPlay, so we default to 5001.
if [[ "${LIBRETRANSLATE:-1}" != "0" ]]; then
  echo "==> Starting LibreTranslate (port 5001)"
  LT_PORT="${LT_PORT:-5001}"
  # Use the project venv if present so `libretranslate` is on PATH.
  if [[ -x ".venv/bin/libretranslate" ]]; then
    LT_BIN=".venv/bin/libretranslate"
  else
    LT_BIN="libretranslate"
  fi
  # Self-hosted LibreTranslate: open access (no --api-keys) so the app's
  # /api/translate proxy can call it without any key. On first run it downloads
  # the full model set (including German<->English), so the wait loop is generous.
  nohup "$LT_BIN" --port="$LT_PORT" --host=127.0.0.1 --disable-web-ui --threads=4 > /tmp/motus-libretranslate.log 2>&1 &
  LT_PID=$!
  echo "    libretranslate pid: $LT_PID"
  echo "    waiting for LibreTranslate to accept requests…"
  for i in $(seq 1 120); do
    if curl -s -o /dev/null "http://127.0.0.1:$LT_PORT/translate" \
       -X POST -H 'Content-Type: application/json' -d '{"q":"hi","source":"en","target":"es"}' 2>/dev/null; then
      echo "    LibreTranslate is live at http://localhost:$LT_PORT"
      break
    fi
    sleep 1
  done
fi

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
