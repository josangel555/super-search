// Input row: the query textarea and Go/nav buttons.
// Subscribes to state.mode and state.inputError for visual feedback.
import { el } from '../dom.js';

let inputEl = null;
let goBtnEl = null;
let prevBtnEl = null;
let nextBtnEl = null;
let summaryEl = null;
let listeners = { onInput: null, onSubmit: null, onPrev: null, onNext: null, onEscape: null };

export function build(state) {
  inputEl = el('textarea', {
    class: 'ss-query',
    spellcheck: 'false',
    autocomplete: 'off',
    autocorrect: 'off',
    rows: 1,
    placeholder: 'search (auto-detects /regex/ and timestamp HH:MM:SS-HH:MM:SS)',
  });
  inputEl.addEventListener('input', () => listeners.onInput?.(inputEl.value));
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

  goBtnEl = el('button', { type: 'button', onClick: () => listeners.onSubmit?.() }, 'Go');
  prevBtnEl = el('button', { type: 'button', title: 'Previous', onClick: () => listeners.onPrev?.() }, '<');
  nextBtnEl = el('button', { type: 'button', title: 'Next', onClick: () => listeners.onNext?.() }, '>');
  summaryEl = el('div', { class: 'ss-summary' }, el('span', { class: 'ss-counter' }, '-'));

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
  } else {
    inputEl.rows = 1;
    // Clear any inline height the user dragged onto the textarea in JS mode
    // so switching back to text/selector returns to single-line.
    if (wasJsMode) inputEl.style.height = '';
  }
  // Show Go button when manual (live=false) OR in JS mode (always manual).
  goBtnEl.hidden = s.live && s.mode !== 'js';

  // Summary
  const matches = s.matches || [];
  const counter = summaryEl.querySelector('.ss-counter');
  if (matches.length === 0) {
    counter.textContent = s.query ? '0 matches' : '-';
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
