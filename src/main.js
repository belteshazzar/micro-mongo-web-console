
import './style.css';
import { Terminal, ESC } from './terminal.js';
import { createANSI } from './ansi.js';
import { VimApp } from './apps/vim.js';
import { TreeApp } from './apps/tree.js';
import { LessApp } from './apps/less.js';
import { MongoshApp } from './apps/mongosh.js';
import { DimApp } from './apps/dim.js';
import { CompletionManager, lexForCompletion, createCommandProvider, createPathProvider } from './completionmanager.js';
import { OPFS } from './opfs.js';
import { createGlobals, JavaScriptREPL } from './repl.js';

var screenEl = document.getElementById("screen");
var kbd = document.getElementById("kbd");

/********************************************************************
 * ANSI helper API
 ********************************************************************/
window.ANSI = createANSI(ESC);
const ANSI = window.ANSI;

var term = new Terminal(screenEl);

ANSI.querySize = function(){ return { cols: term.cols, rows: term.rows }; };
ANSI.onResize = function(cb){ return term.onResize(cb); };

function ansi(s){ term.write(s); }
function println(s){ ansi((s||"")+"\r\n"); }
function errorln(s){ ansi(ESC+"[31m"+s+ESC+"[0m\r\n"); }
function dimln(s){ ansi(ESC+"[90m"+s+ESC+"[0m\r\n"); }

// Resize wiring
window.addEventListener("resize", function(){ term.resizeToFit(); });
if (window.ResizeObserver){
  var ro = new ResizeObserver(function(){ term.resizeToFit(); });
  ro.observe(screenEl);
}

// Mouse wheel scrollback (main only)
screenEl.addEventListener("wheel", function(e){
  e.preventDefault();
  if (term.useAlt) return;
  var dy = e.deltaY;
  // Positive dy (wheel down) should scroll to newer lines (down),
  // which means decreasing view offset (negative delta).
  var baseDir = (dy > 0) ? 1 : -1; // +1 for down gesture, -1 for up
  var direction = -baseDir; // invert so down -> negative delta
  var magnitude = Math.min(6, Math.max(1, Math.round(Math.abs(dy) / 100)));
  var step = magnitude * 3;
  term.scrollbackScroll(direction * step);
  kbd.focus();
}, {passive:false});

screenEl.addEventListener("mousedown", function(){ kbd.focus(); });

window.addEventListener("blur", function(){
  term.cursorPhase = false;
  term.scheduleRender();
});
window.addEventListener("focus", function(){
  term.cursorPhase = true;
  term.scheduleRender();
  kbd.focus();
});

/********************************************************************
 * Path utilities + cwd
 ********************************************************************/
var cwd = "/home/guest";

function pathParts(p){ return p ? p.split("/").filter(Boolean) : []; }
function normalizePath(input, base){
  base = base || cwd;
  var absParts = (input && input[0] === "/") ? [] : pathParts(base);
  pathParts(input||"").forEach(function(part){
    if (part === ".") return;
    if (part === "..") absParts.pop();
    else absParts.push(part);
  });
  return "/" + absParts.join("/");
}
function splitDirFile(absPath){
  var parts = pathParts(absPath);
  var name  = parts.pop() || "";
  var parentPath = "/" + parts.join("/");
  return { parentPath: parentPath===""?"/":parentPath, name:name };
}

/********************************************************************
 * Simple directory index cache (for synchronous path completion)
 ********************************************************************/
const DirIndex = {
  map: new Map(),
  get(path){ return this.map.get(path) || null; },
  set(path, entries){ this.map.set(path, entries.slice()); },
  invalidate(path){ this.map.delete(path); }
};
function listDirCached(absPath){
  return DirIndex.get(absPath);
}
async function refreshDirIndex(absPath){
  if (!__opfsRoot) return;
  try {
    const list = await OPFS.listDir(__opfsRoot, absPath);
    DirIndex.set(absPath, list);
  } catch { DirIndex.invalidate(absPath); }
}

/********************************************************************
 * Tiny app lifecycle manager + stack (pushApp)
 ********************************************************************/
var shell = { line:"", cursor:0, history:[], hidx:0, active:true };

