// Log pane: shows logEntries and diagnostics output. Visible only when
// log.enabled or diagnostics-mode is on.
import { el, clear } from '../dom.js';
import { getEntries as getDiagEntries } from '../diag.js';

let region = null;
let listEl = null;
const MAX_RENDERED = 100;

export function build() {
  listEl = el('ul', { class: 'ss-log' });
  region = el('div', { class: 'ss-log-region' }, listEl);
  return region;
}

export function syncFromState(s) {
  if (!region) return;
  const visible = !!(s.log?.enabled && s.log?.win);
  region.classList.toggle('ss-visible', visible);
  if (!visible) return;
  clear(listEl);
  // Newest first — easier to scan when scrolling a long log.
  const entries = (s.logEntries || []).slice(-MAX_RENDERED).reverse();
  for (const e of entries) {
    const row = el('li', {},
      el('span', { class: 'ss-log-ts' }, '[' + shortTs(e.ts) + '] '),
      el('span', { class: 'ss-log-kind' }, e.kind + ': '),
    );
    // Show context-before, the match (highlighted), context-after.
    if (e.before) row.appendChild(el('span', { class: 'ss-log-ctx' }, e.before));
    row.appendChild(el('span', { class: 'ss-log-match' }, e.value || ''));
    if (e.after) row.appendChild(el('span', { class: 'ss-log-ctx' }, e.after));
    if (e.sourceUrl) {
      row.appendChild(el('span', { class: 'ss-log-url', title: e.sourceUrl }, ' · ' + shortUrl(e.sourceUrl)));
    }
    listEl.appendChild(row);
  }
  // Show recent error diagnostics with an "!" prefix.
  for (const d of getDiagEntries().filter(x => x.level === 'error').slice(-5).reverse()) {
    listEl.appendChild(el('li', { class: 'ss-log-error' }, '! ' + d.msg));
  }
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.host + (u.pathname && u.pathname !== '/' ? u.pathname.slice(0, 20) : '');
  } catch { return String(url).slice(0, 30); }
}

function shortTs(iso) {
  if (typeof iso !== 'string') return '';
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : iso;
}
