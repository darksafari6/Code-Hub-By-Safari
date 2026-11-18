# Architecture

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

`npm run typecheck` runs TypeScript in `strict` mode across client and server;
CI runs typecheck, tests, build and an HTTP smoke test (including a traversal
attempt that must fail).

## Desktop bridge

`electron/main.cjs` builds a native `Menu` whose items never contain their own
logic: each one sends the id of the matching in-app command over
`webContents.send('safari:menu', id)`. `electron/preload.cjs` exposes that stream
as `window.safariDesktop.onMenuCommand(cb)` inside a sandboxed, context-isolated
renderer. `src/App.tsx` builds `menus: MenuDef[]` once per render and stores an
id → action map in a ref, so the native menu and the in-app menu bar execute the
same functions without duplicating code.

The packaged app spawns `dist-server/index.js` with the user's workspace
directory and waits for `/api/health` before loading the UI. If the bundle is
missing it fails loudly instead of showing an empty window.
