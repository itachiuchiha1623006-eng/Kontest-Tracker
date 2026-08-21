/**
 * Kontest Tracker — main process entry.
 * Boot order matters: privileged schemes before ready, shared ESM modules
 * injected into the CommonJS services before any fetch can run.
 */

const { app } = require('electron');

const { registerSchemes, registerAppProtocol } = require('./protocol');
const { loadShared } = require('./util');
const settingsMod = require('./settings');
const cache = require('./cache');
const normalize = require('./normalize');
const merge = require('./merge');
const reminders = require('./reminders');
const dailyProgress = require('./dailyProgress');
const scheduler = require('./scheduler');
const windowMod = require('./window');
const tray = require('./tray');
const { registerIpc } = require('./ipc');

// Single instance: a second launch just reveals the widget.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => windowMod.showWindow());

  registerSchemes(); // must happen before app ready

  app.whenReady().then(init).catch((err) => {
    console.error('[main] fatal boot error:', err);
    app.quit();
  });
}

async function init() {
  app.setAppUserModelId('com.kontest.tracker');

  registerAppProtocol();

  // Inject the ESM shared module into the CommonJS services.
  const shared = await loadShared();
  normalize.initNormalize(shared);
  merge.initMerge(shared);
  reminders.initReminders(shared);

  settingsMod.initSettings();
  cache.initCache();
  reminders.loadFired();
  dailyProgress.initDailyProgress();

  scheduler.initScheduler({
    broadcast: windowMod.broadcast,
    onContestsChanged: () => {},
    updateTrayTooltip: tray.updateTrayTooltip,
  });

  windowMod.createWindow({ startHidden: process.argv.includes('--hidden') });
  tray.createTray({
    onToggle: () => windowMod.toggleWindow(),
    onRefresh: () => scheduler.refreshAll({ reason: 'tray' }).catch(() => {}),
    onQuit: () => {
      windowMod.setQuitting(true);
      app.quit();
    },
  });

  registerIpc();
  scheduler.startScheduler();
}

// Lifecycle: closing the window hides it; only the tray/Settings quit.
app.on('before-quit', () => {
  windowMod.setQuitting(true);
  settingsMod.flushSettings();
  scheduler.stopScheduler();
});

// Never quit when the widget window closes — the tray keeps running.
app.on('window-all-closed', () => {});
