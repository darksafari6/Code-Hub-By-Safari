#!/usr/bin/env bash
# Run every check: Python tests, frontend unit tests and the type checker.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv"
if [ -x "$VENV/bin/python" ]; then
  echo "==> pytest (python/tests)"
  PYTHONPATH="$ROOT/python" "$VENV/bin/python" -m pytest python/tests
else
  echo "warning: skipping Python tests (no .venv; run ./scripts/install.sh)" >&2
fi

if command -v npm >/dev/null 2>&1; then
  echo "==> vitest"
  npm run test
  echo "==> tsc"
  npm run typecheck
fi
