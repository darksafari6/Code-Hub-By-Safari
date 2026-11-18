"""FastAPI application: HTTP API, preview server, SPA host and PTY websocket.

This is the Linux-native counterpart of the Node server. The wire contract is
identical, which is why the existing React client works against both. Where the
two differ, Python offers strictly more: a real PTY terminal and real git.
"""

from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import pathlib
import platform
import sys
import time
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse

from . import ai, files, gitrepo
from .config import settings
from .paths import (
    ApiError,
    bad_request,
    is_ignored_name,
    normalize_relative,
    resolve_in_root,
)
from .pty_session import PtySession

STARTED_AT = time.time()
PUBLIC_PATHS = frozenset({"/api/health"})

app = FastAPI(
    title="Safari AI Dev Studio",
    version=settings.version,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


@app.middleware("http")
async def guard(request: Request, call_next):  # type: ignore[no-untyped-def]
    path = request.url.path

    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.limits.max_body_bytes:
        return JSONResponse(
            {
                "error": "Request body is too large. "
                f"The limit is {settings.limits.max_body_bytes // (1024 * 1024)} MB."
            },
            status_code=413,
        )

    protected = path.startswith("/api") or path.startswith("/preview")
    if protected and path not in PUBLIC_PATHS and settings.access_token:
        supplied = request.headers.get("x-safari-token") or request.query_params.get("token")
        if supplied != settings.access_token:
            return JSONResponse({"error": "Unauthorised"}, status_code=401)

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, error: ApiError) -> JSONResponse:
    return JSONResponse({"error": error.message}, status_code=error.status)


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Request, error: Exception) -> JSONResponse:
    print(f"[api] unhandled error: {error!r}", file=sys.stderr)
    return JSONResponse({"error": "Unexpected server error"}, status_code=500)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def json_body(request: Request) -> dict[str, Any]:
    raw = await request.body()
    if not raw:
        raise bad_request("A JSON body is required")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ApiError(400, "Request body is not valid JSON") from error
    if not isinstance(parsed, dict):
        raise bad_request("A JSON object is required")
    return parsed


