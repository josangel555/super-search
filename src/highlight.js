// CSS.highlights wrapper. Feature-detected so older browsers degrade
// gracefully (no text highlight — navigation still works).
import { safe } from './safe.js';

const ALL_NAME = 'ss-all';
const ACTIVE_NAME = 'ss-active';

let allHL = null;
let activeHL = null;
let installed = false;

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
  // can't be scoped to a shadow root). Append a <style> to <head>.
  if (typeof document === 'undefined') return;
  if (document.getElementById('ss-highlight-styles')) return;
  const style = document.createElement('style');
  style.id = 'ss-highlight-styles';
  style.textContent = `
    ::highlight(${ALL_NAME})    { background-color: #DA70D6; color: #000; }
    ::highlight(${ACTIVE_NAME}) { background-color: #32CD32; color: #000; }
  `;
  (document.head || document.documentElement).appendChild(style);
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
    if (!m.range) continue;
    try {
      if (i === activeIndex) activeHL.add(m.range);
      else allHL.add(m.range);
    } catch { /* range may be detached */ }
  }
}
