#!/usr/bin/env bash
# Development mode: the Python API on :8000 and the Vite dev server on :3000,
# which proxies /api, /preview and /ws to the API.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  echo "error: virtualenv missing. Run ./scripts/install.sh first." >&2
  exit 1
fi

API_PORT="${API_PORT:-8000}"
UI_PORT="${UI_PORT:-3000}"

export PYTHONPATH="$ROOT/python"
export PORT="$API_PORT"

cleanup() {
  trap - INT TERM EXIT
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "==> Python API on http://127.0.0.1:$API_PORT"
"$VENV/bin/python" -m safari &
API_PID=$!

sleep 1
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "error: the Python API failed to start." >&2
  exit 1
fi

echo "==> Vite dev server on http://127.0.0.1:$UI_PORT"
SAFARI_API_PROXY="http://127.0.0.1:$API_PORT" PORT="$UI_PORT" npm run dev:ui
