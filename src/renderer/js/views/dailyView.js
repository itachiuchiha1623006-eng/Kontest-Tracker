/**
 * Daily view: today's LeetCode problem (mark-done toggle) plus the
 * contest attendance tracker — LeetCode-submissions-calendar style, but
 * counting contests attended instead of submissions. Days with at least
 * one attended contest glow in the month heatmap; hovering a day lists
 * which contests were attended.
 */

import { api } from '../api.js';
import { el, icon, renderEmpty, makeToggle } from '../components/widgets.js';
import { localDateKey } from '../format.js';

let cardSlot;

export function initDailyView(root) {
  cardSlot = el('div');
  root.append(cardSlot);
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Local calendar date key for year/month/day (month is 0-based). */
function keyOf(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Weeks-of-month grid for the heatmap: array of weeks, each 7 cells. */
function buildMonthCells(now) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function renderDaily(state) {
  const { daily, progress, attendance } = state;
  cardSlot.replaceChildren();

  renderDailyCard(daily, progress);
  renderAttendanceCard(attendance);
}

function renderDailyCard(daily, progress) {
  if (!daily) {
    cardSlot.append(renderEmpty('📅', 'No daily challenge yet', 'Refresh to fetch today’s LeetCode problem.'));
    return;
  }

  const todayKey = localDateKey();
  // The challenge's own date string is the progress key; fall back to the
  // local date when LeetCode's date is missing/malformed.
  const doneKey = /^\d{4}-\d{2}-\d{2}$/.test(daily.date) ? daily.date : todayKey;
  const isDone = Boolean(progress?.doneDates?.includes(doneKey));

  const toggle = makeToggle(isDone, (next) => {
    api.markDailyDone({ date: doneKey, done: next })
      .then((res) => {
        if (res?.error) return;
        window.dispatchEvent(new CustomEvent('kontest:daily-progress', { detail: res.doneDates ? res : null }));
      })
      .catch(() => {});
  }, 'Mark today’s problem as done');

  cardSlot.append(el('div', { class: 'daily-card' }, [
    el('div', { class: 'daily-top' }, [
      el('span', { class: 'daily-date', text: `Daily · ${daily.date || todayKey}` }),
      el('button', {
        class: 'icon-btn',
        title: 'Open problem on LeetCode',
        onclick: () => api.openExternal({ url: daily.url }).catch(() => {}),
      }, [icon('external')]),
    ]),
    el('div', {}, [
      el('span', { class: 'daily-qid', text: `#${daily.questionId} ` }),
      el('span', { class: 'daily-title', text: daily.title }),
    ]),
    el('div', { class: 'done-toggle' }, [
      toggle,
      el('span', { text: isDone ? 'Done today — nice!' : 'Mark done today' }),
    ]),
  ]));
}

function renderAttendanceCard(attendance) {
  const now = new Date();
  const todayKey = localDateKey(now);
  const byDate = attendance?.byDate || {};
  const total = attendance?.total || 0;
  const thisMonth = attendance?.thisMonth || 0;

  // ---- Attendance counters (LeetCode-stats style) ----
  const stats = el('div', { class: 'streak-row' }, [
    el('div', { class: 'streak-box lc-streak' }, [
      el('span', { class: 'stat-ico', title: 'All-time attended contests' }, [icon('checkCircle')]),
      el('span', { class: 'num', text: String(total) }),
      el('span', { class: 'lbl', text: 'attended' }),
    ]),
    el('div', { class: 'streak-box lc-streak' }, [
      el('span', { class: 'stat-ico dim', title: 'Attended this month' }, [icon('checkCircle')]),
      el('span', { class: 'num', text: String(thisMonth) }),
      el('span', { class: 'lbl', text: 'this month' }),
    ]),
  ]);

  // ---- Month calendar heatmap ----
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const grid = el('div', { class: 'cal-grid' });

  for (const wd of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']) {
    grid.append(el('span', { class: 'cal-wd', text: wd }));
  }
  for (const day of buildMonthCells(now)) {
    if (day === null) {
      grid.append(el('span', { class: 'cal-cell empty' }));
      continue;
    }
    const key = keyOf(now.getFullYear(), now.getMonth(), day);
    const contestsThatDay = byDate[key] || [];
    const classes = ['cal-cell'];
    if (contestsThatDay.length > 0) classes.push('done');
    if (key === todayKey) classes.push('today');
    const tooltip = contestsThatDay.length > 0
      ? `${key} · ${contestsThatDay.map((c) => c.name).join('\n')}`
      : key;
    grid.append(el('span', { class: classes.join(' '), text: String(day), title: tooltip }));
  }

  const hint = total === 0
    ? el('div', { class: 'att-hint', text: 'Mark contests with the ✓ button to build your attendance history.' })
    : null;

  cardSlot.append(el('div', { class: 'daily-card' }, [
    el('div', { class: 'section-title', text: 'Contests attended' }),
    stats,
    el('div', { class: 'section-title', text: monthLabel }),
    grid,
    hint,
  ]));
}
