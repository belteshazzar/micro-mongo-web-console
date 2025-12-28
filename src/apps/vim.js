// Vim app (OPFS-backed save)
// Extracted from src/main.js and adjusted to use injected ctx

export function VimApp(path, content){
  this.path = path;
  this.lines = String(content||"").replace(/\r\n/g,"\n").split("\n");
  if (!this.lines.length) this.lines = [""];
  this.cx = 0; this.cy = 0; this.scroll = 0;
  this.mode = "NORMAL"; // NORMAL | INSERT | CMD
  this.cmd = "";
  this.message = "";
  this.modified = false;
  this._ctx = null;
}

VimApp.prototype.onStart = function(ctx){
  this._ctx = ctx;
  ctx.term.enterAltScreenNow();
  ctx.ansi(ctx.ANSI.altScreenOn() + ctx.ANSI.showCursor());
  this.render(ctx);
};

VimApp.prototype.onResize = function(size, ctx){
  ctx = ctx || this._ctx;
  if (!ctx) return;
  this.render(ctx);
};

VimApp.prototype.onExit = function(ctx){
  ctx.term.leaveAltScreenNow();
  ctx.ansi(ctx.ANSI.altScreenOff() + ctx.ANSI.showCursor());
};

VimApp.prototype._clamp = function(){
  this.cy = Math.max(0, Math.min(this.lines.length-1, this.cy));
  var line = this.lines[this.cy] || "";
  this.cx = Math.max(0, Math.min(line.length, this.cx));
};

VimApp.prototype._ensureVisible = function(rows){
  var textRows = rows - 2;
  if (this.cy < this.scroll) this.scroll = this.cy;
  if (this.cy >= this.scroll + textRows) this.scroll = this.cy - textRows + 1;
  this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.lines.length - 1)));
};

VimApp.prototype._status = function(cols){
  var left = '"' + this.path + '" ' + (this.modified ? "[+]" : "");
  var right = this.mode + "  " + (this.cy+1) + "," + (this.cx+1);
  return padMiddle(left, right, cols);
};

function padMiddle(left, right, n){
  left = String(left||"");
  right = String(right||"");
  if (left.length + right.length >= n){
    var keep = Math.max(0, n - right.length - 2);
    left = left.slice(0, keep) + "..";
  }
  var gap = Math.max(1, n - left.length - right.length);
  return left + new Array(gap+1).join(" ") + right;
}

VimApp.prototype._cmdLine = function(){
  if (this.mode === "CMD") return ":" + this.cmd;
  if (this.mode === "INSERT") return "-- INSERT --";
  return this.message || "";
};

VimApp.prototype.render = function(ctx){
  this._clamp();
  this._ensureVisible(ctx.term.rows);

  var cols = ctx.term.cols;
  var rows = ctx.term.rows;
  var textRows = rows - 2;

  ctx.ansi(ctx.ANSI.scrollRegion(1, textRows));
  ctx.ansi(ctx.ANSI.clear() + ctx.ANSI.home());

  for (var r=0;r<textRows;r++){
    var fileRow = this.scroll + r;
    var line = (fileRow < this.lines.length) ? this.lines[fileRow] : "";
    if (line.length > cols) line = line.slice(0, cols);
    ctx.ansi(ctx.ANSI.moveTo(r+1,1) + ctx.ANSI.reset());
    ctx.ansi(padRight(line, cols));
  }

  ctx.ansi(ctx.ANSI.scrollRegionReset());

  ctx.ansi(ctx.ANSI.moveTo(textRows+1,1) + ctx.ANSI.inverse());
  ctx.ansi(padRight(this._status(cols), cols));
  ctx.ansi(ctx.ANSI.reset());

  ctx.ansi(ctx.ANSI.moveTo(textRows+2,1) + ctx.ANSI.reset());
  ctx.ansi(padRight(this._cmdLine(), cols));

  var cursorRow = (this.cy - this.scroll) + 1;
  var cursorCol = this.cx + 1;
  cursorRow = Math.max(1, Math.min(textRows, cursorRow));
  cursorCol = Math.max(1, Math.min(cols, cursorCol));
  ctx.ansi(ctx.ANSI.moveTo(cursorRow, cursorCol));
};

function padRight(s, n){
  s = String(s||"");
  if (s.length >= n) return s;
  return s + new Array(n - s.length + 1).join(" ");
}

