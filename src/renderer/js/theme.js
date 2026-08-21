/** Apply appearance settings to the document root. */

export function applyTheme(appearance) {
  if (!appearance) return;
  const root = document.documentElement;
  root.dataset.theme = appearance.theme === 'light' ? 'light' : 'dark';
  root.dataset.accent = appearance.accent || 'violet';
  root.style.setProperty('--font-size', `${appearance.fontSize || 13}px`);
}
