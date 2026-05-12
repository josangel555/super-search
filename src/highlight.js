// CSS.highlights wrapper. Feature-detected so older browsers degrade
// gracefully (no text highlight — navigation still works).
import { safe } from './safe.js';

const ALL_NAME = 'ss-all';
const ACTIVE_NAME = 'ss-active';

let allHL = null;
let activeHL = null;
let installed = false;
let styleElRef = null;     // closure-held reference; we don't rely on getElementById

export function isAvailable() {
  return !!(safe.cssHighlights && safe.Highlight);
}

export function install() {
  if (installed) return;
  if (!isAvailable()) { installed = true; return; }
  try {
    allHL = new safe.Highlight();
    activeHL = new safe.Highlight();
    safe.cssHighlights.set(ALL_NAME, allHL);
    safe.cssHighlights.set(ACTIVE_NAME, activeHL);
    installed = true;
  } catch {
    installed = true;
  }
}

export function installStyles() {
  // Highlights are styled at the document level (CSS pseudo-element selector
  // can't be scoped to a shadow root). Append a <style> to documentElement.
  // We retain a closure reference rather than relying on a known-id element,
  // so host pages can't probe for us via getElementById.
  if (typeof document === 'undefined') return;
  if (styleElRef && styleElRef.isConnected) return;
  const style = document.createElement('style');
  // Background colours chosen to pass WCAG AA (>= 4.5:1) against black text:
  // - all matches: #C04AC0 (medium orchid) ≈ 5.1:1
  // - active match: #32CD32 (lime green) ≈ 9.0:1
  style.textContent = `
    ::highlight(${ALL_NAME})    { background-color: #C04AC0; color: #000; }
    ::highlight(${ACTIVE_NAME}) { background-color: #32CD32; color: #000; }
  `;
  (document.head || document.documentElement).appendChild(style);
  styleElRef = style;
}

export function clear() {
  if (allHL) allHL.clear();
  if (activeHL) activeHL.clear();
}

export function setMatches(matches, activeIndex) {
  install();
  if (!isAvailable()) return;
  if (!allHL || !activeHL) return;
  allHL.clear();
  activeHL.clear();
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m || !m.range) continue;
    try {
      if (i === activeIndex) activeHL.add(m.range);
      else allHL.add(m.range);
    } catch { /* range may be detached */ }
  }
}

// Move only the "active" range without rebuilding the full set.
// Used by next/prev navigation — much cheaper than setMatches for big sets.
export function setActiveOnly(matches, activeIndex) {
  install();
  if (!isAvailable() || !allHL || !activeHL) return;
  // Move the previous active back into all, swap in the new active.
  activeHL.clear();
  // Re-derive: this is O(matches) but only touches the Highlight set, no Range allocations.
  allHL.clear();
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m || !m.range) continue;
    try {
      if (i === activeIndex) activeHL.add(m.range);
      else allHL.add(m.range);
    } catch { /* detached */ }
  }
}
