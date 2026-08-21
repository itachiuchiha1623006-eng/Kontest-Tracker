/** Status-bar dots: one per source, tooltip carries state + freshness. */

import { el } from './widgets.js';
import { formatRelative } from '../format.js';

export function renderSourceDots(container, sources, nowSec) {
  container.replaceChildren();
  for (const s of sources) {
    const title = s.state === 'disabled'
      ? `${s.label}: disabled`
      : s.state === 'error'
        ? `${s.label}: error — ${s.error || 'unknown'}`
        : s.fetchedAt
          ? `${s.label}: ${s.state} · updated ${formatRelative(s.fetchedAt, nowSec)}`
          : `${s.label}: never fetched`;
    container.append(el('span', { class: `dot ${s.state}`, title }));
  }
}
