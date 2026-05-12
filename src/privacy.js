// Per-host privacy controls.
// - incognito: session-only mode; no persistence (handled by checking state.incognito
//   in the persistence path).
// - denylist: hostnames where Super Search will not persist matches at all.
import { safe } from './safe.js';

export function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

export function isAllowedToPersist(state, currentUrl) {
  if (state?.privacy?.incognito) return false;
  const host = hostOf(currentUrl || (typeof location !== 'undefined' ? location.href : ''));
  if (!host) return true;
  const denylist = state?.privacy?.denylist || [];
  for (const pattern of denylist) {
    if (matchHost(host, pattern)) return false;
  }
  return true;
}

function matchHost(host, pattern) {
  if (!pattern) return false;
  if (pattern === host) return true;
  // Suffix match: ".example.com" matches "a.example.com" and "example.com"
  if (pattern.startsWith('.')) return host.endsWith(pattern.slice(1));
  // Wildcard: "*.example.com"
  if (pattern.startsWith('*.')) {
    const tail = pattern.slice(2);
    return host === tail || host.endsWith('.' + tail);
  }
  return false;
}
