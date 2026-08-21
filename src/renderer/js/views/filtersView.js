/**
 * Filters view: platform toggles, time window, max duration, hide-running,
 * and reset. Every change persists via settings:set.
 */

import { api } from '../api.js';
import { el, makeCheckRow, makeToggle } from '../components/widgets.js';
import { FILTERABLE_KEYS } from '../../shared/platforms.js';

const PLATFORM_COLORS = {
  codeforces: '#3b82f6',
  leetcode: '#f59e0b',
  atcoder: '#14b8a6',
  hackerrank: '#22c55e',
  codechef: '#a78bfa',
  geeksforgeeks: '#4ade80',
  hackerearth: '#818cf8',
  topcoder: '#38bdf8',
  csacademy: '#fb923c',
};

let container;

export function initFiltersView(root) {
  container = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
  root.append(container);
}

export function renderFilters(state) {
  const { settings } = state;
  if (!settings) return;
  container.replaceChildren();

  // ---- Platforms ----
  container.append(el('div', { class: 'section-title', text: 'Platforms' }));
  for (const key of FILTERABLE_KEYS) {
    const checked = settings.platforms[key] !== false;
    container.append(makeCheckRow({
      label: platformLabel(key),
      color: PLATFORM_COLORS[key],
      checked,
      onToggle: (next) => {
        api.setSettings({ platforms: { [key]: next } }).catch(() => {});
      },
    }));
  }

  // ---- Time window ----
  container.append(el('div', { class: 'section-title', text: 'Starts within' }));
  container.append(makeSelectRow({
    value: String(settings.filters.timeWindowDays),
    options: [
      ['7', '7 days'], ['14', '14 days'], ['30', '30 days'],
      ['90', '90 days'], ['0', 'Any time'],
    ],
    onChange: (v) => api.setSettings({ filters: { timeWindowDays: Number(v) } }).catch(() => {}),
  }));

  // ---- Duration ----
  container.append(el('div', { class: 'section-title', text: 'Max duration' }));
  container.append(makeSelectRow({
    value: String(settings.filters.maxDurationHours),
    options: [
      ['2', 'Up to 2h'], ['3', 'Up to 3h'], ['6', 'Up to 6h'],
      ['12', 'Up to 12h'], ['24', 'Up to 24h'], ['0', 'Any duration'],
    ],
    onChange: (v) => api.setSettings({ filters: { maxDurationHours: Number(v) } }).catch(() => {}),
  }));

  // ---- Hide running ----
  container.append(el('div', { class: 'section-title', text: 'List' }));
  container.append(el('div', { class: 'row' }, [
    el('div', { class: 'row-label' }, [
      el('span', { text: 'Hide running contests' }),
      el('span', { class: 'hint', text: 'Only show contests that haven’t started' }),
    ]),
    makeToggle(settings.filters.hideRunning, (next) => {
      api.setSettings({ filters: { hideRunning: next } }).catch(() => {});
    }, 'hide running'),
  ]));

  // ---- Reset ----
  container.append(el('button', {
    class: 'btn danger',
    style: { marginTop: '10px' },
    text: 'Reset filters',
    onclick: () => api.setSettings({
      filters: {
        timeWindowDays: 30, maxDurationHours: 0, hideRunning: false, search: '', sortBy: 'start',
      },
    }).catch(() => {}),
  }));
}

function makeSelectRow({ value, options, onChange }) {
  const select = el('select', { class: 'select', onchange: (e) => onChange(e.target.value) },
    options.map(([v, label]) => el('option', { value: v, text: label, selected: v === value })));
  return el('div', { class: 'row' }, [select]);
}

function platformLabel(key) {
  const labels = {
    codeforces: 'Codeforces', leetcode: 'LeetCode', atcoder: 'AtCoder',
    hackerrank: 'HackerRank', codechef: 'CodeChef', geeksforgeeks: 'GeeksforGeeks',
    hackerearth: 'HackerEarth', topcoder: 'Topcoder', csacademy: 'CS Academy',
  };
  return labels[key] || key;
}
