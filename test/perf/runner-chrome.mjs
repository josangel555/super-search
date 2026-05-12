// Same perf benchmarks, but run inside headless Chrome via Puppeteer.
// Happy-dom's createElement/innerHTML is much slower than Chrome's, so this
// gives a realistic picture of how the script performs in production.
import { launch } from '../e2e/util.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEXT_MODULE = readFileSync(resolve(import.meta.dirname, '../../src/search/text.js'), 'utf8');

async function main() {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[page]', e.message));
    await page.goto('data:text/html,<html><body></body></html>');

    // Inject just the modules we need (no GM_* — perf benches use direct calls).
    await page.evaluate(`
      window.SS_PERF = (function(){
        const safe = { dateNow: Date.now.bind(Date), NodeFilter: NodeFilter, Math: Math, mathFloor: Math.floor, mathMin: Math.min, mathMax: Math.max };

        const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE']);
        function* walk(root, opts={}) {
          const nodeBudget = opts.nodeBudget || 100000;
          const timeBudget = opts.timeBudgetMs || 500;
          const start = safe.dateNow();
          let seen = 0;
          const stack = [root];
          while (stack.length) {
            const n = stack.pop();
            if (!n) continue;
            if (n.nodeType === 1) {
              if (SKIP_TAGS.has(n.tagName)) continue;
              for (let i = n.childNodes.length-1; i>=0; i--) stack.push(n.childNodes[i]);
              continue;
            }
            if (n.nodeType === 3) {
              seen++;
              if (seen > nodeBudget) return;
              if ((seen & 1023) === 0 && (safe.dateNow() - start) > timeBudget) return;
              yield n;
            }
          }
        }
        function textRun(query, root) {
          const needle = query.toLowerCase();
          const matches = [];
          for (const node of walk(root)) {
            const hay = node.nodeValue.toLowerCase();
            let i = 0;
            while ((i = hay.indexOf(needle, i)) !== -1) {
              const r = document.createRange();
              r.setStart(node, i);
              r.setEnd(node, i + needle.length);
              matches.push({ range: r, value: node.nodeValue.substring(i, i+needle.length) });
              i += needle.length;
            }
          }
          return matches;
        }
        function build(count) {
          const parts = [];
          for (let i=0;i<count;i++) parts.push('<p>Lorem ipsum dolor sit amet '+i+' consectetur adipiscing elit.</p>');
          document.body.innerHTML = parts.join('');
        }
        function bench(label, fn, iters=5) {
          const ts = [];
          for (let i=0;i<iters;i++) {
            const t = performance.now();
            fn();
            ts.push(performance.now()-t);
          }
          ts.sort((a,b)=>a-b);
          const p50 = ts[Math.floor(iters/2)];
          const p95 = ts[Math.min(iters-1, Math.floor(iters*0.95))];
          return { p50, p95 };
        }
        return { build, bench, textRun };
      })();
    `);

    for (const [label, count] of [['5k', 5000], ['20k', 20000], ['50k', 50000]]) {
      const result = await page.evaluate((cnt) => {
        SS_PERF.build(cnt);
        return SS_PERF.bench('text', () => SS_PERF.textRun('lorem', document.body));
      }, count);
      console.log(`  ${label.padEnd(8)} text search p50=${result.p50.toFixed(0)}ms p95=${result.p95.toFixed(0)}ms`);
    }

    // Node-budget enforcement: with 120k nodes, walker should bail at 100k.
    const truncated = await page.evaluate(() => {
      SS_PERF.build(120000);
      const start = performance.now();
      let count = 0;
      let elapsed;
      const matches = SS_PERF.textRun('lorem', document.body);
      elapsed = performance.now() - start;
      return { matches: matches.length, elapsedMs: elapsed };
    });
    console.log(`  120k    text search ${truncated.matches} matches in ${truncated.elapsedMs.toFixed(0)}ms`);

    await page.close();
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
