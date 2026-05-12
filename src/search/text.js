// Plain text search strategy.
// Pure: takes a query and a root element, returns Match[].
import { safe } from '../safe.js';
import { walkTextNodes, DEFAULT_PER_NODE_LEN_CAP } from '../util/treeWalker.js';
import { normaliseForMatch, normaliseQuery } from '../util/textNormalise.js';
import { matchIdFor } from '../util/matchId.js';
import { buildContext } from '../util/contextSnippet.js';

export function run(query, root, opts = {}) {
  const sourceUrl = opts.sourceUrl || (typeof location !== 'undefined' ? location.href : '');
  if (!query) return { matches: [], truncated: false, nodesSeen: 0 };

  const needle = normaliseQuery(query).toLowerCase();
  // Refuse whitespace-only or empty needles — they'd match every space on the page.
  if (!needle || needle.trim() === '') return { matches: [], truncated: false, nodesSeen: 0 };

  const matches = [];
  const w = walkTextNodes(root, opts);

  for (const node of w.nodes) {
    const raw = node.nodeValue;
    if (!raw || raw.length > (opts.perNodeLenCap ?? DEFAULT_PER_NODE_LEN_CAP)) continue;
    const { normalised, indexMap } = normaliseForMatch(raw);
    const haystack = normalised.toLowerCase();

    let i = 0;
    while (i <= haystack.length - needle.length) {
      const found = haystack.indexOf(needle, i);
      if (found === -1) break;

      // Map normalised offsets back to original.
      const origStart = indexMap[found] ?? found;
      const lastNormIdx = found + needle.length - 1;
      const origEnd = (indexMap[lastNormIdx] ?? lastNormIdx) + 1;

      const range = document.createRange();
      try {
        range.setStart(node, origStart);
        range.setEnd(node, origEnd);
      } catch {
        i = found + needle.length;
        continue;
      }

      const value = raw.substring(origStart, origEnd);
      const { before, after } = buildContext(node, origStart, origEnd);
      matches.push({
        id: matchIdFor({ value, before, after, sourceUrl }),
        kind: 'text',
        range,
        element: null,
        value,
        before,
        after,
        sourceUrl,
        capturedAt: safe.dateNow(),
        capturedNodeLength: raw.length,
      });

      i = found + needle.length;
    }
  }

  const s = w.stats();
  return { matches, truncated: s.truncated, nodesSeen: s.nodesSeen };
}
