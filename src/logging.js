// Search-result logging: records each match found with timestamp + context.
// Deduplicates within a session by (value, before, after, sourceUrl).
import { safe } from './safe.js';

const dedupeKeys = new Set();

// Drop query string and hash so persisted logs don't capture auth tokens etc.
function sanitiseUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch { return String(url); }
}

export function buildLogEntry(match) {
  return {
    ts: new safe.Date().toISOString(),
    kind: match.kind || 'text',
    value: match.value,
    before: match.before || '',
    after: match.after || '',
    sourceUrl: sanitiseUrl(match.sourceUrl),
  };
}

function key(m) { return `${m.value}|${m.before}|${m.after}|${m.sourceUrl}`; }

export function logMatches(matches, opts = {}) {
  if (!Array.isArray(matches)) return [];
  const out = [];
  for (const m of matches) {
    const k = key(m);
    if (dedupeKeys.has(k)) continue;
    dedupeKeys.add(k);
    out.push(buildLogEntry(m));
  }
  return out;
}

export function resetSessionDedupe() { dedupeKeys.clear(); }
