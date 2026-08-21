/**
 * Time/text formatting. All epochs are unix seconds; display is always
 * the machine's local timezone via Intl.
 */

const pad2 = (n) => String(n).padStart(2, '0');

/** "2d 04:11:09" | "04:11:09" (negative clamps to zero). */
export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hms = `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

/** "Fri, Aug 22 · 20:00" */
export function formatDateTime(epochSec) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(epochSec * 1000));
}

/** "3m ago" / "2h ago" / "just now" */
export function formatRelative(epochSec, nowSec) {
  const delta = Math.max(0, Math.floor(nowSec - epochSec));
  if (delta < 45) return 'just now';
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

/** "1h 30m" / "2h" / "45m" */
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${Math.max(1, m)}m`;
}

/** Local calendar date key "YYYY-MM-DD". */
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
