/**
 * Settings view: appearance, refresh cadence, reminders, clist.by
 * credentials, behavior toggles, about. Text inputs update-if-different
 * so re-renders never clobber active typing.
 */

import { api } from '../api.js';
import { el, icon, makeToggle } from '../components/widgets.js';

let container;
let refs = {};

export function initSettingsView(root) {
  container = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
  root.append(container);
}

export function renderSettings(state) {
  const { settings } = state;
  if (!settings) return;
  container.replaceChildren();
  refs = {};

  // ---- Appearance ----
  container.append(el('div', { class: 'section-title', text: 'Appearance' }));

  const themeSelect = el('select', {
    class: 'select',
    onchange: (e) => api.setSettings({ appearance: { theme: e.target.value } }).catch(() => {}),
  }, [
    el('option', { value: 'dark', text: 'Dark', selected: settings.appearance.theme === 'dark' }),
    el('option', { value: 'light', text: 'Light', selected: settings.appearance.theme === 'light' }),
  ]);
  container.append(el('div', { class: 'row' }, [
    el('span', { text: 'Theme' }), themeSelect,
  ]));

  const swatches = ['violet', 'teal', 'amber', 'rose'].map((name) => {
    const colors = { violet: '#8b6dff', teal: '#14b8a6', amber: '#f59e0b', rose: '#fb7185' };
    return el('button', {
      class: `swatch${settings.appearance.accent === name ? ' selected' : ''}`,
      style: { background: colors[name] },
      title: name,
      'aria-label': `${name} accent`,
      onclick: () => api.setSettings({ appearance: { accent: name } }).catch(() => {}),
    });
  });
  container.append(el('div', { class: 'row' }, [
    el('span', { text: 'Accent' }),
    el('div', { class: 'swatch-row' }, swatches),
  ]));

  const minus = el('button', { text: '−', 'aria-label': 'Smaller text' });
  const plus = el('button', { text: '+', 'aria-label': 'Larger text' });
  const sizeValue = el('span', { class: 'value', text: String(settings.appearance.fontSize) });
  const bump = (delta) => {
    const next = Math.min(16, Math.max(11, Number(sizeValue.textContent) + delta));
    if (next !== Number(sizeValue.textContent)) {
      sizeValue.textContent = String(next);
      api.setSettings({ appearance: { fontSize: next } }).catch(() => {});
    }
  };
  minus.addEventListener('click', () => bump(-1));
  plus.addEventListener('click', () => bump(1));
  container.append(el('div', { class: 'row' }, [
    el('span', { text: 'Font size' }),
    el('div', { class: 'stepper' }, [minus, sizeValue, plus]),
  ]));

  // ---- Refresh ----
  container.append(el('div', { class: 'section-title', text: 'Data' }));
  container.append(el('div', { class: 'row' }, [
    el('div', { class: 'row-label' }, [
      el('span', { text: 'Refresh every' }),
      el('span', { class: 'hint', text: 'How often contest sources are polled' }),
    ]),
    el('select', {
      class: 'select',
      onchange: (e) => api.setSettings({ behavior: { refreshIntervalMinutes: Number(e.target.value) } }).catch(() => {}),
    }, [
      [15, '15 min'], [30, '30 min'], [60, '1 hour'], [180, '3 hours'], [360, '6 hours'],
    ].map(([v, label]) => el('option', {
      value: String(v), text: label,
      selected: settings.behavior.refreshIntervalMinutes === v,
    })),
  )]));

  // ---- Reminders ----
  container.append(el('div', { class: 'section-title', text: 'Reminders' }));
  container.append(el('div', { class: 'row' }, [
    el('span', { text: 'Enable reminders' }),
    makeToggle(settings.reminders.enabled, (next) => {
      api.setSettings({ reminders: { enabled: next } }).catch(() => {});
    }, 'enable reminders'),
  ]));

  for (const lead of [15, 30, 60]) {
    const checked = settings.reminders.leadMinutes.includes(lead);
    container.append(el('div', { class: 'row' }, [
      el('span', { text: `${lead} minutes before start` }),
      makeToggle(checked, (next) => {
        const set = new Set(settings.reminders.leadMinutes);
        if (next) set.add(lead); else set.delete(lead);
        const leadMinutes = set.size ? [...set] : [30];
        api.setSettings({ reminders: { leadMinutes } }).catch(() => {});
      }, `${lead} minute reminder`),
    ]));
  }

  container.append(el('button', {
    class: 'btn',
    onclick: () => api.testReminder().catch(() => {}),
  }, [icon('bell'), 'Send test notification']));

  // ---- clist.by ----
  container.append(el('div', { class: 'section-title', text: 'clist.by (extra platforms)' }));
  container.append(el('div', { class: 'row' }, [
    el('div', { class: 'row-label' }, [
      el('span', { text: 'Enable clist.by source' }),
      el('span', { class: 'hint', text: 'Adds CodeChef, GeeksforGeeks, HackerEarth, Topcoder…' }),
    ]),
    makeToggle(settings.platforms.clist, (next) => {
      api.setSettings({ platforms: { clist: next } }).catch(() => {});
    }, 'enable clist'),
  ]));

  const userInput = el('input', {
    class: 'text-input', type: 'text', placeholder: 'clist.by username',
    value: settings.clist.username || '',
    onchange: (e) => api.setSettings({ clist: { username: e.target.value.trim() } }).catch(() => {}),
  });
  const keyInput = el('input', {
    class: 'text-input', type: 'password', placeholder: 'API key',
    value: settings.clist.apiKey || '',
    onchange: (e) => api.setSettings({ clist: { apiKey: e.target.value.trim() } }).catch(() => {}),
  });
  refs.clistUser = userInput;
  refs.clistKey = keyInput;

  const testResult = el('span', { class: 'hint', text: '' });
  container.append(
    el('div', { class: 'row' }, [userInput]),
    el('div', { class: 'row' }, [keyInput]),
    el('div', { class: 'row' }, [
      testResult,
      el('button', {
        class: 'btn',
        text: 'Test credentials',
        onclick: async () => {
          testResult.textContent = 'Testing…';
          try {
            const res = await api.testClist();
            testResult.textContent = res?.ok
              ? `✓ works (${res.sampleCount} contests found)`
              : `✗ ${res?.error || 'failed'}`;
          } catch {
            testResult.textContent = '✗ failed';
          }
        },
      }),
    ]),
    el('div', { class: 'row' }, [
      el('span', { class: 'hint', text: 'Free key at clist.by → Settings → API' }),
      el('button', {
        class: 'btn', text: 'Open clist.by',
        onclick: () => api.openExternal({ url: 'https://clist.by' }).catch(() => {}),
      }),
    ]),
  );

  // ---- Behavior ----
  container.append(el('div', { class: 'section-title', text: 'Behavior' }));
  const toggles = [
    ['alwaysOnTop', 'Always on top', 'Widget floats above other windows'],
    ['showOnAllWorkspaces', 'Show on all workspaces', 'Visible on every virtual desktop'],
    ['launchOnStartup', 'Launch on startup', 'Start hidden in tray when you log in'],
    ['hideToTrayOnClose', 'Hide to tray on close', 'Closing the widget only hides it'],
  ];
  for (const [key, label, hint] of toggles) {
    container.append(el('div', { class: 'row' }, [
      el('div', { class: 'row-label' }, [
        el('span', { text: label }),
        hint ? el('span', { class: 'hint', text: hint }) : null,
      ]),
      makeToggle(settings.behavior[key], (next) => {
        api.setSettings({ behavior: { [key]: next } }).catch(() => {});
      }, label),
    ]));
  }

  // ---- About ----
  container.append(el('div', { class: 'section-title', text: 'About' }));
  const versions = el('div', { class: 'hint', text: 'Loading versions…' });
  api.getVersions().then((v) => {
    if (!v?.error) {
      versions.textContent = `Kontest Tracker ${v.app} · Electron ${v.electron} · Node ${v.node}`;
    }
  }).catch(() => {});

  container.append(
    el('div', { class: 'row' }, [
      versions,
      el('button', {
        class: 'btn', text: 'Data folder',
        onclick: () => api.openDataFolder().catch(() => {}),
      }),
    ]),
    el('button', {
      class: 'btn danger', text: 'Reset all settings',
      onclick: () => api.resetSettings().catch(() => {}),
    }),
    el('button', {
      class: 'btn danger', text: 'Quit Kontest Tracker',
      onclick: () => api.quitApp().catch(() => {}),
    }),
  );
}
