/**
 * LeetCode daily-challenge progress: which dates the user marked done.
 * (Contest attendance lives in attendance.js — this only tracks the
 * daily problem.)
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

function getProgress() {
  return { doneDates: Object.keys(progress.done) };
}

module.exports = { initDailyProgress, markDone, getProgress };
