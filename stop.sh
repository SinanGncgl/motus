#!/usr/bin/env bash
# Stop all Motus servers. Idempotent — safe to run when nothing is running.
set -u

pkill -f "local-server.mjs" 2>/dev/null && echo "Stopped local-server.mjs" || echo "local-server.mjs not running"
pkill -f "grab-server.mjs"  2>/dev/null && echo "Stopped grab-server.mjs"   || echo "grab-server.mjs not running"
