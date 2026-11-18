"""The PTY session is what makes the terminal real; test it against /bin/sh."""

from __future__ import annotations

import asyncio
import pathlib

from safari.pty_session import PtySession


def _run(coro, timeout: float = 12.0):
    return asyncio.run(asyncio.wait_for(coro, timeout=timeout))


def test_pty_runs_a_command(workspace: pathlib.Path) -> None:
    async def scenario() -> str:
        session = PtySession(str(workspace), shell="/bin/sh")
        session.start()
        session.write("echo hello-pty\n")
        output = ""
        try:
            async for kind, payload in session.events():
                if kind == "output":
                    output += str(payload)
                else:
                    break
                if "hello-pty" in output:
                    break
        finally:
            session.close()
        return output

    assert "hello-pty" in _run(scenario())


def test_pty_starts_in_the_workspace(workspace: pathlib.Path) -> None:
    async def scenario() -> str:
        session = PtySession(str(workspace), shell="/bin/sh")
        session.start()
        session.write("pwd\n")
        output = ""
        try:
            async for kind, payload in session.events():
                if kind == "output":
                    output += str(payload)
                else:
                    break
                if str(workspace) in output:
                    break
        finally:
            session.close()
        return output

    assert str(workspace) in _run(scenario())


def test_pty_child_environment_excludes_secrets(workspace: pathlib.Path, monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret")

    async def scenario() -> str:
        session = PtySession(str(workspace), shell="/bin/sh")
        session.start()
        session.write('echo "SECRET=[$GEMINI_API_KEY]"\n')
        output = ""
        try:
            async for kind, payload in session.events():
                if kind == "output":
                    output += str(payload)
                else:
                    break
                # Wait for the expanded output, not the echoed command line.
                if "SECRET=[]" in output or "SECRET=[super-secret]" in output:
                    break
        finally:
            session.close()
        return output

    output = _run(scenario())
    assert "super-secret" not in output
    assert "SECRET=[]" in output


def test_pty_resize_and_close(workspace: pathlib.Path) -> None:
    session = PtySession(str(workspace), shell="/bin/sh")
    session.start()
    session.resize(100, 40)
    assert (session.cols, session.rows) == (100, 40)
    session.resize(5, 1)
    assert session.cols == 20
    assert session.rows == 5
    session.close()
    session.close()  # idempotent


def test_missing_shell_reports_exit(workspace: pathlib.Path) -> None:
    async def scenario() -> int | None:
        session = PtySession(str(workspace), shell="/nonexistent/shell")
        session.start()
        try:
            async for kind, payload in session.events():
                if kind == "exit":
                    return int(payload) if payload is not None else None
        finally:
            session.close()
        return None

    assert _run(scenario()) == 127
