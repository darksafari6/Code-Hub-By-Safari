# Architecture

## Two runtimes, one contract

The application is a React/Monaco frontend plus a backend that owns the
workspace. The backend now has two implementations that speak the same HTTP and
WebSocket contract:

| | Python (`python/safari/`) | Node (`server/`) |
| --- | --- | --- |
| Status | **primary** | compatibility backend |
| Started by | `./scripts/dev.sh`, `npm start` | `npm run dev:node`, `npm run start:node` |
| Terminal | real PTY (`pty.fork()`) | line-oriented subprocess |
| Git | the `git` CLI | isomorphic-git |
| SSH remotes | yes | no |
| Extra dependencies | FastAPI, uvicorn, httpx, python-dotenv | npm packages |

The frontend reads `/api/system/info` and switches terminal protocol on
`capabilities.terminal` (`pty` → `/ws/pty`, `line` → `/ws/terminal`). That keeps
one client working against both servers without feature flags in the UI code.

### Python package map

```
python/safari/
  config.py       environment, limits, provider registry, ignore lists
  paths.py        ApiError types, the path jail, allow-listed child env
  files.py        tree, read/write, create, rename, delete, duplicate, upload, search
  gitrepo.py      git CLI wrapper: status/log/diff/branches/commit/push/discard
  pty_session.py  forkpty session, output queue, resize, process-group teardown
  ai.py           Gemini + OpenAI-compatible streaming, model discovery, rate limit
  app.py          FastAPI routes, auth guard, preview server, SPA host, /ws/pty
  desktop.py      GTK3/WebKit2 → GTK4/WebKit6 → browser shell, --server-only
  launcher.py     PyInstaller entry point (delegates to desktop.main)
  __main__.py     `python -m safari`
python/tests/     pytest: path jail, git, PTY, HTTP contract, websocket auth,
                  desktop shell helpers
```

### Bash tooling

`scripts/install.sh` creates `.venv` and installs both dependency sets;
`scripts/dev.sh` runs the API and Vite with the proxy and cleans up both on exit;
`scripts/run.sh` builds the UI and serves everything from Python;
`scripts/test.sh` runs pytest, vitest and `tsc`; `scripts/package-linux.sh`
builds the portable bundle described below. The `Makefile` exposes the same
commands as `make install|dev|run|test|lint|package`.

### PTY websocket protocol

```
client → server: {"type":"input","data":"ls\r"}
                 {"type":"resize","cols":120,"rows":32}
                 {"type":"ping"} | {"type":"restart"}
server → client: {"type":"ready","cwd":"/path","pid":1234}
                 {"type":"output","data":"…"}      # raw terminal bytes, UTF-8
                 {"type":"exit","code":0}
                 {"type":"error","message":"…"}
```

`pty.fork()` allocates a kernel PTY, so curses applications and ANSI colour work
without translation. Output is read by a thread and delivered through a
thread-safe queue, keeping the event loop free of blocking reads. On disconnect
the whole process group receives SIGHUP → SIGTERM → SIGKILL.

Safari AI Dev Studio is two programs in one repository:

1. a **Node server** that owns the workspace (files, git, shell, AI proxying);
2. a **React client** that renders the IDE and talks to the server over HTTP +
   one WebSocket.

In development the server also hosts Vite as middleware, so there is a single
process and a single port. In production it serves the pre-built `dist/` bundle.

```
Browser ──HTTP──▶ /api/files/*   ──▶ files.ts   ──▶ safe-path.ts ──▶ disk
        ──HTTP──▶ /api/git/*     ──▶ git.ts     ──▶ isomorphic-git
        ──HTTP──▶ /api/ai/*      ──▶ ai.ts      ──▶ Gemini / OpenAI-compatible
        ──HTTP──▶ /api/system/*  ──▶ os metrics
        ──WS────▶ /ws/terminal   ──▶ terminal.ts ──▶ bash (workspace cwd)
```

## Desktop shell and packaging

The release artifact is `dist-linux/SafariAIDevStudio-<version>-<arch>.tar.gz`,
produced by `scripts/package-linux.sh`:

```
SafariAIDevStudio-3.1.0-x86_64/
  safari-ai-dev-studio   Bash launcher: checks python3 >= 3.11, exports
                         SAFARI_PACKAGED/SAFARI_ROOT/PYTHONPATH, execs
                         `python -m safari.desktop`
  install.sh             Bash installer: desktop entry, hicolor icons,
                         ~/.local/bin symlink, icon/desktop database refresh
  python/safari/         the application (same code as the source tree)
  vendor/                fastapi, starlette, uvicorn, httpx, python-dotenv
  dist/                  the compiled client bundle
  share/                 .desktop entry + 48/128/256/512 PNGs + SVG
```

`dist-linux/SafariAIDevStudio.AppDir` holds the same tree with an `AppRun`,
ready for `appimagetool`. No step of the build or run touches Node except
compiling the client.

Startup order in `python/safari/desktop.py`:

