// Tree app (interactive, OPFS-backed)
// Extracted from src/main.js; relies on injected OPFS/root and optional LessApp/VimApp

export function TreeApp(rootPath, deps = {}) {
  this.rootPath = rootPath || "/";
  this.expanded = new Set();
  this.selected = 0;
  this.scroll = 0;
  this._ctx = null;
  this._flat = [];
  this._deps = deps;
  this._rootHandle = null;
  this._OPFS = null;
  this._LessApp = deps.LessApp || null;
  this._VimApp = deps.VimApp || null;
}

TreeApp.prototype.onStart = async function(ctx) {
  this._ctx = ctx;
  this._OPFS = this._deps.OPFS || ctx.OPFS;
  this._rootHandle = (this._deps.getOPFSRoot ? this._deps.getOPFSRoot() : (ctx.getOPFSRoot && ctx.getOPFSRoot())) || null;
  this._LessApp = this._LessApp || ctx.LessApp || null;
  this._VimApp = this._VimApp || ctx.VimApp || null;

  ctx.term.enterAltScreenNow();
  ctx.ansi(ctx.ANSI.altScreenOn() + ctx.ANSI.showCursor());

  this.expanded.add(this.rootPath);
  await this.rebuild();
  this.render(ctx);
};

TreeApp.prototype.onResize = async function(size, ctx) {
  ctx = ctx || this._ctx;
  if (!ctx) return;
  await this.rebuild();
  this.render(ctx);
};

TreeApp.prototype.onExit = function(ctx) {
  ctx.term.leaveAltScreenNow();
  ctx.ansi(ctx.ANSI.altScreenOff() + ctx.ANSI.showCursor());
};

TreeApp.prototype.rebuild = async function() {
  if (!this._OPFS || !this._rootHandle) return;
  var out = [];
  var self = this;
  var OPFS = this._OPFS;
  var root = this._rootHandle;

  async function walk(absPath, depth) {
    const names = await OPFS.listDir(root, absPath);
    for (var i = 0; i < names.length; i++) {
      var entry = names[i];
      var isDir = entry.endsWith("/");
      var name = isDir ? entry.slice(0, -1) : entry;
      var childPath = (absPath === "/") ? ("/" + name) : (absPath + "/" + name);
      out.push({ path: childPath, name: name, depth: depth, type: isDir ? "dir" : "file" });
      if (isDir && self.expanded.has(childPath)) {
        await walk(childPath, depth + 1);
      }
    }
  }

  out = [{ path: this.rootPath, name: this.rootPath, depth: 0, type: "root" }];
  await walk(this.rootPath, 1);

  this._flat = out;
  this.selected = Math.max(0, Math.min(this._flat.length - 1, this.selected));
};

TreeApp.prototype.render = function(ctx) {
  var cols = ctx.term.cols;
  var rows = ctx.term.rows;
  var viewRows = rows - 1;

  this.selected = Math.max(0, Math.min(this._flat.length - 1, this.selected));
  if (this.selected < this.scroll) this.scroll = this.selected;
  if (this.selected >= this.scroll + viewRows) this.scroll = this.selected - viewRows + 1;
  this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this._flat.length - viewRows)));

  ctx.ansi(ctx.ANSI.clear() + ctx.ANSI.home());

  for (var r = 0; r < viewRows; r++) {
    var idx = this.scroll + r;
    var line = "";
    if (idx < this._flat.length) {
      var item = this._flat[idx];
      var prefix = "";
      for (var d = 0; d < item.depth; d++) prefix += "  ";

      var marker = "  ";
      if (item.type === "dir" || item.type === "root") {
        var open = this.expanded.has(item.path);
        marker = open ? "v " : "> ";
      } else {
        marker = "  ";
      }

      line = prefix + marker + item.name;
      if (item.type === "dir") line += "/";
    }

    ctx.ansi(ctx.ANSI.moveTo(r + 1, 1));
    if (idx === this.selected) {
      ctx.ansi(ctx.ANSI.inverse());
      ctx.ansi(padRight(line, cols));
      ctx.ansi(ctx.ANSI.reset());
    } else {
      ctx.ansi(padRight(line, cols));
    }
  }

  var status = "tree: Up/Down or j/k, Enter toggle/open, l less, v vim, q quit";
  ctx.ansi(ctx.ANSI.moveTo(rows, 1) + ctx.ANSI.inverse());
  ctx.ansi(padRight(status, cols));
  ctx.ansi(ctx.ANSI.reset());
};

TreeApp.prototype._toggleOrOpen = async function(ctx) {
  if (!this._OPFS || !this._rootHandle) return;
  var item = this._flat[this.selected];
  if (!item) return;

  var OPFS = this._OPFS;
  var root = this._rootHandle;

  if (item.type === "root" || item.type === "dir") {
    const exists = await OPFS.exists(root, item.path);
    if (!exists || exists.type !== "dir") return;
    if (this.expanded.has(item.path)) this.expanded.delete(item.path);
    else this.expanded.add(item.path);
    await this.rebuild();
    this.render(ctx);
    return;
  }

  const content = await OPFS.readFile(root, item.path);
  if (this._LessApp) ctx.pushApp(new this._LessApp(item.path, content));
};

TreeApp.prototype.onKey = async function(e, ctx) {
  var key = e.key;

  if (key === "q" || key === "Q") {
    ctx.exit();
    return;
  }

  if (key === "ArrowDown" || key === "j") {
    this.selected = Math.min(this._flat.length - 1, this.selected + 1);
    this.render(ctx);
    return;
  }
  if (key === "ArrowUp" || key === "k") {
    this.selected = Math.max(0, this.selected - 1);
    this.render(ctx);
    return;
  }

  if (key === "Enter") {
    await this._toggleOrOpen(ctx);
    return;
  }

  if (key === "l") {
    var item = this._flat[this.selected];
    if (item && item.type === "file" && this._LessApp && this._OPFS && this._rootHandle) {
      const text = await this._OPFS.readFile(this._rootHandle, item.path);
      ctx.pushApp(new this._LessApp(item.path, text));
    }
    return;
  }

  if (key === "v") {
    var item2 = this._flat[this.selected];
    if (item2 && item2.type === "file" && this._VimApp && this._OPFS && this._rootHandle) {
      const text2 = await this._OPFS.readFile(this._rootHandle, item2.path);
      ctx.pushApp(new this._VimApp(item2.path, text2));
    }
    return;
  }

  if (key === "ArrowRight") {
    var it = this._flat[this.selected];
    if (it && (it.type === "root" || it.type === "dir")) {
      if (!this.expanded.has(it.path)) {
        this.expanded.add(it.path);
        await this.rebuild();
        this.render(ctx);
      }
    }
    return;
  }
  if (key === "ArrowLeft") {
    var it2 = this._flat[this.selected];
    if (it2 && (it2.type === "root" || it2.type === "dir")) {
      if (this.expanded.has(it2.path)) {
        this.expanded.delete(it2.path);
        await this.rebuild();
        this.render(ctx);
      }
    }
    return;
  }
};

function padRight(s, n) {
  s = String(s || "");
  if (s.length >= n) return s;
  return s + new Array(n - s.length + 1).join(" ");
}
