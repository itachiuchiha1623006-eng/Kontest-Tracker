/**
 * Contest attendance tracker. Records which contests the user attended,
 * keyed by contest id with a denormalized copy of the essentials so the
 * history survives even after the contest leaves the live list.
 *
 * Storage: state/attendance.json
 *   { attended: { "<contestId>": { dateKey, name, platformKey, platformLabel,
 *                                  url, start, markedAt } } }
 */

const path = require('path');
const { app } = require('electron');
const { atomicWriteJson, readJsonSafe } = require('./util');

const VERSION = 1;

let records = {};

function filePath() {
  return path.join(app.getPath('userData'), 'state', 'attendance.json');
}

function initAttendance() {
  const stored = readJsonSafe(filePath(), null);
  if (stored && stored.version === VERSION && stored.attended) records = stored.attended;
  else records = {};
}

function persist() {
  try {
    atomicWriteJson(filePath(), { version: VERSION, attended: records });
  } catch (err) {
    console.error('[attendance] persist failed:', err.message);
  }
}

/** Local calendar date key ("YYYY-MM-DD") of the contest's start. */
function localDateKey(epochSec) {
  const d = new Date(epochSec * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Toggle attendance for a contest. Only whitelisted fields are stored.
 * Returns the full updated state.
 */
function toggle(contest) {
  const id = String(contest?.id || '').slice(0, 160);
  if (!id) throw new Error('contest id required');

  if (records[id]) {
    delete records[id];
  } else {
    records[id] = {
      dateKey: localDateKey(Number(contest.start)),
      name: String(contest.name || '').slice(0, 200),
      platformKey: String(contest.platformKey || 'other').slice(0, 32),
      platformLabel: String(contest.platformLabel || '').slice(0, 40),
      url: String(contest.url || '').slice(0, 300),
      start: Number(contest.start) || 0,
      markedAt: Math.floor(Date.now() / 1000),
    };
  }
  persist();
  return getState();
}

function getState() {
  const byDate = {};
  let thisMonth = 0;
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const [id, r] of Object.entries(records)) {
    (byDate[r.dateKey] ||= []).push({
      id,
      name: r.name,
      platformLabel: r.platformLabel,
      platformKey: r.platformKey,
    });
    if (r.dateKey.startsWith(monthPrefix)) thisMonth++;
  }

  return {
    attendedIds: Object.keys(records),
    byDate,
    total: Object.keys(records).length,
    thisMonth,
  };
}

module.exports = { initAttendance, toggle, getState };
