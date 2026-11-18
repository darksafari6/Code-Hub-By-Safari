#!/usr/bin/env bash
# Install both halves of the project: the Python runtime and the frontend
# toolchain (Node is only needed to build the UI).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
VENV="$ROOT/.venv"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "error: $PYTHON is not installed. Install Python 3.11+ and retry." >&2
  exit 1
fi

"$PYTHON" - <<'PY'
import sys
if sys.version_info < (3, 11):
    raise SystemExit("error: Python 3.11 or newer is required")
PY

if [ ! -d "$VENV" ]; then
  echo "==> creating virtualenv in .venv"
  "$PYTHON" -m venv "$VENV"
fi

echo "==> installing Python dependencies"
"$VENV/bin/pip" install --upgrade pip >/dev/null
"$VENV/bin/pip" install -r python/requirements.txt

if command -v npm >/dev/null 2>&1; then
  echo "==> installing frontend dependencies"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
else
  echo "warning: npm not found — you can run the API, but not build the UI." >&2
fi

echo
echo "Done. Next steps:"
echo "  cp .env.example .env     # add an AI provider key"
echo "  ./scripts/dev.sh         # Python API + Vite dev server"
