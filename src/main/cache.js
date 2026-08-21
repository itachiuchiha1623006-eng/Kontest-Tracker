/**
 * Contest/daily cache under <userData>:
 *   cache/contests.json — { version, sources: { <key>: {fetchedAt, etag,
 *     lastModified, error, contests: Contest[] } } }
 *   cache/daily.json    — { version, fetchedAt, daily: DailyChallenge|null }
 *
 * Every write is atomic and per-source results are written independently,
 * so three healthy sources still persist when the fourth fails.
 */

const path = require('path');
const { app } = require('electron');
const { atomicWriteJson, readJsonSafe } = require('./util');

const VERSION = 1;

let contestsCache = { version: VERSION, sources: {} };
let dailyCache = { version: VERSION, fetchedAt: 0, daily: null };

// All writes funnel through one promise chain — no concurrent writers.
let writeQueue = Promise.resolve();

function cacheDir() {
  return path.join(app.getPath('userData'), 'cache');
}

function contestsPath() {
  return path.join(cacheDir(), 'contests.json');
}

function dailyPath() {
  return path.join(cacheDir(), 'daily.json');
}

function enqueueWrite(filePath, data) {
  writeQueue = writeQueue.then(() => {
    try {
      atomicWriteJson(filePath, data);
    } catch (err) {
      console.error('[cache] write failed:', filePath, err.message);
    }
  });
  return writeQueue;
}

function initCache() {
  const storedContests = readJsonSafe(contestsPath(), null);
  if (storedContests && storedContests.version === VERSION && storedContests.sources) {
    contestsCache = storedContests;
  }
  const storedDaily = readJsonSafe(dailyPath(), null);
  if (storedDaily && storedDaily.version === VERSION) {
    dailyCache = storedDaily;
  }
}

/** Read-only snapshot of everything cached for a source (or null). */
function readSourceResult(key) {
  return contestsCache.sources[key] || null;
}

/** Persist one source's successful fetch. */
function writeSourceResult(key, { contests, etag = null, lastModified = null, error = null }) {
  contestsCache.sources[key] = {
    fetchedAt: Math.floor(Date.now() / 1000),
    etag,
    lastModified,
    error,
    contests,
  };
  return enqueueWrite(contestsPath(), contestsCache);
}

/** Record a source failure without touching its cached contests. */
function writeSourceError(key, error) {
  const prev = contestsCache.sources[key];
  contestsCache.sources[key] = {
    fetchedAt: prev?.fetchedAt || 0,
    etag: prev?.etag || null,
    lastModified: prev?.lastModified || null,
    error,
    contests: prev?.contests || [],
  };
  return enqueueWrite(contestsPath(), contestsCache);
}

function readDaily() {
  return dailyCache;
}

function writeDaily(daily) {
  dailyCache = { version: VERSION, fetchedAt: Math.floor(Date.now() / 1000), daily };
  return enqueueWrite(dailyPath(), dailyCache);
}

module.exports = {
  initCache, readSourceResult, writeSourceResult, writeSourceError, readDaily, writeDaily,
};
