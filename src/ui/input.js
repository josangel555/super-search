// Input row: the query textarea and Go/nav buttons.
// Subscribes to state.mode and state.inputError for visual feedback.
import { el } from '../dom.js';

let inputEl = null;
let goBtnEl = null;
let prevBtnEl = null;
let nextBtnEl = null;
let summaryEl = null;
let listeners = { onInput: null, onSubmit: null, onPrev: null, onNext: null, onEscape: null };

const PLACEHOLDERS = {
  text: 'Search (auto-detects /regex/ and timestamp ranges like 1:00-2:30)',
  selector: 'CSS selector (e.g. div.warning > p, a[href*="example.com"])',
  js: 'JavaScript (e.g. return [...document.querySelectorAll("a")].map(a=>a.href))',
};

function autoGrowIfMultiLine() {
  if (!inputEl) return;
  if (inputEl.classList.contains('ss-mode-js')) return;   // js mode already multi-line
  // Single-line modes: grow up to 4 lines if the user pasted multi-line text.
  const lines = (inputEl.value.match(/\n/g) || []).length + 1;
  if (lines > 1) {
    inputEl.rows = Math.min(lines, 4);
  } else {
    inputEl.rows = 1;
  }
}

export function build(state) {
  inputEl = el('textarea', {
    class: 'ss-query',
    spellcheck: 'false',
    autocomplete: 'off',
    autocorrect: 'off',
    rows: 1,
    'aria-label': 'Search query',
    placeholder: PLACEHOLDERS.text,
  });
  inputEl.addEventListener('input', () => {
    autoGrowIfMultiLine();
    listeners.onInput?.(inputEl.value);
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      listeners.onEscape?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (state.get().mode === 'js' && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      listeners.onSubmit?.();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // In Text/Selector modes, Enter cycles. Shift+Enter cycles back.
      if (state.get().mode !== 'js') {
        e.preventDefault();
        listeners.onPrev?.();
      }
    }
  });

  goBtnEl = el('button', { type: 'button', 'aria-label': 'Run search', onClick: () => listeners.onSubmit?.() }, 'Go');
  prevBtnEl = el('button', { type: 'button', title: 'Previous match', 'aria-label': 'Previous match', onClick: () => listeners.onPrev?.() }, '<');
  nextBtnEl = el('button', { type: 'button', title: 'Next match', 'aria-label': 'Next match', onClick: () => listeners.onNext?.() }, '>');
  summaryEl = el('div', { class: 'ss-summary', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, el('span', { class: 'ss-counter' }, '-'));

  const row = el('div', { class: 'ss-input-row' },
    inputEl,
    el('div', { class: 'ss-input-actions' }, goBtnEl, prevBtnEl, nextBtnEl)
  );

  return { row, summary: summaryEl };
}

export function setListeners(l) { Object.assign(listeners, l); }

export function syncFromState(s) {
  if (!inputEl) return;
  if (inputEl.value !== s.query) inputEl.value = s.query;
  const wasJsMode = inputEl.classList.contains('ss-mode-js');
  inputEl.classList.toggle('ss-mode-js', s.mode === 'js');
  inputEl.classList.toggle('ss-error', !!s.inputError);
  if (s.mode === 'js') {
    inputEl.removeAttribute('rows');
    inputEl.placeholder = PLACEHOLDERS.js;
  } else {
    inputEl.placeholder = s.mode === 'selector' ? PLACEHOLDERS.selector : PLACEHOLDERS.text;
    // Clear any inline height the user dragged onto the textarea in JS mode
    // so switching back to text/selector returns to single-line (or autogrown).
    if (wasJsMode) inputEl.style.height = '';
    autoGrowIfMultiLine();
  }
  // Show Go button when manual (live=false) OR in JS mode (always manual).
  goBtnEl.hidden = s.live && s.mode !== 'js';

  // Summary: shows page-position + total + (if Append) list-size.
  const matches = s.matches || [];
  const counter = summaryEl.querySelector('.ss-counter');
  if (matches.length === 0) {
    counter.textContent = s.query ? '0 matches' : '-';
  } else if (s.append && Array.isArray(s.historical) && s.historical.length > 0) {
    counter.textContent = `${s.activeIndex + 1} / ${matches.length} · list ${s.historical.length}`;
  } else {
    counter.textContent = `${s.activeIndex + 1} / ${matches.length}`;
  }
  prevBtnEl.disabled = matches.length === 0;
  nextBtnEl.disabled = matches.length === 0;

  // Settling indicator (Phase 4 wires this).
  const existing = summaryEl.querySelector('.ss-settling-dot');
  if (s.query && !s.domSettled) {
    if (!existing) summaryEl.appendChild(el('span', { class: 'ss-settling-dot', title: 'Page still loading…' }));
  } else if (existing) {
    existing.remove();
  }

  if (s.truncated) {
    let warn = summaryEl.querySelector('.ss-truncated');
    if (!warn) summaryEl.appendChild(el('span', { class: 'ss-truncated', style: { color: '#d83b01' } }, '(partial)'));
  } else {
    summaryEl.querySelector('.ss-truncated')?.remove();
  }
}

export function focusInput() { inputEl?.focus(); inputEl?.select?.(); }
