/**
 * LeetCode daily-challenge progress: which dates the user marked done,
 * plus streak computation. Streaks are derived, never stored.
 *
 * Storage key = LeetCode's own challenge date string ("2026-08-21"), so
 * marks always attach to the challenge that was displayed.
 */

const path = require('path');
const { app } = require('electron');
const { atomicWriteJson, readJsonSafe } = require('./util');

const VERSION = 1;

let progress = { version: VERSION, done: {} };

function filePath() {
  return path.join(app.getPath('userData'), 'state', 'daily-progress.json');
}

function initDailyProgress() {
  const stored = readJsonSafe(filePath(), null);
  if (stored && stored.version === VERSION && stored.done) progress = stored;
}

/** Local calendar date ("YYYY-MM-DD") in the machine's timezone. */
function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function markDone(dateKey, done) {
  const key = String(dateKey || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`invalid date key: ${key}`);
  }
  if (done) {
    progress.done[key] = { doneAt: Math.floor(Date.now() / 1000) };
  } else {
    delete progress.done[key];
  }
  try {
    atomicWriteJson(filePath(), progress);
  } catch (err) {
    console.error('[daily] persist failed:', err.message);
  }
  return getProgress();
}

/** Consecutive-day runs over all recorded dates, anchored to today/yesterday. */
function computeStreaks(doneDates) {
  const dates = [...doneDates]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  if (dates.length === 0) return { current: 0, best: 0 };

  // Longest run anywhere in history.
  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = isNextDay(dates[i - 1], dates[i]) ? run + 1 : 1;
    best = Math.max(best, run);
  }

  // Current streak: must end today or yesterday (yesterday keeps a streak
  // alive until the day actually passes).
  const today = localDateKey();
  const yesterday = localDateKey(new Date(Date.now() - 24 * 3600 * 1000));
  const doneSet = new Set(dates);
  let current = 0;
  let cursor = doneSet.has(today) ? today : (doneSet.has(yesterday) ? yesterday : null);
  while (cursor && doneSet.has(cursor)) {
    current++;
    cursor = localDateKey(new Date(new Date(`${cursor}T12:00:00`) - 24 * 3600 * 1000));
  }

  return { current, best: Math.max(best, current) };
}

function isNextDay(a, b) {
  const ta = new Date(`${a}T12:00:00`).getTime();
  const tb = new Date(`${b}T12:00:00`).getTime();
  return tb - ta === 24 * 3600 * 1000;
}

function getProgress() {
  const doneDates = Object.keys(progress.done);
  return { doneDates, ...computeStreaks(doneDates) };
}

module.exports = { initDailyProgress, markDone, getProgress, localDateKey };
