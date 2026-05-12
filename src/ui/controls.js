// Mode picker + Live/Append/Dedupe/Log checkboxes + Copy/Clear.
import { el } from '../dom.js';

let modeButtons = {};
let liveCb = null, appendCb = null, dedupeCb = null, logCb = null;
let copyBtn = null, clearBtn = null, dumpBtn = null;
let listeners = {};

export function build() {
  const makeModeBtn = (m, label, longLabel) => el('button', {
    type: 'button',
    role: 'radio',
    'aria-label': longLabel,
    'aria-checked': 'false',
    'data-mode': m,
    onClick: () => listeners.onMode?.(m),
  }, label);
  modeButtons.text = makeModeBtn('text', 'Text', 'Text search mode');
  modeButtons.selector = makeModeBtn('selector', 'CSS', 'CSS selector mode');
  modeButtons.js = makeModeBtn('js', 'JS', 'JavaScript query mode');

  liveCb = el('input', { type: 'checkbox', 'aria-label': 'Live mode — search as you type', onChange: (e) => listeners.onToggle?.('live', e.target.checked) });
  appendCb = el('input', { type: 'checkbox', 'aria-label': 'Append matches across pages and tabs', onChange: (e) => listeners.onToggle?.('append', e.target.checked) });
  dedupeCb = el('input', { type: 'checkbox', 'aria-label': 'Dedupe matches in the list', onChange: (e) => listeners.onToggle?.('dedupe', e.target.checked) });
  logCb = el('input', { type: 'checkbox', 'aria-label': 'Log matches to panel and console', onChange: (e) => listeners.onToggle?.('log', e.target.checked) });

  copyBtn = el('button', { type: 'button', 'aria-label': 'Copy match list to clipboard', onClick: () => listeners.onCopy?.() }, 'Copy');
  dumpBtn = el('button', { type: 'button', hidden: true, 'aria-label': 'Dump JS result to window.superSearchResults', onClick: () => listeners.onDump?.() }, 'Dump');
  clearBtn = el('button', { type: 'button', 'aria-label': 'Clear all matches and history', onClick: () => listeners.onClearAll?.() }, 'Clear');

  const modePicker = el('div', {
    class: 'ss-mode-picker',
    role: 'radiogroup',
    'aria-label': 'Search mode',
    onKeydown: (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const order = ['text', 'selector', 'js'];
      const cur = e.target?.dataset?.mode;
      const idx = order.indexOf(cur);
      if (idx === -1) return;
      const next = e.key === 'ArrowRight'
        ? order[(idx + 1) % order.length]
        : order[(idx - 1 + order.length) % order.length];
      modeButtons[next].focus();
      listeners.onMode?.(next);
    },
  }, modeButtons.text, modeButtons.selector, modeButtons.js);

  const controls = el('div', { class: 'ss-controls' },
    el('label', {}, liveCb, 'Live'),
    el('label', {}, appendCb, 'Append'),
    el('label', {}, dedupeCb, 'Dedupe'),
    el('label', {}, logCb, 'Log'),
    copyBtn,
    dumpBtn,
    clearBtn,
  );

  const header = el('div', { class: 'ss-header' }, modePicker, controls);
  return header;
}

export function setListeners(l) { listeners = l; }

export function syncFromState(s) {
  if (!modeButtons.text) return;
  for (const m of ['text', 'selector', 'js']) {
    const sel = s.mode === m;
    modeButtons[m].setAttribute('aria-checked', sel ? 'true' : 'false');
    modeButtons[m].setAttribute('aria-pressed', sel ? 'true' : 'false');
    // Roving tabindex: only the selected radio is in the tab order.
    modeButtons[m].tabIndex = sel ? 0 : -1;
  }
  liveCb.checked = !!s.live;
  appendCb.checked = !!s.append;
  dedupeCb.checked = !!s.dedupe;
  logCb.checked = !!s.log?.enabled;
  dumpBtn.hidden = !(s.mode === 'js' && s.lastJsResult !== undefined);
}
