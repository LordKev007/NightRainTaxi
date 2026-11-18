// The small set of things the game may ask the desktop app to do. The game sees this as window.nrtDesktop.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nrtDesktop', {
  info: () => ipcRenderer.invoke('nrt:info'),
  check: () => ipcRenderer.invoke('nrt:check'),
  update: () => ipcRenderer.invoke('nrt:update'),
  quit: () => ipcRenderer.invoke('nrt:quit'),
  toggleFullscreen: () => ipcRenderer.invoke('nrt:fullscreen'),
});
