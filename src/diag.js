// In-app diagnostics log. Always captures errors; opt-in for info.
// Visible via the log pane in the UI (Phase 5) and dumpable via menu.
import { safe } from './safe.js';
import { gm } from './gm.js';

const MAX = 200;
const entries = [];
let diagnosticsMode = false;

function add(level, msg) {
  const e = { level, msg: String(msg), ts: safe.dateNow() };
  entries.push(e);
  if (entries.length > MAX) entries.shift();
  if (diagnosticsMode || level === 'error') {
    gm.log(`[${level}] ${e.msg}`);
  }
}

export const log = {
  info: (m) => add('info', m),
  warn: (m) => add('warn', m),
  error: (m) => add('error', m),
};

export function getEntries() { return entries.slice(); }
export function setDiagnostics(on) { diagnosticsMode = !!on; }
export function isDiagnostics() { return diagnosticsMode; }
