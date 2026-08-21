/**
 * Small shared helpers for the main process: time, atomic JSON IO,
 * and loading the ESM shared modules from CommonJS.
 */

const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..', '..');

/** Test hook: KONTEST_FAKE_NOW=<epoch seconds> shifts the scheduler's clock. */
function nowSec() {
  const fake = Number(process.env.KONTEST_FAKE_NOW);
  if (Number.isFinite(fake) && fake > 0) return Math.floor(fake);
  return Math.floor(Date.now() / 1000);
}

/** Atomic JSON write: tmp file + rename in the same directory. */
function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

/** Read JSON, returning `fallback` on any error (missing, corrupt, EACCES). */
function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Ensure a value is an integer within [min, max], else return `fallback`. */
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Load the ESM shared module (platforms.mjs) from this CommonJS process. */
let sharedPromise = null;
function loadShared() {
  if (!sharedPromise) {
    const sharedUrl = new URL(`file://${path.join(APP_ROOT, 'src', 'shared', 'platforms.mjs')}`);
    sharedPromise = import(sharedUrl.href);
  }
  return sharedPromise;
}

module.exports = { APP_ROOT, nowSec, atomicWriteJson, readJsonSafe, clampInt, loadShared };
