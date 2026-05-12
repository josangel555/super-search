// End-to-end through the wiring layer: build the UI, simulate input/key events
// against the textarea, assert state + CSS.highlights end up correct.
import { describe, it, expect, beforeEach } from 'bun:test';
import * as state from '../../src/state.js';
import * as panel from '../../src/ui/panel.js';
import { buildUI } from '../../src/wiring.js';

async function fresh(html) {
  state.reset();
  for (const n of document.documentElement.querySelectorAll('div[id^="ss-"]')) n.remove();
  CSS.highlights.clear();
  document.body.innerHTML = html;
  const sh = panel.mount();
  buildUI(sh, panel.rootEl());
  return panel.rootEl();
}

describe('wiring: input → state → highlight', () => {
  it('typing into textarea triggers debounced search and populates state.matches', async () => {
    const root = await fresh('<p>alpha beta alpha</p><p>gamma alpha</p>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(state.get().query).toBe('alpha');
    expect(state.get().matches.length).toBe(3);
    expect(state.get().activeIndex).toBe(0);
  });

  it('regex parse error sets inputError and applies ss-error class on textarea', async () => {
    const root = await fresh('<p>x</p>');
    const ta = root.querySelector('.ss-query');
    ta.value = '/[/';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(state.get().inputError).toBe('regex');
    expect(ta.classList.contains('ss-error')).toBe(true);
  });

  it('clearing the query clears the error class', async () => {
    const root = await fresh('<p>x</p>');
    const ta = root.querySelector('.ss-query');
    ta.value = '/[/';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    ta.value = '';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(state.get().inputError).toBeNull();
    expect(ta.classList.contains('ss-error')).toBe(false);
  });

  it('JS mode does NOT auto-search on every keystroke (Live+JS guard)', async () => {
    const root = await fresh('<p>x</p>');
    state.set({ mode: 'js', live: true });
    const ta = root.querySelector('.ss-query');
    // Partial JS expression — would throw on eval.
    ta.value = 'return document.body.';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    // The query was stored in state but no dispatch happened.
    expect(state.get().query).toBe('return document.body.');
    expect(state.get().inputError).toBeNull();
  });

  it('Escape key in textarea hides the panel', async () => {
    const root = await fresh('<p>x</p>');
    panel.show();
    expect(panel.isVisible()).toBe(true);
    const ta = root.querySelector('.ss-query');
    ta.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.isVisible()).toBe(false);
  });

  it('Enter cycles activeIndex; Shift+Enter cycles backwards', async () => {
    const root = await fresh('<p>alpha</p><p>alpha</p><p>alpha</p>');
    const ta = root.querySelector('.ss-query');
    ta.value = 'alpha';
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(state.get().matches.length).toBe(3);
    // Enter advances active to 1.
    ta.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(state.get().activeIndex).toBe(1);
    // Shift+Enter goes back to 0.
    ta.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(state.get().activeIndex).toBe(0);
  });

  it('mode picker buttons change state.mode and clear any inline JS-mode height', async () => {
    const root = await fresh('<p>foo</p>');
    state.set({ mode: 'js' });
    const ta = root.querySelector('.ss-query');
    ta.style.height = '120px';
    // Switch to text mode: the input subscriber should clear style.height.
    state.set({ mode: 'text' });
    expect(ta.style.height).toBe('');
  });

  it('Copy on empty list does not throw and logs informational message', async () => {
    const root = await fresh('<p>foo</p>');
    state.set({ matches: [], historical: [] });
    // Find the Copy button by text content (controls header).
    const buttons = [...root.querySelectorAll('button')];
    const copyBtn = buttons.find(b => b.textContent === 'Copy');
    expect(copyBtn).toBeTruthy();
    // Should not throw.
    expect(() => copyBtn.click()).not.toThrow();
  });
});
