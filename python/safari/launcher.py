"""PyInstaller entry point.

`python/safari/launcher.py` is what the frozen binary runs. It defers to the
desktop shell, which starts the server and then either opens a GTK window or
falls back to the system browser.
"""

from __future__ import annotations

import sys

from safari.desktop import main

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
