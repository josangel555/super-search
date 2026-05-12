// JS query mode: eval user code in page realm (via unsafeWindow) and classify
// the result. Returns element matches for DOM results, string matches for
// arrays of strings, single-string match for primitives.
import { safe } from '../safe.js';
import { gm } from '../gm.js';
import { matchIdFor } from '../util/matchId.js';

export class JsError extends Error {}

export function run(query, root, opts = {}) {
  const sourceUrl = opts.sourceUrl || (typeof location !== 'undefined' ? location.href : '');
  let result;
  try {
    // Indirect eval runs in global scope. Prefer unsafeWindow.eval so the
    // user's code can see page-realm variables.
    const u = gm.unsafeWindow;
    if (u && typeof u.eval === 'function') {
      // Wrap in IIFE so the user can use `return`.
      result = u.eval(`(function(){ ${query} })()`);
      // If their code didn't use return, retry as expression.
      if (result === undefined) {
        try { result = u.eval(query); } catch { /* keep undefined */ }
      }
    } else {
      result = (0, eval)(`(function(){ ${query} })()`);
      if (result === undefined) {
        try { result = (0, eval)(query); } catch { /* keep undefined */ }
      }
    }
  } catch (e) {
    throw new JsError(e?.message || String(e));
  }

  // Wrap classify too: the result may have throwing getters / Proxy traps.
  let classified;
  try {
    classified = classify(result, sourceUrl);
  } catch (e) {
    return { matches: [], truncated: false, nodesSeen: 0, lastJsResult: '<unrepresentable>' };
  }
  return { ...classified, lastJsResult: result };
}

function classify(result, sourceUrl) {
  const matches = [];

  const pushElem = (el, idx) => {
    if (!el || (el.nodeType !== 1)) return;
    const desc = describe(el);
    const text = (el.innerText || el.textContent || '').trim().slice(0, 60);
    matches.push({
      id: matchIdFor({ value: desc, before: '', after: text, sourceUrl: sourceUrl + '#' + idx }),
      kind: 'js-element',
      range: null,
      element: el,
      value: desc,
      before: '',
      after: text,
      sourceUrl,
      capturedAt: safe.dateNow(),
      capturedNodeLength: 0,
    });
  };

  const pushString = (s, idx) => {
    const val = String(s);
    matches.push({
      id: matchIdFor({ value: val, before: '', after: '', sourceUrl: sourceUrl + '#js#' + idx }),
      kind: 'js-string',
      range: null,
      element: null,
      value: val,
      before: '',
      after: '',
      sourceUrl,
      capturedAt: safe.dateNow(),
      capturedNodeLength: 0,
    });
  };

  if (result == null) {
    pushString(String(result), 0);
  } else if (typeof result === 'object' && typeof result.then === 'function') {
    // Promise-like — we don't await. Surface this clearly instead of letting
    // the user copy "[object Promise]" and wonder why.
    pushString('<Promise — JS mode does not await; use a synchronous expression>', 0);
  } else if (typeof result === 'object' && result.nodeType === 1) {
    pushElem(result, 0);
  } else if (typeof result === 'object' && (result instanceof Array || isNodeListLike(result))) {
    const arr = Array.from(result);
    if (arr.length === 0) {
      // empty result, no matches
    } else if (arr[0] && typeof arr[0] === 'object' && arr[0].nodeType === 1) {
      arr.forEach((el, i) => pushElem(el, i));
    } else {
      arr.forEach((v, i) => pushString(v, i));
    }
  } else {
    pushString(result, 0);
  }

  return { matches, truncated: false, nodesSeen: matches.length };
}

function isNodeListLike(o) {
  if (!o || typeof o.length !== 'number') return false;
  const c = o.constructor?.name || '';
  if (c === 'NodeList' || c === 'HTMLCollection') return true;
  // Some implementations expose iterable list-like objects with item() method.
  if (typeof o.item === 'function' && typeof o.length === 'number') return true;
  return false;
}

function describe(el) {
  let s = el.tagName ? el.tagName.toLowerCase() : 'node';
  if (el.id) s += '#' + el.id;
  if (el.classList && el.classList.length) {
    s += '.' + Array.from(el.classList).slice(0, 3).join('.');
  }
  return `<${s}>`;
}
