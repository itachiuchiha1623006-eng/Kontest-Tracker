/**
 * Tiny DOM helpers. el() builds nodes programmatically — all remote
 * strings enter the DOM via textContent, never innerHTML. The only
 * innerHTML uses here are the static SVG icon paths below.
 */

/** Build an element: el('div', {class:'x', onclick, dataset:{...}}, [children]). */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'text') {
      node.textContent = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/** Static inline SVG icons (no remote data — safe for innerHTML). */
const ICONS = {
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3.76l1.8 3.1a1 1 0 0 1-.87 1.5H8.07a1 1 0 0 1-.87-1.5z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.innerHTML = ICONS[name] || '';
  span.style.display = 'inline-flex';
  return span;
}

/** Standard empty-state box. */
export function renderEmpty(iconChar, title, hint) {
  return el('div', { class: 'state-box' }, [
    el('div', { class: 'state-icon', text: iconChar }),
    el('div', { class: 'state-title', text: title }),
    hint ? el('div', { class: 'state-hint', text: hint }) : null,
  ]);
}

/** Toggle switch bound to get/set. */
export function makeToggle(isOn, onToggle, label) {
  const toggle = el('button', {
    class: `toggle${isOn ? ' on' : ''}`,
    role: 'switch',
    'aria-checked': String(isOn),
    'aria-label': label || 'toggle',
    onclick: () => {
      const next = !toggle.classList.contains('on');
      toggle.classList.toggle('on', next);
      toggle.setAttribute('aria-checked', String(next));
      onToggle(next);
    },
  });
  return toggle;
}

/** Checkbox row bound to get/set. */
export function makeCheckRow({ label, color, checked, onToggle }) {
  const row = el('div', { class: `check-row${checked ? ' checked' : ''}`, role: 'checkbox', 'aria-checked': String(checked), tabindex: '0' });
  const box = el('span', { class: 'checkbox' });
  const paint = () => {
    box.textContent = row.classList.contains('checked') ? '✓' : '';
  };
  const flip = () => {
    const next = !row.classList.contains('checked');
    row.classList.toggle('checked', next);
    row.setAttribute('aria-checked', String(next));
    paint();
    onToggle(next);
  };
  paint();
  row.addEventListener('click', flip);
  row.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
  });
  if (color) row.append(el('span', { class: 'check-dot', style: { background: color } }));
  row.append(el('span', { text: label, style: { flex: '1' } }));
  row.prepend(box);
  return row;
}
