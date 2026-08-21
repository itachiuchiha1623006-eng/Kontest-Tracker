/**
 * Widget window: frameless, always-on-top, skip-taskbar. Close and
 * minimize both hide to tray; quitting happens only via the tray menu.
 * Position/size persist (clamped into a visible display's work area).
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const settingsMod = require('./settings');
const { entryUrl } = require('./protocol');

let win = null;
let saveTimer = null;

function clampBounds(saved) {
  const width = Math.min(Math.max(saved.width || 340, 300), 1200);
  const height = Math.min(Math.max(saved.height || 520, 400), 2000);
  let x = Number.isFinite(Number(saved.x)) ? Number(saved.x) : null;
  let y = Number.isFinite(Number(saved.y)) ? Number(saved.y) : null;

  const display = (x !== null && y !== null)
    ? screen.getDisplayMatching({ x, y, width, height })
    : screen.getPrimaryDisplay();
  const area = display.workArea;

  if (x === null || y === null) {
    // First run: top-right corner with a small margin.
    x = area.x + area.width - width - 24;
    y = area.y + 24;
  }
  x = Math.min(Math.max(x, area.x), area.x + area.width - width);
  y = Math.min(Math.max(y, area.y), area.y + area.height - height);
  return { x, y, width, height };
}

function persistBoundsSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    settingsMod.updateSettings({ window: win.getBounds() });
  }, 500);
}

function createWindow({ startHidden = false } = {}) {
  const settings = settingsMod.getSettings();
  const bounds = clampBounds(settings.window || {});

  win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 300,
    minHeight: 400,
    frame: false,
    show: false,
    alwaysOnTop: settings.behavior.alwaysOnTop,
    skipTaskbar: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    minimizable: false,
    backgroundColor: '#12141a',
    title: 'Kontest Tracker',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  applyWorkspaceVisibility(settings.behavior.showOnAllWorkspaces);
  win.loadURL(entryUrl());

  win.once('ready-to-show', () => {
    if (!startHidden) win.show();
    maybeDevScreenshot();
  });

  // Close/minimize hide to tray — the only real quit is via the tray menu.
  win.on('close', (e) => {
    if (!app_isQuitting()) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('minimize', (e) => {
    e.preventDefault();
    win.hide();
  });
  win.on('moved', persistBoundsSoon);
  win.on('resized', persistBoundsSoon);

  screen.on('display-removed', () => {
    if (!win || win.isDestroyed()) return;
    const b = clampBounds(win.getBounds());
    win.setBounds(b);
  });

  return win;
}

let _isQuitting = false;
function setQuitting(v) { _isQuitting = v; }
function app_isQuitting() { return _isQuitting; }

/** Dev hook: KONTEST_SHOT=<path> captures the window to a PNG, then quits. */
function maybeDevScreenshot() {
  const target = process.env.KONTEST_SHOT;
  if (!target) return;
  setTimeout(() => {
    const fs = require('fs');
    const { app } = require('electron');
    // capturePage can hang with software compositing — race it with a timeout.
    const captured = win.webContents.capturePage().catch(() => null);
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000));
    Promise.race([captured, timeout]).then((img) => {
      if (img && !img.isEmpty()) {
        fs.writeFileSync(target, img.toPNG());
        console.log(`[window] screenshot saved: ${target}`);
      } else {
        // Visual capture unavailable — dump the rendered text instead.
        win.webContents.executeJavaScript('document.body.innerText')
          .then((text) => {
            fs.writeFileSync(`${target}.txt`, text);
            console.log(`[window] capturePage unavailable; DOM text dumped to ${target}.txt`);
          })
          .catch((err) => console.error('[window] DOM dump failed:', err.message));
      }
      console.log(`[window] visible=${win.isVisible()} bounds=${JSON.stringify(win.getBounds())}`);
      app.quit();
    });
  }, 6000);
}

/** setVisibleOnAllWorkspaces is best-effort under XWayland. */
function applyWorkspaceVisibility(visible) {
  try {
    win?.setVisibleOnAllWorkspaces(visible, { visibleOnFullScreen: true });
  } catch { /* unsupported on this platform */ }
}

function getWindow() {
  return win && !win.isDestroyed() ? win : null;
}

function showWindow() {
  if (!getWindow()) return;
  win.show();
  win.focus();
}

function hideWindow() {
  getWindow()?.hide();
}

function toggleWindow() {
  if (!getWindow()) return;
  if (win.isVisible() && !win.isMinimized()) win.hide();
  else showWindow();
}

function setAlwaysOnTop(enabled) {
  getWindow()?.setAlwaysOnTop(Boolean(enabled));
}

function setWorkspaceVisibility(visible) {
  applyWorkspaceVisibility(visible);
}

function getWindowState() {
  if (!getWindow()) return { bounds: null, alwaysOnTop: false };
  return { bounds: win.getBounds(), alwaysOnTop: win.isAlwaysOnTop() };
}

/** Send to the renderer if the window exists. */
function broadcast(channel, payload) {
  try {
    getWindow()?.webContents.send(channel, payload);
  } catch (err) {
    console.error('[window] broadcast failed:', err.message);
  }
}

module.exports = {
  createWindow, getWindow, showWindow, hideWindow, toggleWindow,
  setAlwaysOnTop, setWorkspaceVisibility, getWindowState, broadcast,
  setQuitting, clampBounds,
};
