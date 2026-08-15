import * as path from 'path';
import * as vscode from 'vscode';
import {
  disposeSaxonWorker,
  EngineOptions,
  EnginePreference,
  locateXsltproc,
  resetXsltprocCache,
  runTransform,
  runTransformOnFiles,
  TransformResult,
  warmUpSaxon
} from './engine';
import { getPlaygroundHtml } from './playgroundHtml';
import {
  SAMPLE_XML,
  SAMPLE_XSLT_10,
  SAMPLE_XSLT_10_EXSLT,
  SAMPLE_XSLT_20,
  SAMPLE_XSLT_20_CSV
} from './samples';

let playgroundPanel: vscode.WebviewPanel | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('XSLT Tester');

  context.subscriptions.push(
    vscode.commands.registerCommand('xsltTester.openPlayground', () =>
      openPlayground(context)
    ),
    vscode.commands.registerCommand('xsltTester.runTransformation', (uri?: vscode.Uri) =>
      runTransformationCommand(context, uri)
    ),
    vscode.commands.registerCommand('xsltTester.runActiveFile', () =>
      runActiveFileCommand(context)
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('xsltTester.xsltprocPath')) {
        resetXsltprocCache();
        notifyEngineStatus();
      }
    }),
    outputChannel
  );

  // Pre-spawn the persistent Saxon worker in the background so the first
  // transformation the user runs is warm (~100 ms instead of ~1 s). Deferred
  // off the activation path to keep command response latency minimal.
  setTimeout(() => {
    try {
      warmUpSaxon(context.extensionPath, context.globalStorageUri?.fsPath);
    } catch { /* worker is an optimization; spawn-per-run still works */ }
  }, 0);
}

export function deactivate() {
  disposeSaxonWorker();
}

/* ------------------------------------------------------------------ */
/* Configuration helpers                                               */
/* ------------------------------------------------------------------ */

function getEngineOptions(overridePreference?: EnginePreference): EngineOptions {
  const cfg = vscode.workspace.getConfiguration('xsltTester');
  return {
    preference: overridePreference ?? cfg.get<EnginePreference>('engine', 'auto'),
    xsltprocPath: cfg.get<string>('xsltprocPath', ''),
    extraSaxonArgs: cfg.get<string[]>('extraSaxonArgs', []),
    extraXsltprocArgs: cfg.get<string[]>('extraXsltprocArgs', [])
  };
}

function xsltprocStatus(): { available: boolean; path: string | null } {
  const cfg = vscode.workspace.getConfiguration('xsltTester');
  const p = locateXsltproc(cfg.get<string>('xsltprocPath', ''));
  return { available: p !== null, path: p };
}

function notifyEngineStatus() {
  if (!playgroundPanel) { return; }
  const status = xsltprocStatus();
  playgroundPanel.webview.postMessage({
    type: 'engineStatus',
    libxsltAvailable: status.available,
    xsltprocPath: status.path
  });
}

/* ------------------------------------------------------------------ */
/* Playground webview                                                  */
/* ------------------------------------------------------------------ */

function openPlayground(context: vscode.ExtensionContext) {
  if (playgroundPanel) {
    playgroundPanel.reveal();
    return;
  }

  playgroundPanel = vscode.window.createWebviewPanel(
    'xsltTester.playground',
    'XSLT Playground',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  playgroundPanel.webview.html = getPlaygroundHtml(nonce);

  playgroundPanel.onDidDispose(() => (playgroundPanel = undefined), null, context.subscriptions);

  playgroundPanel.webview.onDidReceiveMessage(
    async (msg: {
      type: string;
      xml?: string;
      xslt?: string;
      sample?: string;
      engine?: EnginePreference;
    }) => {
      if (!playgroundPanel) { return; }

      if (msg.type === 'ready') {
        notifyEngineStatus();
      } else if (msg.type === 'run') {
        const result = await safeTransform(
          context,
          msg.xml ?? '',
          msg.xslt ?? '',
          msg.engine ?? 'auto'
        );
        logResult('Playground', result);
        playgroundPanel.webview.postMessage({ type: 'result', ...result });
      } else if (msg.type === 'loadSample') {
        const xslt =
          msg.sample === 'v1' ? SAMPLE_XSLT_10 :
          msg.sample === 'v1exslt' ? SAMPLE_XSLT_10_EXSLT :
          msg.sample === 'v2csv' ? SAMPLE_XSLT_20_CSV :
          SAMPLE_XSLT_20;
        playgroundPanel.webview.postMessage({ type: 'sample', xml: SAMPLE_XML, xslt });
      }
    },
    null,
    context.subscriptions
  );
}

async function safeTransform(
  context: vscode.ExtensionContext,
  xmlText: string,
  xsltText: string,
  enginePreference: EnginePreference
): Promise<TransformResult> {
  if (!xsltText.trim()) {
    return {
      ok: false,
      output: '',
      diagnostics: 'Provide an XSLT stylesheet first (or pick one from "Load sample…").',
      detectedVersion: null,
      engineUsed: null,
      elapsedMs: 0
    };
  }
  try {
    return await runTransform(
      context.extensionPath,
      { xmlText, xsltText },
      getEngineOptions(enginePreference)
    );
  } catch (err) {
    return {
      ok: false,
      output: '',
      diagnostics: err instanceof Error ? err.message : String(err),
      detectedVersion: null,
      engineUsed: null,
      elapsedMs: 0
    };
  }
}

/* ------------------------------------------------------------------ */
/* File-based commands                                                 */
/* ------------------------------------------------------------------ */

async function runTransformationCommand(
  context: vscode.ExtensionContext,
  uri?: vscode.Uri
) {
  let xmlUri: vscode.Uri | undefined;
  let xsltUri: vscode.Uri | undefined;
  if (uri) {
    if (isXsltPath(uri.fsPath)) { xsltUri = uri; }
    else if (uri.fsPath.toLowerCase().endsWith('.xml')) { xmlUri = uri; }
  }

  xmlUri = xmlUri ?? (await pickFile('Select the XML input document', {
    'XML files': ['xml'], 'All files': ['*']
  }));
  if (!xmlUri) { return; }

  xsltUri = xsltUri ?? (await pickFile('Select the XSLT stylesheet', {
    'XSLT files': ['xsl', 'xslt'], 'All files': ['*']
  }));
  if (!xsltUri) { return; }

  await executeFileTransform(context, xmlUri, xsltUri);
}

async function runActiveFileCommand(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Open an XML or XSLT file first.');
    return;
  }

  await editor.document.save();
  const activePath = editor.document.uri;

  if (isXsltPath(activePath.fsPath)) {
    const xmlUri = await pickFile('Select the XML input document', {
      'XML files': ['xml'], 'All files': ['*']
    });
    if (!xmlUri) { return; }
    await executeFileTransform(context, xmlUri, activePath);
  } else if (activePath.fsPath.toLowerCase().endsWith('.xml')) {
    const xsltUri = await pickFile('Select the XSLT stylesheet', {
      'XSLT files': ['xsl', 'xslt'], 'All files': ['*']
    });
    if (!xsltUri) { return; }
    await executeFileTransform(context, activePath, xsltUri);
  } else {
    vscode.window.showWarningMessage(
      'The active file is neither XML nor XSLT. Open a .xml, .xsl or .xslt file.'
    );
  }
}

