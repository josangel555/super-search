// Regex search strategy with zero-width guard and time-budget protection
// against catastrophic backtracking (ReDoS).
import { safe } from '../safe.js';
import { walkTextNodes, DEFAULT_PER_NODE_LEN_CAP } from '../util/treeWalker.js';
import { matchIdFor } from '../util/matchId.js';
import { buildContext } from '../util/contextSnippet.js';

export class RegexParseError extends Error {}

// Heuristic catastrophic-backtracking guard.
// JS regex.exec is uninterruptible once it starts, so the only practical
// defence is to refuse known-pathological patterns syntactically before
// execution. This catches the classic forms:  (X+)+ (X*)+ (X+)* (X*)*
// where the inner and outer both have unbounded quantifiers.
const DANGEROUS = /\([^)]*[+*?][^)]*\)[+*]/;
export function looksDangerous(pattern) {
  return DANGEROUS.test(pattern);
}

export function parseRegexLiteral(s) {
  // Input is either "/pattern/flags" or a raw pattern (we ensure /g for iteration).
  try {
    const m = s.match(/^\/(.+)\/([gimsuy]*)$/s);
    let pattern, flags;
    if (m) {
      pattern = m[1];
      flags = m[2] || '';
      // `g` and `y` are mutually exclusive in some engines; if user wants
      // sticky, respect it and rely on m.index advance for iteration.
      if (!flags.includes('g') && !flags.includes('y')) flags += 'g';
    } else {
      pattern = s;
      flags = 'gi';
    }
    if (looksDangerous(pattern)) {
      throw new RegexParseError('Pattern may cause catastrophic backtracking; refusing.');
    }
    return new RegExp(pattern, flags);
  } catch (e) {
    if (e instanceof RegexParseError) throw e;
    throw new RegexParseError(e.message);
  }
}

const PER_REGEX_TIME_BUDGET_MS = 500;

export function run(input, root, opts = {}) {
  const sourceUrl = opts.sourceUrl || (typeof location !== 'undefined' ? location.href : '');
  let re;
  try {
    if (input instanceof RegExp) {
      if (looksDangerous(input.source)) throw new RegexParseError('Pattern may cause catastrophic backtracking; refusing.');
      const f = input.flags;
      // Match parseRegexLiteral semantics: only add `g` if neither `g` nor `y` is present.
      const flags = (f.includes('g') || f.includes('y')) ? f : f + 'g';
      re = new RegExp(input.source, flags);
    } else {
      re = parseRegexLiteral(input);
    }
  } catch (e) {
    if (e instanceof RegexParseError) throw e;
    throw new RegexParseError(e.message);
  }

  const matches = [];
  const w = walkTextNodes(root, opts);
  const startTs = safe.dateNow();
  let regexTimedOut = false;

  for (const node of w.nodes) {
    if (regexTimedOut) break;
    const raw = node.nodeValue;
    if (!raw || raw.length > (opts.perNodeLenCap ?? DEFAULT_PER_NODE_LEN_CAP)) continue;

    re.lastIndex = 0;
    let m;
    let iter = 0;
    while ((m = re.exec(raw)) !== null) {
      iter++;
      // Time guard every 64 iterations.
      if ((iter & 63) === 0) {
        if (safe.dateNow() - startTs > PER_REGEX_TIME_BUDGET_MS) {
          regexTimedOut = true;
          break;
        }
      }

      const start = m.index;
      const end = m.index + m[0].length;

      // Zero-width guard.
      if (m.index === re.lastIndex) {
        re.lastIndex++;
        if (m[0].length === 0) continue;
      }

      if (end > start) {
        const range = document.createRange();
        try {
          range.setStart(node, start);
          range.setEnd(node, end);
        } catch { continue; }

        const value = m[0];
        const { before, after } = buildContext(node, start, end);
        matches.push({
          id: matchIdFor({ value, before, after, sourceUrl }),
          kind: 'regex',
          range,
          element: null,
          value,
          before,
          after,
          sourceUrl,
          capturedAt: safe.dateNow(),
          capturedNodeLength: raw.length,
        });
      }
    }
  }

  const s = w.stats();
  return { matches, truncated: s.truncated || regexTimedOut, nodesSeen: s.nodesSeen, regexTimedOut };
}
