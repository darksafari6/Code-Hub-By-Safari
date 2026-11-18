"""HTTP errors and the workspace path jail.

The jail is the security boundary of the whole server: every path that arrives
from a client goes through `resolve_in_root`, which rejects `..` escapes twice —
once lexically and once against the real path on disk, so symlinks cannot be
used to break out.
"""

from __future__ import annotations

import os
import pathlib

from .config import settings


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def bad_request(message: str) -> ApiError:
    return ApiError(400, message)


def forbidden(message: str) -> ApiError:
    return ApiError(403, message)


def not_found(message: str) -> ApiError:
    return ApiError(404, message)


def conflict(message: str) -> ApiError:
    return ApiError(409, message)


def too_large(message: str) -> ApiError:
    return ApiError(413, message)


def normalize_relative(raw: object) -> str:
    """Validate a client supplied relative path without touching the disk."""
    if not isinstance(raw, str):
        raise bad_request("`path` must be a string")

    candidate = raw.replace("\\", "/").strip()
    if candidate in ("", ".", "/"):
        return ""
    if "\x00" in candidate:
        raise bad_request("Path contains a null byte")

    candidate = candidate.lstrip("/")
    parts = [part for part in candidate.split("/") if part not in ("", ".")]
    if any(part == ".." for part in parts):
        raise bad_request("Path escapes the workspace")

    return "/".join(parts)


def resolve_in_root(raw: object, *, must_exist: bool = False) -> pathlib.Path:
    relative = normalize_relative(raw)
    root = settings.workspace
    target = (root / relative).resolve() if relative else root

    # `resolve()` follows symlinks, so this also catches a link pointing outside.
    if target != root and root not in target.parents:
        raise bad_request("Path escapes the workspace")
    if must_exist and not target.exists():
        raise not_found(f"\"{relative or '.'}\" does not exist")
    return target


def relative_to_root(target: pathlib.Path) -> str:
    root = settings.workspace
    if target == root:
        return ""
    try:
        return target.relative_to(root).as_posix()
    except ValueError as error:  # pragma: no cover - defensive
        raise bad_request("Path escapes the workspace") from error


def is_ignored_name(name: str) -> bool:
    from .config import ALLOWED_DOTFILES, IGNORED_DIRECTORIES

    if name in IGNORED_DIRECTORIES:
        return True
    if name.startswith(".") and name not in ALLOWED_DOTFILES:
        return True
    return name.endswith(".pyc")


def assert_writable(target: pathlib.Path) -> None:
    """Refuse operations that would corrupt git metadata."""
    root = settings.workspace
    try:
        parts = target.relative_to(root).parts
    except ValueError as error:
        raise bad_request("Path escapes the workspace") from error
    if parts and parts[0] == ".git":
        raise forbidden("The .git directory cannot be modified through this API")


def is_binary(path: pathlib.Path) -> bool:
    from .config import BINARY_EXTENSIONS

    if path.suffix.lower().lstrip(".") in BINARY_EXTENSIONS:
        return True
    try:
        with path.open("rb") as handle:
            chunk = handle.read(4096)
    except OSError:
        return False
    return b"\x00" in chunk


def run_env() -> dict[str, str]:
    """Environment for child processes: allow-listed, never credentials."""
    from .config import SHELL_ENV_ALLOWLIST

    env = {key: os.environ[key] for key in SHELL_ENV_ALLOWLIST if key in os.environ}
    env.setdefault("PATH", "/usr/local/bin:/usr/bin:/bin")
    env.setdefault("LANG", "C.UTF-8")
    return env
