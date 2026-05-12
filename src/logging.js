// Search-result logging: records each match found with timestamp + context.
// Deduplicates within a session by (value, before, after, sourceUrl).
import { safe } from './safe.js';

const dedupeKeys = new Set();

export function buildLogEntry(match) {
  return {
    ts: new safe.Date().toISOString(),
    kind: match.kind || 'text',
    value: match.value,
    before: match.before || '',
    after: match.after || '',
    sourceUrl: match.sourceUrl || '',
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
