// Night Rain Taxi desktop app (Windows and Steam Deck).
//
// The game itself is the single index.html. A copy is bundled inside the app so it always
// works offline. When asked, the app checks the GitHub Pages site for a newer index.html,
// saves it in the app's own data folder, and from then on starts whichever copy is newer.

const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SITE = 'https://lordkev007.github.io/NightRainTaxi/';

// AppImages on SteamOS cannot use Chromium's setuid sandbox, and the app only ever runs
// its own game file, so the sandbox is switched off on Linux.
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const bundledFile = path.join(__dirname, 'game', 'index.html');
const savedFile = () => path.join(app.getPath('userData'), 'game', 'index.html');

function versionOf(html) {
  const m = /const GAME_VERSION='([0-9.]+)'/.exec(html || '');
  return m ? m[1] : '0';
}
function compare(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
}
function readOrEmpty(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
// whichever copy of the game is newer: the one shipped with the app, or a downloaded update
function currentGame() {
  const bundled = readOrEmpty(bundledFile), saved = readOrEmpty(savedFile());
  if (saved && compare(versionOf(saved), versionOf(bundled)) > 0) return { file: savedFile(), version: versionOf(saved) };
  return { file: bundledFile, version: versionOf(bundled) };
}

function isSteamDeck() {
  return process.env.SteamDeck === '1' || /valve|neptune/i.test(os.release());
}

let win = null;
let fetched = null;   // the newest game file found online, held until the player chooses to update

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, fullscreen: true, show: false,
    backgroundColor: '#04060b', autoHideMenuBar: true, title: 'Night Rain Taxi',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.setMenu(null);
  win.loadFile(currentGame().file);
  win.once('ready-to-show', () => win.show());
  // links open in the normal web browser; the game window never navigates away
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

async function fetchLatest() {
  const res = await net.fetch(SITE + 'index.html?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('GitHub answered ' + res.status);
  const html = await res.text();
  if (!html.includes('id="gl"') || versionOf(html) === '0') throw new Error('the file online does not look like the game');
  return html;
}

ipcMain.handle('nrt:info', () => ({
  appVersion: app.getVersion(), gameVersion: currentGame().version,
  platform: process.platform, deck: isSteamDeck(),
}));

ipcMain.handle('nrt:check', async () => {
  try {
    const html = await fetchLatest();
    const latest = versionOf(html), newer = compare(latest, currentGame().version) > 0;
    fetched = newer ? html : null;
    return { newer, latest };
  } catch (e) {
    return { newer: false, error: String(e.message || e) };
  }
});

ipcMain.handle('nrt:update', async () => {
  try {
    const html = fetched || await fetchLatest();
    if (compare(versionOf(html), currentGame().version) <= 0) return { ok: false, error: 'already up to date' };
    fs.mkdirSync(path.dirname(savedFile()), { recursive: true });
    fs.writeFileSync(savedFile(), html, 'utf8');
    fetched = null;
    setTimeout(() => win && win.loadFile(currentGame().file), 300);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('nrt:quit', () => app.quit());
ipcMain.handle('nrt:fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
