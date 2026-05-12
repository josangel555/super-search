import { build, context } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';
import { argv } from 'node:process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const watch = argv.includes('--watch');
const dev = argv.includes('--dev') || watch;

const header = readFileSync('src/header.txt', 'utf8')
  .replaceAll('{{VERSION}}', pkg.version)
  .replaceAll('{{DESCRIPTION}}', pkg.description);

// Dev builds get a distinct filename so a stray `npm run build:dev` can't
// accidentally produce an "official" artifact with inline source maps + test hooks.
const OUTFILE = dev ? 'super-search.dev.user.js' : 'super-search.user.js';

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: OUTFILE,
  banner: { js: header },
  target: 'chrome110',
  // Always preserve readable identifiers (Tampermonkey users may inspect)
  // but in prod let esbuild's `minifySyntax` eliminate dead branches such
  // as the __SS_DEV__-gated test hook. Without this the test hook ships
  // in prod as ~1.5 KB of unreachable code.
  minify: false,
  minifySyntax: !dev,
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
    const { size } = statSync(OUTFILE);
    const kb = (size / 1024).toFixed(1);
    const pct = ((size / BUDGET_BYTES) * 100).toFixed(0);
    console.log(`built: ${kb} KB (${pct}% of 100KB budget)`);
    if (size > BUDGET_BYTES && !dev) {
      console.error(`FAIL: bundle ${kb} KB exceeds 100KB budget`);
      process.exit(1);
    }
  } catch (e) {
    console.error('could not stat output:', e.message);
    process.exit(1);
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
