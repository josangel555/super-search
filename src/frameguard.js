// Defence-in-depth: with @noframes Tampermonkey already skips iframe injection,
// but if someone removes that directive or uses a manager without it, we bail here.

export function isTopFrame() {
  try {
    return window.top === window;
  } catch {
    // Cross-origin iframe access throws — definitely not top.
    return false;
  }
}
