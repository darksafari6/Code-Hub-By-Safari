'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only bridge between the native shell and the web application. Native menu
 * clicks arrive here as stable ids; the renderer maps them onto real actions.
 */
contextBridge.exposeInMainWorld('safariDesktop', {
  platform: process.platform,
  version: process.versions.electron,
  onMenuCommand: (callback) => {
    if (typeof callback !== 'function') return () => undefined;
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('safari:menu', listener);
    return () => ipcRenderer.removeListener('safari:menu', listener);
  },
});