var appManager = (function(){
  var active = null;
  var stack = [];

  var ctx = {
    term: term,
    ANSI: ANSI,
    ansi: ansi,
    println: println,
    errorln: errorln,
    dimln: dimln,
    getSize: function(){ return term.getSize(); },
    exit: function(){},
    pushApp: function(app){},
    popApp: function(){},
    // Injected dependencies for external apps
    OPFS: OPFS,
    getOPFSRoot: function(){ return __opfsRoot; },
    refreshDirIndex: refreshDirIndex,
    splitDirFile: splitDirFile,
    isRunning: function(){ return appManager.isRunning(); }
  };

  function runApp(app){
    stack.length = 0;
    return _start(app, false);
  }

  function pushApp(app){
    return _start(app, true);
  }

  function _start(app, push){
    if (active){
      if (push) stack.push(active);
      else _finish(active);
    }

    active = app;
    term.activeApp = app;

    shell.active = false;
    ctx.exit = exitApp;
    ctx.pushApp = pushApp;
    ctx.popApp = popApp;

    if (app && typeof app.onStart === "function"){
      try { app.onStart(ctx); } catch (e) {}
    }
    if (app && typeof app.onResize === "function"){
      try { app.onResize({cols:term.cols, rows:term.rows, prevCols:term.cols, prevRows:term.rows}, ctx); } catch (e2) {}
    }

    return { exit: exitApp };
  }

  function _finish(app){
    try {
      if (app && typeof app.onExit === "function") app.onExit(ctx);
    } catch (e) {}
  }

  function popApp(){
    if (!stack.length){
      exitApp();
      return;
    }
    var old = active;
    _finish(old);
    active = stack.pop();
    term.activeApp = active;

    if (active && typeof active.onResize === "function"){
      try { active.onResize({cols:term.cols, rows:term.rows, prevCols:term.cols, prevRows:term.rows}, ctx); } catch (e2) {}
    }
  }

  function exitApp(){
    if (!active) return;
    var old = active;
    _finish(old);
    active = null;
    term.activeApp = null;
    stack.length = 0;
    shell.active = true;
    requestAnimationFrame(function(){
      ansi(promptStr());
      redrawShellLine();
      kbd.focus();
    });
  }

  function routeKey(e){
    if (!active) return false;
    if (active && typeof active.onKey === "function"){
      try { active.onKey(e, ctx); } catch (e2) {}
      return true;
    }
    return false;
  }

  function isRunning(){ return !!active; }

  return { runApp: runApp, pushApp: pushApp, popApp: popApp, exitApp: exitApp, routeKey: routeKey, isRunning: isRunning };
})();

window.runApp = appManager.runApp;

/********************************************************************
 * JavaScript REPL
 ********************************************************************/
var repl = null; // Will be initialized after app manager is ready

async function initREPL(){
  // Build app launcher functions
  const appLaunchers = {
    vim: async (path) => {
      if (!path) return errorln("vim: missing file operand");
      if (!__opfsRoot) return errorln("vim: OPFS not available");
      const abs = normalizePath(path);
      const st  = await OPFS.exists(__opfsRoot, abs);
      if (!st){
        const info = splitDirFile(abs);
        const parent = await OPFS.exists(__opfsRoot, info.parentPath);
        if (!parent || parent.type!=="dir") return errorln("vim: cannot create '"+abs+"': No such directory");
        await OPFS.writeFile(__opfsRoot, abs, "", { append:false });
        refreshDirIndex(info.parentPath);
      }
      const content = await OPFS.readFile(__opfsRoot, abs);
      shell.active = false;
      appManager.runApp(new VimApp(abs, content));
    },

    less: async (path) => {
      if (!path) return errorln("less: missing file operand");
      if (!__opfsRoot) return errorln("less: OPFS not available");
      const abs = normalizePath(path);
      const st  = await OPFS.exists(__opfsRoot, abs);
      if (!st || st.type!=="file") return errorln("less: " + path + ": No such file");
      const content = await OPFS.readFile(__opfsRoot, abs);
      shell.active = false;
      appManager.runApp(new LessApp(abs, content));
    },

    tree: async (path) => {
      if (!__opfsRoot) return errorln("tree: OPFS not available");
      const rootPath = normalizePath(path || cwd);
      const st = await OPFS.exists(__opfsRoot, rootPath);
      if (!st || st.type!=="dir") return errorln("tree: "+(path || ".")+" : Not a directory");
      shell.active = false;
      appManager.runApp(new TreeApp(rootPath, {
        OPFS,
        getOPFSRoot: () => __opfsRoot,
        LessApp,
        VimApp
      }));
    },

    mongosh: async () => {
      shell.active = false;
      appManager.runApp(new MongoshApp());
    },

    dim: async () => {
      shell.active = false;
      appManager.runApp(new DimApp());
    }
  };

  const g = await createGlobals({
    ansi,
    println,
    errorln,
    dimln,
    ANSI,
    OPFS,
    appManager,
    term,
    normalizePath,
    splitDirFile,
    refreshDirIndex,
    appLaunchers,
    commands
  });
  
  // Create REPL with app launchers included in globals
  repl = new JavaScriptREPL({println, errorln, dimln}, g);

}

