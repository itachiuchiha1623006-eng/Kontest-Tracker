/**
 * Codeforces adapter — official public API.
 * contest.list is sorted newest-first; upcoming = phase BEFORE with
 * negative relativeTimeSeconds; phase CODING = currently running.
 */

const { fetchJson } = require('../net');
const { normalizeContest } = require('../normalize');
const { nowSec } = require('../util');

const CAP = 100;

async function fetchUpcoming() {
  const res = await fetchJson('https://codeforces.com/api/contest.list', { sourceKey: 'codeforces' });
  if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);

  const list = Array.isArray(res.data?.result) ? res.data.result : [];
  const now = nowSec();
  const contests = [];

  for (const c of list) {
    const upcoming = c.phase === 'BEFORE' && c.relativeTimeSeconds < 0;
    const running = c.phase === 'CODING';
    if (!upcoming && !running) continue;
    const contest = normalizeContest({
      sourceKey: 'codeforces',
      sourceId: String(c.id),
      name: c.name,
      url: `https://codeforces.com/contests/${c.id}`,
      start: c.startTimeSeconds,
      durationSeconds: c.durationSeconds,
      rated: null,
    }, now);
    if (contest && contest.end > now) contests.push(contest);
    if (contests.length >= CAP * 2) break;
  }

  contests.sort((a, b) => a.start - b.start);
  return { contests: contests.slice(0, CAP) };
}

module.exports = { fetchUpcoming };
