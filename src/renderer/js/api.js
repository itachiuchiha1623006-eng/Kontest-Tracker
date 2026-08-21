/**
 * Guarded access to the preload bridge. Throws early (with a clear
 * message) if the bridge is missing — e.g. preload failed to load.
 */

const bridge = window.kontest;

if (!bridge) {
  document.body.innerHTML =
    '<div style="padding:16px;font-family:system-ui;color:#f87171">' +
    'Bridge unavailable — preload script failed to load.</div>';
  throw new Error('window.kontest is missing — preload failed');
}

export const api = bridge;
