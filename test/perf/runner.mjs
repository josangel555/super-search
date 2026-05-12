// Perf smoke: builds a synthetic large DOM and measures search throughput.
// Run via `npm run test:perf` — not part of default CI loop.
import { Window } from 'happy-dom';

const win = new Window({ url: 'https://perf.test/' });
Object.defineProperty(globalThis, 'window', { value: win, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: win.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Range', { value: win.Range, writable: true, configurable: true });
Object.defineProperty(globalThis, 'NodeFilter', { value: win.NodeFilter, writable: true, configurable: true });
Object.defineProperty(globalThis, 'MutationObserver', { value: win.MutationObserver, writable: true, configurable: true });
Object.defineProperty(globalThis, 'location', { value: win.location, writable: true, configurable: true });
try { Object.defineProperty(globalThis, 'navigator', { value: win.navigator, writable: true, configurable: true }); } catch {}
try { Object.defineProperty(globalThis, 'crypto', { value: win.crypto || globalThis.crypto, writable: true, configurable: true }); } catch {}

const { run: textRun } = await import('../../src/search/text.js');
const { run: regexRun } = await import('../../src/search/regex.js');

function buildHugeDom(count) {
  // Each <p> contributes one text node; total ~count nodes.
  const paragraphs = [];
  for (let i = 0; i < count; i++) {
    paragraphs.push(`<p>Lorem ipsum dolor sit amet ${i} consectetur adipiscing elit.</p>`);
  }
  document.body.innerHTML = paragraphs.join('');
}

function bench(label, fn, iters = 5) {
  const times = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(iters / 2)];
  const p95 = times[Math.min(iters - 1, Math.floor(iters * 0.95))];
  console.log(`  ${label.padEnd(40)} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
  return { p50, p95 };
}

console.log('# perf smoke');

console.log('## 1k text nodes');
buildHugeDom(1_000);
let r = bench('text search ("lorem")', () => textRun('lorem', document.body));
if (r.p95 > 100) console.warn('  WARN: text p95 exceeded 100ms');

r = bench('regex /\\w{5}\\b/g', () => regexRun('/\\w{5}\\b/g', document.body));

console.log('## 5k text nodes');
buildHugeDom(5_000);
r = bench('text search ("lorem")', () => textRun('lorem', document.body), 3);
if (r.p95 > 500) console.warn('  WARN: text p95 exceeded 500ms');

console.log('## 10k text nodes');
buildHugeDom(10_000);
r = bench('text search ("lorem")', () => textRun('lorem', document.body), 3);
if (r.p95 > 1000) console.warn('  WARN: text p95 exceeded 1000ms');

console.log('\n## ReDoS guard');
document.body.innerHTML = '<p>aaaaaX</p>';
let didThrow = false;
try {
  regexRun('/(a+)+b/g', document.body);
} catch { didThrow = true; }
console.log('  catastrophic regex refused up-front:', didThrow);
if (!didThrow) console.warn('  WARN: dangerous pattern should be refused');

console.log('\nperf smoke complete');
