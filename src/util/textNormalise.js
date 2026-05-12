// Text normalisation pipeline for search matching.
// Transforms a string into a comparable form while keeping a map back to
// original offsets, so Range objects can be built against the original DOM.
//
// Transforms (1:1 or 1:0 per code unit — keeps the index map simple):
//   - NBSP ( ) and other Unicode whitespace → regular space
//   - Zero-width chars (​-‍, ﻿) → dropped
//   - Soft hyphen (­) → dropped
//
// NFC normalisation is applied to the query AND the node text at compare
// time. In practice most web text is already NFC; multi-codepoint NFD edge
// cases (e.g. "é" as e+combining-accent) would shift offsets, so we skip
// running NFC through the index-map machinery. The cost is a rare miss on
// NFD-encoded text, not a crash.

const ZW = /[​-‍﻿­⁠⁡-⁤]/;
const SPACE_LIKE = /[     ]/; // NBSP + narrow/figure/thin/hair spaces

/**
 * Normalise a single node's text for matching.
 * Returns { normalised, indexMap } where indexMap[i] is the original offset of normalised[i].
 */
export function normaliseForMatch(s) {
  if (s == null || s === '') return { normalised: '', indexMap: [] };

  let out = '';
  const map = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ZW.test(ch)) continue;        // drop
    if (SPACE_LIKE.test(ch)) {
      out += ' ';
      map.push(i);
      continue;
    }
    out += ch;
    map.push(i);
  }
  return { normalised: out, indexMap: map };
}

/**
 * Normalise a query string. Returns the comparable form only (no map needed).
 */
export function normaliseQuery(s) {
  if (s == null) return '';
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ZW.test(ch)) continue;
    if (SPACE_LIKE.test(ch)) { out += ' '; continue; }
    out += ch;
  }
  return out;
}
