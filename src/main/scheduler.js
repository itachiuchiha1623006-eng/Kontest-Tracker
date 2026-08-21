/**
 * Scheduler — the app's heartbeat. Owns:
 *   - the refresh loop (settings.behavior.refreshIntervalMinutes)
 *   - the 15s reminder tick (also keeps the tray tooltip fresh)
 *   - boot-time staleness check + system-resume handling
 *   - the merged contest snapshot served to the renderer
 */

const { powerMonitor } = require('electron');
const settingsMod = require('./settings');
const cache = require('./cache');
const sources = require('./sources');
const { mergeContests } = require('./merge');
const { fetchDaily } = require('./sources/leetcode');
const reminders = require('./reminders');
const { nowSec } = require('./util');

const REMINDER_TICK_MS = 15_000;

const state = {
  contests: [],   // merged Contest[]
  statuses: [],   // SourceStatus[]
  daily: null,
  refreshing: false,
  refreshTimer: null,
  reminderTimer: null,
  broadcast: () => {},
  onContestsChanged: () => {},
};

/** Build the merged snapshot from whatever is cached (boot path). */
function loadSnapshotFromCache() {
  const settings = settingsMod.getSettings();
  const maxAgeSec = settings.behavior.refreshIntervalMinutes * 60;
  const bySource = new Map();
  const statuses = [];
  for (const source of sources.SOURCES) {
    const enabled = sources.isSourceEnabled(source, settings);
    const cached = cache.readSourceResult(source.key);
    const ageSec = cached?.fetchedAt ? nowSec() - cached.fetchedAt : Infinity;
    const stateName = !enabled
      ? 'disabled'
      : !cached?.fetchedAt
        ? 'empty'
        : ageSec > maxAgeSec ? 'stale' : 'ok';
    statuses.push({
      key: source.key,
      label: source.label,
      enabled,
      state: stateName,
      fetchedAt: cached?.fetchedAt || 0,
      error: cached?.error || null,
      count: cached?.contests?.length || 0,
    });
    bySource.set(source.key, enabled ? (cached?.contests || []) : []);
  }
  state.contests = mergeContests(bySource, nowSec());
  state.statuses = statuses;
  state.daily = cache.readDaily().daily;
}

function getContestsSnapshot() {
  return { contests: state.contests, sources: state.statuses, nowSec: nowSec() };
}

function getDailySnapshot() {
  return {
    daily: state.daily,
    fetchedAt: cache.readDaily().fetchedAt,
  };
}

/** Fetch all enabled sources, merge, cache, broadcast, run reminders. */
async function refreshAll({ reason = 'manual' } = {}) {
  if (state.refreshing) return getContestsSnapshot();
  state.refreshing = true;
  try {
    const settings = settingsMod.getSettings();
    const { bySource, statuses } = await sources.fetchAllSources(settings);

    state.contests = mergeContests(bySource, nowSec());
    state.statuses = statuses;
    state.broadcast('push:contests-updated', getContestsSnapshot());
    state.onContestsChanged(state.contests);

    reminders.fireDueReminders(state.contests, settings);
    updateTrayTooltip();
    console.log(`[scheduler] refresh (${reason}): ${state.contests.length} contests`);
    return getContestsSnapshot();
  } finally {
    state.refreshing = false;
  }
}

/** Refresh the LeetCode daily challenge. */
async function refreshDaily() {
  try {
    const daily = await fetchDaily();
    await cache.writeDaily(daily);
    state.daily = daily;
    state.broadcast('push:daily-updated', getDailySnapshot());
    return getDailySnapshot();
  } catch (err) {
    console.error('[scheduler] daily refresh failed:', err.message);
    return getDailySnapshot();
  }
}

function isCacheStale(settings) {
  const maxAgeSec = settings.behavior.refreshIntervalMinutes * 60;
  return sources.SOURCES.some((source) => {
    if (!sources.isSourceEnabled(source, settings)) return false;
    const cached = cache.readSourceResult(source.key);
    return !cached || nowSec() - cached.fetchedAt > maxAgeSec;
  });
}

function startRefreshLoop() {
  clearInterval(state.refreshTimer);
  const minutes = settingsMod.getSettings().behavior.refreshIntervalMinutes;
  state.refreshTimer = setInterval(() => refreshAll({ reason: 'interval' }), minutes * 60 * 1000);
}

function tickReminders() {
  const settings = settingsMod.getSettings();
  const firedCount = reminders.fireDueReminders(state.contests, settings);
  if (firedCount > 0) console.log(`[scheduler] fired ${firedCount} reminder(s)`);
  updateTrayTooltip();
}

function startReminderLoop() {
  clearInterval(state.reminderTimer);
  state.reminderTimer = setInterval(tickReminders, REMINDER_TICK_MS);
}

let trayTooltipUpdater = null;

function updateTrayTooltip() {
  if (!trayTooltipUpdater) return;
  const now = nowSec();
  const next = state.contests
    .filter((c) => c.start > now)
    .sort((a, b) => a.start - b.start)[0];
  trayTooltipUpdater(next);
}

/** System came back from sleep — re-sync everything. */
function onResume() {
  console.log('[scheduler] system resume: re-syncing');
  tickReminders();
  state.broadcast('push:resync', {});
  const settings = settingsMod.getSettings();
  if (isCacheStale(settings)) refreshAll({ reason: 'resume' });
}

function initScheduler({ broadcast, onContestsChanged, updateTrayTooltip: onTooltip }) {
  state.broadcast = broadcast || state.broadcast;
  state.onContestsChanged = onContestsChanged || state.onContestsChanged;
  trayTooltipUpdater = onTooltip || null;
  loadSnapshotFromCache();
}

function startScheduler() {
  const settings = settingsMod.getSettings();
  startRefreshLoop();
  startReminderLoop();

  if (isCacheStale(settings)) {
    refreshAll({ reason: 'boot-stale' });
    refreshDaily();
  }

  powerMonitor.on('resume', onResume);
  powerMonitor.on('unlock-screen', onResume);

  // Rebuild the refresh loop when the interval setting changes.
  let lastInterval = settings.behavior.refreshIntervalMinutes;
  settingsMod.onChange((s) => {
    if (s.behavior.refreshIntervalMinutes !== lastInterval) {
      lastInterval = s.behavior.refreshIntervalMinutes;
      startRefreshLoop();
    }
    tickReminders();
  });
}

function stopScheduler() {
  clearInterval(state.refreshTimer);
  clearInterval(state.reminderTimer);
}

module.exports = {
  initScheduler, startScheduler, stopScheduler,
  refreshAll, refreshDaily, onResume,
  getContestsSnapshot, getDailySnapshot, loadSnapshotFromCache,
};
