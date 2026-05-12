// Content-derived match IDs. Stable across tabs so cross-tab union dedupes
// concurrent appends naturally.
import { safe } from '../safe.js';

// FNV-1a 32-bit. Not cryptographic — we just need stable + cheap.
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

// Escape "|" inside any component so values containing the separator can't
// collide with shifted-boundary inputs (e.g. {value:"a|b", before:""} vs
// {value:"a", before:"b"}).
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');

export function matchIdFor({ value, before, after, sourceUrl }) {
  return 'm_' + hashStr(`${esc(sourceUrl)}|${esc(before)}|${esc(value)}|${esc(after)}`);
}
