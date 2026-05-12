// All panel styles. Scoped to the shadow root, so host page CSS cannot reach
// them and we cannot leak to the host page.
export const PANEL_STYLES = `
:host, :root { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }

.ss-panel {
  all: initial;
  position: fixed;
  top: 20px;
  right: 10px;
  width: 390px;
  min-width: 330px;
  max-width: 85vw;
  min-height: 180px;
  max-height: 75vh;
  background: #eef1f5;
  border: 1px solid #b0c4de;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px;
  line-height: 1.3;
  color: #333;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: hidden;
  direction: ltr;
  text-align: left;
}

.ss-panel[hidden] { display: none; }

.ss-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 6px;
  flex-wrap: wrap;
}

.ss-mode-picker { display: flex; gap: 2px; }

.ss-mode-picker button {
  background: #fff;
  border: 1px solid #b0c4de;
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
}
.ss-mode-picker button[aria-pressed="true"] {
  background: #0078d4;
  color: #fff;
  border-color: #005a9c;
}

.ss-controls {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 11px;
}

.ss-controls label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
}

.ss-controls input[type="checkbox"] {
  margin: 0;
}

.ss-controls button {
  background: #0078d4;
  color: #fff;
  border: 1px solid #005a9c;
  border-radius: 3px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
}
.ss-controls button:hover { background: #005a9c; }
.ss-controls button[disabled] { opacity: 0.5; cursor: default; }

.ss-input-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  align-items: flex-start;
}

.ss-query {
  flex-grow: 1;
  padding: 6px 8px;
  border: 1px solid #b0c4de;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  background: #fff;
  color: #222;
  resize: vertical;
  min-height: 30px;
  max-height: 200px;
}
.ss-query.ss-mode-js {
  min-height: 60px;
  height: 80px;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 12px;
}
.ss-query.ss-error {
  border-color: #d83b01;
  box-shadow: 0 0 3px #d83b01;
}

.ss-input-actions { display: flex; flex-direction: column; gap: 2px; }
.ss-input-actions button {
  background: #0078d4;
  color: #fff;
  border: 1px solid #005a9c;
  border-radius: 3px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.ss-input-actions button:hover { background: #005a9c; }
.ss-input-actions button[hidden] { display: none; }

.ss-summary {
  font-size: 11px;
  color: #555;
  margin-bottom: 4px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.ss-summary .ss-settling-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffa500;
  animation: ss-pulse 1.2s infinite;
}
@keyframes ss-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.ss-list-region {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ss-list-header {
  font-size: 11px;
  font-weight: bold;
  padding: 2px 0;
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: space-between;
}

.ss-list {
  flex-grow: 1;
  overflow-y: auto;
  list-style: none;
  background: #fff;
  border: 1px solid #d1dbe6;
  border-radius: 3px;
  padding: 2px;
  font-size: 11px;
  min-height: 60px;
}

.ss-list li {
  padding: 3px 4px;
  border-bottom: 1px solid #eef1f5;
  cursor: pointer;
  display: flex;
  gap: 4px;
}
.ss-list li:hover { background: #f0f6fc; }
.ss-list li.ss-active { background: #fff4ce; }

.ss-list .ss-row-num { color: #888; flex-shrink: 0; min-width: 24px; }
.ss-list .ss-row-text { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-list .ss-row-match { background: #ffe066; padding: 0 2px; border-radius: 2px; }
.ss-list .ss-row-url {
  background: #d1e4f5;
  color: #003366;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 8px;
  flex-shrink: 0;
}

.ss-log-region {
  margin-top: 6px;
  border-top: 1px solid #c5d9ed;
  padding-top: 4px;
  max-height: 100px;
  overflow-y: auto;
  font-size: 10px;
  font-family: 'Menlo', 'Monaco', monospace;
  color: #555;
  display: none;
}
.ss-log-region.ss-visible { display: block; }

.ss-log li { padding: 1px 0; list-style: none; }
.ss-log li.ss-log-error { color: #d83b01; }

.ss-first-run-banner {
  background: #fff4ce;
  border: 1px solid #d4b400;
  border-radius: 3px;
  padding: 6px 8px;
  margin-bottom: 6px;
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  gap: 6px;
}
.ss-first-run-banner button {
  background: #d4b400;
  color: #fff;
  border: 0;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

@media (forced-colors: active) {
  .ss-panel { border: 1px solid CanvasText; background: Canvas; color: CanvasText; }
  .ss-list .ss-row-match { background: Highlight; color: HighlightText; }
}
`;
