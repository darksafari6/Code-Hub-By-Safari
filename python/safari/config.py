"""Configuration for the Python runtime.

Everything is read from the environment once, at import time, so the rest of the
package can treat it as constants. Values mirror the Node server exactly; when
the two disagree the Python implementation is the one that ships.
"""

from __future__ import annotations

import os
import pathlib
import re
from dataclasses import dataclass, field

from dotenv import load_dotenv

# The repository root, derived from this file (python/safari/config.py) so the
# server can be started from any working directory. SAFARI_ROOT overrides it for
# packaged installs.
ROOT = pathlib.Path(os.environ.get("SAFARI_ROOT") or pathlib.Path(__file__).resolve().parents[2]).resolve()
load_dotenv(ROOT / ".env", override=False)


def _env(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _version() -> str:
    manifest = ROOT / "package.json"
    try:
        import json

        return json.loads(manifest.read_text())["version"]
    except Exception:  # noqa: BLE001 - version is cosmetic
        return "0.0.0"


def _workspace() -> pathlib.Path:
    configured = _env("WORKSPACE_DIR")
    path = pathlib.Path(configured).expanduser() if configured else ROOT / "workspace"
    if not path.is_absolute():
        path = (ROOT / path).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


@dataclass(frozen=True)
class Limits:
    max_file_bytes: int = 2 * 1024 * 1024
    max_tree_entries: int = 5000
    max_tree_depth: int = 24
    max_search_results: int = 200
    max_search_file_bytes: int = 1024 * 1024
    max_upload_bytes: int = 8 * 1024 * 1024
    max_body_bytes: int = 12 * 1024 * 1024
    max_pty_output_chunk: int = 64 * 1024
    max_ai_messages: int = 60
    ai_rate_limit_per_minute: int = 40


@dataclass(frozen=True)
class Provider:
    id: str
    label: str
    description: str
    env_key: str
    model: str
    base_url: str | None = None
    api_key: str | None = None


@dataclass(frozen=True)
class Settings:
    host: str = field(default_factory=lambda: _env("HOST") or "0.0.0.0")
    port: int = field(default_factory=lambda: int(_env("PORT") or 8000))
    version: str = field(default_factory=_version)
    workspace: pathlib.Path = field(default_factory=_workspace)
    access_token: str | None = field(default_factory=lambda: _env("SAFARI_ACCESS_TOKEN"))
    dist_dir: pathlib.Path = field(default_factory=lambda: ROOT / "dist")
    limits: Limits = field(default_factory=Limits)
    providers: dict[str, Provider] = field(default_factory=dict)


def _providers() -> dict[str, Provider]:
    openai_base = _env("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    return {
        "gemini": Provider(
            id="gemini",
            label="Google Gemini",
            description="Google's multimodal models, including a generous free tier.",
            env_key="GEMINI_API_KEY",
            model=_env("GEMINI_MODEL") or "gemini-2.5-flash",
            api_key=_env("GEMINI_API_KEY"),
        ),
        "deepseek": Provider(
            id="deepseek",
            label="DeepSeek",
            description="Strong coding models at low cost, OpenAI-compatible API.",
            env_key="DEEPSEEK_API_KEY",
            model=_env("DEEPSEEK_MODEL") or "deepseek-chat",
            base_url="https://api.deepseek.com",
            api_key=_env("DEEPSEEK_API_KEY"),
        ),
        "openai": Provider(
            id="openai",
            label="OpenAI-compatible",
            description="Any endpoint that speaks the OpenAI chat completions API.",
            env_key="OPENAI_API_KEY",
            model=_env("OPENAI_MODEL") or "gpt-4o-mini",
            base_url=openai_base,
            api_key=_env("OPENAI_API_KEY"),
        ),
    }


settings = Settings(providers=_providers())

#: Directories that are never listed, searched or served through the preview.
IGNORED_DIRECTORIES = frozenset(
    {
        "node_modules",
        ".git",
        "dist",
        "dist-server",
        "release",
        "__pycache__",
        ".venv",
        ".next",
        ".turbo",
        "coverage",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
    }
)

#: Hidden files that are real project files rather than tooling state.
ALLOWED_DOTFILES = frozenset(
    {".env.example", ".editorconfig", ".nvmrc", ".gitignore", ".gitattributes", ".dockerignore"}
)

BINARY_EXTENSIONS = frozenset(
    {
        "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "avif",
        "woff", "woff2", "ttf", "otf", "eot",
        "zip", "gz", "tar", "bz2", "xz", "7z", "rar",
        "pdf", "wasm", "mp3", "mp4", "mov", "avi", "mkv", "webm", "ogg",
        "so", "dylib", "dll", "exe", "bin", "pyc", "o", "a",
    }
)

#: Environment variables a terminal session is allowed to inherit. API keys are
#: explicitly absent, which is asserted in the test suite.
SHELL_ENV_ALLOWLIST = (
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
    "SHELL",
    "TERM",
    "COLORTERM",
    "DISPLAY",
    "WAYLAND_DISPLAY",
    "XDG_RUNTIME_DIR",
    "XDG_SESSION_TYPE",
)

SAFE_ENV_PATTERN = re.compile(r"^[A-Z_][A-Z0-9_]*$")
