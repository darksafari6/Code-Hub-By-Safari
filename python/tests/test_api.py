"""HTTP contract tests through the ASGI app itself (no network needed)."""

from __future__ import annotations

import pathlib

import pytest
from fastapi.testclient import TestClient

from safari.app import app
from safari.config import settings


@pytest.fixture()
def client(workspace: pathlib.Path) -> TestClient:
    return TestClient(app)


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == settings.version


def test_info_reports_pty_capability(client: TestClient) -> None:
    body = client.get("/api/system/info").json()
    assert body["capabilities"]["terminal"] == "pty"
    assert body["capabilities"]["git"] == "cli"
    assert body["workspacePath"] == str(settings.workspace)


def test_file_crud(client: TestClient) -> None:
    created = client.post("/api/files/create", json={"path": "src/main.py", "type": "file"})
    assert created.status_code == 200

    written = client.put("/api/files/content", json={"path": "src/main.py", "content": "print(1)\n"})
    assert written.json()["size"] == 9

    read = client.get("/api/files/content", params={"path": "src/main.py"})
    assert read.json()["content"] == "print(1)\n"

    tree = client.get("/api/files/tree").json()["tree"]
    assert tree[0]["name"] == "src"
    assert tree[0]["children"][0]["path"] == "src/main.py"

    renamed = client.post("/api/files/rename", json={"from": "src/main.py", "to": "src/app.py"})
    assert renamed.json()["path"] == "src/app.py"

    duplicated = client.post("/api/files/duplicate", json={"path": "src/app.py"})
    assert duplicated.json()["path"] == "src/app copy.py"

    deleted = client.post("/api/files/delete", json={"path": "src/app copy.py"})
    assert deleted.status_code == 200


def test_traversal_is_rejected(client: TestClient) -> None:
    for request in (
        client.get("/api/files/content", params={"path": "../package.json"}),
        client.put("/api/files/content", json={"path": "../evil.txt", "content": "x"}),
        client.post("/api/files/delete", json={"path": "../../etc"}),
    ):
        assert request.status_code == 400
        assert "escapes the workspace" in request.json()["error"]


def test_upload_and_limit(client: TestClient) -> None:
    import base64

    payload = base64.b64encode(b"\x00\x01\x02").decode()
    response = client.put("/api/files/upload", json={"path": "assets/x.bin", "base64": payload})
    assert response.status_code == 200
    assert response.json()["size"] == 3

    empty = client.put("/api/files/upload", json={"path": "assets/y.bin", "base64": ""})
    assert empty.status_code == 400


def test_search(client: TestClient) -> None:
    client.put("/api/files/content", json={"path": "a.py", "content": "needle here\nother\n"})
    client.put("/api/files/content", json={"path": "b.py", "content": "nothing\n"})

    result = client.get("/api/files/search", params={"q": "needle"}).json()
    assert result["matches"][0]["path"] == "a.py"
    assert result["matches"][0]["line"] == 1


def test_git_flow_over_http(client: TestClient) -> None:
    client.post("/api/git/init")
    client.put("/api/files/content", json={"path": "app.py", "content": "x = 1\n"})

    committed = client.post(
        "/api/git/commit",
        json={"message": "first", "stageAll": True, "name": "T", "email": "t@example.com"},
    )
    assert committed.status_code == 200

    client.put("/api/files/content", json={"path": "app.py", "content": "x = 2\n"})
    diff = client.get("/api/git/diff", params={"path": "app.py"}).json()
    assert diff["oldContent"] == "x = 1\n"
    assert diff["newContent"] == "x = 2\n"

    branch = client.post("/api/git/branch", json={"name": "feature"}).json()
    assert branch["current"] == "feature"

    discarded = client.post("/api/git/discard", json={"paths": ["app.py"]})
    assert discarded.status_code == 200


def test_ai_requires_configuration(client: TestClient) -> None:
    response = client.get("/api/ai/models", params={"provider": "gemini"})
    if settings.providers["gemini"].api_key:
        pytest.skip("a Gemini key is configured in this environment")
    assert response.status_code == 400
    assert "not configured" in response.json()["error"]


def test_auth_guard(workspace: pathlib.Path) -> None:
    original = settings.access_token
    object.__setattr__(settings, "access_token", "s3cret")
    try:
        client = TestClient(app)
        assert client.get("/api/files/tree").status_code == 401
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/files/tree", headers={"x-safari-token": "s3cret"}).status_code == 200
        assert client.get("/api/files/tree", params={"token": "s3cret"}).status_code == 200
    finally:
        object.__setattr__(settings, "access_token", original)


def test_spa_fallback(client: TestClient) -> None:
    response = client.get("/some/deep/link")

    if (settings.dist_dir / "index.html").is_file():
        # A build exists, so deep links get the SPA shell.
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
    else:
        assert response.status_code == 404
        assert "not been built" in response.json()["error"]


def test_pty_websocket_requires_token(workspace: pathlib.Path) -> None:
    from starlette.websockets import WebSocketDisconnect

    original = settings.access_token
    object.__setattr__(settings, "access_token", "s3cret")
    try:
        client = TestClient(app)
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/pty"):
                pass
    finally:
        object.__setattr__(settings, "access_token", original)


def test_pty_websocket_streams_a_real_shell(workspace: pathlib.Path) -> None:
    client = TestClient(app)
    with client.websocket_connect("/ws/pty?token=") as socket:
        ready = socket.receive_json()
        assert ready["type"] == "ready"

        socket.send_json({"type": "resize", "cols": 90, "rows": 24})
        socket.send_json({"type": "input", "data": "echo ws-$((2+2))\n"})

        output = ""
        for _ in range(80):
            message = socket.receive_json()
            if message["type"] == "output":
                output += message["data"]
                if "ws-4" in output:
                    break
        assert "ws-4" in output


def test_pty_websocket_rejects_cross_origin(workspace: pathlib.Path) -> None:
    from starlette.websockets import WebSocketDisconnect

    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/pty", headers={"origin": "http://evil.example"}):
            pass
