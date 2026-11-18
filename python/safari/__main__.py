"""Entry point: `python -m safari` (requires the repo's `python/` on PYTHONPATH)."""

from __future__ import annotations

import sys

import uvicorn

from .config import settings


def main() -> int:
    print(f"Safari AI Dev Studio {settings.version} (Python {sys.version.split()[0]})")
    print(f"  Listening: http://{settings.host}:{settings.port}")
    print(f"  Workspace: {settings.workspace}")

    uvicorn.run(
        "safari.app:app",
        host=settings.host,
        port=settings.port,
        log_level="info",
        ws="websockets",
        access_log=False,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
