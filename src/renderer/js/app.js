/**
 * Renderer entry: boot order is deliberate — settings first (theme
 * applied before first paint), then cached contests/daily (instant,
 * offline-safe), then push subscriptions. Main pushes fresh data when
 * its background refresh completes.
 */

import { api } from './api.js';
import { store } from './state.js';
import { applyTheme } from './theme.js';
import { initViewRouter, showView } from './router.js';
import { icon } from './components/widgets.js';
import { renderSourceDots } from './components/sourceStatus.js';
import { initContestsView, renderContests } from './views/contestsView.js';
import { initDailyView, renderDaily } from './views/dailyView.js';
import { initFiltersView, renderFilters } from './views/filtersView.js';
import { initSettingsView, renderSettings } from './views/settingsView.js';

const statusMsg = document.getElementById('status-msg');
const sourceDots = document.getElementById('source-dots');
const btnRefresh = document.getElementById('btn-refresh');
const btnPin = document.getElementById('btn-pin');
const btnClose = document.getElementById('btn-close');

let statusTimer = null;

function flashStatus(text, kind = '') {
  statusMsg.textContent = text;
  statusMsg.className = kind;
  clearTimeout(statusTimer);
  if (text) {
    statusTimer = setTimeout(() => {
      statusMsg.textContent = '';
      statusMsg.className = '';
    }, 4000);
  }
}

function setRefreshing(refreshing) {
  btnRefresh.classList.toggle('spinning', refreshing);
  store.patch({ refreshing });
}

async function doRefresh() {
  if (store.get().refreshing) return;
  setRefreshing(true);
  try {
    const snap = await api.refreshContests();
    if (snap?.error) {
      flashStatus(`Refresh failed: ${snap.error}`, 'flash-error');
    } else {
      store.patch({ contests: snap.contests, sources: snap.sources });
      flashStatus(`Updated · ${snap.contests.length} contests`, 'flash-ok');
    }
  } catch {
    flashStatus('Refresh failed', 'flash-error');
  } finally {
    setRefreshing(false);
  }
}

function renderAll(state) {
  renderContests(state);
  renderDaily(state);
  renderFilters(state);
  renderSettings(state);
  renderSourceDots(sourceDots, state.sources, Math.floor(Date.now() / 1000));
  if (btnPin) {
    api.getWindowState().then((ws) => {
      if (!ws?.error) btnPin.classList.toggle('active', Boolean(ws.alwaysOnTop));
    }).catch(() => {});
  }
}

async function boot() {
  // 1. Settings → theme before first paint.
  const settings = await api.getSettings();
  if (settings?.error) throw new Error(settings.error);
  store.patch({ settings });
  applyTheme(settings);

  // 2. Static shell: router, views, titlebar.
  initViewRouter();
  initContestsView(document.getElementById('view-contests'));
  initDailyView(document.getElementById('view-daily'));
  initFiltersView(document.getElementById('view-filters'));
  initSettingsView(document.getElementById('view-settings'));

  btnRefresh.replaceChildren(icon('refresh'));
  btnPin.replaceChildren(icon('pin'));
  btnClose.replaceChildren(icon('close'));

  btnRefresh.addEventListener('click', doRefresh);
  btnClose.addEventListener('click', () => api.hideWindow().catch(() => {}));
  btnPin.addEventListener('click', () => {
    const next = !btnPin.classList.contains('active');
    btnPin.classList.toggle('active', next);
    api.setAlwaysOnTop({ enabled: next }).catch(() => {});
  });

  window.addEventListener('kontest:refresh', doRefresh);
  window.addEventListener('kontest:open-settings', () => showView('settings'));

  // 3. Cached data — instant, offline-safe.
  const snap = await api.getContests();
  if (!snap?.error) store.patch({ contests: snap.contests, sources: snap.sources });
  const daily = await api.getDaily();
  if (!daily?.error) store.patch({ daily: daily.daily });
  const attendance = await api.getAttendance();
  if (!attendance?.error) store.patch({ attendance });

  // 4. Push channels keep us in sync with main-process refreshes.
  api.on('push:contests-updated', (s) => {
    store.patch({ contests: s.contests, sources: s.sources });
  });
  api.on('push:daily-updated', (s) => {
    store.patch({ daily: s.daily });
  });
  api.on('push:attendance-changed', (a) => {
    store.patch({ attendance: a });
  });
  api.on('push:settings-changed', (s) => {
    store.patch({ settings: s });
    applyTheme(s);
  });
  api.on('push:resync', async () => {
    const s = await api.getContests();
    if (!s?.error) store.patch({ contests: s.contests, sources: s.sources });
  });

  // 5. Single render pipeline: any patch re-renders every view.
  store.subscribe(renderAll);
  renderAll(store.get());

  // Keep "updated Xm ago" tooltips honest.
  setInterval(() => renderSourceDots(sourceDots, store.get().sources, Math.floor(Date.now() / 1000)), 30_000);

  console.log('[kontest] renderer ready');
}

boot().catch((err) => {
  console.error('[kontest] boot failed:', err);
  document.getElementById('view-contests')?.append(
    Object.assign(document.createElement('div'), {
      className: 'state-box',
      textContent: `Boot failed: ${err.message}`,
    }),
  );
});
