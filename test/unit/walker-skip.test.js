import { describe, it, expect } from 'bun:test';
import { run } from '../../src/search/text.js';

describe('walker skips', () => {
  it('skips contenteditable subtrees', () => {
    document.body.innerHTML = '<div contenteditable="true"><p>secret lorem</p></div><p>public lorem</p>';
    const r = run('lorem', document.body);
    expect(r.matches.length).toBe(1);
    expect(r.matches[0].value).toBe('lorem');
    // Should match the public one, not the editable.
    expect(r.matches[0].after.length + r.matches[0].before.length).toBeGreaterThan(0);
  });

  it('skips <noscript>', () => {
    document.body.innerHTML = '<noscript>lorem</noscript><p>lorem</p>';
    const r = run('lorem', document.body);
    expect(r.matches.length).toBe(1);
  });

  it('skips <template> content', () => {
    document.body.innerHTML = '<template><p>lorem</p></template><p>lorem</p>';
    const r = run('lorem', document.body);
    expect(r.matches.length).toBe(1);
  });
});
