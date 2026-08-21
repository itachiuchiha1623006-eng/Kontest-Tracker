/**
 * Merge keyless-source contests with optional clist results.
 *
 * Keyless sources are the base (stable ids/urls); clist is an overlay that
 * enriches existing entries or appends platforms the keyless sources
 * don't cover (CodeChef, GeeksforGeeks, HackerEarth, Topcoder, CS Academy).
 *
 * Depends on the ESM shared module; main.js injects it via initMerge().
 */

const FUZZ_WINDOW_SEC = 15 * 60;
const HARD_CAP = 200;

let shared = null;

function initMerge(sharedModule) {
  shared = sharedModule;
}

function mergeOne(base, extra) {
  base.sources = [...new Set([...base.sources, ...extra.sources])];
  if (base.rated === null && extra.rated !== null) base.rated = extra.rated;
  if (extra.end > base.end) base.end = extra.end;
  return base;
}

/**
 * contestsBySource: Map<sourceKey, Contest[]> — already normalized.
 * Returns the merged, sorted, capped list (finished contests dropped).
 */
function mergeContests(contestsBySource, nowSecValue) {
  const now = nowSecValue;
  const baseKeys = [...contestsBySource.keys()].filter((k) => k !== 'clist');
  const clist = contestsBySource.get('clist') || [];

  const base = baseKeys.flatMap((k) => contestsBySource.get(k) || []);

  const byUrl = new Map();
  const byName = new Map();
  for (const c of base) {
    const uk = shared.normalizeUrlKey(c.url);
    if (uk) byUrl.set(uk, c);
    byName.set(`${c.platformKey}|${shared.slugifyName(c.name)}`, c);
  }

  for (const extra of clist) {
    const uk = shared.normalizeUrlKey(extra.url);
    // Rule A: same URL.
    let hit = uk ? byUrl.get(uk) : null;
    // Rule B: same platform + exact normalized name.
    if (!hit) hit = byName.get(`${extra.platformKey}|${shared.slugifyName(extra.name)}`) || null;
    // Rule C: same platform, start within 15 min, one name contains the other.
    if (!hit) {
      const extraSlug = shared.slugifyName(extra.name);
      if (extraSlug) {
        for (const c of base) {
          if (c.platformKey !== extra.platformKey) continue;
          if (Math.abs(c.start - extra.start) > FUZZ_WINDOW_SEC) continue;
          const a = shared.slugifyName(c.name);
          if (a.includes(extraSlug) || extraSlug.includes(a)) { hit = c; break; }
        }
      }
    }
    if (hit) {
      mergeOne(hit, extra);
    } else {
      base.push(extra);
      if (uk) byUrl.set(uk, extra);
      byName.set(`${extra.platformKey}|${shared.slugifyName(extra.name)}`, extra);
    }
  }

  return base
    .filter((c) => c.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, HARD_CAP);
}

module.exports = { mergeContests, initMerge };
