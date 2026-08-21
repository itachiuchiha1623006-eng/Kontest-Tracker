/**
 * AtCoder adapter — kenkoooo's AtCoder Problems API (~1 MB payload; the
 * normalized/filtered result cached here is a few KB).
 * Permanent/practice contests (duration > 14 days) are excluded.
 */

const { fetchJson } = require('../net');
const { normalizeContest } = require('../normalize');
const { nowSec } = require('../util');

const CAP = 100;
const MAX_DURATION_SEC = 14 * 24 * 3600;

async function fetchUpcoming() {
  const res = await fetchJson('https://kenkoooo.com/atcoder/resources/contests.json', {
    sourceKey: 'atcoder',
  });
  if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);

  const list = Array.isArray(res.data) ? res.data : [];
  const now = nowSec();
  const contests = [];

  for (const c of list) {
    if (!Number.isFinite(c.start_epoch_second) || !Number.isFinite(c.duration_second)) continue;
    if (c.duration_second > MAX_DURATION_SEC) continue;
    if (c.start_epoch_second + c.duration_second <= now) continue; // finished
    const contest = normalizeContest({
      sourceKey: 'atcoder',
      sourceId: String(c.id || ''),
      name: c.title,
      url: `https://atcoder.jp/contests/${c.id}`,
      start: c.start_epoch_second,
      durationSeconds: c.duration_second,
      rated: c.rate_change !== '-',
    }, now);
    if (contest) contests.push(contest);
  }

  contests.sort((a, b) => a.start - b.start);
  return { contests: contests.slice(0, CAP) };
}

module.exports = { fetchUpcoming };