1. probe the port (`_port_available`) and exit 1 with a message if it is taken;
2. run `uvicorn.Server` in a daemon thread, wait for `/api/health` (25 s budget);
3. print the URL and workspace path — visible in a terminal, and the reason
   `--server-only` works over SSH;
4. open the first shell that exists: GTK3+WebKit2 → GTK4+WebKit6 → browser.

`decide-policy` sends every navigation whose URI does not start with the app URL
to `webbrowser.open()` and cancels it inside the window, so docs links never
replace the app.

### Config truth table

| Situation | `ROOT` | workspace default | version source |
| --- | --- | --- | --- |
| source checkout | repo root | `<repo>/workspace` | `package.json` |
| portable bundle (`SAFARI_PACKAGED=1`) | bundle dir | `~/SafariWorkspace` | `<bundle>/package.json` |
| PyInstaller (`sys.frozen`) | `sys._MEIPASS` | `~/SafariWorkspace` | `safari/__init__.__version__` |

`WORKSPACE_DIR` overrides the workspace in all three cases. Packaged installs
also read `~/.config/safari-ai-dev-studio/.env` after the local `.env`.

### Single-file binary

`packaging/safari-dev-studio.spec` bundles interpreter + server + UI through
PyInstaller (`console=True`, `--add-data dist:dist`). It requires a Python built
with `--enable-shared`; Debian/Ubuntu's `python3` is linked statically unless
`libpython3.X` is installed, which is why the portable bundle is the default
artifact.

## Server modules

| File | Responsibility |
| --- | --- |
| `server/index.ts` | HTTP server bootstrap, graceful shutdown |
| `server/app.ts` | Express wiring: JSON, auth, routes, preview, Vite/prod static, error handler |
| `server/config.ts` | Environment parsing, workspace creation, limits |
| `server/ws.ts` | WebSocket upgrade, origin/token checks, heartbeat, session lifecycle |
| `server/lib/safe-path.ts` | Path normalisation, root confinement, symlink checks |
| `server/lib/files.ts` | Tree listing, read/write (atomic), create/rename/delete, search |
| `server/lib/git.ts` | Status, init, clone, stage, commit, log, push |
| `server/lib/git-status.ts` | Pure `statusMatrix` → UI status mapping (unit tested) |
| `server/lib/terminal.ts` | Command session: cwd tracking, sanitised env, streaming, limits |
| `server/lib/ai.ts` | Provider registry, streaming chat, rate limiting |
| `server/lib/errors.ts` | `HttpError` and message extraction |
| `server/lib/http.ts` | Async route wrapper, zod body/query parsing |

Design decisions worth knowing:

- **Atomic writes.** Content goes to a temporary file in the same directory and is
  renamed into place, so a crash cannot leave a half-written file.
- **Symlink checks.** Lexical path checks are not enough — `resolveInRoot` also
  resolves the closest existing ancestor with `realpath` and re-checks
  containment.
- **Sanitised child environment.** The terminal builds an allow-listed env. This
  is what stops `echo $GEMINI_API_KEY` from leaking a key.
- **Process groups.** Commands spawn detached and signals are sent to `-pid`, so
  `Ctrl+C` also stops grandchildren.
- **Clone is transactional.** Repositories are cloned into `.safari/clone-*` and
  only moved into the workspace after success.
- **Streaming is plain SSE-style JSON lines.** No SDK on the client, so the
  assistant works with every provider and survives proxies.

## HTTP API

All endpoints are JSON. Errors are `{ "error": "message" }` with an appropriate
status code.

### Files

| Method | Path | Body / query | Result |
| --- | --- | --- | --- |
| GET | `/api/files/tree` | — | `{ tree: TreeNode[] }` |
| GET | `/api/files/content` | `?path=` | `{ path, content, size }` |
| PUT | `/api/files/content` | `{ path, content }` | `{ path, size }` |
| POST | `/api/files/create` | `{ path, type }` | `TreeNode` |
| POST | `/api/files/rename` | `{ from, to }` | `TreeNode` |
| POST | `/api/files/delete` | `{ path }` | `{ path }` |
| POST | `/api/files/duplicate` | `{ path, to? }` | `TreeNode` (picks `name copy.ext`) |
| PUT | `/api/files/upload` | `{ path, base64 }` | `{ path, size }` (8 MB cap) |
| GET | `/api/files/search` | `?q=&caseSensitive=&path=` | `{ query, matches, truncated }` |