def require_string(body: dict[str, Any], key: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value:
        raise bad_request(f"`{key}` is required")
    return value


def require_value(body: dict[str, Any], key: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise bad_request(f"`{key}` is required")
    return value.strip()


def cli_paths(body: dict[str, Any]) -> list[str]:
    paths = body.get("paths")
    if not isinstance(paths, list) or not paths or not all(isinstance(p, str) for p in paths):
        raise bad_request("`paths` must be a non-empty array of strings")
    return paths


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": settings.version,
        "runtime": f"python {platform.python_version()}",
        "uptimeSeconds": int(time.time() - STARTED_AT),
    }


@app.get("/api/system/info")
async def system_info() -> dict[str, Any]:
    try:
        empty = not any(
            not is_ignored_name(entry.name) for entry in os.scandir(settings.workspace)
        )
    except OSError:
        empty = False

    return {
        "version": settings.version,
        "workspace": settings.workspace.name,
        "workspacePath": str(settings.workspace),
        "platform": platform.system().lower(),
        "arch": platform.machine(),
        "runtime": f"Python {platform.python_version()}",
        "workspaceEmpty": empty,
        "gitRepository": gitrepo.is_repo(),
        "authEnabled": bool(settings.access_token),
        "providers": [
            {key: provider[key] for key in ("id", "label", "model", "configured")}
            for provider in ai.provider_list()
        ],
        "capabilities": {
            "terminal": "pty",
            "git": "cli",
            "sshRemotes": True,
            "shell": os.environ.get("SHELL") or "/bin/bash",
        },
    }


@app.get("/api/system/stats")
async def system_stats() -> dict[str, Any]:
    memory_total = 0
    memory_available = 0
    try:
        with open("/proc/meminfo", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("MemTotal:"):
                    memory_total = int(line.split()[1]) * 1024
                elif line.startswith("MemAvailable:"):
                    memory_available = int(line.split()[1]) * 1024
    except OSError:
        pass

    load = os.getloadavg() if hasattr(os, "getloadavg") else (0.0, 0.0, 0.0)
    return {
        "cpuCount": os.cpu_count() or 1,
        "loadAverage": load[0],
        "memoryUsedBytes": max(memory_total - memory_available, 0),
        "memoryTotalBytes": memory_total,
        "uptimeSeconds": int(time.time() - STARTED_AT),
        "platform": platform.system().lower(),
    }


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------


@app.get("/api/files/tree")
async def files_tree() -> dict[str, Any]:
    return {"tree": files.list_tree()}


@app.get("/api/files/content")
async def files_read(path: str = "") -> dict[str, Any]:
    return files.read_file(path)


@app.put("/api/files/content")
async def files_write(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return files.write_file(require_string(body, "path"), body.get("content", ""))


@app.post("/api/files/create")
async def files_create(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return files.create_entry(require_string(body, "path"), body.get("type"))


@app.post("/api/files/rename")
async def files_rename(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return files.rename_entry(require_string(body, "from"), require_string(body, "to"))


@app.post("/api/files/delete")
async def files_delete(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return files.delete_entry(require_string(body, "path"))


@app.post("/api/files/duplicate")
async def files_duplicate(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return files.duplicate_entry(require_string(body, "path"), body.get("to"))


@app.put("/api/files/upload")
async def files_upload(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return files.write_upload(require_string(body, "path"), body.get("base64"))


@app.get("/api/files/search")
async def files_search(q: str = "", caseSensitive: bool = False, path: str | None = None) -> dict[str, Any]:
    return files.search(q, case_sensitive=caseSensitive, raw_path=path)


# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------


@app.get("/api/git/status")
async def git_status() -> dict[str, Any]:
    return gitrepo.status()


@app.get("/api/git/log")
async def git_log() -> dict[str, Any]:
    return {"commits": gitrepo.log()}


@app.get("/api/git/branches")
async def git_branches() -> dict[str, Any]:
    return gitrepo.list_branches()


@app.get("/api/git/diff")
async def git_diff(path: str = "") -> dict[str, Any]:
    return gitrepo.diff(path)


@app.post("/api/git/init")
async def git_init() -> dict[str, Any]:
    return gitrepo.init()


@app.post("/api/git/clone")
async def git_clone(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    token = body.get("token") if isinstance(body.get("token"), str) else None
    return await asyncio.to_thread(
        gitrepo.clone,
        require_string(body, "url"),
        token,
        bool(body.get("replace")),
    )


@app.post("/api/git/stage")
async def git_stage(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    if body.get("all") is True:
        return gitrepo.stage(None)
    paths = body.get("paths")
    if isinstance(body.get("path"), str):
        paths = [body["path"]]
    if not isinstance(paths, list) or not paths:
        raise bad_request("Provide `all: true` or a `paths` array")
    return gitrepo.stage([normalize_relative(item) for item in paths])


@app.post("/api/git/unstage")
async def git_unstage(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    paths = body.get("paths")
    if not isinstance(paths, list) or not paths:
        raise bad_request("`paths` is required")
    return gitrepo.unstage([normalize_relative(item) for item in paths])


@app.post("/api/git/discard")
async def git_discard(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return gitrepo.discard([normalize_relative(item) for item in cli_paths(body)])


@app.post("/api/git/commit")
async def git_commit(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return gitrepo.commit(
        require_value(body, "message"),
        bool(body.get("stageAll")),
        body.get("name") if isinstance(body.get("name"), str) else None,
        body.get("email") if isinstance(body.get("email"), str) else None,
    )


@app.post("/api/git/push")
async def git_push(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    token = body.get("token")
    if not isinstance(token, str) or not token.strip():
        raise bad_request("A personal access token is required for HTTPS remotes")
    return await asyncio.to_thread(
        gitrepo.push,
        token.strip(),
        body.get("remote") if isinstance(body.get("remote"), str) else "origin",
        body.get("ref") if isinstance(body.get("ref"), str) else None,
        bool(body.get("force")),
    )


@app.post("/api/git/remote")
async def git_remote(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return gitrepo.set_remote(require_string(body, "url"))


@app.post("/api/git/branch")
async def git_branch(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return gitrepo.create_branch(
        require_string(body, "name"), bool(body.get("checkout", True))
    )


@app.post("/api/git/checkout")
async def git_checkout(request: Request) -> dict[str, Any]:
    body = await json_body(request)
    return gitrepo.checkout_branch(require_string(body, "name"))


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------


LIMITER = ai.RateLimiter(settings.limits.ai_rate_limit_per_minute)


@app.get("/api/ai/providers")
async def ai_providers() -> dict[str, Any]:
    return {"providers": ai.provider_list()}


@app.get("/api/ai/models")
async def ai_models(provider: str = "") -> dict[str, Any]:
    return {"provider": provider, "models": await ai.list_models(provider)}


@app.post("/api/ai/chat")
async def ai_chat(request: Request) -> Response:
    body = await json_body(request)
    client_key = request.client.host if request.client else "unknown"
    await LIMITER.check(client_key)

    messages = body.get("messages")
    if not isinstance(messages, list):
        raise bad_request("`messages` must be an array")

    system = body.get("system")
    temperature = body.get("temperature")
    max_tokens = body.get("maxTokens")
    model = body.get("model")

    async def events():
        try:
            async for delta in ai.stream_chat(
                body.get("provider"),
                messages,
                model=model if isinstance(model, str) else None,
                system=system if isinstance(system, str) else None,
                temperature=float(temperature) if isinstance(temperature, (int, float)) else None,
                max_tokens=int(max_tokens) if isinstance(max_tokens, (int, float)) else None,
            ):
                yield f"data: {json.dumps({'delta': delta})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except ApiError as error:
            yield f"data: {json.dumps({'error': error.message})}\n\n"
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001 - surfaced to the client
            yield f"data: {json.dumps({'error': f'AI request failed: {error}'})}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Preview + SPA
# ---------------------------------------------------------------------------


def _preview_target(raw_path: str) -> pathlib.Path:
    relative = normalize_relative(raw_path)
    segments = relative.split("/") if relative else []
    if any(is_ignored_name(segment) for segment in segments):
        raise ApiError(404, "Not found")

    target = resolve_in_root(relative, must_exist=True)
    if target.is_dir():
        index = target / "index.html"
        if index.is_file():
            return index
        raise ApiError(404, "Not found")
    return target


@app.get("/preview")
@app.get("/preview/")
async def preview_index() -> FileResponse:
    return FileResponse(_preview_target(""))


@app.get("/preview/{path:path}")
async def preview_file(path: str) -> Response:
    try:
        target = _preview_target(path)
    except ApiError as error:
        return JSONResponse({"error": error.message}, status_code=error.status)

    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(target, media_type=media_type)


@app.get("/{full_path:path}")
async def spa(full_path: str) -> Response:
    if full_path.startswith(("api/", "preview/", "ws/")):
        return JSONResponse({"error": "Not found"}, status_code=404)

    dist = settings.dist_dir
    if full_path:
        candidate = (dist / full_path).resolve()
        if candidate.is_file() and (candidate == dist or dist in candidate.parents):
            return FileResponse(candidate, media_type=mimetypes.guess_type(candidate.name)[0])

    index = dist / "index.html"
    if index.is_file():
        return FileResponse(index)

    return JSONResponse(
        {
            "error": (
                "The client bundle has not been built. Run `npm run build`, or use "
                "`./scripts/dev.sh` which serves the Vite dev server in front of this API."
            )
        },
        status_code=404,
    )


# ---------------------------------------------------------------------------
# Terminal websocket (real PTY)
# ---------------------------------------------------------------------------


def _ws_token_ok(websocket: WebSocket) -> bool:
    if not settings.access_token:
        return True
    supplied = websocket.query_params.get("token") or websocket.headers.get("x-safari-token")
    return supplied == settings.access_token


def _origin_ok(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        return True
    host = websocket.headers.get("host")
    try:
        return origin.split("://", 1)[1] == host
    except IndexError:
        return False


@app.websocket("/ws/pty")
async def pty_endpoint(websocket: WebSocket) -> None:
    if not _origin_ok(websocket) or not _ws_token_ok(websocket):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    send_lock = asyncio.Lock()

    session = PtySession(str(settings.workspace))
    try:
        session.start()
    except Exception as error:  # noqa: BLE001 - surface to the client
        await websocket.send_json({"type": "error", "message": f"Could not start a shell: {error}"})
        await websocket.close()
        return

    await websocket.send_json({"type": "ready", "cwd": str(settings.workspace), "pid": session.pid})

    async def pump() -> None:
        async for kind, payload in session.events():
            async with send_lock:
                if kind == "output":
                    await websocket.send_json({"type": "output", "data": payload})
                else:
                    await websocket.send_json({"type": "exit", "code": payload})
                    return

    pump_task = asyncio.create_task(pump())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue

            kind = message.get("type")
            if kind == "input":
                data = message.get("data")
                if isinstance(data, str):
                    session.write(data)
            elif kind == "resize":
                cols = message.get("cols")
                rows = message.get("rows")
                if isinstance(cols, int) and isinstance(rows, int):
                    session.resize(cols, rows)
            elif kind == "ping":
                async with send_lock:
                    await websocket.send_json({"type": "pong"})
            elif kind == "restart":
                pump_task.cancel()
                session.close()
                session = PtySession(str(settings.workspace))
                session.start()
                await websocket.send_json({"type": "ready", "cwd": str(settings.workspace)})
                pump_task = asyncio.create_task(pump())
    except WebSocketDisconnect:
        pass
    finally:
        pump_task.cancel()
        session.close()
