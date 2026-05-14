// Bench: full-body scan vs subtree scan, in real Chrome via puppeteer.
import { launch } from '../e2e/util.js';

const b = await launch();
const page = await b.newPage();
await page.goto('data:text/html,<html><body></body></html>');

const result = await page.evaluate(async () => {
  const parts = [];
  for (let i = 0; i < 50_000; i++) parts.push('<p>alpha ' + i + '</p>');
  document.body.innerHTML = parts.join('');

  function walk(root, needle) {
    const matches = [];
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      if (n.nodeType === 1) {
        for (let i = n.childNodes.length-1; i>=0; i--) stack.push(n.childNodes[i]);
      } else if (n.nodeType === 3) {
        const v = n.nodeValue.toLowerCase();
        let i = 0;
        while ((i = v.indexOf(needle, i)) !== -1) {
          matches.push({ node: n, start: i, end: i+needle.length });
          i += needle.length;
        }
      }
    }
    return matches;
  }

  const full = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    walk(document.body, 'alpha');
    full.push(performance.now() - t);
  }
  full.sort((a,b)=>a-b);

  const p = document.querySelectorAll('p')[100];
  p.innerHTML += ' more alpha';
  const partial = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    walk(p, 'alpha');
    partial.push(performance.now() - t);
  }
  partial.sort((a,b)=>a-b);

  return {
    fullP50: full[2].toFixed(1),
    fullP95: full[4].toFixed(1),
    partialP50: partial[2].toFixed(3),
    partialP95: partial[4].toFixed(3),
  };
});

console.log('50k <p> page:');
console.log(`  full body scan      p50=${result.fullP50}ms  p95=${result.fullP95}ms`);
console.log(`  subtree scan (1 p)  p50=${result.partialP50}ms  p95=${result.partialP95}ms`);
console.log(`  speedup: ${(parseFloat(result.fullP50) / parseFloat(result.partialP50)).toFixed(0)}x`);

await b.close();