/********************************************************************
 * Commands (OPFS-primary)
 ********************************************************************/
var commands = {};

commands.help = function(){
  println(
    "Commands:\n"+
    "  help(), ls(), cd(), pwd, mkdir, touch, cat, echo, clear, vim, less, tree, rm, rmdir, du, quota, mongosh, dim\n\n"+
    "quota flags:\n"+
    "  --bar=N       set utilization bar width (default 24)\n"+
    "  --no-details  hide per-source breakdown\n"+
    "  --bytes       show raw byte counts\n\n"+
    "Apps:\n"+
    "  less <file>   (q quits, / search)\n"+
    "  tree [path]   interactive browser\n"+
    "  mongosh       minimal MongoDB shell (Data API)\n"+
    "  dim           screen dimension test (Ctrl+C to exit)\n\n"+
    "Tab completion:\n"+
    "  Tab completes, Tab Tab lists, further Tab cycles\n"
  );
};

commands.clear = function(){
  if (!term.useAlt){
    term.mainScrollback.length = 0;
    term.mainViewOffset = 0;
  }
  ansi(ANSI.clear() + ANSI.home());
};

commands.pwd = function(){ println(cwd); };

commands.ls = async function(args){
  if (!__opfsRoot) return errorln("ls: OPFS not available");
  const target = normalizePath(args[0] || cwd);
  const st = await OPFS.exists(__opfsRoot, target);
  if (!st) return errorln("ls: cannot access '"+(args[0]||".")+"': No such file or directory");
  if (st.type === "file") return println(splitDirFile(target).name);
  const list = await OPFS.listDir(__opfsRoot, target);
  DirIndex.set(target, list);
  println(list.join("  "));
};

commands.cd = async function(args){
  if (!__opfsRoot) return errorln("cd: OPFS not available");
  const target = normalizePath(args[0] || "/home/guest");
  const st = await OPFS.exists(__opfsRoot, target);
  if (!st || st.type !== "dir") return errorln("cd: no such file or directory: " + (args[0]||target));
  cwd = target;
};

commands.mkdir = async function(args){
  if (!__opfsRoot) return errorln("mkdir: OPFS not available");
  if (!args.length) return errorln("mkdir: missing operand");
  for (let i=0;i<args.length;i++){
    const abs = normalizePath(args[i]);
    const exists = await OPFS.exists(__opfsRoot, abs);
    if (exists) { errorln("mkdir: cannot create directory '"+args[i]+"': File exists"); continue; }
    try { await OPFS.ensureDir(__opfsRoot, abs); refreshDirIndex(splitDirFile(abs).parentPath); }
    catch (e){ errorln("mkdir: "+String(e)); }
  }
};

commands.touch = async function(args){
  if (!__opfsRoot) return errorln("touch: OPFS not available");
  if (!args.length) return errorln("touch: missing file operand");
  for (let i=0;i<args.length;i++){
    const abs = normalizePath(args[i]);
    const info = splitDirFile(abs);
    const parent = await OPFS.exists(__opfsRoot, info.parentPath);
    if (!parent || parent.type!=="dir"){
      errorln("touch: cannot touch '"+abs+"': No such file or directory");
      continue;
    }
    try { await OPFS.writeFile(__opfsRoot, abs, "", { append:false }); refreshDirIndex(info.parentPath); }
    catch (e){ errorln("touch: "+String(e)); }
  }
};

