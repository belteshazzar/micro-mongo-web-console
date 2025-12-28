// LessApp: pager/viewer for text files with search, navigation

function padRight(s, n){
  s = String(s||"");
  if (s.length >= n) return s.slice(0,n);
  return s + new Array(n - s.length + 1).join(" ");
}

function LessApp(title, text){
  this.title = title || "less";
  this.lines = String(text||"").replace(/\r\n/g,"\n").split("\n");
  if (!this.lines.length) this.lines = [""];
  this.top = 0;
  this.searchMode = false;
  this.searchText = "";
  this.lastSearch = "";
  this.statusMsg = "";
  this._ctx = null;
}

LessApp.prototype.onStart = function(ctx){
  this._ctx = ctx;
  ctx.term.enterAltScreenNow();
  ctx.ansi(ctx.ANSI.altScreenOn() + ctx.ANSI.showCursor());
  this.render(ctx);
};

LessApp.prototype.onResize = function(size, ctx){
  ctx = ctx || this._ctx;
  if (!ctx) return;
  this.render(ctx);
};

LessApp.prototype.onExit = function(ctx){
  ctx.term.leaveAltScreenNow();
  ctx.ansi(ctx.ANSI.altScreenOff() + ctx.ANSI.showCursor());
};

LessApp.prototype._clampTop = function(rows){
  var viewRows = rows - 1; // last row status/prompt
  var maxTop = Math.max(0, this.lines.length - viewRows);
  this.top = Math.max(0, Math.min(maxTop, this.top));
};

LessApp.prototype._findNext = function(query, fromLine){
  if (!query) return -1;
  query = query.toLowerCase();
  for (var i=fromLine;i<this.lines.length;i++){
    if ((this.lines[i]||"").toLowerCase().indexOf(query) !== -1) return i;
  }
  return -1;
};

LessApp.prototype._findPrev = function(query, fromLine){
  if (!query) return -1;
  query = query.toLowerCase();
  for (var i=fromLine;i>=0;i--){
    if ((this.lines[i]||"").toLowerCase().indexOf(query) !== -1) return i;
  }
  return -1;
};

LessApp.prototype.render = function(ctx){
  var cols = ctx.term.cols;
  var rows = ctx.term.rows;
  var viewRows = rows - 1;

  this._clampTop(rows);

  ctx.ansi(ctx.ANSI.clear() + ctx.ANSI.home());

  for (var r=0;r<viewRows;r++){
    var idx = this.top + r;
    var line = (idx < this.lines.length) ? this.lines[idx] : "";
    if (line.length > cols) line = line.slice(0, cols);
    ctx.ansi(ctx.ANSI.moveTo(r+1,1) + ctx.ANSI.reset());
    ctx.ansi(padRight(line, cols));
  }

  // status line (now shows transient statusMsg)
  var percent = (this.lines.length <= 1) ? 100 : Math.round((Math.min(this.lines.length-1, this.top) / (this.lines.length-1)) * 100);
  var left = this.searchMode ? ("/" + this.searchText) : (this.statusMsg ? this.statusMsg : this.title);
  var right = (this.top + viewRows >= this.lines.length) ? "(END)" : (percent + "%");
  var status = left;
  if (status.length + right.length + 1 > cols){
    status = status.slice(0, Math.max(0, cols - right.length - 2)) + "..";
  }
  status = status + new Array(Math.max(1, cols - status.length - right.length) + 1).join(" ") + right;
  status = status.slice(0, cols);

  ctx.ansi(ctx.ANSI.moveTo(rows,1) + ctx.ANSI.inverse());
  ctx.ansi(padRight(status, cols));
  ctx.ansi(ctx.ANSI.reset());

  if (this.searchMode){
    var caretCol = Math.min(cols, 1 + this.searchText.length + 1);
    ctx.ansi(ctx.ANSI.moveTo(rows, caretCol));
  } else {
    ctx.ansi(ctx.ANSI.moveTo(rows, cols));
  }
};

LessApp.prototype.onKey = function(e, ctx){
  var key = e.key;
  var rows = ctx.term.rows;

  if (this.searchMode){
    if (key === "Escape"){
      this.searchMode = false;
      this.searchText = "";
      this.render(ctx);
      return;
    }
    if (key === "Enter"){
      this.searchMode = false;
      this.lastSearch = this.searchText;
      var start = Math.min(this.lines.length-1, this.top + 1);
      var found = this._findNext(this.lastSearch, start);
      if (found >= 0){
        this.top = found;
      } else {
        this.statusMsg = "Pattern not found";
      }
      this.searchText = "";
      this.render(ctx);
      return;
    }
    if (key === "Backspace"){
      this.searchText = this.searchText.slice(0, -1);
      this.render(ctx);
      return;
    }
    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
      this.searchText += key;
      this.render(ctx);
      return;
    }
    return;
  }

  if (key === "q" || key === "Q"){
    ctx.exit();
    return;
  }
  if (key === "/" ){
    this.searchMode = true;
    this.searchText = "";
    this.render(ctx);
    return;
  }
  if (key === "n" || key === "N"){
    if (!this.lastSearch) return;
    var startN = (key === "n") ? Math.min(this.lines.length-1, this.top + 1) : Math.max(0, this.top - 1);
    var foundN = (key === "n") ? this._findNext(this.lastSearch, startN) : this._findPrev(this.lastSearch, startN);
    if (foundN >= 0) this.top = foundN;
    this.render(ctx);
    return;
  }

  var viewRows = rows - 1;

  if (key === "ArrowDown" || key === "j"){ this.top += 1; this.render(ctx); return; }
  if (key === "ArrowUp" || key === "k"){ this.top -= 1; this.render(ctx); return; }

  if (key === "PageDown" || key === " "){ this.top += viewRows; this.render(ctx); return; }
  if (key === "PageUp" || key === "b"){ this.top -= viewRows; this.render(ctx); return; }

  if (key === "g"){ this.top = 0; this.render(ctx); return; }
  if (key === "G"){ this.top = 999999; this.render(ctx); return; }
};

export { LessApp };
