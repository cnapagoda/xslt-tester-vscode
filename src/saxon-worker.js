/*
 * Persistent Saxon-JS worker process.
 *
 * Loading Saxon-JS (~2.4 MB of JavaScript) dominates the cost of every
 * transformation when a fresh Node process is spawned per run (~500-1500 ms).
 * This worker loads Saxon-JS ONCE and then executes the xslt3 CLI driver
 * in-process for each request by re-requiring its (small) script with a
 * patched argv and captured stdio — warm transformations complete in ~100 ms.
 *
 * Protocol (over child-process IPC):
 *   parent -> worker: { id, args: string[], cwd?: string }
 *   worker -> parent: { id, code, stdout, stderr }
 *   worker -> parent on boot: { type: 'ready' }
 *
 * Requests are processed strictly sequentially because argv/stdio are
 * process-global while a transformation is in flight.
 */
'use strict';

const path = require('path');

const NODE_MODULES = path.join(__dirname, '..', 'node_modules');
const XSLT3 = path.join(NODE_MODULES, 'xslt3', 'xslt3.js');

// Pre-load Saxon-JS so every subsequent require() of it is a cache hit.
try {
  require(path.join(NODE_MODULES, 'saxon-js'));
} catch (e) {
  // If this fails, per-request requires will surface the real error.
}

const REQUEST_TIMEOUT_MS = 60000;
const queue = [];
let busy = false;

process.on('message', (msg) => {
  if (msg && typeof msg.id === 'number' && Array.isArray(msg.args)) {
    queue.push(msg);
    pump();
  }
});

function pump() {
  if (busy) { return; }
  const msg = queue.shift();
  if (!msg) { return; }
  busy = true;
  handle(msg).then((res) => {
    try { process.send(res); } catch (e) { /* parent gone */ }
    busy = false;
    if (res.poisoned) {
      // A hung transformation leaves unknown async work behind; exit so the
      // parent can respawn a clean worker.
      process.exit(3);
    }
    pump();
  });
}

function handle(msg) {
  return new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const origArgv = process.argv;
    const origCwd = process.cwd();
    const origOut = process.stdout.write;
    const origErr = process.stderr.write;
    const origExitCode = process.exitCode;
    let settled = false;

    // The '-t' flag makes xslt3 print "Transformation complete" to stderr as
    // its final act on success — our completion marker.
    process.argv = [origArgv[0], XSLT3, ...msg.args, '-t'];
    process.exitCode = undefined;
    process.stdout.write = (chunk, enc, cb) => {
      stdoutChunks.push(String(chunk));
      if (typeof enc === 'function') { enc(); } else if (cb) { cb(); }
      return true;
    };
    process.stderr.write = (chunk, enc, cb) => {
      stderrChunks.push(String(chunk));
      if (typeof enc === 'function') { enc(); } else if (cb) { cb(); }
      return true;
    };
    if (msg.cwd) {
      try { process.chdir(msg.cwd); } catch (e) { /* keep current cwd */ }
    }

    const finish = (poisoned) => {
      if (settled) { return; }
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      process.stdout.write = origOut;
      process.stderr.write = origErr;
      process.argv = origArgv;
      try { process.chdir(origCwd); } catch (e) { /* ignore */ }
      const code = process.exitCode;
      process.exitCode = origExitCode;
      resolve({
        id: msg.id,
        code: poisoned ? 124 : (code === undefined ? 0 : code),
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
        poisoned: !!poisoned
      });
    };

    const poll = setInterval(() => {
      if (process.exitCode !== undefined) {
        // Error path: xslt3 sets a non-zero exit code.
        setTimeout(() => finish(false), 20);
        clearInterval(poll);
      } else if (stderrChunks.some((c) => c.indexOf('Transformation complete') !== -1)) {
        // Success path: final '-t' marker seen.
        setTimeout(() => finish(false), 20);
        clearInterval(poll);
      }
    }, 5);

    const timeout = setTimeout(() => finish(true), REQUEST_TIMEOUT_MS);

    // Re-run the small (~31 KB) CLI driver; its require of saxon-js is cached.
    delete require.cache[XSLT3];
    try {
      require(XSLT3);
    } catch (e) {
      stderrChunks.push(String((e && e.message) || e));
      process.exitCode = 2;
    }
  });
}

if (typeof process.send === 'function') {
  process.send({ type: 'ready' });
}
