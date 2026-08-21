/**
 * Source registry + orchestrator. Runs every enabled adapter with
 * per-source isolation: one failing source never affects the others, and
 * each success is written to cache immediately.
 */

const codeforces = require('./codeforces');
const leetcode = require('./leetcode');
const atcoder = require('./atcoder');
const hackerrank = require('./hackerrank');
const clist = require('./clist');
const cache = require('../cache');
const { nowSec, loadShared } = require('../util');


const SOURCES = [
  { key: 'codeforces', label: 'Codeforces', fetch: (s) => codeforces.fetchUpcoming(s) },
  { key: 'leetcode', label: 'LeetCode', fetch: (s) => leetcode.fetchUpcoming(s) },
  { key: 'atcoder', label: 'AtCoder', fetch: (s) => atcoder.fetchUpcoming(s) },
  { key: 'hackerrank', label: 'HackerRank', fetch: (s) => hackerrank.fetchUpcoming(s) },
  { key: 'clist', label: 'clist.by', fetch: (s) => clist.fetchUpcoming(s) },
];

let initialized = false;

async function initSources() {
  if (initialized) return;
  const shared = await loadShared();
  clist.initClist(shared);
  initialized = true;
}

function isSourceEnabled(source, settings) {
  if (source.key === 'clist') {
    return Boolean(settings.platforms.clist && settings.clist.username && settings.clist.apiKey);
  }
  return Boolean(settings.platforms[source.key]);
}

/**
 * Fetch all enabled sources concurrently.
 * Returns { bySource: Map<key, Contest[]>, statuses: SourceStatus[] }.
 */
async function fetchAllSources(settings) {
  await initSources();
  const now = nowSec();

  const results = await Promise.all(
    SOURCES.map(async (source) => {
      const enabled = isSourceEnabled(source, settings);
      if (!enabled) {
        return {
          key: source.key, label: source.label, enabled: false,
          state: 'disabled', fetchedAt: cache.readSourceResult(source.key)?.fetchedAt || 0,
          error: null, contests: [],
        };
      }
      try {
        const { contests } = await source.fetch(settings);
        await cache.writeSourceResult(source.key, { contests });
        return {
          key: source.key, label: source.label, enabled: true,
          state: contests.length ? 'ok' : 'empty',
          fetchedAt: now, error: null, contests,
        };
      } catch (err) {
        const disabled = err?.code === 'DISABLED';
        if (!disabled) await cache.writeSourceError(source.key, String(err.message || err));
        return {
          key: source.key, label: source.label, enabled: !disabled,
          state: disabled ? 'disabled' : 'error',
          fetchedAt: cache.readSourceResult(source.key)?.fetchedAt || 0,
          error: disabled ? null : String(err.message || err),
          contests: [],
        };
      }
    }),
  );

  const bySource = new Map();
  for (const r of results) bySource.set(r.key, r.contests);

  return { bySource, statuses: results.map(({ contests, ...status }) => ({
    ...status,
    count: contests.length,
  })) };
}

module.exports = { SOURCES, fetchAllSources, initSources, isSourceEnabled };
