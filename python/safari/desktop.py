"""Linux desktop shell.

The packaged application is a single Python binary. This module starts the
FastAPI server in a background thread and then presents the UI:

1. **GTK + WebKitGTK** — a native window, no Electron, no Node (`python3-gi` and
   `gir1.2-webkit2-4.1` on Debian/Ubuntu, `webkit2gtk4.1` on Fedora);
2. **the system browser** — when GTK is unavailable (headless boxes, SSH).

Both paths are real: if the window cannot be created the user still gets a
working application, never a blank screen.
"""

from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

from .config import settings

APP_TITLE = "Safari AI Dev Studio"


def _wait_for_server(url: str, timeout: float = 25.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.2)
    return False


def _run_server(host: str, port: int) -> None:
    import uvicorn

    from .app import app

    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=False,
        # The browser and the native window both use the same origin checks.
        ws="websockets",
    )
    uvicorn.Server(config).run()


def _port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((host, port))
            return True
        except OSError:
            return False


def _open_gtk_window(url: str) -> bool:
    """Try GTK3 + WebKit2, then GTK4 + WebKit 6. Returns False if neither works."""
    if _gtk3_window(url):
        return True
    return _gtk4_window(url)


def _external_navigation_policy(navigation_uri: str, app_url: str) -> bool:
    """True when a link should open in the user's browser instead of the app."""
    return not navigation_uri.startswith(app_url)


def _gtk3_window(url: str) -> bool:
    try:
        import gi

        gi.require_version("Gtk", "3.0")
        for version in ("4.1", "4.0"):
            try:
                gi.require_version("WebKit2", version)
                break
            except ValueError:
                continue
        else:
            return False

        from gi.repository import GLib, Gtk, WebKit2
    except (ImportError, ValueError):
        return False

    try:
        view = WebKit2.WebView()
        view.load_uri(url)

        def on_decide_policy(_view, decision, decision_type):
            try:
                if decision_type != WebKit2.PolicyDecisionType.NAVIGATION_ACTION:
                    return False
                uri = decision.get_request().get_uri() or ""
                if _external_navigation_policy(uri, url):
                    webbrowser.open(uri)
                    decision.ignore()
                    return True
            except Exception:  # pragma: no cover - WebKit API differences
                return False
            return False

        view.connect("decide-policy", on_decide_policy)

        window = Gtk.Window(title=APP_TITLE)
        window.set_default_size(1440, 900)
        window.set_icon_name("safari-ai-dev-studio")
        window.add(view)
        window.connect("destroy", Gtk.main_quit)
        window.show_all()

        GLib.idle_add(view.grab_focus)
        Gtk.main()
        return True
    except Exception as error:  # pragma: no cover - depends on the desktop
        print(f"[shell] GTK3/WebKit2 window failed: {error}", file=sys.stderr)
        return False


def _gtk4_window(url: str) -> bool:
    try:
        import gi

        gi.require_version("Gtk", "4.0")
        gi.require_version("WebKit", "6.0")

        from gi.repository import Gtk, WebKit
    except (ImportError, ValueError):
        return False

    try:
        app = Gtk.Application(application_id="com.safariaidevstudio.app")

        def on_activate(_application):
            view = WebKit.WebView()
            view.load_uri(url)

            window = Gtk.ApplicationWindow(application=app, title=APP_TITLE)
            window.set_default_size(1440, 900)
            window.set_child(view)
            window.present()

        app.connect("activate", on_activate)
        app.run([])
        return True
    except Exception as error:  # pragma: no cover - depends on the desktop
        print(f"[shell] GTK4/WebKit6 window failed: {error}", file=sys.stderr)
        return False


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="safari-ai-dev-studio",
        description="Safari AI Dev Studio — an AI development environment for Linux.",
    )
    parser.add_argument("--port", type=int, default=settings.port, help="HTTP port (default: %(default)s)")
    parser.add_argument("--host", default=settings.host, help="bind address (default: %(default)s)")
    parser.add_argument(
        "--server-only",
        action="store_true",
        help="just serve the API and print the URL (useful over SSH)",
    )
    parser.add_argument(
        "--browser",
        action="store_true",
        help="skip the GTK window and open the system browser",
    )
    args = parser.parse_args(argv)

    if not _port_available(args.host if args.host != "0.0.0.0" else "127.0.0.1", args.port):
        print(f"error: port {args.port} is already in use", file=sys.stderr)
        return 1

    thread = threading.Thread(
        target=_run_server, args=(args.host, args.port), name="safari-server", daemon=True
    )
    thread.start()

    local_url = f"http://127.0.0.1:{args.port}"
    if not _wait_for_server(local_url):
        print("error: the server did not start in time", file=sys.stderr)
        return 1

    print(f"{APP_TITLE} running at {local_url}")
    print(f"Workspace: {settings.workspace}")

    if args.server_only:
        try:
            while thread.is_alive():
                thread.join(0.5)
        except KeyboardInterrupt:
            return 0
        return 0

    if not args.browser and _open_gtk_window(local_url):
        return 0

    if args.browser or not _gtk_available():
        print("[shell] GTK/WebKit not available — using the system browser.")
        print("[shell] Install python3-gi and gir1.2-webkit2-4.1 for a native window.")

    if not webbrowser.open(local_url):
        print(f"[shell] No browser found. Open {local_url} manually.")

    try:
        while thread.is_alive():
            thread.join(0.5)
    except KeyboardInterrupt:
        return 0
    return 0


def _gtk_available() -> bool:
    try:
        import gi  # noqa: F401
    except ImportError:
        return False
    return True


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
