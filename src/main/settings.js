/**
 * Settings: defaults, deep-merge over stored JSON, validation, and
 * debounced atomic persistence to <userData>/settings.json.
 */

const path = require('path');
const { app } = require('electron');
const { atomicWriteJson, readJsonSafe, clampInt } = require('./util');

const VERSION = 1;

const DEFAULT_SETTINGS = {
  version: VERSION,
  platforms: {
    codeforces: true,
    leetcode: true,
    atcoder: true,
    hackerrank: true,
    clist: false,
    codechef: false,
    geeksforgeeks: false,
    hackerearth: false,
    topcoder: false,
    csacademy: false,
  },
  clist: { username: '', apiKey: '' },
  filters: {
    timeWindowDays: 30,      // 0 = any
    maxDurationHours: 0,     // 0 = any
    hideRunning: false,
    search: '',
    sortBy: 'start',         // start | name | duration
  },
  reminders: {
    enabled: true,
    leadMinutes: [30],       // subset of [15, 30, 60]
    mutedContests: {},       // { "<contestId>": true }
  },
  appearance: {
    theme: 'dark',           // dark | light
    accent: 'violet',        // violet | teal | amber | rose
    fontSize: 13,            // 11..16
  },
  behavior: {
    refreshIntervalMinutes: 180, // min 15
    alwaysOnTop: true,
    showOnAllWorkspaces: true,
    launchOnStartup: false,
    hideToTrayOnClose: true,
  },
  window: { x: null, y: null, width: 340, height: 520 },
};

const VALID_LEADS = [15, 30, 60];
const VALID_SORTS = ['start', 'name', 'duration'];
const VALID_THEMES = ['dark', 'light'];
const VALID_ACCENTS = ['violet', 'teal', 'amber', 'rose'];

let settings = null;
let writeTimer = null;
const listeners = new Set();

function filePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Recursive merge: stored values win, defaults fill gaps, unknown keys dropped. */
function deepMerge(defaults, stored) {
  if (!isPlainObject(stored)) return structuredClone(defaults);
  const out = structuredClone(defaults);
  for (const [key, value] of Object.entries(stored)) {
    if (!(key in out)) continue;
    if (isPlainObject(out[key]) && isPlainObject(value)) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Coerce user-editable fields into their valid domain. Mutates `s`. */
function sanitize(s) {
  s.version = VERSION;

  for (const key of Object.keys(s.platforms)) {
    s.platforms[key] = Boolean(s.platforms[key]);
  }

  s.clist.username = String(s.clist.username || '').slice(0, 100);
  s.clist.apiKey = String(s.clist.apiKey || '').slice(0, 100);

  const f = s.filters;
  f.timeWindowDays = [0, 7, 14, 30, 90].includes(Number(f.timeWindowDays))
    ? Number(f.timeWindowDays) : 30;
  f.maxDurationHours = [0, 2, 3, 6, 12, 24].includes(Number(f.maxDurationHours))
    ? Number(f.maxDurationHours) : 0;
  f.hideRunning = Boolean(f.hideRunning);
  f.search = String(f.search || '').slice(0, 100);
  if (!VALID_SORTS.includes(f.sortBy)) f.sortBy = 'start';

  const r = s.reminders;
  r.enabled = Boolean(r.enabled);
  if (!Array.isArray(r.leadMinutes)) r.leadMinutes = [30];
  r.leadMinutes = [...new Set(r.leadMinutes.map(Number).filter((n) => VALID_LEADS.includes(n)))];
  if (r.leadMinutes.length === 0) r.leadMinutes = [30];
  if (!isPlainObject(r.mutedContests)) r.mutedContests = {};

  const a = s.appearance;
  if (!VALID_THEMES.includes(a.theme)) a.theme = 'dark';
  if (!VALID_ACCENTS.includes(a.accent)) a.accent = 'violet';
  a.fontSize = clampInt(a.fontSize, 11, 16, 13);

  const b = s.behavior;
  b.refreshIntervalMinutes = clampInt(b.refreshIntervalMinutes, 15, 24 * 60, 180);
  b.alwaysOnTop = Boolean(b.alwaysOnTop);
  b.showOnAllWorkspaces = Boolean(b.showOnAllWorkspaces);
  b.launchOnStartup = Boolean(b.launchOnStartup);
  b.hideToTrayOnClose = Boolean(b.hideToTrayOnClose);

  const w = s.window;
  w.width = clampInt(w.width, 300, 1200, 340);
  w.height = clampInt(w.height, 400, 2000, 520);
  if (w.x !== null && !Number.isFinite(Number(w.x))) w.x = null;
  if (w.y !== null && !Number.isFinite(Number(w.y))) w.y = null;

  return s;
}

/** Load settings from disk (or defaults) and sanitize. Called once at boot. */
function initSettings() {
  const stored = readJsonSafe(filePath(), null);
  settings = sanitize(deepMerge(DEFAULT_SETTINGS, stored || {}));
  return settings;
}

function getSettings() {
  if (!settings) initSettings();
  return settings;
}

function persistSoon() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      atomicWriteJson(filePath(), settings);
    } catch (err) {
      console.error('[settings] write failed:', err.message);
    }
  }, 500);
}

/** Merge a partial update, sanitize, persist, notify listeners, return merged. */
function updateSettings(partial) {
  if (!settings) initSettings();
  const before = JSON.stringify(settings);
  settings = sanitize(deepMerge(settings, isPlainObject(partial) ? partial : {}));
  if (JSON.stringify(settings) !== before) {
    persistSoon();
    for (const cb of listeners) {
      try { cb(settings); } catch (err) { console.error('[settings] listener failed:', err.message); }
    }
  }
  return settings;
}

function resetSettings() {
  settings = sanitize(structuredClone(DEFAULT_SETTINGS));
  persistSoon();
  for (const cb of listeners) {
    try { cb(settings); } catch { /* listener errors are non-fatal */ }
  }
  return settings;
}

/** Flush any pending debounced write immediately (used on quit). */
function flushSettings() {
  clearTimeout(writeTimer);
  try {
    if (settings) atomicWriteJson(filePath(), settings);
  } catch (err) {
    console.error('[settings] flush failed:', err.message);
  }
}

function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

module.exports = {
  initSettings, getSettings, updateSettings, resetSettings, flushSettings, onChange,
};
