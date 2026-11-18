"""The desktop shell: argument handling, port probing and link policy."""

from __future__ import annotations

import socket
import subprocess
import sys
from pathlib import Path

import pytest

from safari.desktop import _external_navigation_policy, _port_available, main


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def test_free_port_is_available() -> None:
    assert _port_available("127.0.0.1", _free_port()) is True


def test_busy_port_is_reported_unavailable() -> None:
    with socket.socket() as occupied:
        occupied.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        occupied.bind(("127.0.0.1", 0))
        occupied.listen(1)
        port = occupied.getsockname()[1]
        assert _port_available("127.0.0.1", port) is False


def test_main_refuses_a_busy_port() -> None:
    with socket.socket() as occupied:
        occupied.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        occupied.bind(("127.0.0.1", 0))
        occupied.listen(1)
        port = occupied.getsockname()[1]
        assert main(["--server-only", "--host", "127.0.0.1", "--port", str(port)]) == 1


@pytest.mark.parametrize(
    ("uri", "external"),
    [
        ("https://github.com/darksafari6/Code-Hub-By-Safari", True),
        ("https://docs.python.org/3/library/asyncio.html", True),
        ("about:blank", True),
        ("http://127.0.0.1:8000/", False),
        ("http://127.0.0.1:8000/index.html?x=1#hash", False),
        ("http://127.0.0.1:8000/api/health", False),
    ],
)
def test_external_navigation_policy(uri: str, external: bool) -> None:
    assert _external_navigation_policy(uri, "http://127.0.0.1:8000") is external


def test_module_entry_point_exposes_help() -> None:
    root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "-m", "safari.desktop", "--help"],
        capture_output=True,
        text=True,
        timeout=60,
        env={"PATH": "/usr/bin:/bin", "PYTHONPATH": str(root / "python")},
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "--server-only" in result.stdout
    assert "--browser" in result.stdout
