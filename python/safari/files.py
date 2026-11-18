"""Workspace file operations: tree, read, write, create, rename, delete,
duplicate, binary upload and literal search.
"""

from __future__ import annotations

import base64
import binascii
import os
import pathlib
import shutil
from collections.abc import Iterator
from typing import Any

from .config import settings
from .paths import (
    assert_writable,
    bad_request,
    conflict,
    is_binary,
    is_ignored_name,
    normalize_relative,
    relative_to_root,
    resolve_in_root,
    too_large,
)


def _node(path: pathlib.Path, *, with_children: bool, depth: int, budget: list[int]) -> dict[str, Any]:
    stat = path.stat()
    node: dict[str, Any] = {
        "name": path.name,
        "path": relative_to_root(path),
        "type": "directory" if path.is_dir() else "file",
    }
    if path.is_file():
        node["size"] = stat.st_size
        return node

    children: list[dict[str, Any]] = []
    if with_children and depth < settings.limits.max_tree_depth and budget[0] > 0:
        for entry in _iter_visible(path):
            if budget[0] <= 0:
                break
            budget[0] -= 1
            try:
                children.append(_node(entry, with_children=True, depth=depth + 1, budget=budget))
            except OSError:
                continue
    node["children"] = children
    return node


def _iter_visible(directory: pathlib.Path) -> list[pathlib.Path]:
    try:
        entries = list(os.scandir(directory))
    except OSError:
        return []
    visible = [pathlib.Path(entry.path) for entry in entries if not is_ignored_name(entry.name)]
    visible.sort(key=lambda item: (item.is_file(), item.name.lower()))
    return visible


def list_tree() -> list[dict[str, Any]]:
    budget = [settings.limits.max_tree_entries]
    root = settings.workspace
    nodes: list[dict[str, Any]] = []
    for entry in _iter_visible(root):
        if budget[0] <= 0:
            break
        budget[0] -= 1
        try:
            nodes.append(_node(entry, with_children=True, depth=0, budget=budget))
        except OSError:
            continue
    return nodes


def read_file(raw_path: object) -> dict[str, Any]:
    target = resolve_in_root(raw_path, must_exist=True)
    if target.is_dir():
        raise bad_request("That path is a directory")
    if is_binary(target):
        raise bad_request("Binary files cannot be opened in the editor")

    size = target.stat().st_size
    if size > settings.limits.max_file_bytes:
        raise too_large(
            f"File is larger than the {settings.limits.max_file_bytes // 1024} KB editor limit"
        )

    return {
        "path": relative_to_root(target),
        "content": target.read_text(encoding="utf-8", errors="replace"),
        "size": size,
    }


def write_file(raw_path: object, content: object) -> dict[str, Any]:
    target = resolve_in_root(raw_path)
    assert_writable(target)
    if not isinstance(content, str):
        raise bad_request("`content` must be a string")

    payload = content.encode("utf-8")
    if len(payload) > settings.limits.max_file_bytes:
        raise too_large("File is larger than the editor limit")

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.{os.getpid()}.tmp")
    temporary.write_bytes(payload)
    os.replace(temporary, target)

    return {"path": relative_to_root(target), "size": len(payload)}


def create_entry(raw_path: object, kind: object) -> dict[str, Any]:
    if kind not in ("file", "directory"):
        raise bad_request("`type` must be 'file' or 'directory'")

    target = resolve_in_root(raw_path)
    assert_writable(target)
    if normalize_relative(raw_path) == "":
        raise bad_request("A path is required")
    if target.exists():
        raise conflict(f"\"{relative_to_root(target)}\" already exists")

    target.parent.mkdir(parents=True, exist_ok=True)
    if kind == "directory":
        target.mkdir()
    else:
        target.touch(exist_ok=False)

    return {
        "name": target.name,
        "path": relative_to_root(target),
        "type": kind,
        "size": 0 if kind == "file" else None,
    }


