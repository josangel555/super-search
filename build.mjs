import { build, context } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';
import { argv } from 'node:process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const watch = argv.includes('--watch');
const dev = argv.includes('--dev') || watch;

const header = readFileSync('src/header.txt', 'utf8')
  .replaceAll('{{VERSION}}', pkg.version)
  .replaceAll('{{DESCRIPTION}}', pkg.description);

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'super-search.user.js',
  banner: { js: header },
  target: 'chrome110',
  minify: false,
  legalComments: 'inline',
  logLevel: 'info',
  define: {
    '__SS_VERSION__': JSON.stringify(pkg.version),
    '__SS_DEV__': JSON.stringify(dev),
  },
  sourcemap: dev ? 'inline' : false,
};

const BUDGET_BYTES = 100 * 1024;

function reportSize() {
  try {
    const { size } = statSync('super-search.user.js');
    const kb = (size / 1024).toFixed(1);
    const pct = ((size / BUDGET_BYTES) * 100).toFixed(0);
    console.log(`built: ${kb} KB (${pct}% of 100KB budget)`);
    if (size > BUDGET_BYTES) {
      console.error('WARN: bundle exceeds 100KB budget');
    }
  } catch (e) {
    console.error('could not stat output:', e.message);
  }
}

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log('watching src/ for changes...');
} else {
  await build(opts);
  reportSize();
}
