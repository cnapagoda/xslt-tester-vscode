export function getPlaygroundHtml(nonce: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>XSLT Playground</title>
<style>
  :root {
    --gap: 8px;
  }
  * { box-sizing: border-box; }
  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--gap);
    padding: 8px 10px;
    border-bottom: 1px solid var(--vscode-panel-border, #444);
    flex-wrap: wrap;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 5px 14px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
  select {
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border, transparent);
    padding: 4px 6px;
    border-radius: 3px;
  }
  .status {
    margin-left: auto;
    font-size: 12px;
    opacity: 0.85;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1px;
    background: var(--vscode-panel-border, #444);
    height: calc(100% - 46px);
  }
  .pane {
    display: flex;
    flex-direction: column;
    background: var(--vscode-editor-background);
    min-width: 0;
  }
  .pane header {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.7;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  textarea, .outbox {
    flex: 1;
    width: 100%;
    resize: none;
    border: none;
    outline: none;
    padding: 8px 10px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    line-height: 1.45;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    white-space: pre;
    overflow: auto;
    tab-size: 2;
  }
  .outbox { margin: 0; }
  .outbox.error { color: var(--vscode-errorForeground, #f48771); }
  .diag {
    max-height: 30%;
    overflow: auto;
    border-top: 1px solid var(--vscode-panel-border, #444);
    padding: 6px 10px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    color: var(--vscode-errorForeground, #f48771);
    white-space: pre-wrap;
    display: none;
  }
  .diag.show { display: block; }
  @media (max-width: 900px) {
    .grid { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr 1fr; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button id="run" title="Ctrl+Enter / Cmd+Enter">&#9654;&nbsp;Run</button>
    <select id="engine" title="Transformation engine">
      <option value="auto">Engine: Auto</option>
      <option value="saxon">Engine: Saxon-JS (XSLT 2.0/3.0)</option>
      <option value="libxslt">Engine: libxslt (XSLT 1.0 + EXSLT)</option>
    </select>
    <select id="sample" title="Load a sample">
      <option value="">Load sample&hellip;</option>
      <option value="v1">XSLT 1.0 &mdash; sort &amp; attributes</option>
      <option value="v1exslt">XSLT 1.0 &mdash; EXSLT (libxslt engine)</option>
      <option value="v2">XSLT 2.0 &mdash; grouping, avg(), string-join()</option>
      <option value="v2csv">XSLT 2.0 &mdash; XML &rarr; CSV (text output)</option>
    </select>
    <button id="clear" class="secondary">Clear</button>
    <span class="status">
      <span id="engineBadge" class="badge" style="display:none"></span>
      <span id="version" class="badge" style="display:none"></span>
      <span id="time"></span>
      <span id="state"></span>
    </span>
  </div>
  <div class="grid">
    <div class="pane">
      <header><span>XML input</span></header>
      <textarea id="xml" spellcheck="false" placeholder="&lt;root&gt;...&lt;/root&gt;"></textarea>
    </div>
    <div class="pane">
      <header><span>XSLT stylesheet (1.0 or 2.0)</span></header>
      <textarea id="xslt" spellcheck="false" placeholder="&lt;xsl:stylesheet version=&quot;2.0&quot; ...&gt;"></textarea>
    </div>
    <div class="pane">
      <header>
        <span>Output</span>
        <button id="copy" class="secondary" style="padding:2px 8px;font-size:11px">Copy</button>
      </header>
      <pre id="out" class="outbox"></pre>
      <div id="diag" class="diag"></div>
    </div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const xmlEl = $('xml'), xsltEl = $('xslt'), outEl = $('out'), diagEl = $('diag');

  // restore state
  const prev = vscode.getState();
  if (prev) {
    xmlEl.value = prev.xml || '';
    xsltEl.value = prev.xslt || '';
    outEl.textContent = prev.out || '';
    if (prev.engine) { $('engine').value = prev.engine; }
  }
  function saveState() {
    vscode.setState({
      xml: xmlEl.value,
      xslt: xsltEl.value,
      out: outEl.textContent,
      engine: $('engine').value
    });
  }
  $('engine').addEventListener('change', saveState);
  vscode.postMessage({ type: 'ready' });
  xmlEl.addEventListener('input', saveState);
  xsltEl.addEventListener('input', saveState);

  function run() {
    $('state').textContent = 'Running…';
    $('run').disabled = true;
    vscode.postMessage({
      type: 'run',
      xml: xmlEl.value,
      xslt: xsltEl.value,
      engine: $('engine').value
    });
  }
  $('run').addEventListener('click', run);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });

  $('clear').addEventListener('click', () => {
    xmlEl.value = ''; xsltEl.value = ''; outEl.textContent = '';
    diagEl.textContent = ''; diagEl.classList.remove('show');
    $('version').style.display = 'none'; $('time').textContent = '';
    saveState();
  });

  $('copy').addEventListener('click', () => {
    navigator.clipboard.writeText(outEl.textContent || '');
  });

  $('sample').addEventListener('change', (e) => {
    const v = e.target.value;
    e.target.value = '';
    if (!v) return;
    vscode.postMessage({ type: 'loadSample', sample: v });
  });

  // allow Tab inside textareas
  for (const el of [xmlEl, xsltEl]) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = el.selectionStart, t = el.selectionEnd;
        el.value = el.value.substring(0, s) + '  ' + el.value.substring(t);
        el.selectionStart = el.selectionEnd = s + 2;
      }
    });
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'result') {
      $('run').disabled = false;
      $('state').textContent = '';
      outEl.textContent = msg.output || (msg.ok ? '(empty output)' : '');
      outEl.classList.toggle('error', !msg.ok);
      if (msg.diagnostics) {
        diagEl.textContent = msg.diagnostics;
        diagEl.classList.add('show');
      } else {
        diagEl.textContent = '';
        diagEl.classList.remove('show');
      }
      const vb = $('version');
      if (msg.detectedVersion) {
        vb.textContent = 'XSLT ' + msg.detectedVersion;
        vb.style.display = '';
      } else {
        vb.style.display = 'none';
      }
      const eb = $('engineBadge');
      if (msg.engineUsed) {
        eb.textContent = msg.engineUsed === 'libxslt' ? 'libxslt' : 'Saxon-JS';
        eb.style.display = '';
      } else {
        eb.style.display = 'none';
      }
      $('time').textContent = msg.elapsedMs != null ? msg.elapsedMs + ' ms' : '';
      saveState();
    } else if (msg.type === 'engineStatus') {
      const opt = document.querySelector('#engine option[value="libxslt"]');
      if (opt) {
        opt.disabled = !msg.libxsltAvailable;
        opt.textContent = msg.libxsltAvailable
          ? 'Engine: libxslt (XSLT 1.0 + EXSLT)'
          : 'Engine: libxslt (xsltproc not found)';
      }
      if (!msg.libxsltAvailable && $('engine').value === 'libxslt') {
        $('engine').value = 'auto';
        saveState();
      }
    } else if (msg.type === 'sample') {
      xmlEl.value = msg.xml;
      xsltEl.value = msg.xslt;
      saveState();
    }
  });
</script>
</body>
</html>`;
}