VimApp.prototype._save = function(){
  var content = this.lines.join("\n");
  var self = this;
  var ctx = this._ctx;
  var OPFS = ctx && ctx.OPFS;
  var root = ctx && ctx.getOPFSRoot ? ctx.getOPFSRoot() : null;
  if (!OPFS || !root){ self.message = "OPFS unavailable"; return Promise.resolve(false); }
  return OPFS.writeFile(root, this.path, content, { append:false })
    .then(function(r){
      if (!r.ok){ self.message = r.err; return false; }
      self.modified = false;
      self.message = '"' + self.path + '" written';
      try {
        var split = ctx && ctx.splitDirFile ? ctx.splitDirFile(self.path) : null;
        if (split && ctx && ctx.refreshDirIndex) ctx.refreshDirIndex(split.parentPath);
      } catch {}
      return true;
    });
};

VimApp.prototype._runEx = function(cmd, ctx){
  cmd = String(cmd||"").trim();
  if (cmd === "w"){ this._save().then(()=> this.render(ctx)); return; }
  if (cmd === "q"){
    if (this.modified){ this.message = "No write since last change (add ! to override)"; this.render(ctx); return; }
    ctx.exit(); return;
  }
  if (cmd === "q!"){ ctx.exit(); return; }
  if (cmd === "wq" || cmd === "x"){
    var self=this;
    this._save().then(function(ok){ if (ok) ctx.exit(); else self.render(ctx); });
    return;
  }
  this.message = "Not an editor command: " + cmd;
  this.render(ctx);
};

VimApp.prototype._insertText = function(text){
  var line = this.lines[this.cy] || "";
  this.lines[this.cy] = line.slice(0,this.cx) + text + line.slice(this.cx);
  this.cx += text.length;
  this.modified = true;
};

VimApp.prototype.onKey = function(e, ctx){
  var key = e.key;
  var ctrl = e.ctrlKey || e.metaKey;

  if (this.mode === "CMD"){
    if (key === "Escape"){ this.mode="NORMAL"; this.cmd=""; this.message=""; this.render(ctx); return; }
    if (key === "Enter"){
      var cmd = this.cmd;
      this.cmd=""; this.mode="NORMAL";
      this._runEx(cmd, ctx);
      if (ctx.isRunning ? ctx.isRunning() : true) this.render(ctx);
      return;
    }
    if (key === "Backspace"){ this.cmd = this.cmd.slice(0,-1); this.render(ctx); return; }
    if (key.length === 1 && !ctrl && !e.altKey){ this.cmd += key; this.render(ctx); return; }
    return;
  }

  if (this.mode === "INSERT"){
    if (key === "Escape"){ this.mode="NORMAL"; this.message=""; this.render(ctx); return; }
    if (key === "Enter"){
      var line2 = this.lines[this.cy] || "";
      var before = line2.slice(0,this.cx);
      var after  = line2.slice(this.cx);
      this.lines[this.cy] = before;
      this.lines.splice(this.cy+1, 0, after);
      this.cy++; this.cx=0;
      this.modified = true;
      this.render(ctx);
      return;
    }
    if (key === "Backspace"){
      if (this.cx > 0){
        var ln = this.lines[this.cy] || "";
        this.lines[this.cy] = ln.slice(0,this.cx-1) + ln.slice(this.cx);
        this.cx--;
      } else if (this.cy > 0){
        var prev = this.lines[this.cy-1] || "";
        var cur = this.lines[this.cy] || "";
        this.cx = prev.length;
        this.lines[this.cy-1] = prev + cur;
        this.lines.splice(this.cy,1);
        this.cy--;
      }
      this.modified = true;
      this.render(ctx);
      return;
    }
    if (key === "Tab"){ this._insertText("  "); this.render(ctx); return; }
    if (key === "ArrowLeft"){ this.cx--; this._clamp(); this.render(ctx); return; }
    if (key === "ArrowRight"){ this.cx++; this._clamp(); this.render(ctx); return; }
    if (key === "ArrowUp"){ this.cy--; this._clamp(); this.render(ctx); return; }
    if (key === "ArrowDown"){ this.cy++; this._clamp(); this.render(ctx); return; }
    if (key.length === 1 && !ctrl && !e.altKey){
      this._insertText(key);
      this.render(ctx);
    }
    return;
  }

  // NORMAL
  if (key === ":"){ this.mode="CMD"; this.cmd=""; this.message=""; this.render(ctx); return; }
  if (key === "i"){ this.mode="INSERT"; this.message=""; this.render(ctx); return; }
  if (key === "h" || key==="ArrowLeft"){ this.cx--; this._clamp(); this.render(ctx); return; }
  if (key === "l" || key==="ArrowRight"){ this.cx++; this._clamp(); this.render(ctx); return; }
  if (key === "k" || key==="ArrowUp"){ this.cy--; this._clamp(); this.render(ctx); return; }
  if (key === "j" || key==="ArrowDown"){ this.cy++; this._clamp(); this.render(ctx); return; }
  if (key === "0"){ this.cx = 0; this.render(ctx); return; }
  if (key === "$"){ this.cx = (this.lines[this.cy]||"").length; this.render(ctx); return; }
};