def rename_entry(raw_from: object, raw_to: object) -> dict[str, Any]:
    source = resolve_in_root(raw_from, must_exist=True)
    target = resolve_in_root(raw_to)
    assert_writable(source)
    assert_writable(target)

    if normalize_relative(raw_from) == "":
        raise bad_request("The workspace root cannot be renamed")
    if target.exists():
        raise conflict(f"\"{relative_to_root(target)}\" already exists")

    target.parent.mkdir(parents=True, exist_ok=True)
    source.rename(target)

    node: dict[str, Any] = {
        "name": target.name,
        "path": relative_to_root(target),
        "type": "directory" if target.is_dir() else "file",
    }
    if target.is_file():
        node["size"] = target.stat().st_size
    return node


def delete_entry(raw_path: object) -> dict[str, Any]:
    target = resolve_in_root(raw_path, must_exist=True)
    assert_writable(target)
    if normalize_relative(raw_path) == "":
        raise bad_request("The workspace root cannot be deleted")

    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"path": relative_to_root(target)}


def duplicate_entry(raw_path: object, raw_target: object = None) -> dict[str, Any]:
    source = resolve_in_root(raw_path, must_exist=True)
    assert_writable(source)
    if source.is_dir():
        raise bad_request("Only files can be duplicated")

    if raw_target:
        target = resolve_in_root(raw_target)
    else:
        stem, suffix = source.stem, source.suffix
        attempt = 1
        while True:
            label = " copy" if attempt == 1 else f" copy {attempt}"
            candidate = source.with_name(f"{stem}{label}{suffix}")
            if not candidate.exists():
                target = candidate
                break
            attempt += 1

    assert_writable(target)
    if target.exists():
        raise conflict(f"\"{relative_to_root(target)}\" already exists")

    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)

    return {
        "name": target.name,
        "path": relative_to_root(target),
        "type": "file",
        "size": target.stat().st_size,
    }


def write_upload(raw_path: object, encoded: object) -> dict[str, Any]:
    target = resolve_in_root(raw_path)
    assert_writable(target)
    if not isinstance(encoded, str):
        raise bad_request("`base64` must be a string")

    payload = encoded
    if payload.startswith("data:") and "," in payload:
        payload = payload.split(",", 1)[1]

    try:
        data = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as error:
        raise bad_request("Invalid base64 payload") from error

    if not data:
        raise bad_request("Uploaded file is empty")
    if len(data) > settings.limits.max_upload_bytes:
        raise too_large(
            f"Upload is larger than the {settings.limits.max_upload_bytes // (1024 * 1024)} MB limit"
        )
    if target.is_dir():
        raise bad_request("That path is a directory")

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.{os.getpid()}.upload")
    temporary.write_bytes(data)
    os.replace(temporary, target)

    return {"path": relative_to_root(target), "size": len(data)}


def _iter_search_files(root: pathlib.Path, scope: pathlib.Path) -> Iterator[pathlib.Path]:
    for base, directories, files in os.walk(scope):
        directories[:] = sorted(d for d in directories if not is_ignored_name(d))
        for name in sorted(files):
            if is_ignored_name(name):
                continue
            candidate = pathlib.Path(base) / name
            try:
                if candidate.stat().st_size > settings.limits.max_search_file_bytes:
                    continue
            except OSError:
                continue
            if is_binary(candidate):
                continue
            yield candidate


def search(raw_query: object, case_sensitive: bool = False, raw_path: object = None) -> dict[str, Any]:
    if not isinstance(raw_query, str) or not raw_query.strip():
        raise bad_request("A search query is required")

    scope = resolve_in_root(raw_path, must_exist=True) if raw_path else settings.workspace
    needle = raw_query if case_sensitive else raw_query.lower()

    matches: list[dict[str, Any]] = []
    truncated = False

    for candidate in _iter_search_files(settings.workspace, scope):
        try:
            text = candidate.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        for number, line in enumerate(text.splitlines(), start=1):
            haystack = line if case_sensitive else line.lower()
            index = haystack.find(needle)
            if index < 0:
                continue

            matches.append(
                {
                    "path": relative_to_root(candidate),
                    "line": number,
                    "column": index + 1,
                    "preview": line.strip()[:240],
                }
            )
            if len(matches) >= settings.limits.max_search_results:
                truncated = True
                return {"query": raw_query, "matches": matches, "truncated": truncated}

    return {"query": raw_query, "matches": matches, "truncated": truncated}