commands.cat = async function(args){
  if (!__opfsRoot) return errorln("cat: OPFS not available");
  if (!args.length) return errorln("cat: missing file operand");
  for (let i=0;i<args.length;i++){
    const abs = normalizePath(args[i]);
    const st  = await OPFS.exists(__opfsRoot, abs);
    if (!st) { errorln("cat: "+args[i]+": No such file or directory"); continue; }
    if (st.type === "dir"){ errorln("cat: "+args[i]+": Is a directory"); continue; }
    const text = await OPFS.readFile(__opfsRoot, abs);
    ansi(text.replace(/\n/g,"\r\n"));
    if (!text.endsWith("\n")) ansi("\r\n");
  }
};

commands.echo = async function(args, redirect){
  const out = args.join(" ");
  if (!redirect) { println(out); return; }
  if (!__opfsRoot) return errorln("echo: OPFS not available");
  const abs = normalizePath(redirect.path);
  const info = splitDirFile(abs);
  const parent = await OPFS.exists(__opfsRoot, info.parentPath);
  if (!parent || parent.type!=="dir"){
    return errorln("write: '"+abs+"': No such file or directory");
  }
  const r = await OPFS.writeFile(__opfsRoot, abs, out+"\n", { append: redirect.op===">>" });
  if (!r.ok) errorln(r.err); else refreshDirIndex(info.parentPath);
};

// rm / rmdir
function parsePathFlags(args){
  let recursive = false, force = false;
  const paths = [];
  for (const a of args){
    if (a === "-r" || a === "-R" || a === "--recursive") recursive = true;
    else if (a === "-f" || a === "--force") force = true;
    else paths.push(a);
  }
  return { recursive, force, paths };
}

commands.rm = async function(args){
  if (!__opfsRoot) return errorln("rm: OPFS not available");
  const { recursive, force, paths } = parsePathFlags(args);
  if (!paths.length) return errorln("rm: missing operand");

  for (const p of paths){
    const abs = normalizePath(p);
    const st = await OPFS.exists(__opfsRoot, abs);
    const parent = splitDirFile(abs).parentPath;
    if (!st){
      if (!force) errorln("rm: cannot remove '"+p+"': No such file or directory");
      continue;
    }
    if (st.type === "dir" && !recursive){
      errorln("rm: cannot remove '"+p+"': Is a directory");
      continue;
    }
    try { await OPFS.remove(__opfsRoot, abs, { recursive }); refreshDirIndex(parent); }
    catch (e){ if (!force) errorln("rm: cannot remove '"+p+"': " + String(e)); }
  }
};

commands.rmdir = async function(args){
  if (!__opfsRoot) return errorln("rmdir: OPFS not available");
  const { recursive, paths } = parsePathFlags(args);
  if (!paths.length) return errorln("rmdir: missing operand");

  for (const p of paths){
    const abs = normalizePath(p);
    const st = await OPFS.exists(__opfsRoot, abs);
    const parent = splitDirFile(abs).parentPath;
    if (!st){
      errorln("rmdir: failed to remove '"+p+"': No such file or directory");
      continue;
    }
    if (st.type !== "dir"){
      errorln("rmdir: failed to remove '"+p+"': Not a directory");
      continue;
    }
    try { await OPFS.remove(__opfsRoot, abs, { recursive }); refreshDirIndex(parent); }
    catch (e){ errorln("rmdir: failed to remove '"+p+"': " + String(e)); }
  }
};

// du / quota
function formatBytes(n){
  n = Number(n||0);
  const u = ["B","KiB","MiB","GiB","TiB"];
  let i = 0;
  while (n >= 1024 && i < u.length-1){ n /= 1024; i++; }
  const digits = n >= 10 ? 0 : 2;
  return n.toFixed(digits) + " " + u[i];
}
function leftPad(str, width){
  str = String(str||"");
  if (str.length >= width) return str;
  return new Array(width - str.length + 1).join(" ") + str;
}

