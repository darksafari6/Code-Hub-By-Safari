#!/usr/bin/env bash
# Production mode: build the UI once, then let the Python server host both the
# API and the static bundle on a single port.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  echo "error: virtualenv missing. Run ./scripts/install.sh first." >&2
  exit 1
fi

if [ ! -f "$ROOT/dist/index.html" ] || [ "${SAFARI_SKIP_BUILD:-0}" != "1" ]; then
  echo "==> building the frontend"
  npm run build
fi

export PYTHONPATH="$ROOT/python"
exec "$VENV/bin/python" -m safari
