/**
 * System tray. On Ubuntu (AppIndicator backend) the click event is
 * unreliable, so ALL actions live in the context menu; the tooltip
 * carries the next-contest countdown.
 */

const { Tray, Menu, app } = require('electron');
const path = require('path');

let tray = null;

function createTray({ onToggle, onRefresh, onQuit }) {
  tray = new Tray(path.join(__dirname, '..', '..', 'assets', 'tray.png'));
  tray.setToolTip('Kontest Tracker');

  const menu = Menu.buildFromTemplate([
    { label: 'Show / Hide widget', click: () => onToggle?.() },
    { label: 'Refresh contests now', click: () => onRefresh?.() },
    { type: 'separator' },
    { label: 'Quit Kontest Tracker', click: () => onQuit?.() },
  ]);
  tray.setContextMenu(menu);
  return tray;
}

/** Tooltip text: next contest countdown (called by the scheduler). */
function updateTrayTooltip(nextContest) {
  if (!tray) return;
  let line = 'Kontest Tracker';
  if (nextContest) {
    const secs = nextContest.start - Math.floor(Date.now() / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const when = h >= 24
      ? `${Math.floor(h / 24)}d ${h % 24}h`
      : `${h}h ${m}m`;
    line = `Kontest Tracker\n${nextContest.platformLabel}: ${nextContest.name}\nStarts in ${when}`;
  }
  tray.setToolTip(line);
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

module.exports = { createTray, updateTrayTooltip, destroyTray, app };
