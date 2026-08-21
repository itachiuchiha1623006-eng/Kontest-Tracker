/**
 * Preload — the only bridge between the sandboxed renderer and the main
 * process. Exposes a minimal, allowlisted API as window.kontest.
 * No ipcRenderer, no remote, no Node primitives leak through.
 */

const { contextBridge, ipcRenderer } = require('electron');

const PUSH_CHANNELS = new Set([
  'push:contests-updated',
  'push:daily-updated',
  'push:attendance-changed',
  'push:settings-changed',
  'push:resync',
]);

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('kontest', {
  // settings
  getSettings: invoke('settings:get'),
  setSettings: invoke('settings:set'),
  resetSettings: invoke('settings:reset'),
  testClist: invoke('clist:test'),

  // contests
  getContests: invoke('contests:get'),
  refreshContests: invoke('contests:refresh'),

  // daily challenge
  getDaily: invoke('daily:get'),
  refreshDaily: invoke('daily:refresh'),

  // contest attendance
  getAttendance: invoke('attendance:get'),
  toggleAttendance: invoke('attendance:toggle'),

  // window
  hideWindow: invoke('win:hide'),
  setAlwaysOnTop: invoke('win:setAlwaysOnTop'),
  getWindowState: invoke('win:getState'),

  // system / app
  openExternal: invoke('app:openExternal'),
  testReminder: invoke('reminders:test'),
  getVersions: invoke('app:getVersions'),
  openDataFolder: invoke('app:openDataFolder'),
  quitApp: invoke('app:quit'),

  /** Subscribe to a push channel; returns an unsubscribe function. */
  on(channel, callback) {
    if (!PUSH_CHANNELS.has(channel)) throw new Error(`Channel not allowed: ${channel}`);
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
