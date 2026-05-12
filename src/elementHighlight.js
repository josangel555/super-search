// Element-mode highlighting: inline outline applied to elements with the
// previous value saved on a data attribute so we can restore on clear.
// Used for selector and js-element kinds.
import { safe } from './safe.js';

const OUTLINE_DASHED = '2px dashed #FF69B4';
const OUTLINE_SOLID = '2px solid #32CD32';
const SHADOW_SOLID = '0 0 6px #32CD32';

const PREV_OUTLINE = 'ssPrevOutline';
const PREV_SHADOW = 'ssPrevBoxShadow';

let outlined = [];

export function applyOutlines(matches, activeIndex) {
  restore();
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const el = m.element;
    if (!el || el.nodeType !== 1) continue;
    if (!el.isConnected) continue;
    save(el);
    if (i === activeIndex) {
      el.style.outline = OUTLINE_SOLID;
      el.style.boxShadow = SHADOW_SOLID;
    } else {
      el.style.outline = OUTLINE_DASHED;
    }
    outlined.push(el);
  }
}

function save(el) {
  if (el.dataset[PREV_OUTLINE] === undefined) {
    el.dataset[PREV_OUTLINE] = el.style.outline || '';
  }
  if (el.dataset[PREV_SHADOW] === undefined) {
    el.dataset[PREV_SHADOW] = el.style.boxShadow || '';
  }
}

export function restore() {
  for (const el of outlined) {
    if (!el || !el.style) continue;
    el.style.outline = el.dataset[PREV_OUTLINE] || '';
    el.style.boxShadow = el.dataset[PREV_SHADOW] || '';
    delete el.dataset[PREV_OUTLINE];
    delete el.dataset[PREV_SHADOW];
  }
  outlined = [];
}

export function isOutlined(el) {
  return el && el.dataset && el.dataset[PREV_OUTLINE] !== undefined;
}
