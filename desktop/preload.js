// The small set of things the game may ask the desktop app to do. The game sees this as window.nrtDesktop.
// The app checks that each call comes from the bundled game file before acting on it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nrtDesktop', {
  info: () => ipcRenderer.invoke('nrt:info'),
  quit: () => ipcRenderer.invoke('nrt:quit'),
  toggleFullscreen: () => ipcRenderer.invoke('nrt:fullscreen'),
});
