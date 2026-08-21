/**
 * Launch-on-startup via ~/.config/autostart/kontest-tracker.desktop
 * (the standard freedesktop mechanism GNOME's "Startup Applications" reads).
 * Works unpackaged: Exec points at the electron binary + app path.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

function desktopFilePath() {
  return path.join(os.homedir(), '.config', 'autostart', 'kontest-tracker.desktop');
}

function desktopEntry() {
  const exec = [process.execPath, app.getAppPath(), '--hidden']
    .map((part) => (part.includes(' ') ? `"${part}"` : part))
    .join(' ');
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Kontest Tracker',
    `Comment=Upcoming coding contests widget`,
    `Exec=${exec}`,
    'X-GNOME-Autostart-enabled=true',
    'X-GNOME-UsesNotifications=true',
    'Terminal=false',
    '',
  ].join('\n');
}

function setLaunchOnStartup(enabled) {
  const file = desktopFilePath();
  if (enabled) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, desktopEntry());
  } else {
    try { fs.unlinkSync(file); } catch { /* already absent */ }
  }
  return isLaunchOnStartup();
}

function isLaunchOnStartup() {
  return fs.existsSync(desktopFilePath());
}

module.exports = { setLaunchOnStartup, isLaunchOnStartup, desktopFilePath };
