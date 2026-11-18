"""Shared fixtures: point the singleton settings at a temporary workspace."""

from __future__ import annotations

import pathlib

import pytest

from safari.config import settings


@pytest.fixture()
def workspace(tmp_path: pathlib.Path) -> pathlib.Path:
    """Redirect every module at a throw-away workspace.

    `settings` is a frozen dataclass, but all modules share the same instance, so
    bypassing the frozen guard gives tests an isolated workspace without
    re-importing the package.
    """
    original = settings.workspace
    object.__setattr__(settings, "workspace", tmp_path)
    try:
        yield tmp_path
    finally:
        object.__setattr__(settings, "workspace", original)
