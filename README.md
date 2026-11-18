# Safari AI Dev Studio

A local-first AI development workspace that runs in your browser (or as a desktop
app). It combines a code editor, file explorer, real terminal, git client and an
AI assistant that can see the file you are working on.

Everything runs on your machine: the web UI talks to a small Node server that
owns the workspace folder. API keys never leave the server.

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│ Explorer     │ Editor (Monaco)               │ Assistant /      │
│ Search       │                               │ Preview          │
│ Source Ctrl  ├───────────────────────────────┤                  │
│              │ Terminal · Problems           │                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

## Features

- **Editor** — Monaco with TypeScript/JSON/CSS/HTML IntelliSense, multi-tab
  editing, unsaved-change tracking, explicit save (`Ctrl/Cmd + S`) or auto-save.
- **Explorer** — create, rename and delete files and folders, context menus,
  ignored `node_modules`/`dist`/`.git` and friends.
- **Search** — fast literal search across the workspace with per-file grouping
  and jump-to-line.
- **Terminal** — a real shell session over WebSocket: streaming output, command
  history, `Ctrl+C` interrupt, working directory tracking, output limits.
- **Source control** — initialise, clone (public or token), stage/unstage,
  commit and push with isomorphic-git. No git binary required.
- **Assistant** — streaming chat with Google Gemini, DeepSeek or any
  OpenAI-compatible endpoint. Sends the active file as context and renders code
  blocks with a copy button.
- **Preview** — serves the workspace statically at `/preview/` and reloads on
  save.
- **Problems** — live diagnostics from Monaco's TypeScript/JSON/CSS/HTML
  services.
- **Command palette** — `Ctrl/Cmd + K`, plus quick open and keyboard shortcuts.
- **Desktop app** — optional Electron shell that starts the server for you.

## Quick start

Requirements: **Node.js 20.11+** (22 recommended).

```bash
git clone https://github.com/darksafari6/Code-Hub-By-Safari.git
cd Code-Hub-By-Safari
npm install
cp .env.example .env      # optional: add an AI provider key
npm run dev
```

Open <http://localhost:3000>. The `workspace/` folder is the project you are
editing — replace it with your code or point `WORKSPACE_DIR` somewhere else.

### Enabling the assistant

Add **one** of these to `.env` and restart the server:

```ini
GEMINI_API_KEY=...          # Google AI Studio
DEEPSEEK_API_KEY=...        # DeepSeek
OPENAI_API_KEY=...          # OpenAI or any compatible endpoint
OPENAI_BASE_URL=https://api.openai.com/v1
```

Without a key the rest of the IDE works normally; the assistant explains what is
missing instead of failing silently.

## Configuration

| Variable             | Default                     | Purpose                                        |
| -------------------- | --------------------------- | ---------------------------------------------- |
| `PORT`               | `3000`                      | HTTP port                                      |
| `HOST`               | `0.0.0.0`                   | Bind address                                   |
| `WORKSPACE_DIR`      | `./workspace`               | Folder the IDE edits                           |
| `SAFARI_ACCESS_TOKEN`| unset                       | Require a token for API/terminal access        |
| `GEMINI_API_KEY`     | unset                       | Gemini provider                                |
| `GEMINI_MODEL`       | `gemini-2.5-flash`          | Gemini model id                                |
| `DEEPSEEK_API_KEY`   | unset                       | DeepSeek provider                              |
| `DEEPSEEK_MODEL`     | `deepseek-chat`             | DeepSeek model id                              |
| `OPENAI_API_KEY`     | unset                       | OpenAI-compatible provider                     |
| `OPENAI_BASE_URL`    | `https://api.openai.com/v1` | Endpoint base URL (Ollama, OpenRouter, Groq…)  |
| `OPENAI_MODEL`       | `gpt-4o-mini`               | Model id                                       |

## Scripts

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Development server with Vite middleware and hot reload    |
| `npm run build`      | Production build (`dist/` + `dist-server/`)               |
| `npm start`          | Run the production build                                  |
| `npm run typecheck`  | Strict TypeScript check across client and server          |
| `npm test`           | Unit tests (Vitest)                                       |
| `npm run desktop`    | Open the Electron shell (expects a dev server)            |
| `npm run dist:desktop` | Build AppImage / .deb into `release/`                   |

## Security model

Running a terminal in a web UI needs care. What this project does:

- **Path safety** — every file operation resolves through
  `server/lib/safe-path.ts`, which rejects `..` traversal, NUL bytes and symlink
  escapes. Only paths inside `WORKSPACE_DIR` are reachable.
- **`.git` protection** — the generic file API cannot write into `.git`.
- **Terminal scoping** — commands run with the workspace as their working
  directory, and `cd` cannot climb above it.
- **Secret isolation** — child processes receive an allow-listed environment
  (`PATH`, `HOME`, `LANG`, …). `GEMINI_API_KEY`, `OPENAI_API_KEY` and friends are
  **not** visible to commands you run or code you execute.
- **No keys in the browser** — AI calls are proxied by the server; the client
  bundle contains no credentials.
- **Origin checks** — WebSocket upgrades must come from the same host, blocking
  cross-site socket hijacking.
- **Optional access token** — set `SAFARI_ACCESS_TOKEN` before exposing the IDE
  over a network. Requests need `x-safari-token: <token>`, `?token=<token>` or
  `Authorization: Bearer <token>`.
- **Limits** — request bodies, file size, command runtime, output size and search
  results are all capped.

Notes and limitations:

- The terminal is line-oriented, not a full TTY. Interactive programs such as
  `vim`, `top` or `ssh` will not render properly. Use a normal terminal for those.
- Clone and push work over HTTPS. SSH remotes are not supported by the bundled
  git implementation.
- Push requires a personal access token; it is used for that request only and is
  not persisted.

## Desktop app

```bash
npm run build
npm run dist:desktop        # -> release/*.AppImage, release/*.deb
```

The packaged app starts the bundled server on port 3000 and stores its workspace
in `~/Documents/SafariWorkspace` (override with `WORKSPACE_DIR`).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map, HTTP API and
terminal protocol. In short:

```
server/            Express app, services, WebSocket terminal
  lib/             files, git, terminal, ai, path safety
  routes/          files, git, ai, system
src/               React client
  hooks/           settings, workspace, git, chat, hotkeys, diagnostics
  components/      layout, editor, panels, chat, terminal, ui
tests/             Vitest unit tests for the tricky pure logic
```

## Troubleshooting

**`npm run build` runs out of memory.** Monaco is large; the build script already
raises the heap to 3 GB. Close other processes or lower the constant in
`scripts/build-web.mjs`.

**The terminal says “disconnected”.** The server restarted (tsx watch) — use the
reconnect button in the panel toolbar, or reload the page.

**The assistant returns 401.** The provider rejected the key. Check `.env`, then
restart the server so the new value is loaded.

**Preview is blank.** `/preview/` serves the workspace root; add an `index.html`
there, or open a file path directly (e.g. `/preview/docs/index.html`).

**Port 3000 is taken.** Set `PORT=3001` in `.env` and restart.

## License

MIT
