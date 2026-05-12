// Captures references to built-ins and Web APIs BEFORE any other module body runs.
// Anything imported here is frozen at module-load time, so even if the host page later
// monkey-patches globals, our code keeps the pristine refs.
// This is the ONLY file allowed to reference these globals directly.

const g = globalThis;

const _Array = g.Array;
const _Object = g.Object;
const _RegExp = g.RegExp;
const _JSON = g.JSON;
const _Promise = g.Promise;
const _Map = g.Map;
const _Set = g.Set;
const _Date = g.Date;
const _Math = g.Math;
const _String = g.String;
const _Number = g.Number;
const _WeakRef = typeof g.WeakRef !== 'undefined' ? g.WeakRef : null;
const _Error = g.Error;

const _setTimeout = g.setTimeout?.bind(g) ?? null;
const _clearTimeout = g.clearTimeout?.bind(g) ?? null;
const _setInterval = g.setInterval?.bind(g) ?? null;
const _clearInterval = g.clearInterval?.bind(g) ?? null;
const _queueMicrotask = g.queueMicrotask?.bind(g) ?? null;
const _requestAnimationFrame = g.requestAnimationFrame?.bind(g) ?? null;
const _requestIdleCallback = g.requestIdleCallback?.bind(g) ?? null;

const _MutationObserver = g.MutationObserver ?? null;
const _BroadcastChannel = typeof g.BroadcastChannel !== 'undefined' ? g.BroadcastChannel : null;
const _Highlight = typeof g.Highlight !== 'undefined' ? g.Highlight : null;
const _cssHighlights = (typeof g.CSS !== 'undefined' && g.CSS.highlights) ? g.CSS.highlights : null;
const _crypto = g.crypto ?? null;
const _NodeFilter = g.NodeFilter ?? null;
const _Range = g.Range ?? null;

const arrayFrom = _Array.from.bind(_Array);
const arrayIsArray = _Array.isArray.bind(_Array);
const objectAssign = _Object.assign.bind(_Object);
const objectKeys = _Object.keys.bind(_Object);
const objectEntries = _Object.entries.bind(_Object);
const objectFreeze = _Object.freeze.bind(_Object);
const jsonParse = _JSON.parse.bind(_JSON);
const jsonStringify = _JSON.stringify.bind(_JSON);
const dateNow = _Date.now.bind(_Date);
const mathMin = _Math.min.bind(_Math);
const mathMax = _Math.max.bind(_Math);
const mathFloor = _Math.floor.bind(_Math);

export const safe = objectFreeze({
  Array: _Array,
  Object: _Object,
  RegExp: _RegExp,
  JSON: _JSON,
  Promise: _Promise,
  Map: _Map,
  Set: _Set,
  Date: _Date,
  Math: _Math,
  String: _String,
  Number: _Number,
  WeakRef: _WeakRef,
  Error: _Error,

  setTimeout: _setTimeout,
  clearTimeout: _clearTimeout,
  setInterval: _setInterval,
  clearInterval: _clearInterval,
  queueMicrotask: _queueMicrotask,
  requestAnimationFrame: _requestAnimationFrame,
  requestIdleCallback: _requestIdleCallback,

  MutationObserver: _MutationObserver,
  BroadcastChannel: _BroadcastChannel,
  Highlight: _Highlight,
  cssHighlights: _cssHighlights,
  crypto: _crypto,
  NodeFilter: _NodeFilter,
  Range: _Range,

  arrayFrom,
  arrayIsArray,
  objectAssign,
  objectKeys,
  objectEntries,
  objectFreeze,
  jsonParse,
  jsonStringify,
  dateNow,
  mathMin,
  mathMax,
  mathFloor,
});

// Convenience: short alias.
export default safe;
