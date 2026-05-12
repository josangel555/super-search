// Match list view: renders the current matches (or accumulated historical).
import { el, clear } from '../dom.js';

let listEl = null;
let regionEl = null;
let headerEl = null;
let listeners = {};

export function build() {
  listEl = el('ul', { class: 'ss-list' });
  headerEl = el('div', { class: 'ss-list-header' }, 'Found Matches', el('span', { class: 'ss-collapse' }, '▾'));
  headerEl.addEventListener('click', () => listeners.onToggleCollapse?.());
  regionEl = el('div', { class: 'ss-list-region' }, headerEl, listEl);
  return regionEl;
}

export function setListeners(l) { listeners = l; }

export function syncFromState(s, opts = {}) {
  if (!listEl) return;
  // If Append is on, render historical (the merged cross-tab list); otherwise current matches.
  const data = s.append ? (s.historical || []) : (s.matches || []);
  const shown = s.dedupe ? dedupe(data) : data;

  clear(listEl);
  if (s.ui?.listCollapsed) {
    regionEl.classList.add('ss-collapsed');
    listEl.style.display = 'none';
    return;
  }
  listEl.style.display = '';
  regionEl.classList.remove('ss-collapsed');

  // Render rows. Limit DOM to ~500 visible rows for perf; rest counted in footer.
  const MAX_RENDERED = 500;
  const rendered = shown.slice(0, MAX_RENDERED);
  for (let i = 0; i < rendered.length; i++) {
    const m = rendered[i];
    const isActive = !s.append && i === s.activeIndex;
    const li = el('li', {
      class: isActive ? 'ss-active' : '',
      onClick: () => listeners.onRowClick?.(m, i, s.append),
    },
      el('span', { class: 'ss-row-num' }, String(i + 1) + '.'),
      el('span', { class: 'ss-row-text' },
        m.before, el('span', { class: 'ss-row-match' }, m.value), m.after),
    );
    if (m.sourceUrl && m.sourceUrl !== (opts.currentUrl || location.href)) {
      li.appendChild(el('span', { class: 'ss-row-url' }, hostOf(m.sourceUrl)));
    }
    listEl.appendChild(li);
  }
  if (shown.length > MAX_RENDERED) {
    listEl.appendChild(el('li', { style: { color: '#888' } }, `… and ${shown.length - MAX_RENDERED} more`));
  }
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return url.slice(0, 30); }
}

function dedupe(arr) {
  const seen = new Set();
  const out = [];
  for (const m of arr) {
    const key = m.id || `${m.value}|${m.before}|${m.after}|${m.sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export { dedupe };
