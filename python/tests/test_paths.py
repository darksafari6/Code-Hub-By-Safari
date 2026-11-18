"""The path jail is the security boundary, so it gets explicit coverage."""

from __future__ import annotations

import os
import pathlib

import pytest

from safari.files import duplicate_entry, read_file, write_file
from safari.paths import ApiError, is_ignored_name, normalize_relative, resolve_in_root


def test_normalize_rejects_traversal() -> None:
    for candidate in ("../etc/passwd", "a/../../b", "/../x", "..\\..\\windows"):
        with pytest.raises(ApiError):
            normalize_relative(candidate)


def test_normalize_strips_leading_slash_and_dots() -> None:
    assert normalize_relative("/src/app.ts") == "src/app.ts"
    assert normalize_relative("./src//app.ts") == "src/app.ts"
    assert normalize_relative(".") == ""
    assert normalize_relative("") == ""


def test_resolve_stays_inside_workspace(workspace: pathlib.Path) -> None:
    inside = workspace / "src"
    inside.mkdir()
    assert resolve_in_root("src") == inside.resolve()

    with pytest.raises(ApiError):
        resolve_in_root("../outside.txt")


def test_symlink_escape_is_rejected(workspace: pathlib.Path, tmp_path_factory) -> None:
    outside = tmp_path_factory.mktemp("outside")
    (outside / "secret.txt").write_text("classified")

    link = workspace / "escape"
    try:
        os.symlink(outside, link)
    except OSError:  # pragma: no cover - platform without symlink support
        pytest.skip("symlinks unavailable")

    with pytest.raises(ApiError):
        resolve_in_root("escape/secret.txt")


def test_ignored_names(workspace: pathlib.Path) -> None:
    assert is_ignored_name("node_modules")
    assert is_ignored_name(".git")
    assert is_ignored_name(".hidden")
    assert not is_ignored_name(".env.example")
    assert not is_ignored_name("app.ts")


def test_write_and_read_roundtrip(workspace: pathlib.Path) -> None:
    result = write_file("docs/readme.md", "# hello")
    assert result["path"] == "docs/readme.md"

    content = read_file("docs/readme.md")
    assert content["content"] == "# hello"
    assert content["size"] == 7


def test_write_rejects_git_metadata(workspace: pathlib.Path) -> None:
    (workspace / ".git").mkdir()
    with pytest.raises(ApiError) as error:
        write_file(".git/config", "[core]")
    assert error.value.status == 403


def test_duplicate_picks_available_names(workspace: pathlib.Path) -> None:
    write_file("notes.txt", "one")
    assert duplicate_entry("notes.txt")["path"] == "notes copy.txt"
    assert duplicate_entry("notes.txt")["path"] == "notes copy 2.txt"
