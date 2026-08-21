/** View router: toggles section visibility + active tab. Esc = back to Contests. */

const VIEWS = ['contests', 'daily', 'filters', 'settings'];
let current = 'contests';
let changeListeners = [];

export function initViewRouter() {
  document.querySelectorAll('#tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current !== 'contests') showView('contests');
  });
}

export function showView(name) {
  if (!VIEWS.includes(name)) return;
  current = name;
  for (const v of VIEWS) {
    const section = document.getElementById(`view-${v}`);
    if (section) section.hidden = v !== name;
  }
  document.querySelectorAll('#tabs .tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === name);
  });
  for (const fn of changeListeners) fn(name);
}

export function getCurrentView() {
  return current;
}

export function onViewChanged(fn) {
  changeListeners.push(fn);
  return () => { changeListeners = changeListeners.filter((f) => f !== fn); };
}
