const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Safari AI Dev Studio",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Start the backend server
  const serverPath = path.join(__dirname, '../dist/server.js');
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
    if (data.toString().includes('Server running')) {
      mainWindow.loadURL('http://localhost:3000');
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  // Fallback if stdout doesn't catch it
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 3000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
