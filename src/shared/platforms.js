/**
 * Canonical platform registry — the single source of truth shared by the
 * main process (normalization, URL allowlist) and the renderer (labels,
 * filter chips, colors).
 *
 * ESM on purpose: the renderer imports it directly; the main process
 * loads it with `await import()` (see src/main/util.js: loadShared()).
 */

export const PLATFORMS = {
  codeforces: {
    key: 'codeforces',
    label: 'Codeforces',
    color: '#3b82f6',
    hosts: ['codeforces.com'],
  },
  leetcode: {
    key: 'leetcode',
    label: 'LeetCode',
    color: '#f59e0b',
    hosts: ['leetcode.com'],
  },
  atcoder: {
    key: 'atcoder',
    label: 'AtCoder',
    color: '#14b8a6',
    hosts: ['atcoder.jp'],
  },
  hackerrank: {
    key: 'hackerrank',
    label: 'HackerRank',
    color: '#22c55e',
    hosts: ['hackerrank.com'],
  },
  codechef: {
    key: 'codechef',
    label: 'CodeChef',
    color: '#a78bfa',
    hosts: ['codechef.com'],
  },
  geeksforgeeks: {
    key: 'geeksforgeeks',
    label: 'GeeksforGeeks',
    color: '#4ade80',
    hosts: ['geeksforgeeks.org'],
  },
  hackerearth: {
    key: 'hackerearth',
    label: 'HackerEarth',
    color: '#818cf8',
    hosts: ['hackerearth.com'],
  },
  topcoder: {
    key: 'topcoder',
    label: 'Topcoder',
    color: '#38bdf8',
    hosts: ['topcoder.com'],
  },
  csacademy: {
    key: 'csacademy',
    label: 'CS Academy',
    color: '#fb923c',
    hosts: ['csacademy.com'],
  },
  other: {
    key: 'other',
    label: 'Other',
    color: '#94a3b8',
    hosts: [],
  },
};

/** Every host a contest URL is allowed to point at (security allowlist). */
export const ALLOWED_HOSTS = [
  ...new Set(Object.values(PLATFORMS).flatMap((p) => p.hosts)),
];

/** Platform keys that can be toggled in filters (excludes the catch-all). */
export const FILTERABLE_KEYS = Object.keys(PLATFORMS).filter((k) => k !== 'other');

/** Lowercased alphanumerics only — used for fuzzy name comparison. */
export function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Strip protocol/www/trailing slash/query/fragment for URL-based dedup. */
export function normalizeUrlKey(url) {
  try {
    const u = new URL(String(url || ''));
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return '';
  }
}

/** Map a clist resource name ("LeetCode", "geeksforgeeks.org", …) to a platform key. */
export function resourceToPlatformKey(resourceName) {
  const s = slugifyName(resourceName).replace(/\s+/g, '');
  if (!s) return 'other';
  if (s.includes('codeforces')) return 'codeforces';
  if (s.includes('leetcode')) return 'leetcode';
  if (s.includes('atcoder')) return 'atcoder';
  if (s.includes('hackerrank')) return 'hackerrank';
  if (s.includes('codechef')) return 'codechef';
  if (s.includes('geeksforgeeks') || s.includes('geeksforgeekspractice')) return 'geeksforgeeks';
  if (s.includes('hackerearth')) return 'hackerearth';
  if (s.includes('topcoder')) return 'topcoder';
  if (s.includes('csacademy')) return 'csacademy';
  return 'other';
}

/** Map a URL hostname to a platform key (validation + platform inference). */
export function hostToPlatformKey(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  for (const p of Object.values(PLATFORMS)) {
    if (p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return p.key;
  }
  return null;
}
