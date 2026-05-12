import { describe, it, expect } from 'bun:test';
import { el, clear, setText } from '../../src/dom.js';

describe('dom helpers', () => {
  it('creates elements with props and children', () => {
    const node = el('div', { class: 'foo' }, 'hello');
    expect(node.tagName).toBe('DIV');
    expect(node.className).toBe('foo');
    expect(node.textContent).toBe('hello');
  });

  it('supports nested arrays of children', () => {
    const node = el('ul', {}, [el('li', {}, 'a'), el('li', {}, 'b')]);
    expect(node.children.length).toBe(2);
  });

  it('binds event listeners via on* props', () => {
    let clicked = 0;
    const btn = el('button', { onClick: () => clicked++ });
    btn.dispatchEvent(new window.Event('click'));
    expect(clicked).toBe(1);
  });

  it('clear removes all children', () => {
    const node = el('div', {}, 'a', 'b', 'c');
    clear(node);
    expect(node.childNodes.length).toBe(0);
  });

  it('setText escapes via textContent', () => {
    const node = el('span');
    setText(node, '<script>alert(1)</script>');
    expect(node.textContent).toBe('<script>alert(1)</script>');
    expect(node.children.length).toBe(0);
  });
});