### Git

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/git/status` | — | `GitStatus` |
| GET | `/api/git/log` | — | `{ commits }` |
| GET | `/api/git/branches` | — | `{ branches, current }` |
| GET | `/api/git/diff` | `?path=` | `{ path, oldContent, newContent, binary, truncated }` |
| POST | `/api/git/branch` | `{ name, checkout? }` | `{ branches, current }` |
| POST | `/api/git/checkout` | `{ name }` | `{ branches, current }` |
| POST | `/api/git/discard` | `{ paths }` | `GitStatus` |
| POST | `/api/git/init` | — | `GitStatus` |
| POST | `/api/git/clone` | `{ url, token?, replace? }` | `GitStatus` |
| POST | `/api/git/stage` | `{ all }` or `{ paths }` | `GitStatus` |
| POST | `/api/git/unstage` | `{ paths }` | `GitStatus` |
| POST | `/api/git/commit` | `{ message, stageAll?, name?, email? }` | `{ oid, status }` |
| POST | `/api/git/push` | `{ token, remote?, ref?, force? }` | `{ ok }` |
| POST | `/api/git/remote` | `{ url }` | `GitStatus` |

### AI

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/ai/providers` | — | `{ providers }` with `configured` flags |
| GET | `/api/ai/models` | `?provider=` | `{ provider, models: [{ id, label }] }` |
| POST | `/api/ai/chat` | `{ provider, messages, system?, temperature?, maxTokens? }` | event stream |

The chat response is `text/event-stream`, one JSON object per `data:` line:

```
data: {"delta":"Hello"}
data: {"delta":" there"}
data: {"done":true}
```

Failures arrive as `data: {"error":"…"}`, so the client can render the reason
inline. Requests are rate limited per IP (40/minute).

### System

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/health` | `{ status, version, uptimeSeconds }` (no auth) |
| GET | `/api/system/stats` | CPU count, load average, memory, uptime |
| GET | `/api/system/info` | version, workspace path, platform/arch/Node, git/auth flags, provider status |

## Terminal protocol

Single endpoint: `ws://<host>/ws/terminal`.

Client → server:

```json
{ "type": "exec", "command": "npm test" }
{ "type": "interrupt" }
```

Server → client (`TerminalEvent`):

```ts
{ type: 'ready', cwd: 'src' }
{ type: 'command', command: 'ls', cwd: 'src' }
{ type: 'stdout', data: '…' }
{ type: 'stderr', data: '…' }
{ type: 'exit', code: 0, signal: null, durationMs: 42 }
{ type: 'cwd', cwd: 'src/components' }
{ type: 'error', message: '…' }
{ type: 'clear' }
```

Builtins (`cd`, `clear`, `exit`) are handled by the session and always emit an
`exit` event, which is what tells the client to draw a new prompt.

## Client structure

- **State lives in hooks.** `useWorkspace` owns the file tree, open tabs and
  per-file buffers (so switching tabs never loses edits). `useGit`, `useChat`,
  `useSettings`, `useSystemInfo`, `useProblems` and `useHotkeys` are independent
  and testable.
- **No global store.** Hooks are called once in `App` and passed down. This keeps
  data flow obvious at the cost of some prop drilling.
- **Monaco is bundled**, not loaded from a CDN, so the IDE works offline. Only
  the languages the app needs are registered (`src/lib/monaco.ts`).
- **Settings persist** in `localStorage` and drive the editor, terminal and
  theme.
- **The preview iframe** reloads when you save a file, and keeps the access token
  in its query string when one is configured.

## Testing strategy

The pure logic that is easy to get wrong is extracted and unit tested:

- `server/lib/safe-path.ts` — traversal and symlink escapes;
- `server/lib/git-status.ts` — the `statusMatrix` mapping table;
- `server/lib/terminal.ts` — command tokenisation and cwd resolution;
- `server/lib/git.ts` — branch-name validation (rejects `..`, leading `-`, `.lock`);
- `src/lib/markdown.ts` — assistant message rendering;
- `src/lib/diff.ts` — the LCS line diff behind the diff viewer.

Python has its own suite (`python/tests`, 38 tests) covering the path jail
(including a symlink escape), file CRUD, the git parser against real
repositories, PTY behaviour (`/bin/sh` execution, working directory, window
size, exit codes, secret isolation), the HTTP contract through the ASGI app, and
websocket auth. `npm run typecheck` runs TypeScript in `strict` mode; CI runs
typecheck, vitest, the frontend build, `pytest`, and HTTP smoke tests for both
servers (each including a traversal attempt that must fail).

## Desktop bridge

`electron/main.cjs` builds a native `Menu` whose items never contain their own
logic: each one sends the id of the matching in-app command over
`webContents.send('safari:menu', id)`. `electron/preload.cjs` exposes that stream
as `window.safariDesktop.onMenuCommand(cb)` inside a sandboxed, context-isolated
renderer. `src/App.tsx` builds `menus: MenuDef[]` once per render and stores an
id → action map in a ref, so the native menu and the in-app menu bar execute the
same functions without duplicating code.

The packaged app starts the Python runtime when it can find one (`.venv`,
`SAFARI_PYTHON`, or `/usr/bin/python3` with the package on `PYTHONPATH`), waits
for `/api/health`, and otherwise falls back to the bundled Node server
(`dist-server/index.js` via `ELECTRON_RUN_AS_NODE`). If neither starts, it fails
loudly instead of showing an empty window.
