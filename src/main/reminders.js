/**
 * Reminder engine: computes which (contest, lead) pairs are due, fires
 * desktop notifications, and persists a "fired" set so restarting the app
 * inside the reminder window never duplicates a notification.
 *
 * Storage: state/reminders.json — { fired: { "<contestId>:<leadMin>": ts } }
 */

const path = require('path');
const { app, Notification, shell } = require('electron');
const { atomicWriteJson, readJsonSafe, nowSec } = require('./util');

const VERSION = 1;
const PRUNE_AGE_SEC = 14 * 24 * 3600;

let shared = null; // ESM shared module (platforms.js) — injected at boot

function initReminders(sharedModule) {
  shared = sharedModule;
}

let fired = {};

function filePath() {
  return path.join(app.getPath('userData'), 'state', 'reminders.json');
}

function loadFired() {
  const stored = readJsonSafe(filePath(), null);
  if (stored && stored.version === VERSION && stored.fired) fired = stored.fired;
  else fired = {};
}

function persistFired() {
  try {
    atomicWriteJson(filePath(), { version: VERSION, fired });
  } catch (err) {
    console.error('[reminders] persist failed:', err.message);
  }
}

/** Drop entries older than 14 days — the set stays small forever. */
function pruneFired(now) {
  const cutoff = now - PRUNE_AGE_SEC;
  let changed = false;
  for (const [key, ts] of Object.entries(fired)) {
    if (ts < cutoff) {
      delete fired[key];
      changed = true;
    }
  }
  if (changed) persistFired();
}

/** Only https URLs on a known platform host may be opened. */
function isUrlAllowed(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return shared.ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Fire notifications for every (contest, lead) that is due.
 * Returns the number of notifications fired.
 */
function fireDueReminders(contests, settings) {
  if (!settings.reminders.enabled) return 0;
  const now = nowSec();
  pruneFired(now);

  let count = 0;
  for (const contest of contests) {
    if (contest.start <= now) continue; // never announce an already-started contest
    if (settings.reminders.mutedContests[contest.id]) continue;

    const secondsToStart = contest.start - now;
    for (const lead of settings.reminders.leadMinutes) {
      const key = `${contest.id}:${lead}`;
      if (fired[key]) continue;
      if (secondsToStart > lead * 60) continue;
      if (secondsToStart < lead * 60 - 90) continue; // missed window by >90s: skip

      fired[key] = now;
      count++;
      showNotification(contest);
    }
  }
  if (count > 0) persistFired();
  return count;
}

function showNotification(contest) {
  if (!Notification.isSupported()) return;
  const minutes = Math.max(1, Math.round((contest.start - nowSec()) / 60));
  const notification = new Notification({
    title: `${contest.platformLabel} — starts in ${minutes} min`,
    body: contest.name,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    silent: false,
  });
  notification.on('click', () => {
    if (contest.url && isUrlAllowed(contest.url)) shell.openExternal(contest.url);
  });
  notification.show();
}

/** Fire a sample notification (Settings "Test" button). */
function sendTestNotification() {
  if (!Notification.isSupported()) return false;
  const notification = new Notification({
    title: 'Kontest Tracker',
    body: 'Reminders are working — see you at the next contest!',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
  });
  notification.show();
  return true;
}

module.exports = { initReminders, loadFired, fireDueReminders, sendTestNotification, isUrlAllowed };
