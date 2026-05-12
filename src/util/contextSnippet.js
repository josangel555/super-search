// Build context strings around a text-node range, walking neighbouring text
// nodes if necessary to reach CONTEXT_LEN characters of context.
export const CONTEXT_LEN = 30;

export function buildContext(textNode, start, end, contextLen = CONTEXT_LEN) {
  const value = textNode.nodeValue;
  const before = value.substring(Math.max(0, start - contextLen), start);
  const after = value.substring(end, Math.min(value.length, end + contextLen));
  return { before, after };
}