async function duWalk(absPath){
  const st = await OPFS.exists(__opfsRoot, absPath);
  if (!st) return { total:0, items:[] };
  if (st.type === "file"){
    const size = await OPFS.fileSize(__opfsRoot, absPath);
    return { total:size, items:[{ path:absPath, size:size, type:"file" }] };
  }
  let total = 0;
  let items = [];
  const entries = await OPFS.listDir(__opfsRoot, absPath);
  for (const entry of entries){
    const isDir = entry.endsWith("/");
    const name  = isDir ? entry.slice(0,-1) : entry;
    const childPath = absPath === "/" ? ("/"+name) : (absPath + "/" + name);
    const sub = await duWalk(childPath);
    total += sub.total;
    items = items.concat(sub.items);
  }
  items.push({ path:absPath, size:total, type:"dir" });
  return { total, items };
}

function parseDuFlags(args){
  let listAll=false, json=false;
  let target=null;
  for (const a of args){
    if (a==="-" || a==="--") continue;
    if (a==="-a") listAll=true;
    else if (a==="-h") {/* human default */}
    else if (a==="--json") json=true;
    else target = a;
  }
  return { listAll, json, target };
}

commands.du = async function(args){
  if (!__opfsRoot) return errorln("du: OPFS not available");
  const { listAll, json, target } = parseDuFlags(args);
  const abs = normalizePath(target || cwd);
  const st = await OPFS.exists(__opfsRoot, abs);
  if (!st) return errorln("du: cannot access '"+(target||abs)+"': No such file or directory");

  const res = await duWalk(abs);

  if (json){
    println(JSON.stringify({ path:abs, total:res.total, items:listAll?res.items:undefined }, null, 2));
    return;
  }
  if (listAll){
    const items = res.items.slice().sort(function(a,b){
      const da = a.path.split("/").filter(Boolean).length;
      const db = b.path.split("/").filter(Boolean).length;
      if (da !== db) return da - db;
      return a.path.localeCompare(b.path);
    });
    for (const it of items){
      println(leftPad(formatBytes(it.size), 10) + "  " + it.path + (it.type==="dir" ? "/" : ""));
    }
    println(leftPad(formatBytes(res.total), 10) + "  TOTAL");
  } else {
    println(leftPad(formatBytes(res.total), 10) + "  " + abs + (st.type==="dir" ? "/" : ""));
  }
};

function renderBar(used, quota, width){
  if (!quota || quota <= 0) return "";
  width = Math.max(10, Math.min(80, (width|0) || 24));
  const pct = used / quota;
  const filled = Math.round(width * pct);
  const fill = "█", empty = "░";
  return "[" + new Array(filled+1).join(fill) + new Array(width-filled+1).join(empty) + "]";
}
function colorForPct(pct){
  if (pct >= 0.90) return ANSI.brightRed();
  if (pct >= 0.70) return ANSI.brightYellow();
  return ANSI.brightGreen();
}
function parseQuotaFlags(args){
  let width = 24, showDetails = true, showBytes = false;
  for (const a of args){
    if (a.startsWith("--bar=")){
      const n = parseInt(a.slice(6), 10);
      if (!isNaN(n)) width = n;
    } else if (a === "--no-details") {
      showDetails = false;
    } else if (a === "--bytes") {
      showBytes = true;
    }
  }
  return { width, showDetails, showBytes };
}

commands.quota = async function(args){
  const { width, showDetails, showBytes } = parseQuotaFlags(args);
  const est = await OPFS.estimate();
  if (!est) return errorln("quota: storage estimate unavailable");

  const used  = (est.usage || 0);
  const quota = (est.quota || 0);
  const free  = Math.max(0, quota - used);
  const pct   = quota > 0 ? used / quota : 0;

  const bar   = renderBar(used, quota, width);
  const color = colorForPct(pct);
  const status = pct >= 0.90 ? "CRITICAL" : (pct >= 0.70 ? "WARNING" : "OK");

  println("Storage (origin):");
  println("  Used : " + formatBytes(used)  + (showBytes ? ("  ("+used+" B)") : ""));
  println("  Free : " + formatBytes(free)  + (showBytes ? ("  ("+free+" B)") : ""));
  println("  Quota: " + formatBytes(quota) + (showBytes ? ("  ("+quota+" B)") : ""));

  ansi(color);
  println("  Utilization: " + (pct*100).toFixed(1) + "%  " + bar);
  ansi(ANSI.reset());
  println("  Status: " + status);

  const details = est.usageDetails || null;
  if (showDetails && details && Object.keys(details).length){
    println("  Breakdown:");
    const keys = Object.keys(details).sort();
    for (const k of keys){
      const v = details[k] || 0;
      println("    " + leftPad(k, 16) + "  " + formatBytes(v) + (showBytes ? ("  ("+v+" B)") : ""));
    }
  }
};

