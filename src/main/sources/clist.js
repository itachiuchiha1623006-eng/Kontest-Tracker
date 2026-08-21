/**
 * clist.by adapter — optional aggregator covering CodeChef, GeeksforGeeks,
 * HackerEarth, Topcoder, CS Academy (and everything else, merged away by
 * merge.js). Requires a free username + API key from clist.by.
 */

const { fetchJson } = require('../net');
const { normalizeContest, toEpoch } = require('../normalize');
const { nowSec } = require('../util');

const CAP = 150;

let shared = null;

/** Injected by sources/index.js at boot (same pattern as normalize/merge). */
function initClist(sharedModule) {
  shared = sharedModule;
}

async function fetchUpcoming(settings) {
  const { username, apiKey } = settings?.clist || {};
  if (!username || !apiKey) {
    const err = new Error('clist.by credentials not configured');
    err.code = 'DISABLED';
    throw err;
  }

  // clist v4 wants an ISO start without milliseconds.
  const startAfter = new Date().toISOString().replace(/\.\d{3}Z$/, '');
  const url =
    `https://clist.by/api/v4/json/contest/?username=${encodeURIComponent(username)}` +
    `&api_key=${encodeURIComponent(apiKey)}&limit=${CAP}&start_after=${encodeURIComponent(startAfter)}` +
    `&order_by=start`;

  const res = await fetchJson(url, { sourceKey: 'clist' });
  if (res.status === 401 || res.status === 403) {
    throw new Error('clist.by rejected the credentials (check username/API key)');
  }
  if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);

  const objects = Array.isArray(res.data?.objects) ? res.data.objects : [];
  const now = nowSec();
  const contests = [];

  for (const o of objects) {
    const contest = normalizeContest({
      sourceKey: 'clist',
      sourceId: String(o.id ?? ''),
      platformKey: shared.resourceToPlatformKey(o.resource?.name),
      name: o.event,
      url: o.url,
      start: toEpoch(o.start),
      end: toEpoch(o.end),
      durationSeconds: Number.isFinite(o.duration) ? o.duration : null,
      rated: null,
    }, now);
    if (contest && contest.end > now) contests.push(contest);
  }

  contests.sort((a, b) => a.start - b.start);
  return { contests };
}

module.exports = { fetchUpcoming, initClist };
