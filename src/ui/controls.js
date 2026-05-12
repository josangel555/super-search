// Mode picker + Live/Append/Dedupe/Log checkboxes + Copy/Clear.
import { el } from '../dom.js';

let modeButtons = {};
let liveCb = null, appendCb = null, dedupeCb = null, logCb = null;
let logWinCb = null, logConCb = null;
let copyBtn = null, clearBtn = null, dumpBtn = null, helpBtn = null;
let listeners = {};

export function build() {
  const MODE_DESC = {
    text: 'Text mode — plain text, auto-detects /regex/ and HH:MM:SS-HH:MM:SS ranges',
    selector: 'CSS selector mode — querySelectorAll syntax (e.g. div.warning > p)',
    js: 'JS mode — run JavaScript in the page realm (return value classified)',
  };
  const makeModeBtn = (m, label) => el('button', {
    type: 'button',
    role: 'radio',
    'aria-label': MODE_DESC[m],
    'aria-checked': 'false',
    title: MODE_DESC[m],
    'data-mode': m,
    onClick: () => listeners.onMode?.(m),
  }, label);
  modeButtons.text = makeModeBtn('text', 'Text');
  modeButtons.selector = makeModeBtn('selector', 'CSS');
  modeButtons.js = makeModeBtn('js', 'JS');

  liveCb = el('input', {
    type: 'checkbox',
    'aria-label': 'Live mode — search as you type',
    title: 'Live: search as you type (100ms debounce). Off = manual via Go / Enter.',
    onChange: (e) => listeners.onToggle?.('live', e.target.checked),
  });
  appendCb = el('input', {
    type: 'checkbox',
    'aria-label': 'Append matches across pages and tabs',
    title: 'Append: collect match VALUES into one running list across all tabs.\nUse for cross-tab triage workflows (e.g. scan 20 tabs, copy results).',
    onChange: (e) => listeners.onToggle?.('append', e.target.checked),
  });
  dedupeCb = el('input', {
    type: 'checkbox',
    'aria-label': 'Dedupe matches in the list',
    title: 'Dedupe: hide duplicate rows in the displayed list (display-only).',
    onChange: (e) => listeners.onToggle?.('dedupe', e.target.checked),
  });
  logCb = el('input', {
    type: 'checkbox',
    'aria-label': 'Log matches with timestamps and URLs',
    title: 'Log: audit trail with timestamp + URL of every find.\nDifferent from Append — Append stores values; Log stores history of finds.',
    onChange: (e) => listeners.onToggle?.('log', e.target.checked),
  });
  logWinCb = el('input', {
    type: 'checkbox',
    'aria-label': 'Show log in panel',
    title: 'Win: show log entries in the panel.',
    onChange: (e) => listeners.onToggle?.('log.win', e.target.checked),
  });
  logConCb = el('input', {
    type: 'checkbox',
    'aria-label': 'Mirror log to browser console',
    title: 'Con: mirror log entries to the browser DevTools console.',
    onChange: (e) => listeners.onToggle?.('log.con', e.target.checked),
  });

  copyBtn = el('button', {
    type: 'button',
    'aria-label': 'Copy match list to clipboard',
    title: 'Copy the visible match list to clipboard (tab-separated, with source URLs).',
    onClick: () => listeners.onCopy?.(),
  }, 'Copy');
  dumpBtn = el('button', {
    type: 'button', hidden: true,
    'aria-label': 'Dump JS result to window.superSearchResults',
    title: 'Dump the last JS query result to window.superSearchResults so you can inspect it in DevTools.',
    onClick: () => listeners.onDump?.(),
  }, 'Dump');
  clearBtn = el('button', {
    type: 'button',
    'aria-label': 'Clear all matches and history',
    title: 'Clear matches, accumulated list, and log (cross-tab synced).',
    onClick: () => listeners.onClearAll?.(),
  }, 'Clear');
  helpBtn = el('button', {
    type: 'button',
    class: 'ss-help-btn',
    'aria-label': 'Show help',
    title: 'Show help / keyboard shortcuts / examples',
    onClick: () => listeners.onHelp?.(),
  }, '?');

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

  const logTargets = el('span', { class: 'ss-log-targets', hidden: true },
    el('label', { title: 'Win: show log in the panel' }, logWinCb, 'Win'),
    el('label', { title: 'Con: mirror log to DevTools console' }, logConCb, 'Con'),
  );

  const controls = el('div', { class: 'ss-controls' },
    el('label', { title: 'Live: search as you type. JS mode is always manual.' }, liveCb, 'Live'),
    el('label', { title: 'Append: collect match values across all tabs' }, appendCb, 'Append'),
    el('label', { title: 'Dedupe: hide duplicate rows' }, dedupeCb, 'Dedupe'),
    el('label', { title: 'Log: audit trail with timestamps + URLs' }, logCb, 'Log'),
    logTargets,
    copyBtn,
    dumpBtn,
    clearBtn,
    helpBtn,
  );

  // Stash logTargets so syncFromState can toggle its visibility.
  modeButtons.__logTargets = logTargets;

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
  logWinCb.checked = !!s.log?.win;
  logConCb.checked = !!s.log?.con;
  // Win/Con targets only relevant when Log is enabled — hide otherwise.
  if (modeButtons.__logTargets) modeButtons.__logTargets.hidden = !s.log?.enabled;
  dumpBtn.hidden = !(s.mode === 'js' && s.lastJsResultPresent);
}
