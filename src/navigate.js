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
  // Respect prefers-reduced-motion — smooth scroll triggers vestibular issues.
  let reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
  try {
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  } catch {
    try { el.scrollIntoView(); } catch {}
  }
}
