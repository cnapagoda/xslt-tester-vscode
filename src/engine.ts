import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type XsltEngine = 'saxon' | 'libxslt';
export type EnginePreference = 'auto' | XsltEngine;

export interface TransformResult {
  ok: boolean;
  output: string;
  /** stderr / diagnostics from the processor (compile errors, runtime errors, xsl:message) */
  diagnostics: string;
  /** XSLT version declared on the stylesheet root element, if detectable */
  detectedVersion: string | null;
  /** which engine actually ran the transformation */
  engineUsed: XsltEngine | null;
  /** wall-clock milliseconds */
  elapsedMs: number;
}

export interface TransformRequest {
  /** XML source document text */
  xmlText: string;
  /** XSLT stylesheet text */
  xsltText: string;
  /** Base directory used as cwd (relative URI resolution for in-memory runs) */
  baseDir?: string;
  /** Extra raw args for the chosen processor CLI */
  extraArgs?: string[];
}

export interface EngineOptions {
  /** engine preference: auto (pick by stylesheet version), saxon, or libxslt */
  preference: EnginePreference;
  /** explicit path to xsltproc; empty = search PATH */
  xsltprocPath?: string;
  extraSaxonArgs?: string[];
  extraXsltprocArgs?: string[];
}

/* ------------------------------------------------------------------ */
/* Detection helpers                                                   */
/* ------------------------------------------------------------------ */

/** Extract version="..." from the xsl:stylesheet / xsl:transform root element. */
export function detectXsltVersion(xsltText: string): string | null {
  const rootMatch = xsltText.match(
    /<\s*(?:[\w-]+:)?(?:stylesheet|transform)\b[^>]*>/s
  );
  if (!rootMatch) { return null; }
  const versionMatch = rootMatch[0].match(/\bversion\s*=\s*["']([^"']+)["']/);
  return versionMatch ? versionMatch[1].trim() : null;
}

/** Locate the bundled xslt3.js script (Saxon-JS command-line driver). */
export function locateXslt3(extensionRoot: string): string {
  const candidates = [
    path.join(extensionRoot, 'node_modules', 'xslt3', 'xslt3.js'),
    path.join(extensionRoot, '..', 'node_modules', 'xslt3', 'xslt3.js')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) { return c; }
  }
  throw new Error(
    'Cannot find the bundled Saxon-JS processor (xslt3.js). Reinstall the extension.'
  );
}

let cachedXsltproc: string | null | undefined;

/**
 * Locate the xsltproc executable (libxslt's CLI). Checks the configured path
 * first, then the system PATH. Result is cached for the session unless a
 * configured path is supplied.
 */
