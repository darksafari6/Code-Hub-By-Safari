"""Git is driven through the real binary, so these tests create real repositories."""

from __future__ import annotations

import pathlib
import subprocess

import pytest

from safari import gitrepo


def _init(workspace: pathlib.Path) -> None:
    """Create a repository with a single baseline commit."""
    gitrepo.init()
    (workspace / ".gitkeep").write_text("")
    gitrepo.commit("initial", stage_all=True, name="Test", email="test@example.com")


def test_status_before_init(workspace: pathlib.Path) -> None:
    status = gitrepo.status()
    assert status["isRepo"] is False
    assert status["files"] == []


def test_init_creates_main_branch(workspace: pathlib.Path) -> None:
    status = gitrepo.init()
    assert status["isRepo"] is True
    assert status["branch"] == "main"
    assert status["hasCommits"] is False


def test_commit_tracks_identity_and_status(workspace: pathlib.Path) -> None:
    gitrepo.init()
    (workspace / "app.py").write_text("print('hi')\n")

    untracked = gitrepo.status()["files"]
    assert untracked == [{"path": "app.py", "status": "untracked", "staged": False}]

    result = gitrepo.commit("add app", stage_all=True, name="Test", email="test@example.com")
    assert len(result["oid"]) == 40
    assert result["status"]["files"] == []

    log = gitrepo.log()
    assert log[0]["author"] == "Test"
    assert log[0]["email"] == "test@example.com"
    assert log[0]["message"] == "add app"


def test_commit_requires_message(workspace: pathlib.Path) -> None:
    gitrepo.init()
    with pytest.raises(gitrepo.ApiError):
        gitrepo.commit("   ", stage_all=True)


def test_diff_shows_head_and_working_tree(workspace: pathlib.Path) -> None:
    gitrepo.init()
    (workspace / "file.txt").write_text("one\ntwo\n")
    gitrepo.commit("base", stage_all=True, name="Test", email="test@example.com")

    (workspace / "file.txt").write_text("one\nTWO\nthree\n")
    result = gitrepo.diff("file.txt")

    assert result["oldContent"] == "one\ntwo\n"
    assert result["newContent"] == "one\nTWO\nthree\n"
    assert result["binary"] is False
    assert result["truncated"] is False


def test_branch_create_checkout_and_validation(workspace: pathlib.Path) -> None:
    _init(workspace)

    created = gitrepo.create_branch("feature/x")
    assert created["current"] == "feature/x"
    assert "main" in created["branches"]

    back = gitrepo.checkout_branch("main")
    assert back["current"] == "main"

    with pytest.raises(gitrepo.ApiError):
        gitrepo.checkout_branch("missing")
    for bad in ("../evil", "-rf", "a..b", "trailing/", "x.lock", "with space"):
        with pytest.raises(gitrepo.ApiError):
            gitrepo.create_branch(bad)


def test_discard_restores_tracked_and_removes_untracked(workspace: pathlib.Path) -> None:
    gitrepo.init()
    (workspace / "tracked.txt").write_text("original\n")
    gitrepo.commit("base", stage_all=True, name="Test", email="test@example.com")

    (workspace / "tracked.txt").write_text("modified\n")
    (workspace / "loose.txt").write_text("untracked\n")

    status = gitrepo.discard(["tracked.txt", "loose.txt"])

    assert (workspace / "tracked.txt").read_text() == "original\n"
    assert not (workspace / "loose.txt").exists()
    assert status["files"] == []


def test_stage_and_unstage(workspace: pathlib.Path) -> None:
    _init(workspace)
    file_path = workspace / "staged.txt"
    file_path.write_text("data\n")

    staged = gitrepo.stage(["staged.txt"])
    assert staged["files"] == [{"path": "staged.txt", "status": "added", "staged": True}]

    unstaged = gitrepo.unstage(["staged.txt"])
    assert unstaged["files"] == [{"path": "staged.txt", "status": "untracked", "staged": False}]


def test_remote_validation_rejects_argument_injection(workspace: pathlib.Path) -> None:
    _init(workspace)

    with pytest.raises(gitrepo.ApiError):
        gitrepo.set_remote("--upload-pack=/bin/sh")
    with pytest.raises(gitrepo.ApiError):
        gitrepo.set_remote("file:///etc/passwd")
    with pytest.raises(gitrepo.ApiError):
        gitrepo.validate_remote("https://example.com/repo.git\nrm -rf /")

    status = gitrepo.set_remote("https://example.com/repo.git")
    assert status["remote"] == "https://example.com/repo.git"


def test_clone_rejects_non_empty_workspace(workspace: pathlib.Path) -> None:
    (workspace / "existing.txt").write_text("x")
    with pytest.raises(gitrepo.ApiError) as error:
        gitrepo.clone("https://example.com/repo.git")
    assert error.value.status == 409


def test_push_requires_remote(workspace: pathlib.Path) -> None:
    _init(workspace)
    with pytest.raises(gitrepo.ApiError):
        gitrepo.push("token")


def test_status_parses_real_git_output(workspace: pathlib.Path) -> None:
    """Cross-check our porcelain parser against git itself."""
    _init(workspace)
    (workspace / "a.txt").write_text("a\n")
    subprocess.run(["git", "add", "a.txt"], cwd=workspace, check=True, capture_output=True)

    entries = gitrepo.status()["files"]
    assert {"path": "a.txt", "status": "added", "staged": True} in entries
