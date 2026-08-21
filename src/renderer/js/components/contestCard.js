/**
 * Contest card + hero card. Clicking anywhere opens the contest URL;
 * the bell toggles per-contest reminder mute; the check marks attendance.
 */

import { api } from '../api.js';
import { store } from '../state.js';
import { el, icon } from './widgets.js';
import { formatCountdown, formatDateTime, formatDuration } from '../format.js';
import { registerTicker } from '../countdownTicker.js';
import { contestStatus } from '../filters.js';

function platformColor(platformKey) {
  const style = getComputedStyle(document.documentElement);
  // Platform colors come from shared/platforms.js via a data attribute map
  // rendered inline; fall back to accent if unknown.
  return CARD_COLORS[platformKey] || style.getPropertyValue('--accent').trim() || '#8b6dff';
}

// Mirrors src/shared/platforms.mjs colors (kept in sync; renderer can't
// import the ESM shared module through the app://shared host without an
// extra fetch — a static map is simpler and CSP-safe).
const CARD_COLORS = {
  codeforces: '#3b82f6',
  leetcode: '#f59e0b',
  atcoder: '#14b8a6',
  hackerrank: '#22c55e',
  codechef: '#a78bfa',
  geeksforgeeks: '#4ade80',
  hackerearth: '#818cf8',
  topcoder: '#38bdf8',
  csacademy: '#fb923c',
  other: '#94a3b8',
};

function openContest(contest) {
  api.openExternal({ url: contest.url }).then((res) => {
    if (res?.error) console.warn('[contestCard] open failed:', res.error);
  });
}

/** Big "next contest" hero card. */
export function renderHero(contest) {
  const countdown = el('div', { class: 'hero-countdown', text: '—' });
  const meta = el('div', { class: 'hero-meta' });

  const card = el('div', { class: 'hero', onclick: () => openContest(contest) }, [
    el('div', { class: 'hero-label', text: 'Next up' }),
    el('div', { class: 'hero-name', text: contest.name }),
    countdown,
    meta,
  ]);

  meta.append(
    el('span', {
      class: 'chip platform',
      text: contest.platformLabel,
      style: { '--chip-color': platformColor(contest.platformKey) },
    }),
    el('span', { text: formatDateTime(contest.start) }),
  );

  registerTicker(countdown, (now) => {
    countdown.textContent = formatCountdown(contest.start - now);
  });

  return card;
}

/** Compact list row. */
export function renderContestCard(contest, settings, nowSec) {
  const status = contestStatus(contest, nowSec);
  const muted = Boolean(settings.reminders.mutedContests[contest.id]);
  const attended = Boolean(store.get().attendance?.attendedIds?.includes(contest.id));

  const countdown = el('div', {
    class: `cc-countdown${status === 'running' ? ' live' : ''}`,
    text: status === 'running' ? 'LIVE' : status === 'ended' ? 'ended' : '—',
  });

  const body = el('div', { class: 'cc-body' }, [
    el('div', { class: 'cc-name', text: contest.name, title: contest.name }),
    el('div', { class: 'cc-meta' }, [
      el('span', {
        class: 'chip platform',
        text: contest.platformLabel,
        style: { '--chip-color': platformColor(contest.platformKey) },
      }),
      status === 'running'
        ? el('span', { class: 'chip live', text: 'LIVE' })
        : el('span', { text: formatDateTime(contest.start) }),
      status === 'ended'
        ? el('span', { class: 'chip ended', text: 'ended' })
        : el('span', { text: formatDuration(contest.durationSeconds) }),
      contest.rated ? el('span', { class: 'chip rated', text: 'rated' }) : null,
    ]),
    countdown,
  ]);

  const bellBtn = el('button', {
    class: `icon-btn${muted ? ' muted' : ''}`,
    title: muted ? 'Reminders muted for this contest' : 'Mute reminders for this contest',
    onclick: (e) => {
      e.stopPropagation();
      const nextMuted = !bellBtn.classList.contains('muted');
      bellBtn.classList.toggle('muted', nextMuted);
      bellBtn.title = nextMuted ? 'Reminders muted for this contest' : 'Mute reminders for this contest';
      bellBtn.replaceChildren(icon(nextMuted ? 'bellOff' : 'bell'));
      const mutedContests = { ...settings.reminders.mutedContests, [contest.id]: nextMuted };
      api.setSettings({ reminders: { mutedContests } }).catch(() => {});
    },
  }, [icon(muted ? 'bellOff' : 'bell')]);

  // Attendance toggle: records the contest in the attendance calendar.
  const attendBtn = el('button', {
    class: `icon-btn attend${attended ? ' active' : ''}`,
    title: attended ? 'Attended — click to unmark' : 'Mark as attended',
    'aria-pressed': String(attended),
    onclick: (e) => {
      e.stopPropagation();
      api.toggleAttendance({
        id: contest.id,
        name: contest.name,
        platformKey: contest.platformKey,
        platformLabel: contest.platformLabel,
        url: contest.url,
        start: contest.start,
      }).then((res) => {
        if (!res?.error) store.patch({ attendance: res });
      }).catch(() => {});
    },
  }, [icon('checkCircle')]);

  const actions = [attendBtn];
  if (status !== 'ended') actions.push(bellBtn);

  const card = el('div', {
    class: `contest-card${status === 'running' ? ' running' : ''}${status === 'ended' ? ' ended' : ''}`,
    onclick: () => openContest(contest),
    title: 'Open contest page',
  }, [
    el('div', { class: 'cc-stripe', style: { background: platformColor(contest.platformKey) } }),
    body,
    el('div', { class: 'cc-actions' }, actions),
  ]);

  if (status === 'upcoming') {
    registerTicker(countdown, (now) => {
      const remaining = contest.start - now;
      if (remaining <= 0) {
        countdown.textContent = 'LIVE';
        countdown.classList.add('live');
      } else {
        countdown.textContent = formatCountdown(remaining);
      }
    });
  }

  return card;
}
