// Mode picker + Live/Append/Dedupe/Log checkboxes + Copy/Clear.
import { el } from '../dom.js';

let modeButtons = {};
let liveCb = null, appendCb = null, dedupeCb = null, logCb = null;
let copyBtn = null, clearBtn = null;
let listeners = {};

export function build() {
  modeButtons.text = el('button', { type: 'button', onClick: () => listeners.onMode?.('text') }, 'Text');
  modeButtons.selector = el('button', { type: 'button', onClick: () => listeners.onMode?.('selector') }, 'CSS');
  modeButtons.js = el('button', { type: 'button', onClick: () => listeners.onMode?.('js') }, 'JS');

  liveCb = el('input', { type: 'checkbox', onChange: (e) => listeners.onToggle?.('live', e.target.checked) });
  appendCb = el('input', { type: 'checkbox', onChange: (e) => listeners.onToggle?.('append', e.target.checked) });
  dedupeCb = el('input', { type: 'checkbox', onChange: (e) => listeners.onToggle?.('dedupe', e.target.checked) });
  logCb = el('input', { type: 'checkbox', onChange: (e) => listeners.onToggle?.('log', e.target.checked) });

  copyBtn = el('button', { type: 'button', onClick: () => listeners.onCopy?.() }, 'Copy');
  clearBtn = el('button', { type: 'button', onClick: () => listeners.onClearAll?.() }, 'Clear');

  const modePicker = el('div', { class: 'ss-mode-picker' },
    modeButtons.text, modeButtons.selector, modeButtons.js);

  const controls = el('div', { class: 'ss-controls' },
    el('label', {}, liveCb, 'Live'),
    el('label', {}, appendCb, 'Append'),
    el('label', {}, dedupeCb, 'Dedupe'),
    el('label', {}, logCb, 'Log'),
    copyBtn,
    clearBtn,
  );

  const header = el('div', { class: 'ss-header' }, modePicker, controls);
  return header;
}

export function setListeners(l) { listeners = l; }

export function syncFromState(s) {
  if (!modeButtons.text) return;
  for (const m of ['text', 'selector', 'js']) {
    modeButtons[m].setAttribute('aria-pressed', s.mode === m ? 'true' : 'false');
  }
  liveCb.checked = !!s.live;
  appendCb.checked = !!s.append;
  dedupeCb.checked = !!s.dedupe;
  logCb.checked = !!s.log?.enabled;
}
