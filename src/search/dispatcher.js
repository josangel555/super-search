// Routes a query to the right search strategy.
// Mode 'text' auto-detects regex (/.../flags) and timestamp (HH:MM:SS-HH:MM:SS).
// Phase 1: text + regex. Phase 2 will register selector/js/timestamp strategies.
import { run as runText } from './text.js';
import { run as runRegex, RegexParseError } from './regex.js';

const RX_REGEX = /^\/(.+)\/([gimsuy]*)$/s;
const RX_TIMESTAMP = /^\d{1,2}(:\d{2}){1,2}-\d{1,2}(:\d{2}){1,2}$/;

// Strategy registry — Phase 2 will populate selector/js/timestamp.
const strategies = {
  text: runText,
  regex: runRegex,
};

export function registerStrategy(name, fn) {
  strategies[name] = fn;
}

export function detectTextSubmode(query) {
  if (!query) return 'empty';
  if (RX_REGEX.test(query)) return 'regex';
  if (RX_TIMESTAMP.test(query)) return 'timestamp';
  return 'plain';
}

export function dispatch({ query, mode, root, sourceUrl }) {
  if (!query) return { matches: [], error: null, submode: 'empty', truncated: false };
  root = root || document.body;
  const ctx = { sourceUrl };

  try {
    if (mode === 'selector') {
      const fn = strategies.selector;
      if (!fn) return { matches: [], error: null, submode: 'selector' };
      return { ...fn(query, root, ctx), error: null, submode: 'selector' };
    }
    if (mode === 'js') {
      const fn = strategies.js;
      if (!fn) return { matches: [], error: null, submode: 'js' };
      return { ...fn(query, root, ctx), error: null, submode: 'js' };
    }

    // Text mode + auto-detect.
    const submode = detectTextSubmode(query);
    if (submode === 'regex') {
      return { ...runRegex(query, root, ctx), error: null, submode };
    }
    if (submode === 'timestamp') {
      const fn = strategies.timestamp;
      if (fn) return { ...fn(query, root, ctx), error: null, submode };
      // Fall through to text if timestamp strategy not registered.
    }
    return { ...runText(query, root, ctx), error: null, submode: 'plain' };
  } catch (e) {
    if (e instanceof RegexParseError) {
      return { matches: [], error: 'regex', submode: 'regex' };
    }
    return { matches: [], error: errorKind(mode), submode: mode };
  }
}

function errorKind(mode) {
  if (mode === 'selector') return 'selector';
  if (mode === 'js') return 'js';
  return 'unknown';
}