export function locateXsltproc(configuredPath?: string): string | null {
  if (configuredPath && configuredPath.trim()) {
    const p = configuredPath.trim();
    return fs.existsSync(p) ? p : null;
  }
  if (cachedXsltproc !== undefined) { return cachedXsltproc; }

  const exe = process.platform === 'win32' ? 'xsltproc.exe' : 'xsltproc';
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  // A few common locations that may not be on the extension host's PATH
  const extraDirs =
    process.platform === 'win32'
      ? ['C:\\Program Files\\libxslt\\bin', 'C:\\tools\\libxslt\\bin']
      : ['/usr/bin', '/usr/local/bin', '/opt/homebrew/bin', '/opt/local/bin'];

  for (const dir of [...pathDirs, ...extraDirs]) {
    if (!dir) { continue; }
    const candidate = path.join(dir, exe);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      cachedXsltproc = candidate;
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  cachedXsltproc = null;
  return null;
}

/** Reset the cached xsltproc location (e.g. after a settings change). */
export function resetXsltprocCache(): void {
  cachedXsltproc = undefined;
}

/**
 * Decide which engine to run.
 *  - explicit 'saxon' / 'libxslt' preferences are honored;
 *  - 'auto': XSLT 1.0 stylesheets use libxslt when xsltproc is available
 *    (authentic libxslt/EXSLT semantics), everything else uses Saxon-JS.
 */
export function resolveEngine(
  preference: EnginePreference,
  detectedVersion: string | null,
  xsltprocAvailable: boolean
): XsltEngine {
  if (preference === 'saxon') { return 'saxon'; }
  if (preference === 'libxslt') { return 'libxslt'; }
  if (detectedVersion === '1.0' && xsltprocAvailable) { return 'libxslt'; }
  return 'saxon';
}

/* ------------------------------------------------------------------ */
/* Persistent Saxon worker                                             */
/* ------------------------------------------------------------------ */

interface WorkerResponse {
  id: number;
  code: number;
  stdout: string;
  stderr: string;
  poisoned?: boolean;
}

/**
 * Manages a long-lived child process that keeps Saxon-JS loaded in memory.
 * Cold spawn-per-run costs ~500-1500 ms (mostly parsing Saxon's 2.4 MB
 * runtime); warm worker requests complete in ~100 ms.
 */
class SaxonWorker {
  private child: cp.ChildProcess | undefined;
  private pending = new Map<number, {
    resolve: (r: WorkerResponse) => void;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private nextId = 1;

  constructor(
    private readonly workerScript: string,
    private readonly compileCacheDir?: string
  ) {}

  /** Spawn the worker eagerly so the first user-visible run is warm. */
  warmUp(): void {
    try { this.ensureChild(); } catch { /* fall back to spawn-per-run */ }
  }

  isAvailable(): boolean {
    return fs.existsSync(this.workerScript);
  }

  dispose(): void {
    this.child?.kill();
    this.child = undefined;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Saxon worker disposed'));
    }
    this.pending.clear();
  }

  private ensureChild(): cp.ChildProcess {
    if (this.child && this.child.exitCode === null && !this.child.killed) {
      return this.child;
    }
    const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
    if (this.compileCacheDir) {
      try {
        fs.mkdirSync(this.compileCacheDir, { recursive: true });
        env.NODE_COMPILE_CACHE = this.compileCacheDir;
      } catch { /* cache is optional */ }
    }
    const child = cp.spawn(process.execPath, [this.workerScript], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    child.on('message', (raw) => {
      const res = raw as WorkerResponse;
      if (typeof res.id !== 'number') { return; }
      const p = this.pending.get(res.id);
      if (p) {
        this.pending.delete(res.id);
        clearTimeout(p.timer);
        p.resolve(res);
      }
    });
    const onGone = () => {
      if (this.child === child) { this.child = undefined; }
      for (const [id, p] of this.pending) {
        this.pending.delete(id);
        clearTimeout(p.timer);
        p.reject(new Error('Saxon worker exited unexpectedly'));
      }
    };
    child.on('exit', onGone);
    child.on('error', onGone);
    this.child = child;
    return child;
  }

  run(args: string[], cwd: string): Promise<WorkerResponse> {
    const child = this.ensureChild();
    const id = this.nextId++;
    return new Promise<WorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.child?.kill();
        this.child = undefined;
        reject(new Error('Saxon worker request timed out'));
      }, 65_000);
      this.pending.set(id, { resolve, reject, timer });
      child.send({ id, args, cwd }, (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }
}

let saxonWorker: SaxonWorker | undefined;

function getSaxonWorker(extensionRoot: string, compileCacheDir?: string): SaxonWorker | null {
  if (!saxonWorker) {
    const script = path.join(extensionRoot, 'out', 'saxon-worker.js');
    saxonWorker = new SaxonWorker(script, compileCacheDir);
  }
  return saxonWorker.isAvailable() ? saxonWorker : null;
}

/** Pre-spawn the Saxon worker (call from extension activation). */
export function warmUpSaxon(extensionRoot: string, compileCacheDir?: string): void {
  getSaxonWorker(extensionRoot, compileCacheDir)?.warmUp();
}

/** Kill the Saxon worker (call from extension deactivation). */
export function disposeSaxonWorker(): void {
  saxonWorker?.dispose();
  saxonWorker = undefined;
}

/** Lines emitted because the worker appends '-t'; hidden from user diagnostics. */
const WORKER_NOISE = [
  /^SaxonJS .* from Saxonica/,
  /^Node\.js version /,
  /^SEF generated by/,
  /^Compiling stylesheet/,
  /^Stylesheet compilation time:/,
  /^Asynchronous transform with options:/,
  /^Execution time:/,
  /^Memory used:/,
  /^Initial mode:/,
  /^Initial template:/,
  /^Writing to /,
  /^Transformation complete$/
];

function stripWorkerNoise(stderr: string, userAskedForTiming: boolean): string {
  if (userAskedForTiming) { return stderr.trim(); }
  return stderr
    .split('\n')
    .filter((line) => !WORKER_NOISE.some((re) => re.test(line.trim())))
    .join('\n')
    .trim();
}

async function runSaxonViaWorker(
  extensionRoot: string,
  xmlPath: string,
  xslPath: string,
  cwd: string,
  extraArgs: string[],
  detectedVersion: string | null
): Promise<TransformResult | null> {
  const worker = getSaxonWorker(extensionRoot);
  if (!worker) { return null; }
  const started = Date.now();
  try {
    const res = await worker.run([`-s:${xmlPath}`, `-xsl:${xslPath}`, ...extraArgs], cwd);
    return {
      ok: res.code === 0,
      output: res.stdout,
      diagnostics: stripWorkerNoise(res.stderr, extraArgs.includes('-t')),
      detectedVersion,
      engineUsed: 'saxon',
      elapsedMs: Date.now() - started
    };
  } catch {
    return null; // fall back to spawn-per-run
  }
}

/* ------------------------------------------------------------------ */
/* Shared process runner                                               */
/* ------------------------------------------------------------------ */

interface SpawnSpec {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

function runProcess(
  spec: SpawnSpec,
  meta: { detectedVersion: string | null; engineUsed: XsltEngine },
  cleanup?: () => void
): Promise<TransformResult> {
  const started = Date.now();
  return new Promise<TransformResult>((resolve) => {
    const child = cp.spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env ?? process.env,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));

    const timer = setTimeout(() => {
      child.kill();
      stderr += '\n[XSLT Tester] Transformation timed out after 60 seconds.';
    }, 60_000);

    const finish = (ok: boolean, extraDiag?: string) => {
      clearTimeout(timer);
      try { cleanup?.(); } catch { /* best effort */ }
      resolve({
        ok,
        output: stdout,
        diagnostics: [stderr.trim(), extraDiag].filter(Boolean).join('\n'),
        detectedVersion: meta.detectedVersion,
        engineUsed: meta.engineUsed,
        elapsedMs: Date.now() - started
      });
    };

    child.on('error', (err) => finish(false, `Failed to start processor: ${err.message}`));
    child.on('close', (code) => finish(code === 0));
  });
}

/* ------------------------------------------------------------------ */
/* Saxon-JS engine (XSLT 2.0 / 3.0, plus 1.0 compatibility mode)       */
/* ------------------------------------------------------------------ */

function saxonSpawnSpec(
  extensionRoot: string,
  xmlPath: string,
  xslPath: string,
  cwd: string,
  extraArgs: string[]
): SpawnSpec {
  const xslt3 = locateXslt3(extensionRoot);
  return {
    command: process.execPath,
    args: [xslt3, `-s:${xmlPath}`, `-xsl:${xslPath}`, ...extraArgs],
    cwd,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  };
}

/* ------------------------------------------------------------------ */
/* libxslt engine (xsltproc — authentic XSLT 1.0 + EXSLT)              */
/* ------------------------------------------------------------------ */

function libxsltSpawnSpec(
  xsltprocPath: string,
  xmlPath: string,
  xslPath: string,
  cwd: string,
  extraArgs: string[]
): SpawnSpec {
  return {
    command: xsltprocPath,
    args: [...extraArgs, xslPath, xmlPath],
    cwd
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Run a transformation on in-memory XML/XSLT text. */
export async function runTransform(
  extensionRoot: string,
  req: TransformRequest,
  options: EngineOptions = { preference: 'auto' }
): Promise<TransformResult> {
  const detectedVersion = detectXsltVersion(req.xsltText);
  const xsltproc = locateXsltproc(options.xsltprocPath);
  const engine = resolveEngine(options.preference, detectedVersion, xsltproc !== null);

  if (engine === 'libxslt' && !xsltproc) {
    return {
      ok: false,
      output: '',
      diagnostics:
        'libxslt engine selected, but the xsltproc executable was not found.\n' +
        'Install libxslt (macOS: preinstalled / `brew install libxslt`; ' +
        'Linux: `apt install xsltproc`; Windows: install libxslt binaries or use Chocolatey) ' +
        'or set "xsltTester.xsltprocPath" in settings.',
      detectedVersion,
      engineUsed: null,
      elapsedMs: 0
    };
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'xslt-tester-'));
  const xmlPath = path.join(scratch, 'input.xml');
  const xslPath = path.join(scratch, 'stylesheet.xsl');
  fs.writeFileSync(xmlPath, req.xmlText, 'utf8');
  fs.writeFileSync(xslPath, req.xsltText, 'utf8');
  const cwd = req.baseDir && fs.existsSync(req.baseDir) ? req.baseDir : scratch;
  const cleanup = () => fs.rmSync(scratch, { recursive: true, force: true });

  if (engine === 'saxon') {
    const viaWorker = await runSaxonViaWorker(
      extensionRoot, xmlPath, xslPath, cwd, options.extraSaxonArgs ?? [], detectedVersion
    );
    if (viaWorker) {
      try { cleanup(); } catch { /* best effort */ }
      return viaWorker;
    }
  }

  const spec =
    engine === 'libxslt'
      ? libxsltSpawnSpec(xsltproc as string, xmlPath, xslPath, cwd, options.extraXsltprocArgs ?? [])
      : saxonSpawnSpec(extensionRoot, xmlPath, xslPath, cwd, options.extraSaxonArgs ?? []);

  return runProcess(spec, { detectedVersion, engineUsed: engine }, cleanup);
}

/**
 * Run a transformation directly against files on disk (preserves relative
 * URI resolution for xsl:include / xsl:import / document()).
 */
export async function runTransformOnFiles(
  extensionRoot: string,
  xmlFile: string,
  xsltFile: string,
  options: EngineOptions = { preference: 'auto' }
): Promise<TransformResult> {
  let detectedVersion: string | null = null;
  try {
    detectedVersion = detectXsltVersion(fs.readFileSync(xsltFile, 'utf8'));
  } catch {
    /* ignore */
  }

  const xsltproc = locateXsltproc(options.xsltprocPath);
  const engine = resolveEngine(options.preference, detectedVersion, xsltproc !== null);

  if (engine === 'libxslt' && !xsltproc) {
    return {
      ok: false,
      output: '',
      diagnostics:
        'libxslt engine selected, but the xsltproc executable was not found. ' +
        'Install libxslt or set "xsltTester.xsltprocPath" in settings.',
      detectedVersion,
      engineUsed: null,
      elapsedMs: 0
    };
  }

  const cwd = path.dirname(xsltFile);

  if (engine === 'saxon') {
    const viaWorker = await runSaxonViaWorker(
      extensionRoot, xmlFile, xsltFile, cwd, options.extraSaxonArgs ?? [], detectedVersion
    );
    if (viaWorker) { return viaWorker; }
  }

  const spec =
    engine === 'libxslt'
      ? libxsltSpawnSpec(xsltproc as string, xmlFile, xsltFile, cwd, options.extraXsltprocArgs ?? [])
      : saxonSpawnSpec(extensionRoot, xmlFile, xsltFile, cwd, options.extraSaxonArgs ?? []);

  return runProcess(spec, { detectedVersion, engineUsed: engine });
}
