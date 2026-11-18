"""Git support through the real `git` binary.

Using the CLI instead of a JavaScript reimplementation means hooks, submodules,
worktrees, GPG signing, SSH remotes and the user's own git config all work.
Every call is argv-based (never a shell), runs inside the workspace and inherits
only allow-listed environment variables.
"""

from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from .config import settings
from .paths import ApiError, bad_request, conflict, forbidden, not_found, resolve_in_root, run_env

GIT_TIMEOUT_SECONDS = 120
MAX_DIFF_BYTES = 400 * 1024
BRANCH_PATTERN = re.compile(r"^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]{1,120}$")


@dataclass
class GitResult:
    stdout: str
    stderr: str
    code: int


def _git(*args: str, timeout: int = GIT_TIMEOUT_SECONDS, check: bool = False) -> GitResult:
    env = run_env()
    env.update(
        {
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_ASKPASS": "/bin/true",
            "GIT_CONFIG_NOSYSTEM": "1",
            "LC_ALL": "C",
        }
    )
    if settings.access_token:
        # Keep the app token out of git's environment.
        env.pop("SAFARI_ACCESS_TOKEN", None)

    try:
        completed = subprocess.run(  # noqa: S603 - argv list, no shell
            ["git", *args],
            cwd=settings.workspace,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as error:
        raise ApiError(500, "The git binary is not installed on this system") from error
    except subprocess.TimeoutExpired as error:
        raise ApiError(504, f"git {' '.join(args[:2])} timed out") from error

    result = GitResult(completed.stdout, completed.stderr, completed.returncode)
    if check and result.code != 0:
        raise _git_error(result, args)
    return result


def _git_error(result: GitResult, args: Sequence[str]) -> ApiError:
    detail = (result.stderr or result.stdout).strip().splitlines()
    message = detail[-1] if detail else f"git {' '.join(args[:2])} failed"
    lowered = message.lower()

    if "not a git repository" in lowered:
        return bad_request("This workspace is not a git repository")
    if "would be overwritten" in lowered or "local changes" in lowered or "conflict" in lowered:
        return conflict(message)
    if "authentication" in lowered or "permission denied" in lowered or "403" in lowered:
        return ApiError(502, f"Git authentication failed: {message}")
    return ApiError(400, message)


def _bytes(*args: str) -> bytes:
    env = run_env()
    env.update({"GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "/bin/true", "LC_ALL": "C"})
    completed = subprocess.run(  # noqa: S603 - argv list, no shell
        ["git", *args],
        cwd=settings.workspace,
        env=env,
        capture_output=True,
        timeout=GIT_TIMEOUT_SECONDS,
        check=False,
    )
    return completed.stdout


def is_repo() -> bool:
    return (settings.workspace / ".git").exists()


def assert_repo() -> None:
    if not is_repo():
        raise bad_request("This workspace is not a git repository")


def has_commits() -> bool:
    return _git("rev-parse", "--verify", "HEAD").code == 0


def current_branch() -> str | None:
    # `branch --show-current` also works before the first commit, where
    # `rev-parse HEAD` fails because HEAD is unborn.
    result = _git("branch", "--show-current")
    if result.code == 0:
        name = result.stdout.strip()
        if name:
            return name

    result = _git("rev-parse", "--abbrev-ref", "HEAD")
    name = result.stdout.strip()
    return name or None if result.code == 0 else None


def remote_url() -> str | None:
    result = _git("config", "--get", "remote.origin.url")
    value = result.stdout.strip()
    return value or None


STATUS_LETTERS = {
    "A": "added",
    "M": "modified",
    "D": "deleted",
    "R": "modified",
    "C": "modified",
    "T": "modified",
    "U": "modified",
}


def _status_entries() -> list[dict[str, Any]]:
    raw = _git("status", "--porcelain=v1", "-z", "--untracked-files=all").stdout
    entries: list[dict[str, Any]] = []
    fields = raw.split("\0")
    index = 0

    while index < len(fields):
        field = fields[index]
        index += 1
        if len(field) < 3:
            continue

        code, path = field[:2], field[3:]
        if code[0] in ("R", "C"):
            # Renames carry the original path as the next NUL separated field.
            index += 1

        if code == "??":
            entries.append({"path": path, "status": "untracked", "staged": False})
            continue
        if code == "!!":
            continue

        staged_letter = code[0] if code[0] != " " else None
        unstaged_letter = code[1] if code[1] != " " else None

        if staged_letter:
            entries.append(
                {
                    "path": path,
                    "status": STATUS_LETTERS.get(staged_letter, "modified"),
                    "staged": True,
                }
            )
        if unstaged_letter:
            entries.append(
                {
                    "path": path,
                    "status": STATUS_LETTERS.get(unstaged_letter, "modified"),
                    "staged": False,
                }
            )

    return entries


def status() -> dict[str, Any]:
    if not is_repo():
        return {"isRepo": False, "branch": None, "hasCommits": False, "remote": None, "files": []}

    return {
        "isRepo": True,
        "branch": current_branch(),
        "hasCommits": has_commits(),
        "remote": remote_url(),
        "files": _status_entries(),
    }


def log(limit: int = 50) -> list[dict[str, Any]]:
    if not is_repo() or not has_commits():
        return []

    result = _git(
        "log",
        f"-n{limit}",
        "--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ae%x1f%at",
    )
    commits: list[dict[str, Any]] = []
    for line in result.stdout.splitlines():
        parts = line.split("\x1f")
        if len(parts) != 6:
            continue
        oid, short, message, author, email, timestamp = parts
        commits.append(
            {
                "oid": oid,
                "shortOid": short,
                "message": message,
                "author": author,
                "email": email,
                "timestamp": int(timestamp) * 1000,
            }
        )
    return commits


def list_branches() -> dict[str, Any]:
    if not is_repo():
        return {"branches": [], "current": None}

    result = _git("branch", "--format=%(refname:short)")
    branches = sorted({line.strip() for line in result.stdout.splitlines() if line.strip()})
    return {"branches": branches, "current": current_branch()}


def valid_branch_name(name: object) -> bool:
    if not isinstance(name, str):
        return False
    if not BRANCH_PATTERN.match(name):
        return False
    if name.startswith(".") or name.endswith("/") or name.endswith(".lock"):
        return False
    return True


def create_branch(name: str, checkout: bool = True) -> dict[str, Any]:
    assert_repo()
    if not valid_branch_name(name):
        raise bad_request('Invalid branch name. Use letters, numbers, ".", "_", "-" or "/".')
    if not has_commits():
        raise bad_request("Create a commit before branching")

    existing = set(list_branches()["branches"])
    if name in existing:
        raise conflict(f'Branch "{name}" already exists')

    if checkout:
        result = _git("checkout", "-b", name)
    else:
        result = _git("branch", name)
    if result.code != 0:
        raise _git_error(result, ["branch", name])
    return list_branches()


def checkout_branch(name: str) -> dict[str, Any]:
    assert_repo()
    if not valid_branch_name(name):
        raise bad_request("Invalid branch name")

    if name not in set(list_branches()["branches"]):
        raise not_found(f'Branch "{name}" does not exist')

    result = _git("checkout", name)
    if result.code != 0:
        message = (result.stderr or result.stdout).strip()
        if "local changes" in message.lower() or "overwritten" in message.lower():
            raise conflict(
                f'Cannot switch to "{name}": you have uncommitted changes that would be '
                "overwritten. Commit or discard them first."
            )
        raise _git_error(result, ["checkout", name])
    return list_branches()


def diff(raw_path: object) -> dict[str, Any]:
    assert_repo()
    target = resolve_in_root(raw_path, must_exist=False)
    relative = target.relative_to(settings.workspace).as_posix()

    old_bytes = b""
    if has_commits():
        old_bytes = _bytes("show", f"HEAD:{relative}")

    new_bytes = b""
    if target.is_file():
        new_bytes = target.read_bytes()

    binary = b"\0" in old_bytes[:4096] or b"\0" in new_bytes[:4096]
    truncated = len(old_bytes) > MAX_DIFF_BYTES or len(new_bytes) > MAX_DIFF_BYTES

    return {
        "path": relative,
        "oldContent": old_bytes[:MAX_DIFF_BYTES].decode("utf-8", errors="replace"),
        "newContent": new_bytes[:MAX_DIFF_BYTES].decode("utf-8", errors="replace"),
        "binary": binary,
        "truncated": truncated,
    }


def _tracked_paths(paths: Sequence[str]) -> set[str]:
    result = _git("ls-files", "-z")
    return {entry for entry in result.stdout.split("\0") if entry}


def discard(raw_paths: Sequence[str]) -> dict[str, Any]:
    assert_repo()
    tracked = _tracked_paths(raw_paths)
    statuses = {entry["path"]: entry for entry in _status_entries()}

    for raw_path in raw_paths:
        target = resolve_in_root(raw_path)
        if target == settings.workspace:
            raise bad_request("The workspace root cannot be discarded")
        if target.relative_to(settings.workspace).parts[0] == ".git":
            raise forbidden("The .git directory cannot be discarded through this API")

        relative = target.relative_to(settings.workspace).as_posix()
        entry = statuses.get(relative)

        if relative in tracked and (entry is None or entry["staged"] or entry["status"] != "untracked"):
            result = _git("checkout", "HEAD", "--", relative)
            if result.code != 0:
                raise _git_error(result, ["checkout", "HEAD", "--", relative])
            continue

        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()

    return status()


def stage(paths: Sequence[str] | None = None) -> dict[str, Any]:
    assert_repo()
    if paths is None:
        result = _git("add", "-A")
    else:
        result = _git("add", "--", *paths)
    if result.code != 0:
        raise _git_error(result, ["add"])
    return status()


def unstage(paths: Sequence[str]) -> dict[str, Any]:
    assert_repo()
    if has_commits():
        result = _git("reset", "-q", "HEAD", "--", *paths)
    else:
        result = _git("rm", "-r", "--cached", "-q", "--", *paths)
    if result.code != 0:
        raise _git_error(result, ["reset"])
    return status()


def commit(message: str, stage_all: bool = False, name: str | None = None, email: str | None = None) -> dict[str, Any]:
    assert_repo()
    if not message.strip():
        raise bad_request("A commit message is required")

    if stage_all:
        stage()

    args = ["commit", "-m", message]
    if name:
        args = ["-c", f"user.name={name}", *args]
    if email:
        args = ["-c", f"user.email={email}", *args]

    result = _git(*args)
    if result.code != 0:
        message_text = (result.stderr or result.stdout).strip()
        if "Please tell me who you are" in message_text:
            raise bad_request(
                "Set an author name and email in Settings, or configure git user.name/user.email."
            )
        if "nothing to commit" in message_text:
            raise bad_request("Nothing to commit — stage some changes first")
        raise _git_error(result, ["commit"])

    oid = _git("rev-parse", "HEAD").stdout.strip()
    return {"oid": oid, "status": status()}


def init() -> dict[str, Any]:
    result = _git("init", "-b", "main")
    if result.code != 0:
        # Older git versions do not support -b.
        result = _git("init")
        if result.code != 0:
            raise _git_error(result, ["init"])
        _git("symbolic-ref", "HEAD", "refs/heads/main")
    return status()


def _auth_headers(token: str) -> list[str]:
    encoded = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    return ["-c", f"http.extraheader=Authorization: Basic {encoded}"]


REMOTE_PATTERN = re.compile(r"^(https?://|ssh://|git://|git@)[^\s]+$")


def validate_remote(url: object) -> str:
    if not isinstance(url, str) or not url.strip():
        raise bad_request("A repository URL is required")
    candidate = url.strip()
    if candidate.startswith("-") or any(ch in candidate for ch in "\0\r\n\t "):
        raise bad_request("Invalid repository URL")
    if not REMOTE_PATTERN.match(candidate):
        raise bad_request("Only http(s), ssh and git URLs are supported")
    return candidate


def set_remote(url: str) -> dict[str, Any]:
    assert_repo()
    cleaned = validate_remote(url)
    result = _git("remote", "set-url", "origin", cleaned)
    if result.code != 0:
        result = _git("remote", "add", "origin", cleaned)
    if result.code != 0:
        raise _git_error(result, ["remote", "add"])
    return status()


def clone(url: str, token: str | None = None, replace: bool = False) -> dict[str, Any]:
    cleaned = validate_remote(url)
    workspace = settings.workspace

    if not replace:
        existing = {entry.name for entry in os.scandir(workspace)}
        if existing:
            raise conflict("The workspace is not empty. Enable 'replace' to overwrite it.")

    with tempfile.TemporaryDirectory(dir=workspace.parent) as temporary:
        args = ["clone", "--depth", "1"]
        if token:
            args.extend(_auth_headers(token))
        args.extend([cleaned, temporary])

        env = run_env()
        env.update({"GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "/bin/true"})
        completed = subprocess.run(  # noqa: S603 - argv list, no shell
            ["git", *args],
            cwd=workspace.parent,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip().splitlines()
            raise ApiError(502, f"Clone failed: {detail[-1] if detail else 'unknown error'}")

        for entry in os.scandir(workspace):
            target = workspace / entry.name
            shutil.rmtree(target) if target.is_dir() else target.unlink()

        for entry in os.scandir(temporary):
            source = os.path.join(temporary, entry.name)
            destination = workspace / entry.name
            shutil.move(source, destination) if os.path.isdir(source) else shutil.copy2(
                source, destination
            )

    return status()


def push(token: str | None, remote: str = "origin", ref: str | None = None, force: bool = False) -> dict[str, Any]:
    assert_repo()
    if not remote_url():
        raise not_found(f'Remote "{remote}" is not configured for this repository')

    branch = ref or current_branch()
    if not branch:
        raise bad_request("No branch is checked out")

    args: list[str] = []
    if token:
        args = _auth_headers(token)
    args += ["push", remote, f"HEAD:{branch}"]
    if force:
        args.append("--force")

    result = _git(*args, timeout=300)
    if result.code != 0:
        raise _git_error(result, ["push"])
    return {"ok": True}
