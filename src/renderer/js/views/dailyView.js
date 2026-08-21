/**
 * LeetCode Daily view: today's problem, mark-done toggle, streaks,
 * and a last-14-days history strip.
 */

import { api } from '../api.js';
import { el, icon, renderEmpty, makeToggle } from '../components/widgets.js';
import { formatRelative, localDateKeyMinus } from '../format.js';

let cardSlot;

export function initDailyView(root) {
  cardSlot = el('div');
  root.append(cardSlot);
}

export function renderDaily(state) {
  const { daily, progress } = state;
  cardSlot.replaceChildren();

  if (!daily) {
    cardSlot.append(renderEmpty('📅', 'No daily challenge yet', 'Refresh to fetch today’s LeetCode problem.'));
    return;
  }

  const todayKey = localDateKeyMinus(0);
  // The challenge's own date string is the progress key; fall back to the
  // local date when LeetCode's date is missing/malformed.
  const doneKey = /^\d{4}-\d{2}-\d{2}$/.test(daily.date) ? daily.date : todayKey;
  const isDone = Boolean(progress?.doneDates?.includes(doneKey));

  const toggle = makeToggle(isDone, (next) => {
    api.markDailyDone({ date: doneKey, done: next })
      .then((res) => {
        if (res?.error) return;
        const p = res.doneDates ? res : null;
        window.dispatchEvent(new CustomEvent('kontest:daily-progress', { detail: p }));
      })
      .catch(() => {});
  }, 'Mark today’s problem as done');

  const doneRow = el('div', { class: 'done-toggle' }, [
    toggle,
    el('span', { text: isDone ? 'Done today — nice!' : 'Mark done today' }),
  ]);

  const streakRow = el('div', { class: 'streak-row' }, [
    el('div', { class: 'streak-box' }, [
      el('div', { class: 'num', text: String(progress?.current ?? 0) }),
      el('div', { class: 'lbl', text: 'current streak' }),
    ]),
    el('div', { class: 'streak-box' }, [
      el('div', { class: 'num', text: String(progress?.best ?? 0) }),
      el('div', { class: 'lbl', text: 'best streak' }),
    ]),
  ]);

  const strip = el('div', { class: 'history-strip', title: 'Last 14 days' });
  const doneSet = new Set(progress?.doneDates || []);
  for (let i = 13; i >= 0; i--) {
    const key = localDateKeyMinus(i);
    strip.append(el('span', {
      class: `hist-day${doneSet.has(key) ? ' done' : ''}${i === 0 ? ' today' : ''}`,
      title: `${key}${doneSet.has(key) ? ' · done' : ''}`,
    }));
  }

  cardSlot.append(
    el('div', { class: 'daily-card' }, [
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
      doneRow,
      streakRow,
      el('div', {}, [el('div', { class: 'section-title', text: 'Last 14 days' }), strip]),
    ]),
  );
}
