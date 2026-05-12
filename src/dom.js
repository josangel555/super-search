// Safe DOM helpers. Project convention: NEVER use innerHTML, outerHTML,
// or insertAdjacentHTML in src/. Use these helpers (or document.createElement +
// textContent + appendChild) instead.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const sk in v) node.style[sk] = v[sk];
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset' && typeof v === 'object') {
      for (const dk in v) node.dataset[dk] = v[dk];
    } else if (k in node) {
      node[k] = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') {
      node.appendChild(document.createTextNode(String(c)));
    } else if (Array.isArray(c)) {
      for (const cc of c) {
        if (cc == null || cc === false) continue;
        node.appendChild(typeof cc === 'string' || typeof cc === 'number'
          ? document.createTextNode(String(cc))
          : cc);
      }
    } else {
      node.appendChild(c);
    }
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function setText(node, text) {
  node.textContent = String(text);
}
