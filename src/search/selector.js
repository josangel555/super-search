// CSS selector search. Returns element-mode Match objects.
import { safe } from '../safe.js';
import { matchIdFor } from '../util/matchId.js';

export class SelectorError extends Error {}

const MAX_ELEMENTS = 5000; // soft cap to prevent huge selectors freezing the tab

export function run(query, root, opts = {}) {
  const sourceUrl = opts.sourceUrl || (typeof location !== 'undefined' ? location.href : '');
  let nodes;
  try {
    nodes = root.querySelectorAll(query);
  } catch (e) {
    throw new SelectorError(e.message);
  }

  const matches = [];
  let truncated = false;
  for (let i = 0; i < nodes.length; i++) {
    if (i >= MAX_ELEMENTS) { truncated = true; break; }
    const el = nodes[i];
    const text = (el.innerText || el.textContent || '').trim().slice(0, 60);
    const tagDesc = describe(el);
    matches.push({
      id: matchIdFor({ value: tagDesc, before: '', after: text, sourceUrl: sourceUrl + '#' + i }),
      kind: 'selector',
      range: null,
      element: el,
      value: tagDesc,
      before: '',
      after: text,
      sourceUrl,
      capturedAt: safe.dateNow(),
      capturedNodeLength: 0,
    });
  }
  return { matches, truncated, nodesSeen: matches.length };
}

function describe(el) {
  let s = el.tagName ? el.tagName.toLowerCase() : 'node';
  if (el.id) s += '#' + el.id;
  if (el.classList && el.classList.length) {
    s += '.' + Array.from(el.classList).slice(0, 3).join('.');
  }
  return `<${s}>`;
}
