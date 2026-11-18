"""A real pseudo-terminal session.

This is the piece the Node implementation could not provide without a native
addon: `pty.fork()` allocates a kernel PTY, so full-screen programs (vim, htop,
top, less, ssh, REPLs) behave exactly as they do in a normal Linux terminal,
including colours, curses and window resizing.

Design notes:
- the shell runs in its own session/process group so the whole job tree can be
  terminated on disconnect;
- a reader thread owns the master fd and pushes chunks into a thread-safe queue,
  so the event loop never performs a blocking read and a session can be created
  from synchronous code;
- the child inherits an allow-listed environment only, so API keys are never
  reachable from the terminal;
- exactly one `exit` event is emitted, carrying the real exit status.
"""

from __future__ import annotations

import asyncio
import errno
import fcntl
import os
import pty
import queue
import signal
import struct
import termios
import threading

from .config import settings
from .paths import run_env

#: Sentinel that unblocks a pending `events()` call when the session is closed.
_CLOSED = object()


class PtySession:
    def __init__(self, cwd: str, shell: str | None = None, cols: int = 120, rows: int = 32) -> None:
        self.cwd = cwd
        self.shell = shell or os.environ.get("SHELL") or "/bin/bash"
        self.cols = max(20, min(cols, 400))
        self.rows = max(5, min(rows, 200))
        self.pid: int | None = None
        self._fd: int | None = None
        self._queue: queue.Queue[tuple[str, object]] = queue.Queue(maxsize=4096)
        self._closed = False
        self._exit_sent = False

    # -- lifecycle ---------------------------------------------------------

    def start(self) -> None:
        if self.pid is not None:
            return

        pid, fd = pty.fork()
        if pid == 0:  # child
            try:
                os.chdir(self.cwd)
                env = run_env()
                env["TERM"] = "xterm-256color"
                env["COLORTERM"] = "truecolor"
                os.execvpe(self.shell, [self.shell], env)
            except BaseException:  # pragma: no cover - child process
                os._exit(127)

        self.pid = pid
        self._fd = fd
        self.resize(self.cols, self.rows)

        threading.Thread(target=self._pump, name="pty-reader", daemon=True).start()
        threading.Thread(target=self._wait_child, name="pty-waiter", daemon=True).start()

    def _put(self, item: tuple[str, object]) -> None:
        if self._closed:
            return
        try:
            self._queue.put_nowait(item)
        except queue.Full:  # pragma: no cover - runaway output
            pass

    def _pump(self) -> None:
        assert self._fd is not None
        while not self._closed:
            try:
                chunk = os.read(self._fd, settings.limits.max_pty_output_chunk)
            except OSError as error:
                if error.errno in (errno.EIO, errno.EBADF):
                    break
                continue
            if not chunk:
                break
            self._put(("output", chunk.decode("utf-8", errors="replace")))

    def _wait_child(self) -> None:
        if self.pid is None:
            return
        try:
            _, status = os.waitpid(self.pid, 0)
        except ChildProcessError:
            return

        code = os.waitstatus_to_exitcode(status)
        if not self._exit_sent:
            self._exit_sent = True
            self._put(("exit", code))

    # -- io ----------------------------------------------------------------

    async def events(self):
        """Yield ("output", text) followed by a single ("exit", code)."""
        while True:
            kind, payload = await asyncio.to_thread(self._queue.get)
            if payload is _CLOSED:
                return
            yield kind, payload
            if kind == "exit":
                return

    def write(self, data: str) -> None:
        if self._closed or self._fd is None:
            return
        try:
            os.write(self._fd, data.encode("utf-8", errors="replace"))
        except OSError:
            pass

    def resize(self, cols: int, rows: int) -> None:
        if self._fd is None:
            return
        self.cols = max(20, min(int(cols), 400))
        self.rows = max(5, min(int(rows), 200))
        try:
            fcntl.ioctl(
                self._fd,
                termios.TIOCSWINSZ,
                struct.pack("HHHH", self.rows, self.cols, 0, 0),
            )
        except OSError:
            pass

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True

        if self.pid is not None:
            for sig in (signal.SIGHUP, signal.SIGTERM, signal.SIGKILL):
                try:
                    os.killpg(os.getpgid(self.pid), sig)
                except (ProcessLookupError, PermissionError, OSError):
                    break

        if self._fd is not None:
            try:
                os.close(self._fd)
            except OSError:
                pass
            self._fd = None

        # Unblock any pending events() iterator.
        try:
            self._queue.put_nowait(("exit", _CLOSED))
        except queue.Full:  # pragma: no cover
            pass
