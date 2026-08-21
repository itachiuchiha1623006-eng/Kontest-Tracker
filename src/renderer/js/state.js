/**
 * Minimal observable store. Views subscribe and re-render on patch();
 * patches only happen on data/settings changes — never on the 1s tick.
 */

const listeners = new Set();

const state = {
  settings: null,
  contests: [],
  sources: [],
  daily: null,
  progress: null,
  attendance: null,
  refreshing: false,
};

export const store = {
  get: () => state,

  patch(partial) {
    Object.assign(state, partial);
    for (const fn of listeners) {
      try { fn(state); } catch (err) { console.error('[store] subscriber failed:', err); }
    }
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
