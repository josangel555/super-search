// CSS.highlights wrapper with incremental delta updates.
// Tracks current state internally so syncMatches() only touches Range objects
// that actually changed — eliminates the clear-then-rebuild flicker on
// observer-driven re-runs.
import { safe } from './safe.js';

const ALL_NAME = 'ss-all';
const ACTIVE_NAME = 'ss-active';

let allHL = null;
let activeHL = null;
let installed = false;
let styleElRef = null;

// Set of Range objects currently registered with CSS.highlights. Keyed by
// Range identity (not match.id) because two matches with identical content
// at different DOM positions are legitimately separate highlight rows and
// must be tracked individually. Range identity also makes survivors free:
// re-searches that produce fresh Range objects for the SAME content are
// caught by performSearch's fingerprint short-circuit before they reach us.
const currentRanges = new Set();
let currentActiveRange = null;

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
  if (typeof document === 'undefined') return;
  if (styleElRef && styleElRef.isConnected) return;
  const style = document.createElement('style');
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
  currentRanges.clear();
  currentActiveRange = null;
}

// Wholesale set the highlights to mirror `matches` with `activeIndex` active.
// Touches only Range objects that changed since the previous call.
// Re-searches that produce identical content but fresh Range objects are
// short-circuited upstream in performSearch via the fingerprint check —
// so by the time we get here, fresh Ranges always mean genuinely new matches.
export function syncMatches(matches, activeIndex) {
  install();
  if (!isAvailable() || !allHL || !activeHL) return;
  const list = Array.isArray(matches) ? matches : [];
  const newRanges = [];
  const newSet = new Set();
  for (const m of list) {
    if (m && m.range) {
      newRanges.push(m.range);
      newSet.add(m.range);
    }
  }
  const targetActive = (activeIndex >= 0 && list[activeIndex]) ? list[activeIndex].range : null;

  // 1. Remove Ranges no longer present.
  for (const r of [...currentRanges]) {
    if (newSet.has(r)) continue;
    tryDelete(allHL, r); tryDelete(activeHL, r);
    currentRanges.delete(r);
    if (r === currentActiveRange) currentActiveRange = null;
  }

  // 2. Add new Ranges.
  for (const r of newRanges) {
    if (currentRanges.has(r)) continue;
    tryAdd(allHL, r);
    currentRanges.add(r);
  }

  // 3. Active-range swap. Move previous active back into all-set, promote new.
  if (targetActive !== currentActiveRange) {
    if (currentActiveRange) {
      tryDelete(activeHL, currentActiveRange);
      tryAdd(allHL, currentActiveRange);
    }
    if (targetActive) {
      tryDelete(allHL, targetActive);
      tryAdd(activeHL, targetActive);
    }
    currentActiveRange = targetActive;
  }
}

function tryAdd(hl, range) { try { hl.add(range); } catch {} }
function tryDelete(hl, range) { try { hl.delete(range); } catch {} }

// Back-compat alias — existing callers still use setMatches.
export const setMatches = syncMatches;
// setActiveOnly is now just a special case of syncMatches.
export function setActiveOnly(matches, activeIndex) { syncMatches(matches, activeIndex); }

// Inspection helpers for tests / diagnostics.
export function currentSize() { return currentRanges.size; }
export function activeRange() { return currentActiveRange; }
