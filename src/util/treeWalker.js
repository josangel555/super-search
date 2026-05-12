// Bounded text-node iterator. Caps total nodes walked and total wall-clock
// time so a pathological page can't freeze the tab. Skips script/style/
// noscript/template tags and any subtree marked as ours.
import { safe } from '../safe.js';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
export const DEFAULT_NODE_BUDGET = 100_000;
export const DEFAULT_TIME_BUDGET_MS = 500;
export const DEFAULT_PER_NODE_LEN_CAP = 50_000;

/**
 * Build an iterator over text nodes under `root`.
 * Stops early on budget overrun and reports it.
 *
 * @param {Element} root
 * @param {object} opts
 * @param {(el: Element) => boolean} [opts.shouldSkip] additional skip predicate
 * @param {number} [opts.nodeBudget]
 * @param {number} [opts.timeBudgetMs]
 * @returns {{ nodes: Generator<Text>, stats: () => { nodesSeen: number, timeMs: number, truncated: boolean } }}
 */
export function walkTextNodes(root, opts = {}) {
  const shouldSkip = opts.shouldSkip || (() => false);
  const nodeBudget = opts.nodeBudget ?? DEFAULT_NODE_BUDGET;
  const timeBudgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startTs = safe.dateNow();
  let nodesSeen = 0;
  let truncated = false;

  // Hand-rolled DFS over text nodes. Avoids dependence on TreeWalker
  // behaviour quirks across DOM implementations; iterative to avoid stack
  // overflow on deeply nested trees.
  function* gen() {
    if (!root) return;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      // Skip rules apply to elements (and their subtrees).
      if (node.nodeType === 1) {
        if (SKIP_TAGS.has(node.tagName)) continue;
        if (shouldSkip(node)) continue;
        // Push children in reverse so they pop in forward order.
        const children = node.childNodes;
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
        continue;
      }
      if (node.nodeType === 3) {
        nodesSeen++;
        if (nodesSeen > nodeBudget) { truncated = true; return; }
        if ((nodesSeen & 1023) === 0) {
          if (safe.dateNow() - startTs > timeBudgetMs) { truncated = true; return; }
        }
        yield node;
        continue;
      }
      // Other node types (comments, doctype, etc.) — also descend their children if any.
      if (node.childNodes && node.childNodes.length) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
      }
    }
  }

  return {
    nodes: gen(),
    stats: () => ({ nodesSeen, timeMs: safe.dateNow() - startTs, truncated }),
  };
}

export function isSkippableTag(tagName) { return SKIP_TAGS.has(tagName); }
