// ScreenBuffer with content-preserving smart resize

function sgrReset(){ return {fg:null,bg:null,bold:false,ul:false,inv:false}; }
function sgrClone(a){ return {fg:a.fg,bg:a.bg,bold:a.bold,ul:a.ul,inv:a.inv}; }
function sameAttr(a,b){
  return a.fg===b.fg && a.bg===b.bg && a.bold===b.bold && a.ul===b.ul && a.inv===b.inv;
}

var PALETTE = {
  30:"#000000",31:"#ff7b72",32:"#7ee787",33:"#f2cc60",34:"#79c0ff",35:"#d2a8ff",36:"#7bdff2",37:"#d7e0ea",
  90:"#6e7681",91:"#ffaba8",92:"#aff5b4",93:"#f8e3a1",94:"#a5d6ff",95:"#e2c5ff",96:"#b3f0ff",97:"#ffffff",
  40:"#000000",41:"#5a1a1a",42:"#173b23",43:"#3a2f14",44:"#132a4a",45:"#2a1644",46:"#0f3a44",47:"#2b323b",
  100:"#2b2f36",101:"#7a2f2f",102:"#2e6b3e",103:"#6b5a2e",104:"#2b4f78",105:"#5a3a86",106:"#2f7280",107:"#d7e0ea"
};

function cloneRowCells(row){
  var out = new Array(row.length);
  for (var i=0;i<row.length;i++){
    out[i] = { ch: row[i].ch, attr: sgrClone(row[i].attr) };
  }
  return out;
}

function ScreenBuffer(cols, rows){
  this.cols = cols;
  this.rows = rows;

  this.cells = [];
  this.cx = 0;
  this.cy = 0;
  this.saved = {cx:0, cy:0};
  this.attr = sgrReset();
  this.cursorVisible = true;

  this.scrollTop = 0;
  this.scrollBottom = rows - 1;

  // delayed wrap
  this.wrapPending = false;

  // per-row overflow store to preserve right-side cells on shrink
  this._rowOverflow = [];

  this.reset();
}

ScreenBuffer.prototype.blankRow = function(){
  var a = sgrReset();
  var row = new Array(this.cols);
  for (var i=0;i<this.cols;i++){
    row[i] = { ch:" ", attr:sgrClone(a) };
  }
  return row;
};

ScreenBuffer.prototype.reset = function(){
  this.cells = new Array(this.rows);
  for (var r=0;r<this.rows;r++){
    this.cells[r] = this.blankRow();
  }
  this.cx = 0; this.cy = 0;
  this.saved = {cx:0, cy:0};
  this.attr = sgrReset();
  this.cursorVisible = true;
  this.scrollTop = 0;
  this.scrollBottom = this.rows - 1;
  this.wrapPending = false;

  // reset overflow rows to match current height
  this._rowOverflow = new Array(this.rows);
  for (var i=0;i<this.rows;i++) this._rowOverflow[i] = [];
};

// legacy resize (kept for completeness; not used by Terminal anymore)
ScreenBuffer.prototype.resize = function(cols, rows){
  var oldCells = this.cells;
  var oldRows = this.rows;
  var oldCols = this.cols;

  this.cols = cols;
  this.rows = rows;

  this.cells = new Array(rows);
  for (var r=0;r<rows;r++){
    var row = new Array(cols);
    for (var c=0;c<cols;c++){
      if (r < oldRows && c < oldCols) row[c] = oldCells[r][c];
      else row[c] = { ch:" ", attr:sgrClone(sgrReset()) };
    }
    this.cells[r] = row;
  }

  this.cx = Math.min(this.cx, cols-1);
  this.cy = Math.min(this.cy, rows-1);

  this.scrollTop = Math.max(0, Math.min(this.scrollTop, rows-1));
  this.scrollBottom = Math.max(0, Math.min(this.scrollBottom, rows-1));
  if (this.scrollBottom < this.scrollTop){
    this.scrollTop = 0;
    this.scrollBottom = rows - 1;
  }
  this.wrapPending = false;

  // keep overflow arrays consistent
  this._ensureOverflowRows = this._ensureOverflowRows || function(rows){
    if (!this._rowOverflow) this._rowOverflow = [];
    var old = this._rowOverflow.length|0;
    if (old < rows){
      for (var i=old;i<rows;i++) this._rowOverflow[i] = [];
    } else if (old > rows){
      this._rowOverflow.length = rows;
    }
  };
  this._ensureOverflowRows(this.rows);
};

// helper for smart resize
ScreenBuffer.prototype._ensureOverflowRows = function(rows){
  if (!this._rowOverflow) this._rowOverflow = [];
  var old = this._rowOverflow.length|0;
  if (old < rows){
    for (var i=old;i<rows;i++) this._rowOverflow[i] = [];
  } else if (old > rows){
    this._rowOverflow.length = rows;
  }
};

