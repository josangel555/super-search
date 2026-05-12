// Navigation: next/prev/wrap + scrollIntoView on the active match.
import { safe } from './safe.js';

function indexOfNext(cur, len) { return len === 0 ? 0 : (cur + 1) % len; }
function indexOfPrev(cur, len) { return len === 0 ? 0 : (cur - 1 + len) % len; }

export function nextIndex(cur, len) { return indexOfNext(cur, len); }
export function prevIndex(cur, len) { return indexOfPrev(cur, len); }

export function scrollToMatch(m) {
  if (!m) return;
  const el = m.element || (m.range && m.range.commonAncestorContainer?.parentElement);
  if (!el || !el.scrollIntoView) return;
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    try { el.scrollIntoView(); } catch {}
  }
}
