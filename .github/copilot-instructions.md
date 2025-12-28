# AI Agent Instructions for micro-mongo-web-console

Use this as a quick start to be productive in this repo. It summarizes the architecture, key workflows, and project-specific patterns.

## Overview
- Purpose: A browser-based terminal UI (“WebShell”) rendering ANSI sequences into a DOM screen.
- Entry: [index.html](index.html) loads [src/main.js](src/main.js) with module script; styles in [src/style.css](src/style.css).
- Architecture: Custom terminal renderer (`window.ANSI`, `Terminal`, `ScreenBuffer`) with scrollback, alt-screen, smart resize, and a minimal app lifecycle (`runApp`). OPFS-based storage helpers for persistence.

## Run & Build
- Dev server: `npm run dev` (Vite). Opens the app at `http://localhost:5173` by default.
- Build: `npm run build`; Preview: `npm run preview`.
- Dependencies: `vite`, `acorn`, `node-inspect-extracted`. Local interpreter code in [src/sval.js](src/sval.js).

## Core Components
- `window.ANSI` (in [src/main.js](src/main.js)):
  - Compose ANSI strings: `ANSI.compose(parts...)`.
  - Helpers: colors (`ANSI.green()`), cursor moves (`ANSI.up(n)`), SGR reset (`ANSI.reset()`), alt screen toggle (`ANSI.altScreenOn()`/`Off`).
  - Size/resize hooks: `ANSI.querySize()`, `ANSI.onResize(cb)`.
- `Terminal` (in [src/main.js](src/main.js)):
  - `write(str)`: parse ANSI + render to [#screen](index.html#L12-L13).
  - Buffers: main + alt (`DEC 1049` handling). Scrollback only on main.
  - Smart resize: `resizeToFit()` measures cell size and preserves content via `ScreenBuffer.resizeSmart()`.
  - Viewport scrollback: mouse wheel on the screen element; `scrollbackScroll(delta)` and `scrollbackToBottom()`.
- `ScreenBuffer` (in [src/main.js](src/main.js)):
  - Maintains `rows/cols`, cursor, attributes; supports `erase`, `insert/delete` chars/lines, scroll regions, delayed wrap.
  - `resizeSmart(cols, rows, pushScrollbackRowCb)`: preserves right-side cells on shrink, restores on grow; pushes truncated bottom rows to scrollback.
- App lifecycle (in [src/main.js](src/main.js)):
  - `window.runApp(app)`: start an app object with `onStart(ctx)`, `onKey(e,ctx)`, `onResize(info,ctx)`, `onExit(ctx)`.
  - `pushApp(app)` / `popApp()` to stack apps; `exitApp()` returns to shell.
- OPFS helpers (in [src/main.js](src/main.js)):
  - `OPFS.root(), listDir(path), readFile(path), writeFile(path, content, {append}), ensureDir(path), remove(path,{recursive}), requestPersistence()`.
  - `DirIndex` caches directory listings for fast completion.

## Input & UI
- Screen: `#screen` div inside `#terminal`; hidden textarea `#kbd` captures focus and keystrokes.
- Cursor: internal blink + visibility controlled by `Terminal`; avoid manual DOM cursor changes.
- Scrollback: mouse wheel on the screen; disabled in alt buffer.

## Conventions & Patterns
- Prefer writing ANSI to `Terminal.write()` rather than manipulating the DOM.
- Use `ANSI.onResize(cb)` instead of polling; call `term.resizeToFit()` on container resize.
- Alt buffer is for full-screen apps; main buffer keeps scrollback. Don’t assume scrollback in alt.
- Apps are plain objects; keep UI updates via ANSI writes and react to `onKey`/`onResize`.

## Examples
- Print colored text:
  - `ansi(ANSI.compose(ANSI.green(), "Hello", ANSI.reset(), "\r\n"))`
- Enter/leave alt screen:
  - `ansi(ANSI.altScreenOn()); /* ... */ ansi(ANSI.altScreenOff());`
- React to resize:
  - `ANSI.onResize(({cols,rows}) => println(`Resized to ${cols}x${rows}`));`
- Minimal app:
  - `runApp({ onStart({println}){ println("App started"); }, onKey(e,{exit}){ if(e.key==='q') exit(); } });`
- OPFS write:
  - `const root = await OPFS.root(); await OPFS.ensureDir(root, "/home/guest"); await OPFS.writeFile(root, "/home/guest/readme.txt", "hi\n");`

## Legacy/Context
- There is legacy code in [src/main-orig.js](src/main-orig.js) that used `xterm.js` + `Sval`. Current implementation uses a custom terminal renderer in [src/main.js](src/main.js).
