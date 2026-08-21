/**
 * LeetCode adapter — GraphQL (verified working query, needs a Referer).
 * Provides both upcoming contests and the daily coding challenge.
 */

const { fetchJson } = require('../net');
const { normalizeContest } = require('../normalize');
const { nowSec } = require('../util');

const CAP = 50;
const GRAPHQL_URL = 'https://leetcode.com/graphql';
const HEADERS = { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' };

const QUERY = `
query {
  contestV2UpcomingContests { title titleSlug startTime duration }
  activeDailyCodingChallengeQuestion {
    date
    link
    question { questionFrontendId title titleSlug }
  }
}`;

async function query() {
  const res = await fetchJson(GRAPHQL_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query: QUERY }),
    sourceKey: 'leetcode',
  });
  if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
  if (Array.isArray(res.data?.errors) && res.data.errors.length && !res.data.data) {
    throw new Error(res.data.errors[0]?.message || 'graphql error');
  }
  return res.data.data || {};
}

async function fetchUpcoming() {
  const data = await query();
  const list = Array.isArray(data.contestV2UpcomingContests) ? data.contestV2UpcomingContests : [];
  const now = nowSec();
  const contests = [];

  for (const c of list) {
    const contest = normalizeContest({
      sourceKey: 'leetcode',
      sourceId: String(c.titleSlug || ''),
      name: c.title,
      url: `https://leetcode.com/contest/${c.titleSlug}/`,
      start: c.startTime,
      durationSeconds: c.duration,
      rated: true,
    }, now);
    if (contest) contests.push(contest);
  }

  contests.sort((a, b) => a.start - b.start);
  return { contests: contests.slice(0, CAP) };
}

/** Returns the DailyChallenge shape (or null) — cached separately. */
async function fetchDaily() {
  const data = await query();
  const d = data.activeDailyCodingChallengeQuestion;
  if (!d?.question?.titleSlug) return null;
  return {
    date: String(d.date || ''),
    questionId: String(d.question.questionFrontendId || ''),
    title: String(d.question.title || ''),
    titleSlug: String(d.question.titleSlug),
    url: `https://leetcode.com${String(d.link || `/problems/${d.question.titleSlug}/`)}`,
  };
}

module.exports = { fetchUpcoming, fetchDaily };
