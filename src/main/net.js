/**
 * Network layer for the main process. All upstream API access funnels
 * through fetchJson(): timeout, one retry, conditional-request support,
 * and a structured result that never throws for expected failures.
 *
 * Test hooks (no-ops unless the env vars are set):
 *   KONTEST_SIMULATE=offline        -> every request fails
 *   KONTEST_SIMULATE=codeforces,... -> the named sources fail
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT = 'Kontest-Tracker/0.1.0 (+https://github.com/)';

function simulatedFailure(sourceKey) {
  const raw = process.env.KONTEST_SIMULATE;
  if (!raw) return null;
  if (raw === 'offline') return 'simulated: offline';
  const keys = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (keys.includes(sourceKey)) return `simulated: ${sourceKey} failure`;
  return null;
}

/**
 * Fetch JSON. Returns { ok, status, data, notModified, error } and only
 * throws on programmer error (bad URL), never on network/HTTP failure.
 */
async function fetchJson(url, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    body = undefined,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    etag = null,
    lastModified = null,
    sourceKey = '',
  } = opts;

  const sim = simulatedFailure(sourceKey);
  if (sim) return { ok: false, status: 0, data: null, notModified: false, error: sim };

  const attempt = async () => {
    const h = { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers };
    if (etag) h['If-None-Match'] = etag;
    if (lastModified) h['If-Modified-Since'] = lastModified;

    const res = await fetch(url, {
      method,
      headers: h,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 304) {
      return { ok: true, status: 304, data: null, notModified: true, error: null };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data: null, notModified: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      ok: true,
      status: res.status,
      data,
      notModified: false,
      error: null,
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    };
  };

  try {
    return await attempt();
  } catch (err) {
    // One retry for transient failures (network, DNS, 5xx handled above).
    await new Promise((r) => setTimeout(r, 2000));
    try {
      return await attempt();
    } catch (err2) {
      return {
        ok: false,
        status: 0,
        data: null,
        notModified: false,
        error: err2.name === 'TimeoutError' ? 'timeout' : (err2.cause?.code || err2.message || 'network error'),
      };
    }
  }
}

module.exports = { fetchJson };