async function executeFileTransform(
  context: vscode.ExtensionContext,
  xmlUri: vscode.Uri,
  xsltUri: vscode.Uri
) {
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `XSLT: transforming ${path.basename(xmlUri.fsPath)} with ${path.basename(xsltUri.fsPath)}…`
    },
    () =>
      runTransformOnFiles(
        context.extensionPath,
        xmlUri.fsPath,
        xsltUri.fsPath,
        getEngineOptions()
      )
  );

  logResult(`${path.basename(xmlUri.fsPath)} + ${path.basename(xsltUri.fsPath)}`, result);

  if (!result.ok) {
    outputChannel.show(true);
    vscode.window.showErrorMessage(
      'XSLT transformation failed — see the "XSLT Tester" output for details.'
    );
    return;
  }

  const engineLabel = result.engineUsed === 'libxslt' ? 'libxslt' : 'Saxon-JS';
  const target = vscode.workspace
    .getConfiguration('xsltTester')
    .get<string>('outputTarget', 'editor');

  if (target === 'file') {
    const outPath = deriveOutputPath(xmlUri.fsPath, result.output);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(outPath),
      Buffer.from(result.output, 'utf8')
    );
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    vscode.window.showInformationMessage(
      `XSLT ${result.detectedVersion ?? '?'} transform OK via ${engineLabel} in ${result.elapsedMs} ms → ${path.basename(outPath)}`
    );
  } else {
    const language = result.output.trimStart().startsWith('<') ? 'xml' : 'plaintext';
    const doc = await vscode.workspace.openTextDocument({
      content: result.output,
      language
    });
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    vscode.window.setStatusBarMessage(
      `XSLT ${result.detectedVersion ?? ''} transform via ${engineLabel} completed in ${result.elapsedMs} ms`,
      5000
    );
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isXsltPath(p: string): boolean {
  const lower = p.toLowerCase();
  return lower.endsWith('.xsl') || lower.endsWith('.xslt');
}

async function pickFile(
  title: string,
  filters: Record<string, string[]>
): Promise<vscode.Uri | undefined> {
  const picked = await vscode.window.showOpenDialog({
    title,
    canSelectMany: false,
    openLabel: 'Use this file',
    filters
  });
  return picked?.[0];
}

function deriveOutputPath(xmlPath: string, output: string): string {
  const dir = path.dirname(xmlPath);
  const base = path.basename(xmlPath, path.extname(xmlPath));
  const ext = output.trimStart().startsWith('<') ? '.out.xml' : '.out.txt';
  return path.join(dir, base + ext);
}

function logResult(label: string, result: TransformResult) {
  const stamp = new Date().toLocaleTimeString();
  const engine = result.engineUsed ?? 'n/a';
  outputChannel.appendLine(
    `[${stamp}] ${label} — ${result.ok ? 'OK' : 'FAILED'} (XSLT ${result.detectedVersion ?? 'unknown'}, engine: ${engine}, ${result.elapsedMs} ms)`
  );
  if (result.diagnostics) {
    outputChannel.appendLine(result.diagnostics);
  }
}
