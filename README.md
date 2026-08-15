# XSLT Tester (1.0 / 2.0)

Test XSLT transformations right inside VS Code. Paste (or open) an XML document and an XSLT stylesheet, version 1.0 or 2.0 and see the transformation result instantly.

Two engines are supported:

- **Saxon-JS** (bundled, no installs needed) - a conformant XSLT 3.0 processor: runs XSLT 2.0 natively and XSLT 1.0 in backwards-compatible mode. No Java required.
- **libxslt** (via the `xsltproc` executable) - the reference XSLT 1.0 processor with full **EXSLT** extension support (`exsl:node-set()`, `str:tokenize()`, `math:*`, `date:*`, …). Auto-detected when installed; also noticeably faster for 1.0 stylesheets.

In the default **Auto** mode, XSLT 1.0 stylesheets run on libxslt when `xsltproc` is available (authentic 1.0 semantics), and everything else runs on Saxon-JS.

## Features

### 1. XSLT Playground (interactive)

Run **`XSLT Tester: Open Playground`** from the Command Palette (`Ctrl+Shift+P`).

A three-pane editor opens: XML input on the left, XSLT stylesheet in the middle, output on the right.

- Press **Run** (or `Ctrl+Enter` / `Cmd+Enter`) to transform.
- Choose the engine in the toolbar: **Auto**, **Saxon-JS**, or **libxslt**. The libxslt option is greyed out (with a hint) when `xsltproc` isn't installed.
- The engine actually used, the detected stylesheet version (`XSLT 1.0` / `XSLT 2.0`), and execution time are shown in the toolbar after each run.
- Compile and runtime errors appear beneath the output pane with line numbers.
- Built-in samples: an XSLT 1.0 sorting example, an XSLT 1.0 + EXSLT example (libxslt engine), an XSLT 2.0 grouping example (`for-each-group`, `avg()`, `string-join()`), and an XML→CSV text-output example.
- Your input is preserved when the panel is hidden or VS Code restarts the webview.

### 2. Transform files

- **`XSLT Tester: Run Transformation`** - pick an XML file and an XSLT file; the result opens in a new editor beside your code (or is written to a file, see settings).
- **`XSLT Tester: Run Transformation with Active File`** (`Ctrl+Alt+T` / `Cmd+Alt+T`) - with a `.xsl`/`.xslt` file open you're prompted for the XML input; with a `.xml` file open you're prompted for the stylesheet.
- Both commands are also available from the editor and Explorer right-click menus for XML/XSLT files.
- File-based runs resolve relative `xsl:include`, `xsl:import`, and `document()` URIs against the stylesheet's own folder.
- Diagnostics (including `xsl:message` output) are logged to the **XSLT Tester** output channel.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `xsltTester.engine` | `auto` | `auto` (1.0 → libxslt when available, else Saxon-JS), `saxon`, or `libxslt`. |
| `xsltTester.xsltprocPath` | `""` | Full path to `xsltproc`. Empty = auto-detect from PATH and common install locations. |
| `xsltTester.extraXsltprocArgs` | `[]` | Extra CLI arguments for `xsltproc`, e.g. `["--nonet"]`, `["--timing"]`. |
| `xsltTester.outputTarget` | `editor` | `editor` opens results in a new tab; `file` writes `<input>.out.xml` / `.out.txt` next to the XML input. |
| `xsltTester.extraSaxonArgs` | `[]` | Extra CLI arguments for the Saxon-JS `xslt3` processor, e.g. `["-t"]` for timing details. |

### Installing xsltproc (optional, for the libxslt engine)

- **macOS** - already preinstalled (`/usr/bin/xsltproc`); newer builds via `brew install libxslt`.
- **Debian/Ubuntu** - `sudo apt install xsltproc`
- **Fedora/RHEL** - `sudo dnf install libxslt`
- **Windows** - install libxslt binaries (e.g. `choco install xsltproc`, or the Igor Zlatković builds) and set `xsltTester.xsltprocPath` if it's not on PATH.

Without `xsltproc`, everything still works - all transformations run on the bundled Saxon-JS.

## Installation from the .vsix

1. In VS Code open the Extensions view (`Ctrl+Shift+X`).
2. Click the `…` menu → **Install from VSIX…** and choose `xslt-tester-1.3.0.vsix`.
3. Reload when prompted.

Or from a terminal: `code --install-extension xslt-tester-1.3.0.vsix`

## Performance

Saxon-JS is kept loaded in a persistent background worker that starts warming up the moment the extension activates, so transformations typically complete in ~100 ms (first-ever run may take ~1 s while the worker boots). The libxslt engine calls the native `xsltproc` binary and is faster still (~10 ms). If the worker ever crashes or hangs it is restarted automatically, and the extension transparently falls back to one-shot process spawning.

## Building from source

```bash
npm install
npm run build        # typecheck (tsc) + bundle (esbuild) + worker copy
npm run package      # produces the .vsix (requires @vscode/vsce)
```

Press `F5` in VS Code to launch an Extension Development Host for debugging.

## Notes on XSLT version support

- **Saxon-JS** is a conformant XSLT 3.0 processor: XSLT 2.0 is fully supported, and XSLT 1.0 stylesheets execute in spec-defined backwards-compatibility mode. EXSLT extensions (`exsl:*`, `str:*`, …) are **not** available on this engine.
- **libxslt** (`xsltproc`) is the reference XSLT 1.0 implementation with full EXSLT support - pick it (or leave Auto mode on) when you need byte-for-byte libxslt behavior, e.g. matching a production pipeline built on libxslt, PHP, or Python lxml. It cannot run XSLT 2.0 stylesheets.

## License and third-party notices

The extension's own code is licensed under the **Apache License, Version 2.0** - see the LICENSE and NOTICE files shipped with this extension.

**Saxon-JS legal notice.** This extension bundles the `saxon-js` and `xslt3` npm packages in unmodified binary form. These packages are **Copyright © Saxonica Ltd** ([saxonica.com](https://www.saxonica.com/)) and are **not** covered by the Apache-2.0 license of this extension; they remain governed by Saxonica's own license (Version 1.0, June 2020), which permits redistribution in binary form as part of an application. The full Saxonica license text - including its copyright notice, redistribution conditions, patent-litigation clause, and warranty disclaimer ("THIS SOFTWARE IS PROVIDED … 'AS IS'") - is reproduced verbatim in the THIRD-PARTY-NOTICES.md file shipped with this extension, as required by condition 1 of that license. In accordance with its terms, this extension does not modify, reverse-engineer, or disassemble Saxon-JS, and the name Saxonica is used only to attribute the software, not to endorse this extension. "Saxon" and "Saxonica" are trade names of Saxonica Ltd.

**libxslt.** The optional libxslt engine invokes the `xsltproc` executable installed on your own system; no libxslt, libexslt, or libxml2 code is bundled with or distributed by this extension. libxslt is © Daniel Veillard and contributors, distributed by its maintainers under the MIT license.

This extension is an independent project and is not affiliated with, endorsed by, or sponsored by Saxonica Ltd or the libxslt project.