// Content-preserving resize: keeps right-side cells in overflow, restores on grow, emits scrollback on shrink.
ScreenBuffer.prototype.resizeSmart = function(cols, rows, pushScrollbackRow){
  var oldRows = this.rows|0;
  var oldCols = this.cols|0;

  var newCells = new Array(rows);
  this._ensureOverflowRows(Math.max(oldRows, rows));

  // If rows decrease, send truncated bottom rows to scrollback
  if (rows < oldRows && typeof pushScrollbackRow === "function"){
    for (var r = rows; r < oldRows; r++){
      var outgoing = cloneRowCells(this.cells[r]);
      var over = this._rowOverflow[r] || [];
      if (over.length){
        for (var k=0;k<over.length;k++){
          outgoing.push({ch:over[k].ch, attr:sgrClone(over[k].attr)});
        }
      }
      try { pushScrollbackRow(outgoing); } catch(e){}
    }
  }

  for (var r2=0; r2<rows; r2++){
    var srcRow = (r2 < oldRows) ? this.cells[r2] : null;
    var srcOverflow = (r2 < this._rowOverflow.length) ? (this._rowOverflow[r2] || []) : [];
    var row = new Array(cols);

    if (srcRow){
      if (cols <= oldCols){
        // shrink: keep visible; stash the rest
        for (var c=0; c<cols; c++){
          row[c] = srcRow[c];
        }
        var lost = srcRow.slice(cols);
        this._rowOverflow[r2] = lost.concat(srcOverflow);
      } else {
        // grow: copy existing, then restore from overflow
        var c2=0;
        for (; c2<oldCols && c2<cols; c2++){
          row[c2] = srcRow[c2];
        }
        while (c2 < cols && srcOverflow.length){
          row[c2++] = srcOverflow.shift();
        }
        while (c2 < cols){
          row[c2++] = { ch:" ", attr:sgrClone(sgrReset()) };
        }
        this._rowOverflow[r2] = srcOverflow;
      }
    } else {
      // new row (rows grew)
      var c3=0;
      while (c3 < cols && srcOverflow.length){
        row[c3++] = srcOverflow.shift();
      }
      while (c3 < cols){
        row[c3++] = { ch:" ", attr:sgrClone(sgrReset()) };
      }
      this._rowOverflow[r2] = srcOverflow;
    }

    newCells[r2] = row;
  }

  this.cells = newCells;
  this.cols  = cols;
  this.rows  = rows;

  this.cx = Math.min(this.cx, Math.max(0, this.cols-1));
  this.cy = Math.min(this.cy, Math.max(0, this.rows-1));

  this.scrollTop    = Math.max(0, Math.min(this.scrollTop, this.rows-1));
  this.scrollBottom = Math.max(0, Math.min(this.scrollBottom, this.rows-1));
  if (this.scrollBottom < this.scrollTop){
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;
  }

  this._ensureOverflowRows(this.rows);
  this.wrapPending = false;
};

ScreenBuffer.prototype.setScrollRegion = function(top, bottom){
  if (top == null || bottom == null){
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;
    this.wrapPending = false;
    return;
  }
  top = Math.max(0, Math.min(this.rows-1, top|0));
  bottom = Math.max(0, Math.min(this.rows-1, bottom|0));
  if (bottom < top){
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;
  } else {
    this.scrollTop = top;
    this.scrollBottom = bottom;
  }
  this.wrapPending = false;
};

ScreenBuffer.prototype.moveCursor = function(row, col){
  this.cy = Math.max(0, Math.min(this.rows-1, row|0));
  this.cx = Math.max(0, Math.min(this.cols-1, col|0));
  this.wrapPending = false;
};

ScreenBuffer.prototype.scrollUpRegion = function(n, onRowOut){
  n = (n || 1)|0;
  for (var i=0;i<n;i++){
    var out = this.cells[this.scrollTop];
    for (var r=this.scrollTop; r<this.scrollBottom; r++){
      this.cells[r] = this.cells[r+1];
    }
    this.cells[this.scrollBottom] = this.blankRow();
    if (onRowOut) onRowOut(out);
  }
  this.wrapPending = false;
};

ScreenBuffer.prototype.scrollDownRegion = function(n){
  n = (n || 1)|0;
  for (var i=0;i<n;i++){
    for (var r=this.scrollBottom; r>this.scrollTop; r--){
      this.cells[r] = this.cells[r-1];
    }
    this.cells[this.scrollTop] = this.blankRow();
  }
  this.wrapPending = false;
};

ScreenBuffer.prototype._lineFeed = function(onRowOut){
  if (this.cy === this.scrollBottom){
    this.scrollUpRegion(1, onRowOut);
  } else {
    this.cy++;
    if (this.cy >= this.rows) this.cy = this.rows-1;
  }
};

