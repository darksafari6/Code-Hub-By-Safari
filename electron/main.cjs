'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const DEV_URL = process.env.SAFARI_URL ?? 'http://localhost:3000';

/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

const PORT = Number(process.env.PORT ?? 3000);
const HOST = '127.0.0.1';

function workspaceDirectory() {
  if (process.env.WORKSPACE_DIR) return path.resolve(process.env.WORKSPACE_DIR);

  if (app.isPackaged) {
    const directory = path.join(app.getPath('documents'), 'SafariWorkspace');
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  return path.join(app.getAppPath(), 'workspace');
}

function resolveServerEntry() {
  const candidates = [
    path.join(app.getAppPath(), 'dist-server', 'index.js'),
    path.join(__dirname, '..', 'dist-server', 'index.js'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

async function waitForServer(url, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return true;
    } catch {
      // Server not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

function startServer() {
  const entry = resolveServerEntry();
  if (!entry) {
    throw new Error(
      'Production server bundle missing. Run `npm run build` before packaging the desktop app.',
    );
  }

  serverProcess = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOST,
      WORKSPACE_DIR: workspaceDirectory(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverProcess.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  serverProcess.on('exit', (code) => {
    console.log(`[server] exited with code ${code}`);
    serverProcess = null;
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b0d10',
    title: 'Safari AI Dev Studio',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // External links open in the user's browser, never inside the app shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  let target = DEV_URL;
  if (app.isPackaged) {
    startServer();
    target = `http://${HOST}:${PORT}`;
    const ready = await waitForServer(target);
    if (!ready) {
      throw new Error('The local server did not start in time. Check the terminal output.');
    }
  }

  await mainWindow.loadURL(target);
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error(error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});
