// GM_* shim injected into the headless browser before our bundle.
// Provides minimal implementations backed by localStorage so tests can verify
// persistence and cross-tab semantics.
export const GM_SHIM = `
(function(){
  var listeners = {};
  function readEnv(k) {
    try { var v = localStorage.getItem('gm.'+k); return v == null ? null : v; }
    catch { return null; }
  }
  window.GM_getValue = function(k, def) {
    var v = readEnv(k);
    if (v == null) return def;
    try { return JSON.parse(v); } catch { return v; }
  };
  window.GM_setValue = function(k, v) {
    var ser = typeof v === 'string' ? v : JSON.stringify(v);
    try { localStorage.setItem('gm.'+k, ser); } catch {}
    if (listeners[k]) listeners[k].forEach(function(fn){
      try { fn(k, null, ser, false); } catch {}
    });
  };
  window.GM_deleteValue = function(k){ try{ localStorage.removeItem('gm.'+k); }catch{} };
  window.GM_addValueChangeListener = function(k, fn){
    if (!listeners[k]) listeners[k] = [];
    listeners[k].push(fn);
    return Symbol('l');
  };
  window.GM_removeValueChangeListener = function(){};
  window.GM_registerMenuCommand = function(){ return 0; };
  window.GM_log = function(msg){ /* console.log('[gm]', msg); */ };
  window.unsafeWindow = window;
  // 'storage' event listener simulates cross-tab.
  window.addEventListener('storage', function(e){
    if (!e.key || !e.key.startsWith('gm.')) return;
    var k = e.key.slice(3);
    if (listeners[k]) listeners[k].forEach(function(fn){
      try { fn(k, e.oldValue, e.newValue, true); } catch {}
    });
  });
})();
`;
