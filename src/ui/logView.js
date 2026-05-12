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
  const entries = (s.logEntries || []).slice(-MAX_RENDERED);
  for (const e of entries) {
    listEl.appendChild(el('li', {}, `[${shortTs(e.ts)}] ${e.kind}: ${e.value}`));
  }
  // Append recent diagnostics errors.
  for (const d of getDiagEntries().filter(x => x.level === 'error').slice(-10)) {
    listEl.appendChild(el('li', { class: 'ss-log-error' }, `! ${d.msg}`));
  }
}

function shortTs(iso) {
  if (typeof iso !== 'string') return '';
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : iso;
}
