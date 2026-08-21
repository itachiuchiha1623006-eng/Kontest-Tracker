/**
 * Contests view: search + sort controls (built once, so typing never
 * loses focus), offline/error banner, hero next-contest card, and the
 * filtered list with "show more" pagination.
 */

import { api } from '../api.js';
import { store } from '../state.js';
import { el, icon, renderEmpty } from '../components/widgets.js';
import { renderHero, renderContestCard } from '../components/contestCard.js';
import { applyFilters, nextUpcoming } from '../filters.js';
import { formatRelative } from '../format.js';

const PAGE_SIZE = 30;

let searchInput;
let sortSelect;
let bannerSlot;
let heroSlot;
let listSlot;
let moreSlot;
let shown = PAGE_SIZE;
let searchTimer = null;
let lastRenderedNow = 0;

export function initContestsView(root) {
  searchInput = el('input', {
    class: 'text-input',
    type: 'search',
    placeholder: 'Search contests…',
    'aria-label': 'Search contests',
    oninput: () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        api.setSettings({ filters: { search: searchInput.value } }).catch(() => {});
      }, 300);
    },
  });

  sortSelect = el('select', {
    class: 'select',
    'aria-label': 'Sort contests',
    onchange: () => api.setSettings({ filters: { sortBy: sortSelect.value } }).catch(() => {}),
  }, [
    el('option', { value: 'start', text: 'Soonest' }),
    el('option', { value: 'name', text: 'Name' }),
    el('option', { value: 'duration', text: 'Duration' }),
  ]);

  const searchRow = el('div', { class: 'search-row' }, [searchInput, sortSelect]);
  bannerSlot = el('div');
  heroSlot = el('div');
  listSlot = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
  moreSlot = el('div');

  moreSlot.addEventListener('click', (e) => {
    if (e.target.closest('button.btn')) shown += PAGE_SIZE;
  });

  root.append(searchRow, bannerSlot, heroSlot, listSlot, moreSlot);
}

export function renderContests(state) {
  const { settings, contests, sources, refreshing } = state;
  if (!settings) return;
  const nowSec = Math.floor(Date.now() / 1000);
  lastRenderedNow = nowSec;

  // Sync controls with settings (without clobbering active typing).
  if (searchInput.value !== (settings.filters.search || '') &&
      document.activeElement !== searchInput) {
    searchInput.value = settings.filters.search || '';
  }
  if (sortSelect.value !== settings.filters.sortBy) sortSelect.value = settings.filters.sortBy;

  renderBanner(sources, settings, nowSec);

  const filtered = applyFilters(contests, settings, nowSec);
  const next = nextUpcoming(contests, nowSec);

  heroSlot.replaceChildren();
  if (next && !settings.filters.hideRunning) heroSlot.append(renderHero(next));

  // Reset pagination when the result set shrinks below the current page.
  if (shown > filtered.length) shown = Math.max(PAGE_SIZE, Math.ceil(filtered.length / PAGE_SIZE) * PAGE_SIZE);

  listSlot.replaceChildren();
  if (filtered.length === 0) {
    listSlot.append(renderEmpty(
      '🏁',
      sources.some((s) => s.state === 'error') ? 'Nothing to show' : 'No upcoming contests',
      sources.some((s) => s.state === 'error')
        ? 'Some sources failed — try Refresh, or check Filters.'
        : 'Try widening the time window in Filters, or enable more platforms.',
    ));
  } else {
    for (const contest of filtered.slice(0, shown)) {
      listSlot.append(renderContestCard(contest, settings, nowSec));
    }
  }

  renderMoreButton(filtered.length);
}

function renderBanner(sources, settings, nowSec) {
  bannerSlot.replaceChildren();
  const enabled = sources.filter((s) => s.enabled);
  const errored = enabled.filter((s) => s.state === 'error');
  const allFailed = enabled.length > 0 && errored.length === enabled.length;

  if (allFailed) {
    const stalest = Math.max(...sources.map((s) => s.fetchedAt), 0);
    bannerSlot.append(el('div', { class: 'banner offline' }, [
      el('span', {
        text: stalest
          ? `Offline — cached data from ${formatRelative(stalest, nowSec)}`
          : 'Offline — no cached data yet',
      }),
      el('button', {
        class: 'btn', text: 'Retry', onclick: () => window.dispatchEvent(new Event('kontest:refresh')),
      }),
    ]));
  } else if (errored.length > 0) {
    bannerSlot.append(el('div', { class: 'banner error', title: errored.map((s) => `${s.label}: ${s.error}`).join('\n') }, [
      el('span', { text: `${errored.length} source(s) failed — showing cached where available` }),
    ]));
  }

  // Nudge when clist is enabled as a platform but credentials are missing.
  if (settings.platforms.clist && (!settings.clist.username || !settings.clist.apiKey)) {
    bannerSlot.append(el('div', { class: 'banner offline' }, [
      el('span', { text: 'clist.by needs an API key — add it in Settings' }),
      el('button', {
        class: 'btn', text: 'Open', onclick: () => window.dispatchEvent(new Event('kontest:open-settings')),
      }),
    ]));
  }
}

function renderMoreButton(total) {
  moreSlot.replaceChildren();
  if (total > shown) {
    moreSlot.append(el('button', {
      class: 'btn', style: { width: '100%' },
      text: `Show more (${total - shown} hidden)`,
      onclick: () => {
        shown += PAGE_SIZE;
        renderContests(store.get());
      },
    }));
  }
}
