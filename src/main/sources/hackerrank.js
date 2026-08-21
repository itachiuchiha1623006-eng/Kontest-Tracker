/**
 * HackerRank adapter — semi-official REST endpoint used by their site.
 * Contests without a scheduled start (epoch_starttime = 0) are skipped.
 */

const { fetchJson } = require('../net');
const { normalizeContest } = require('../normalize');
const { nowSec } = require('../util');

const CAP = 20;

async function fetchUpcoming() {
  const res = await fetchJson('https://www.hackerrank.com/rest/contests/upcoming?limit=20', {
    sourceKey: 'hackerrank',
  });
  if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);

  const models = Array.isArray(res.data?.models) ? res.data.models : [];
  const now = nowSec();
  const contests = [];

  for (const c of models) {
    if (!c.epoch_starttime || !c.epoch_endtime) continue;
    if (c.epoch_endtime <= now) continue;
    const contest = normalizeContest({
      sourceKey: 'hackerrank',
      sourceId: String(c.slug || c.id),
      name: c.name,
      url: `https://www.hackerrank.com/contests/${c.slug}`,
      start: c.epoch_starttime,
      end: c.epoch_endtime,
      rated: Boolean(c.rated),
    }, now);
    if (contest) contests.push(contest);
  }

  contests.sort((a, b) => a.start - b.start);
  return { contests: contests.slice(0, CAP) };
}

module.exports = { fetchUpcoming };
