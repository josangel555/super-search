// Timestamp-range search: find tokens like '1:25' or '01:01:25' in text and
// keep only those whose parsed-seconds value lies inside the user's range.
import { safe } from '../safe.js';
import { walkTextNodes, DEFAULT_PER_NODE_LEN_CAP } from '../util/treeWalker.js';
import { matchIdFor } from '../util/matchId.js';
import { buildContext } from '../util/contextSnippet.js';
import { parseRange, timeToSeconds, TOKEN_RX } from '../util/timeParse.js';

export function run(query, root, opts = {}) {
  const sourceUrl = opts.sourceUrl || (typeof location !== 'undefined' ? location.href : '');
  const range = parseRange(query);
  if (!range) return { matches: [], truncated: false, nodesSeen: 0 };
  if (range.lo > range.hi) {
    // Inverted range — surface the issue rather than silently returning empty.
    return { matches: [], truncated: false, nodesSeen: 0, error: 'inverted-range' };
  }

  const matches = [];
  const w = walkTextNodes(root, opts);
  for (const node of w.nodes) {
    const raw = node.nodeValue;
    if (!raw || raw.length > (opts.perNodeLenCap ?? DEFAULT_PER_NODE_LEN_CAP)) continue;

    const re = new RegExp(TOKEN_RX.source, 'g');
    let m;
    while ((m = re.exec(raw)) !== null) {
      const tok = m[0];
      const secs = timeToSeconds(tok);
      if (Number.isNaN(secs)) continue;
      if (secs < range.lo || secs > range.hi) continue;

      const start = m.index;
      const end = start + tok.length;
      const r = document.createRange();
      try {
        r.setStart(node, start);
        r.setEnd(node, end);
      } catch { continue; }
      const { before, after } = buildContext(node, start, end);
      matches.push({
        id: matchIdFor({ value: tok, before, after, sourceUrl }),
        kind: 'timestamp',
        range: r,
        element: null,
        value: tok,
        before,
        after,
        sourceUrl,
        capturedAt: safe.dateNow(),
        capturedNodeLength: raw.length,
      });
    }
  }

  const s = w.stats();
  return { matches, truncated: s.truncated, nodesSeen: s.nodesSeen };
}
