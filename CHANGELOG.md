# Change Log

## 1.3.0

- **Performance**: Saxon-JS now runs in a persistent background worker that is pre-warmed on activation — warm transformations complete in ~100 ms instead of ~0.5–1.5 s (the cost of spawning a fresh Node process and re-parsing Saxon's 2.4 MB runtime on every run). The worker auto-restarts on crashes/hangs and falls back to spawn-per-run if unavailable.
- Extension host code is now bundled and minified with esbuild (single 24 KB file) for faster activation from the Command Palette.
- Node's compile cache (`NODE_COMPILE_CACHE`) is enabled for the worker, speeding up cold starts after the first ever run.
- libxslt runs were already fast (~10 ms) and are unchanged.

## 1.2.1

- Added a Marketplace icon (256×256 PNG) and gallery banner theme.

## 1.2.0

- Relicensed the extension's own code under the Apache License, Version 2.0 (LICENSE + NOTICE files added).
- Added THIRD-PARTY-NOTICES.md reproducing the full Saxonica license, copyright notice, and disclaimer for the bundled Saxon-JS/xslt3 packages, as required by Saxonica's redistribution terms; README and marketplace description now carry the Saxon-JS legal notice.
- Clarified that libxslt/xsltproc is invoked from the user's system and is not bundled.

## 1.1.0

- **libxslt engine support**: transformations can now run on native libxslt via `xsltproc` — the reference XSLT 1.0 processor with full EXSLT support (auto-detected on PATH; configurable via `xsltTester.xsltprocPath`).
- New `xsltTester.engine` setting (`auto` / `saxon` / `libxslt`); Auto routes XSLT 1.0 stylesheets to libxslt when available and everything else to Saxon-JS.
- Playground: engine picker in the toolbar, engine badge on results, new XSLT 1.0 + EXSLT sample.
- New `xsltTester.extraXsltprocArgs` setting; engine name shown in status messages and the output channel.

## 1.0.0

- Initial release.
- Interactive XSLT Playground webview (XML / XSLT / Output panes) with samples, version auto-detection, timing, and error diagnostics.
- File-based transformation commands with editor/context-menu integration and `Ctrl+Alt+T` keybinding.
- Bundled Saxon-JS engine: XSLT 2.0 native, XSLT 1.0 backwards-compatible mode. No Java required.