/* TreeApp moved to src/apps/tree.js */
/* LessApp moved to src/apps/less.js */

/********************************************************************
 * Completion manager instance
 ********************************************************************/
var completer = new CompletionManager({
  printList: function(lines){
    println("");
    for (var i=0;i<lines.length;i++) println(lines[i]);
    ansi(promptStr());
    redrawShellLine();
  },
  beep: function(){ ansi("\x07"); },
  maxListCols: 6,
  getTermCols: function(){ return term.cols; }
});

completer.register(createCommandProvider(function(){
  var names = Object.keys(commands);
  names.sort();
  return names;
}));
completer.register(createPathProvider({
  normalizePath: normalizePath,
  listDirCached: listDirCached,
  refreshDirIndex: refreshDirIndex,
  getCwd: function(){ return cwd; }
}));

/********************************************************************
 * Shell input line editor (async pipeline)
 ********************************************************************/
function cwdDisplay(){
  var home="/home/guest";
  if (cwd===home) return "~";
  if (cwd.indexOf(home+"/")===0) return "~"+cwd.slice(home.length);
  return cwd;
}
function promptStr(){
  return "guest@web:" + cwdDisplay() + "$ ";
}

function redrawShellLine(){
  ansi("\r" + ANSI.clearLine());
  ansi(promptStr());
  ansi(shell.line);

  var b = term.buf();
  var row = b.cy;
  var promptLen = promptStr().length;
  var col = promptLen + shell.cursor;
  ansi(ANSI.moveTo(row+1, col+1));
}

async function runShellCommand(line){
  const trimmed = (line||"").trim();
  if (!trimmed) return;

  const tokens = tokenize(trimmed);
  const pr      = parseRedirection(tokens);
  const argv    = pr.argv;
  const redirect= pr.redirect;
  if (!argv.length) return;

  const cmd  = argv[0];
  const args = argv.slice(1);

  const fn = commands[cmd];
  if (!fn) { errorln(cmd + ": command not found"); return; }

  try { await fn(args, redirect); } catch(e){ errorln(String(e)); }
}

async function commitShellLine(){
  const line = shell.line;

  println("");
  shell.history.push(line);
  shell.hidx = shell.history.length;
  shell.line = "";
  shell.cursor = 0;

  completer.reset();
  
  // Execute via JavaScript REPL instead of command parsing
  if (repl) {
    await repl.execute(line);
  }

  if (!appManager.isRunning() && shell.active){
    ansi(promptStr());
  }
}

