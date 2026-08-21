/**
 * Normalization: every external contest passes through normalizeContest()
 * before it is cached or merged. Type coercion, clamps, URL allowlist —
 * malformed entries are dropped, never rendered raw.
 *
 * Depends on the ESM shared module (platforms.js); main.js injects it via
 * initNormalize(await loadShared()) before any source fetch runs.
 */

const MAX_NAME = 200;
const MAX_HORIZON_SEC = 400 * 24 * 3600; // reject starts > 400 days out

let shared = null;

function initNormalize(sharedModule) {
  shared = sharedModule;
}

function toEpoch(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: milliseconds if absurdly large.
    return Math.floor(value > 1e12 ? value / 1000 : value);
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (Number.isFinite(t)) return Math.floor(t / 1000);
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.floor(n > 1e12 ? n / 1000 : n);
  }
  return null;
}

function cleanString(value, max) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Build a normalized Contest from raw adapter output, or null if invalid.
 * raw: { sourceKey, sourceId, platformKey?, name, url, start, end?, durationSeconds?, rated? }
 */
function normalizeContest(raw, nowSecValue) {
  const now = nowSecValue ?? Math.floor(Date.now() / 1000);

  const sourceKey = cleanString(raw?.sourceKey, 32);
  const sourceId = cleanString(raw?.sourceId, 120);
  const name = cleanString(raw?.name, MAX_NAME);
  if (!sourceKey || !sourceId || !name) return null;

  // URL must parse to https on a known host.
  let url = null;
  try {
    const u = new URL(String(raw?.url || ''));
    if (u.protocol === 'https:') {
      const pk = shared.hostToPlatformKey(u.hostname);
      if (pk) url = u.toString();
    }
  } catch { /* invalid URL -> dropped */ }
  if (!url) return null;

  const start = toEpoch(raw?.start);
  if (start === null || start <= 0 || start > now + MAX_HORIZON_SEC) return null;

  let end = toEpoch(raw?.end);
  let durationSeconds = Number(raw?.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) durationSeconds = null;
  if (durationSeconds) durationSeconds = Math.min(Math.round(durationSeconds), MAX_HORIZON_SEC);
  if (end === null || end < start) end = durationSeconds ? start + durationSeconds : null;
  if (end === null) end = start + 2 * 3600; // conservative default duration
  if (end < start) end = start;

  // Platform: explicit key from the adapter, else inferred from the URL host.
  let platformKey = cleanString(raw?.platformKey, 32);
  if (!platformKey || !shared.PLATFORMS[platformKey] || platformKey === 'other') {
    platformKey = shared.hostToPlatformKey(new URL(url).hostname) || sourceKey;
  }
  if (!shared.PLATFORMS[platformKey]) platformKey = 'other';

  return {
    id: `${sourceKey}:${sourceId}`,
    source: sourceKey,
    sourceId,
    platformKey,
    platformLabel: shared.PLATFORMS[platformKey].label,
    name,
    url,
    start,
    end,
    durationSeconds: durationSeconds ?? (end - start),
    rated: typeof raw?.rated === 'boolean' ? raw.rated : null,
    sources: [sourceKey],
  };
}

module.exports = { normalizeContest, initNormalize, toEpoch };
