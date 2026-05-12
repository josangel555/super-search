// Parse 'MM:SS' or 'HH:MM:SS' to seconds.
export function timeToSeconds(s) {
  if (typeof s !== 'string') return NaN;
  const parts = s.split(':').map(Number);
  if (parts.some(p => Number.isNaN(p) || p < 0)) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

export function parseRange(rangeStr) {
  const m = rangeStr.match(/^(\d{1,2}(?::\d{2}){1,2})-(\d{1,2}(?::\d{2}){1,2})$/);
  if (!m) return null;
  const lo = timeToSeconds(m[1]);
  const hi = timeToSeconds(m[2]);
  if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
  return { lo, hi };
}

// Regex used by timestamp strategy to find standalone tokens in text.
export const TOKEN_RX = /\b(\d{1,2}:)?\d{1,2}:\d{2}\b/g;