function handleShellKey(e){
  var key = e.key;
  var ctrl = e.ctrlKey || e.metaKey;

  if (!term.useAlt && term.mainViewOffset > 0){
    if (key.length === 1 || key === "Enter" || key === "Backspace" || key === "Tab"){
      term.scrollbackToBottom();
    }
  }

  if (key !== "Tab") completer.reset();

  if (key === "Enter"){ e.preventDefault(); Promise.resolve().then(commitShellLine); return; }

  if (key === "Backspace"){
    e.preventDefault();
    if (shell.cursor > 0){
      shell.line = shell.line.slice(0, shell.cursor-1) + shell.line.slice(shell.cursor);
      shell.cursor--;
      redrawShellLine();
    }
    return;
  }

  if (key === "ArrowLeft"){ e.preventDefault(); shell.cursor = Math.max(0, shell.cursor-1); redrawShellLine(); return; }
  if (key === "ArrowRight"){ e.preventDefault(); shell.cursor = Math.min(shell.line.length, shell.cursor+1); redrawShellLine(); return; }

  if (key === "ArrowUp"){
    e.preventDefault();
    if (!shell.history.length) return;
    shell.hidx = Math.max(0, shell.hidx-1);
    shell.line = shell.history[shell.hidx] || "";
    shell.cursor = shell.line.length;
    redrawShellLine();
    return;
  }
  if (key === "ArrowDown"){
    e.preventDefault();
    if (!shell.history.length) return;
    shell.hidx = Math.min(shell.history.length, shell.hidx+1);
    shell.line = (shell.hidx === shell.history.length) ? "" : (shell.history[shell.hidx] || "");
    shell.cursor = shell.line.length;
    redrawShellLine();
    return;
  }

  if (key === "Tab"){
    e.preventDefault();
    var lex = lexForCompletion(shell.line, shell.cursor);
    var currentTok = lex.tokens[lex.tokenIndex];
    var ctx = {
      line: shell.line,
      cursor: shell.cursor,
      tokens: lex.tokens,
      tokenIndex: lex.tokenIndex,
      current: currentTok
    };
    var res = completer.onTab(shell.line, shell.cursor, ctx);
    if (res && res.handled){
      shell.line = res.line;
      shell.cursor = res.cursor;
      redrawShellLine();
    }
    return;
  }

  if (ctrl && (key === "l" || key === "L")){
    e.preventDefault();
    commands.clear();
    ansi(promptStr());
    shell.line = ""; shell.cursor = 0;
    redrawShellLine();
    return;
  }

  if (key.length === 1 && !ctrl && !e.altKey){
    e.preventDefault();
    shell.line = shell.line.slice(0, shell.cursor) + key + shell.line.slice(shell.cursor);
    shell.cursor++;
    redrawShellLine();
    return;
  }
}

document.addEventListener("keydown", function(e){
  if (document.activeElement !== kbd) kbd.focus();

  if (appManager.isRunning()){
    e.preventDefault();
    appManager.routeKey(e);
    return;
  }

  if (shell.active) handleShellKey(e);
});

/********************************************************************
 * Tokenize + redirect parse (unchanged)
 ********************************************************************/
