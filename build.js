/* Cross-platform build script: bundle the extension and copy the worker. */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const required = [
  'src/extension.ts',
  'src/engine.ts',
  'src/playgroundHtml.ts',
  'src/samples.ts',
  'src/saxon-worker.js'
];

const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length > 0) {
  console.error(
    '\n[build] ERROR: required source files are missing:\n  - ' +
    missing.join('\n  - ') +
    '\n\nYour working copy looks incomplete or mixed with an older version.' +
    '\nPlease re-extract the latest source archive into a FRESH, empty folder' +
    '\nand run "npm install" followed by "npm run build" again.\n'
  );
  process.exit(1);
}

fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });

execSync(
  'npx esbuild src/extension.ts --bundle --external:vscode --platform=node ' +
  '--target=node16 --outfile=out/extension.js --minify',
  { cwd: root, stdio: 'inherit' }
);

fs.copyFileSync(
  path.join(root, 'src', 'saxon-worker.js'),
  path.join(root, 'out', 'saxon-worker.js')
);

console.log('[build] OK: out/extension.js + out/saxon-worker.js');
