/**
 * IPC surface — every channel the renderer can invoke, wired to services.
 * Handlers return structured results; unexpected throws become
 * { error: "..." } rather than unhandled rejections in the renderer.
 */

const { ipcMain, shell, app } = require('electron');
const settingsMod = require('./settings');
const scheduler = require('./scheduler');
const reminders = require('./reminders');
const dailyProgress = require('./dailyProgress');
const attendance = require('./attendance');
const autostart = require('./autostart');
const windowMod = require('./window');
const clist = require('./sources/clist');

function wrap(handler) {
  return async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error('[ipc] handler failed:', err.message);
      return { error: String(err.message || err) };
    }
  };
}

function registerIpc() {
  // ---- settings ----
  ipcMain.handle('settings:get', wrap(() => settingsMod.getSettings()));

  ipcMain.handle('settings:set', wrap(async (partial) => {
    const prev = settingsMod.getSettings();
    const merged = settingsMod.updateSettings(partial);

    // Side effects, in dependency order.
    if (prev.behavior.alwaysOnTop !== merged.behavior.alwaysOnTop) {
      windowMod.setAlwaysOnTop(merged.behavior.alwaysOnTop);
    }
    if (prev.behavior.showOnAllWorkspaces !== merged.behavior.showOnAllWorkspaces) {
      windowMod.setWorkspaceVisibility(merged.behavior.showOnAllWorkspaces);
    }
    if (prev.behavior.launchOnStartup !== merged.behavior.launchOnStartup) {
      autostart.setLaunchOnStartup(merged.behavior.launchOnStartup);
    }
    if (prev.platforms.clist !== merged.platforms.clist ||
        prev.clist.username !== merged.clist.username ||
        prev.clist.apiKey !== merged.clist.apiKey ||
        ['codeforces', 'leetcode', 'atcoder', 'hackerrank'].some(
          (k) => prev.platforms[k] !== merged.platforms[k])) {
      // Re-fetch in the background so the list reflects the new platforms.
      scheduler.refreshAll({ reason: 'settings' }).catch(() => {});
    }
    windowMod.broadcast('push:settings-changed', merged);
    return merged;
  }));

  ipcMain.handle('settings:reset', wrap(async () => {
    const merged = settingsMod.resetSettings();
    windowMod.setAlwaysOnTop(merged.behavior.alwaysOnTop);
    windowMod.setWorkspaceVisibility(merged.behavior.showOnAllWorkspaces);
    windowMod.broadcast('push:settings-changed', merged);
    scheduler.refreshAll({ reason: 'reset' }).catch(() => {});
    return merged;
  }));

  ipcMain.handle('clist:test', wrap(async () => {
    const settings = settingsMod.getSettings();
    if (!settings.clist.username || !settings.clist.apiKey) {
      return { ok: false, error: 'Enter your clist.by username and API key first' };
    }
    try {
      const { contests } = await clist.fetchUpcoming(settings);
      return { ok: true, sampleCount: contests.length };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }));

  // ---- contests ----
  ipcMain.handle('contests:get', wrap(() => scheduler.getContestsSnapshot()));
  ipcMain.handle('contests:refresh', wrap(() => scheduler.refreshAll({ reason: 'manual' })));

  // ---- daily ----
  ipcMain.handle('daily:get', wrap(() => scheduler.getDailySnapshot()));
  ipcMain.handle('daily:refresh', wrap(() => scheduler.refreshDaily()));
  ipcMain.handle('daily:markDone', wrap(({ date, done }) => dailyProgress.markDone(date, done)));

  // ---- attendance ----
  ipcMain.handle('attendance:get', wrap(() => attendance.getState()));
  ipcMain.handle('attendance:toggle', wrap((contest) => {
    const state = attendance.toggle(contest);
    windowMod.broadcast('push:attendance-changed', state);
    return state;
  }));

  // ---- window ----
  ipcMain.handle('win:hide', wrap(() => {
    windowMod.hideWindow();
    return { ok: true };
  }));
  ipcMain.handle('win:setAlwaysOnTop', wrap(({ enabled }) => {
    windowMod.setAlwaysOnTop(Boolean(enabled));
    return { enabled: Boolean(enabled) };
  }));
  ipcMain.handle('win:getState', wrap(() => windowMod.getWindowState()));

  // ---- system / app ----
  ipcMain.handle('app:openExternal', wrap(({ url }) => {
    if (!reminders.isUrlAllowed(String(url || ''))) {
      throw new Error(`URL not allowed: ${url}`);
    }
    shell.openExternal(String(url));
    return { ok: true };
  }));

  ipcMain.handle('reminders:test', wrap(() => ({ ok: reminders.sendTestNotification() })));

  ipcMain.handle('app:getVersions', wrap(() => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    userDataPath: app.getPath('userData'),
  })));

  ipcMain.handle('app:openDataFolder', wrap(() => shell.openPath(app.getPath('userData'))));

  ipcMain.handle('app:quit', wrap(() => {
    windowMod.setQuitting(true);
    app.quit();
    return { ok: true };
  }));
}

module.exports = { registerIpc };
