// Matches reference live DOM nodes; SPAs and observers can detach them.
// Always filter through isAlive before rendering so stale references don't
// crash the highlight or scroll layers.

export function isAlive(m) {
  if (!m) return false;
  // Text-mode: range references must still be in the document.
  if (m.range) {
    const node = m.range.startContainer;
    if (!node || !node.isConnected) return false;
    // Also detect node-length changes (rewrites/edits) — node-value mutation
    // invalidates offsets. Falsy nodeValue (empty string) is itself a change
    // from any captured length > 0, so use length explicitly rather than
    // truthiness-gating.
    if (m.capturedNodeLength != null && node.nodeType === 3) {
      const len = (node.nodeValue == null) ? 0 : node.nodeValue.length;
      if (len !== m.capturedNodeLength) return false;
    }
    return true;
  }
  // Element-mode.
  if (m.element) return m.element.isConnected === true;
  // String matches (js-string): always considered alive.
  if (m.kind === 'js-string') return true;
  return false;
}

export function pruneDead(matches) {
  if (!Array.isArray(matches)) return [];
  return matches.filter(isAlive);
}

export function adjustIndex(idx, oldLen, newLen) {
  if (newLen === 0) return 0;
  if (idx < 0) return 0;
  if (idx >= newLen) return newLen - 1;
  return idx;
}
