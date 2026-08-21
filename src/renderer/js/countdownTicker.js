/**
 * Exactly one setInterval drives every live countdown on screen.
 * Components register {el, compute}; each tick updates only registered,
 * still-connected nodes; cadence drops to 30s while hidden.
 */

const registered = new Set();
let timer = null;
let currentIntervalMs = 1000;

function tick() {
  const now = Date.now() / 1000;
  for (const item of registered) {
    if (!item.el.isConnected) {
      registered.delete(item);
      continue;
    }
    try {
      item.update(now);
    } catch {
      registered.delete(item);
    }
  }
}

function ensureTimer() {
  if (timer) return;
  timer = setInterval(tick, currentIntervalMs);
}

/**
 * Register a countdown. `update(nowSec)` should set el.textContent.
 * Returns an unregister function.
 */
export function registerTicker(el, update) {
  const item = { el, update };
  registered.add(item);
  ensureTimer();
  update(Date.now() / 1000); // paint immediately
  return () => registered.delete(item);
}

document.addEventListener('visibilitychange', () => {
  clearInterval(timer);
  currentIntervalMs = document.hidden ? 30_000 : 1000;
  timer = null;
  if (!document.hidden) ensureTimer();
});