function tokenize(line){
  var tokens=[], cur="", quote=null;
  for (var i=0;i<line.length;i++){
    var ch=line[i];
    if (quote){
      if (ch===quote){ quote=null; continue; }
      if (ch=="\\"
          && quote === '"'
          && i+1<line.length){ cur += line[++i]; continue; }
      cur += ch;
    } else {
      if (ch === '"' || ch === "'"){ quote=ch; continue; }
      if (ch === "\\"){ if (i+1<line.length) cur += line[++i]; continue; }
      if (/\s/.test(ch)){ if (cur){ tokens.push(cur); cur=""; } }
      else cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}
function parseRedirection(tokens){
  var redirect=null, argv=[];
  for (var i=0;i<tokens.length;i++){
    var t=tokens[i];
    if ((t===">"||t===">>") && i+1<tokens.length){
      redirect={op:t, path:tokens[i+1]}; i++;
    } else argv.push(t);
  }
  return {argv:argv, redirect:redirect};
}

/********************************************************************
 * Apps: less + tree + vim launchers
 ********************************************************************/
commands.vim = async function(args){
  if (!args[0]) return errorln("vim: missing file operand");
  if (!__opfsRoot) return errorln("vim: OPFS not available");
  const abs = normalizePath(args[0]);
  const st  = await OPFS.exists(__opfsRoot, abs);
  if (!st){
    const info = splitDirFile(abs);
    const parent = await OPFS.exists(__opfsRoot, info.parentPath);
    if (!parent || parent.type!=="dir") return errorln("vim: cannot create '"+abs+"': No such directory");
    await OPFS.writeFile(__opfsRoot, abs, "", { append:false });
    refreshDirIndex(info.parentPath);
  }
  const content = await OPFS.readFile(__opfsRoot, abs);
  shell.active = false;
  appManager.runApp(new VimApp(abs, content));
};

commands.less = async function(args){
  if (!args[0]) return errorln("less: missing file operand");
  if (!__opfsRoot) return errorln("less: OPFS not available");
  const abs = normalizePath(args[0]);
  const st  = await OPFS.exists(__opfsRoot, abs);
  if (!st || st.type!=="file") return errorln("less: " + args[0] + ": No such file");
  const content = await OPFS.readFile(__opfsRoot, abs);
  shell.active = false;
  appManager.runApp(new LessApp(abs, content));
};

commands.tree = async function(args){
  if (!__opfsRoot) return errorln("tree: OPFS not available");
  const rootPath = normalizePath(args[0] || cwd);
  const st = await OPFS.exists(__opfsRoot, rootPath);
  if (!st || st.type!=="dir") return errorln("tree: "+(args[0]||".")+": Not a directory");
  shell.active = false;
  appManager.runApp(new TreeApp(rootPath, {
    OPFS,
    getOPFSRoot: () => __opfsRoot,
    LessApp,
    VimApp
  }));
};

commands.mongosh = async function(args){
  shell.active = false;
  appManager.runApp(new MongoshApp());
};

commands.dim = async function(args){
  shell.active = false;
  appManager.runApp(new DimApp());
};

/********************************************************************
 * Boot (async): OPFS init, seed defaults, prime completion cache
 ********************************************************************/
let __opfsRoot = null;

async function ensureInitialContent(){
  try {
    const statHome = await OPFS.exists(__opfsRoot, "/home");
    const statReadme = await OPFS.exists(__opfsRoot, "/home/guest/readme.txt");
    if (!statHome) await OPFS.ensureDir(__opfsRoot, "/home/guest");
    if (!statReadme) {
      const text =
"Welcome to WebShell.\n\nTry:\n  help\n  ls\n  tree\n  tree /home/guest\n  less readme.txt\n  vim docs/notes.txt\n\nIn tree:\n  arrows/jk move, Enter toggles dir, l opens less, v opens vim, q quit\nIn less:\n  j/k scroll, Space/PageDown page, b/PageUp back, / search, n next, q quit\n";
      await OPFS.writeFile(__opfsRoot, "/home/guest/readme.txt", text, { append:false });
      await OPFS.ensureDir(__opfsRoot, "/home/guest/docs");
      await OPFS.writeFile(__opfsRoot, "/home/guest/docs/notes.txt",
"Notes\n\nThis is docs/notes.txt.\n\nTry:\n  - Use less to page.\n  - Use tree to browse.\n", { append:false });
      await OPFS.writeFile(__opfsRoot, "/home/guest/docs/todo.txt",
"TODO\n- Build more apps\n- Add flags completion\n", { append:false });
      await OPFS.ensureDir(__opfsRoot, "/tmp");
    }
  } catch {}
}

async function boot(){
  __opfsRoot = await OPFS.root();
  term.resizeToFit();
  ansi(ANSI.clear() + ANSI.home());

  if (!__opfsRoot){
    errorln("OPFS not available in this context (secure context & supported browser required).");
    ansi(promptStr());
    shell.line = ""; shell.cursor = 0;
    shell.active = true;
    kbd.focus();
    redrawShellLine();
    return;
  }

  // Request persistence; display a storage line
  OPFS.requestPersistence().catch(()=>{});
  const est = await OPFS.estimate();

  ansi(ANSI.brightGreen() + "Baby Mongo Shell" + ANSI.reset() + "\r\n");
  dimln("");
  dimln("Try: ls()");
  dimln("     cat(\"readme.txt\")");
  dimln("     vim(\"docs/notes.txt\")");
  dimln("     await db.test.find().toArray()");
  dimln("");
  if (est && est.quota != null && est.usage != null){
    const usedMB  = Math.round(est.usage / (1024*1024));
    const quotaMB = Math.round(est.quota / (1024*1024));
    dimln("Storage (OPFS): " + usedMB + "MB / " + quotaMB + "MB");
  }
  dimln("");

  await ensureInitialContent();

  // prime completion cache
  await refreshDirIndex("/home");
  await refreshDirIndex("/home/guest");
  await refreshDirIndex("/home/guest/docs");
  await refreshDirIndex("/tmp");

  // Initialize JavaScript REPL
  await initREPL();

  ansi(promptStr());
  shell.line = ""; shell.cursor = 0;
  shell.active = true;
  kbd.focus();
  redrawShellLine();
}

boot();

