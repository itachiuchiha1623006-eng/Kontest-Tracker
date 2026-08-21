/**
 * Pure filtering/sorting of the merged contest list. Contest status is
 * derived here (never stored): running = start <= now < end; ended
 * contests linger for ENDED_RETENTION_SEC so attendance can be marked.
 */

import { ENDED_RETENTION_SEC } from '../../shared/platforms.mjs';

export function contestStatus(contest, nowSec) {
  if (contest.start > nowSec) return 'upcoming';
  if (contest.end > nowSec) return 'running';
  return 'ended';
}

/**
 * @param {Array} contests merged list
 * @param {Object} settings full settings (uses .filters and .platforms)
 * @returns filtered + sorted contests
 */
export function applyFilters(contests, settings, nowSec) {
  const { filters, platforms } = settings;
  const search = (filters.search || '').trim().toLowerCase();

  const filtered = contests.filter((c) => {
    const status = contestStatus(c, nowSec);
    if (status === 'ended' && c.end <= nowSec - ENDED_RETENTION_SEC) return false;
    // Platform toggles: 'other' shows only when the clist source is on.
    if (c.platformKey === 'other') {
      if (!platforms.clist) return false;
    } else if (platforms[c.platformKey] === false) {
      return false;
    }
    if (filters.hideRunning && c.start <= nowSec) return false;
    if (filters.timeWindowDays > 0 && c.start > nowSec) {
      if (c.start - nowSec > filters.timeWindowDays * 86400) return false;
    }
    if (filters.maxDurationHours > 0 && c.durationSeconds > filters.maxDurationHours * 3600) {
      return false;
    }
    if (search) {
      const haystack = `${c.name} ${c.platformLabel}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return sortContests(filtered, filters.sortBy, nowSec);
}

export function sortContests(contests, sortBy, nowSec) {
  // running pinned first, then upcoming, ended last.
  const order = { running: 0, upcoming: 1, ended: 2 };
  const status = (c) => order[contestStatus(c, nowSec)] ?? 1;
  const sorted = [...contests];
  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'duration':
      sorted.sort((a, b) => a.durationSeconds - b.durationSeconds);
      break;
    case 'start':
    default:
      sorted.sort((a, b) => a.start - b.start || a.end - b.end);
      break;
  }
  return sorted.sort((a, b) => status(a) - status(b));
}

/** Next upcoming contest (for the hero card). */
export function nextUpcoming(contests, nowSec) {
  return contests
    .filter((c) => c.start > nowSec)
    .sort((a, b) => a.start - b.start)[0] || null;
}