ScreenBuffer.prototype.putChar = function(ch, onRowOut){
  if (ch === "\n"){
    this.wrapPending = false;
    this.cx = 0;
    this._lineFeed(onRowOut);
    return;
  }
  if (ch === "\r"){
    this.wrapPending = false;
    this.cx = 0;
    return;
  }
  if (ch === "\b"){
    this.wrapPending = false;
    this.cx = Math.max(0, this.cx-1);
    return;
  }

  if (this.wrapPending){
    this.wrapPending = false;
    this.cx = 0;
    this._lineFeed(onRowOut);
  }

  var cell = this.cells[this.cy][this.cx];
  cell.ch = ch;
  cell.attr = sgrClone(this.attr);

  if (this.cx === this.cols - 1){
    this.wrapPending = true;
    return;
  }
  this.cx++;
};

ScreenBuffer.prototype.eraseInDisplay = function(mode){
  mode = (mode || 0)|0;
  this.wrapPending = false;

  if (mode === 2){
    this.reset();
    return;
  }

  if (mode === 0){
    for (var r=this.cy; r<this.rows; r++){
      var start = (r === this.cy) ? this.cx : 0;
      for (var c=start; c<this.cols; c++){
        this.cells[r][c] = { ch:" ", attr:sgrClone(sgrReset()) };
      }
    }
  } else if (mode === 1){
    for (var rr=0; rr<=this.cy; rr++){
      var end = (rr === this.cy) ? this.cx : (this.cols-1);
      for (var cc=0; cc<=end; cc++){
        this.cells[rr][cc] = { ch:" ", attr:sgrClone(sgrReset()) };
      }
    }
  }
};

ScreenBuffer.prototype.eraseInLine = function(mode){
  mode = (mode || 0)|0;
  this.wrapPending = false;
  var row = this.cells[this.cy];

  if (mode === 2){
    for (var c=0;c<this.cols;c++) row[c] = { ch:" ", attr:sgrClone(sgrReset()) };
  } else if (mode === 0){
    for (var c0=this.cx;c0<this.cols;c0++) row[c0] = { ch:" ", attr:sgrClone(sgrReset()) };
  } else if (mode === 1){
    for (var c1=0;c1<=this.cx;c1++) row[c1] = { ch:" ", attr:sgrClone(sgrReset()) };
  }
};

ScreenBuffer.prototype.setSGR = function(params){
  if (!params || !params.length) params = [0];
  for (var i=0;i<params.length;i++){
    var p = params[i]|0;
    if (p === 0) this.attr = sgrReset();
    else if (p === 1) this.attr.bold = true;
    else if (p === 4) this.attr.ul = true;
    else if (p === 7) this.attr.inv = true;
    else if ((p>=30 && p<=37) || (p>=90 && p<=97)) this.attr.fg = PALETTE[p] || null;
    else if ((p>=40 && p<=47) || (p>=100 && p<=107)) this.attr.bg = PALETTE[p] || null;
  }
};

ScreenBuffer.prototype.insertChars = function(n){
  this.wrapPending = false;
  n = (n || 1)|0;
  n = Math.max(0, Math.min(this.cols - this.cx, n));
  if (n <= 0) return;

  var row = this.cells[this.cy];
  for (var c=this.cols-1; c>=this.cx+n; c--){
    row[c] = row[c-n];
  }
  for (var i=0;i<n;i++){
    row[this.cx+i] = { ch:" ", attr:sgrClone(this.attr) };
  }
};

ScreenBuffer.prototype.deleteChars = function(n){
  this.wrapPending = false;
  n = (n || 1)|0;
  n = Math.max(0, Math.min(this.cols - this.cx, n));
  if (n <= 0) return;

  var row = this.cells[this.cy];
  for (var c=this.cx; c<this.cols-n; c++){
    row[c] = row[c+n];
  }
  for (var i=0;i<n;i++){
    row[this.cols-1-i] = { ch:" ", attr:sgrClone(sgrReset()) };
  }
};

ScreenBuffer.prototype.eraseChars = function(n){
  this.wrapPending = false;
  n = (n || 1)|0;
  n = Math.max(0, Math.min(this.cols - this.cx, n));
  if (n <= 0) return;

  var row = this.cells[this.cy];
  for (var i=0;i<n;i++){
    row[this.cx+i] = { ch:" ", attr:sgrClone(sgrReset()) };
  }
};

ScreenBuffer.prototype.insertLines = function(n){
  this.wrapPending = false;
  n = (n || 1)|0;
  if (n <= 0) return;

  var top = Math.max(this.scrollTop, Math.min(this.scrollBottom, this.cy));
  for (var k=0;k<n;k++){
    for (var r=this.scrollBottom; r>top; r--){
      this.cells[r] = this.cells[r-1];
    }
    this.cells[top] = this.blankRow();
  }
};

ScreenBuffer.prototype.deleteLines = function(n){
  this.wrapPending = false;
  n = (n || 1)|0;
  if (n <= 0) return;

  var top = Math.max(this.scrollTop, Math.min(this.scrollBottom, this.cy));
  for (var k=0;k<n;k++){
    for (var r=top; r<this.scrollBottom; r++){
      this.cells[r] = this.cells[r+1];
    }
    this.cells[this.scrollBottom] = this.blankRow();
  }
};

export { ScreenBuffer, sgrReset, sgrClone, sameAttr, cloneRowCells };
