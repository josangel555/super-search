import { safe } from '../safe.js';

export function debounce(ms, fn) {
  let t = null;
  const wrapped = (...args) => {
    if (t !== null) safe.clearTimeout(t);
    t = safe.setTimeout(() => { t = null; fn(...args); }, ms);
  };
  wrapped.cancel = () => { if (t !== null) { safe.clearTimeout(t); t = null; } };
  wrapped.flush = (...args) => { wrapped.cancel(); fn(...args); };
  return wrapped;
}
