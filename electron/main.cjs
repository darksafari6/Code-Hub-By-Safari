'use strict';

const { app, BrowserWindow, Menu, shell } = require('electron');
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

/** Every native menu item sends a stable id that mirrors src/App.tsx. */
function sendMenuCommand(id) {
  const target = BrowserWindow.getFocusedWindow() ?? mainWindow;
  target?.webContents.send('safari:menu', id);
}

function menuItem(id, label, accelerator, extra = {}) {
  return {
    label,
    ...(accelerator ? { accelerator } : {}),
    click: () => sendMenuCommand(id),
    ...extra,
  };
}

function buildApplicationMenu() {
  const separator = { type: 'separator' };

  const template = [
    {
      label: 'File',
      submenu: [
        menuItem('file.newFile', 'New File…', 'CmdOrCtrl+N'),
        menuItem('file.newFolder', 'New Folder…', 'CmdOrCtrl+Shift+N'),
        menuItem('file.open', 'Open File…', 'CmdOrCtrl+P'),
        menuItem('file.upload', 'Upload Files…'),
        separator,
        menuItem('file.save', 'Save', 'CmdOrCtrl+S'),
        menuItem('file.saveAll', 'Save All', 'CmdOrCtrl+Shift+S'),
        separator,
        menuItem('file.close', 'Close Editor', 'CmdOrCtrl+W'),
        menuItem('file.closeAll', 'Close All Editors'),
        menuItem('file.closeOthers', 'Close Other Editors'),
        separator,
        menuItem('file.download', 'Download Active File'),
        separator,
        menuItem('file.settings', 'Settings', 'CmdOrCtrl+,'),
        separator,
        { role: 'quit', label: 'Quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        menuItem('edit.undo', 'Undo', 'CmdOrCtrl+Z'),
        menuItem('edit.redo', 'Redo', 'CmdOrCtrl+Shift+Z'),
        separator,
        menuItem('edit.find', 'Find…', 'CmdOrCtrl+F'),
        menuItem('edit.replace', 'Replace…', 'CmdOrCtrl+H'),
        separator,
        menuItem('edit.comment', 'Toggle Line Comment', 'CmdOrCtrl+/'),
        menuItem('edit.format', 'Format Document', 'Shift+Alt+F'),
        separator,
        menuItem('edit.duplicateLine', 'Duplicate Line'),
        menuItem('edit.moveLineUp', 'Move Line Up'),
        menuItem('edit.moveLineDown', 'Move Line Down'),
      ],
    },
    {
      label: 'Selection',
      submenu: [
        menuItem('selection.all', 'Select All', 'CmdOrCtrl+A'),
        menuItem('selection.expand', 'Expand Selection', 'Shift+Alt+Right'),
        menuItem('selection.addCursor', 'Add Cursor Below', 'CmdOrCtrl+Alt+Down'),
        separator,
        menuItem('selection.copy', 'Copy', 'CmdOrCtrl+C'),
        menuItem('selection.cut', 'Cut', 'CmdOrCtrl+X'),
        menuItem('selection.paste', 'Paste', 'CmdOrCtrl+V'),
        separator,
        menuItem('selection.askAssistant', 'Ask Assistant About Selection'),
        menuItem('selection.insertLast', 'Insert Assistant Code at Cursor'),
      ],
    },
    {
      label: 'View',
      submenu: [
        menuItem('view.explorer', 'Explorer', 'CmdOrCtrl+Shift+E'),
        menuItem('view.search', 'Search', 'CmdOrCtrl+Shift+F'),
        menuItem('view.git', 'Source Control', 'CmdOrCtrl+Shift+G'),
        separator,
        menuItem('view.sidebar', 'Toggle Sidebar', 'CmdOrCtrl+B'),
        menuItem('view.panel', 'Toggle Bottom Panel', 'CmdOrCtrl+J'),
        menuItem('view.assistant', 'Toggle AI Assistant', 'CmdOrCtrl+Alt+A'),
        menuItem('view.preview', 'Toggle Preview', 'CmdOrCtrl+Shift+V'),
        separator,
        menuItem('view.wordWrap', 'Word Wrap'),
        menuItem('view.minimap', 'Minimap'),
        separator,
        menuItem('view.themeDark', 'Dark Theme'),
        menuItem('view.themeLight', 'Light Theme'),
        separator,
        menuItem('view.palette', 'Command Palette…', 'CmdOrCtrl+Shift+P'),
        separator,
        { role: 'reload', label: 'Reload Window' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
        { role: 'togglefullscreen', label: 'Full Screen', accelerator: 'F11' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        menuItem('go.file', 'Go to File…', 'CmdOrCtrl+P'),
        menuItem('go.line', 'Go to Line…', 'CmdOrCtrl+G'),
        menuItem('go.symbol', 'Go to Symbol…', 'CmdOrCtrl+Shift+O'),
        menuItem('go.definition', 'Go to Definition', 'F12'),
        separator,
        menuItem('go.problems', 'Problems'),
        menuItem('go.diff', 'Show Working Tree Diff'),
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        menuItem('terminal.toggle', 'Toggle Terminal'),
        menuItem('terminal.new', 'Restart Session'),
        menuItem('terminal.clear', 'Clear Terminal'),
        separator,
        menuItem('terminal.problems', 'Problems'),
        separator,
        menuItem('terminal.preview', 'Open Preview in Browser'),
        menuItem('terminal.reloadPreview', 'Reload Preview'),
      ],
    },
    {
      label: 'AI',
      submenu: [
        menuItem('ai.assistant', 'Focus Assistant', 'CmdOrCtrl+Alt+A'),
        menuItem('ai.explain', 'Explain Selection'),
        menuItem('ai.review', 'Review Current File'),
        menuItem('ai.tests', 'Generate Tests'),
        menuItem('ai.refactor', 'Refactor Current File'),
        separator,
        menuItem('ai.model', 'Choose Model…'),
        menuItem('ai.clear', 'Clear Conversation'),
      ],
    },
    {
      label: 'Help',
      submenu: [
        menuItem('help.shortcuts', 'Keyboard Shortcuts', 'F1'),
        menuItem('help.docs', 'Documentation'),
        menuItem('help.issues', 'Report an Issue'),
        separator,
        menuItem('help.about', 'About Safari AI Dev Studio'),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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
  buildApplicationMenu();

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
