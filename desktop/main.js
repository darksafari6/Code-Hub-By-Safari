const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // In production, load the built files. For dev, load localhost.
  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);
