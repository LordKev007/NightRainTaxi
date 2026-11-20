// Night Rain Taxi desktop app (Windows and Steam Deck).
//
// The game itself is the single index.html, bundled inside the app. The app never downloads or runs
// any other game file: updates come from installing a new release (and, later, from Steam).
//
// Security setup, following Electron's security checklist:
//  - the Chromium sandbox stays on everywhere, including Linux and Steam Deck
//  - the game page has no Node access, runs in its own isolated world, and talks to the app only
//    through the four calls in preload.js, which accept calls only from the bundled game file
//  - the page can't navigate, open windows, open outside links, or get camera, microphone,
//    location or other permissions

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { fileURLToPath } = require('url');

app.enableSandbox();
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const gameFile = path.join(__dirname, 'game', 'index.html');

function versionOf(html) {
  const m = /const GAME_VERSION='([0-9.]+)'/.exec(html || '');
  return m ? m[1] : '0';
}
let gameVersion = '0';
try { gameVersion = versionOf(fs.readFileSync(gameFile, 'utf8')); } catch {}

function isSteamDeck() {
  return process.env.SteamDeck === '1' || /valve|neptune/i.test(os.release());
}

// Older versions of the app could download game updates into the app's data folder.
// That copy is never used now, so it is removed.
function removeOldDownloadedGame() {
  try { fs.rmSync(path.join(app.getPath('userData'), 'game'), { recursive: true, force: true }); } catch {}
}

let win = null;

// Only the main frame of the game window, showing the bundled game file, may call the app.
function isGameFile(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:' || u.search || u.hash) return false;
    const a = path.resolve(fileURLToPath(u)), b = path.resolve(gameFile);
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch { return false; }
}
function fromGame(event) {
  const f = event.senderFrame;
  return !!(win && f && event.sender === win.webContents && f === win.webContents.mainFrame && isGameFile(f.url));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, fullscreen: true, show: false,
    backgroundColor: '#04060b', autoHideMenuBar: true, title: 'Night Rain Taxi',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.setMenu(null);
  // no outside pages: block navigation, new windows and every other link
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-redirect', (e) => e.preventDefault());
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  win.loadFile(gameFile);
  win.once('ready-to-show', () => win.show());
}

ipcMain.handle('nrt:info', (e) => {
  if (!fromGame(e)) return null;
  return { appVersion: app.getVersion(), gameVersion, platform: process.platform, deck: isSteamDeck() };
});
ipcMain.handle('nrt:quit', (e) => { if (fromGame(e)) app.quit(); });
ipcMain.handle('nrt:fullscreen', (e) => { if (fromGame(e) && win) win.setFullScreen(!win.isFullScreen()); });

app.whenReady().then(() => {
  // deny every permission request (camera, microphone, location, notifications, MIDI...)
  // except fullscreen, which the game may ask for itself
  const allowed = (permission) => permission === 'fullscreen';
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(allowed(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allowed(permission));
  session.defaultSession.setDevicePermissionHandler(() => false);
  removeOldDownloadedGame();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
// no other process may open windows or web contents
app.on('web-contents-created', (e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (ev) => ev.preventDefault());
});
