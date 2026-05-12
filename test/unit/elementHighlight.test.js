import { describe, it, expect, beforeEach } from 'bun:test';
import { applyOutlines, restore, isOutlined } from '../../src/elementHighlight.js';

describe('elementHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '<p id="a">A</p><p id="b">B</p>';
  });

  it('applies dashed pink to all + solid green to active', () => {
    const a = document.querySelector('#a');
    const b = document.querySelector('#b');
    applyOutlines([{ element: a }, { element: b }], 1);
    expect(b.style.outline).toContain('solid');
    expect(a.style.outline).toContain('dashed');
  });

  it('saves and restores prior inline style', () => {
    const a = document.querySelector('#a');
    a.style.outline = '5px solid red';
    const original = a.style.outline; // capture whatever the DOM normalised it to
    applyOutlines([{ element: a }], 0);
    expect(a.style.outline).toContain('solid');
    restore();
    expect(a.style.outline).toBe(original);
  });

  it('isOutlined reflects state', () => {
    const a = document.querySelector('#a');
    expect(isOutlined(a)).toBe(false);
    applyOutlines([{ element: a }], 0);
    expect(isOutlined(a)).toBe(true);
    restore();
    expect(isOutlined(a)).toBe(false);
  });
});
