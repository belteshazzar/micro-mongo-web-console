import { ScreenBuffer, sgrReset, sgrClone, sameAttr, cloneRowCells } from './screenbuffer.js';

export const ESC = "\x1b";

function escapeHtml(s){
  return s.replace(/[&<>"]/g, function(ch){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]);
  });
}

// Terminal (main scrollback only) + resize callbacks + cursor blink
function Terminal(mount){
  this.mount = mount;
  this.cols = 80;
  this.rows = 24;

  this.main = new ScreenBuffer(this.cols, this.rows);
  this.alt  = new ScreenBuffer(this.cols, this.rows);
  this.useAlt = false;

  this.maxScrollback = 3000;
  this.mainScrollback = [];
  this.mainViewOffset = 0;

  this._savedMainState = null;

  this.renderScheduled = false;

  this.activeApp = null;

  this.cursorBlink = true;
  this.cursorPhase = true;
  this._blinkTimer = null;

  this._resizeHandlers = [];

  this.resizeToFit();
  this.render();
  this.startCursorBlink();
}

Terminal.prototype.buf = function(){ return this.useAlt ? this.alt : this.main; };

Terminal.prototype.getSize = function(){ return { cols:this.cols, rows:this.rows }; };

Terminal.prototype.onResize = function(cb){
  if (typeof cb !== "function") return function(){};
  this._resizeHandlers.push(cb);
  cb({ cols:this.cols, rows:this.rows, prevCols:this.cols, prevRows:this.rows });
  var self = this;
  return function(){ self.offResize(cb); };
};

Terminal.prototype.offResize = function(cb){
  var i = this._resizeHandlers.indexOf(cb);
  if (i >= 0) this._resizeHandlers.splice(i,1);
};

// FIXED: actually call handlers
Terminal.prototype._emitResize = function(prevCols, prevRows) {
  var payload = { cols:this.cols, rows:this.rows, prevCols:prevCols, prevRows:prevRows };
  console.log("Emitting terminal resize event:", payload);
  for (var i=0;i<this._resizeHandlers.length;i++){
    try {
      this._resizeHandlers[i](payload);
    } catch (e) {
      console.error("Error in terminal resize handler:", e);
    }
  }
};

Terminal.prototype._saveMainState = function(){
  var b = this.main;
  this._savedMainState = {
    cx:b.cx, cy:b.cy,
    saved:{cx:b.saved.cx, cy:b.saved.cy},
    attr:sgrClone(b.attr),
    cursorVisible:b.cursorVisible,
    scrollTop:b.scrollTop,
    scrollBottom:b.scrollBottom,
    viewOffset:this.mainViewOffset
  };
};

Terminal.prototype._restoreMainState = function(){
  if (!this._savedMainState) return;
  var s = this._savedMainState;
  var b = this.main;

  b.cx = s.cx; b.cy = s.cy;
  b.saved = {cx:s.saved.cx, cy:s.saved.cy};
  b.attr = sgrClone(s.attr);
  b.cursorVisible = s.cursorVisible;
  b.scrollTop = s.scrollTop;
  b.scrollBottom = s.scrollBottom;
  b.wrapPending = false;

  var total = this.mainScrollback.length + this.main.rows;
  var maxOffset = Math.max(0, total - this.rows);
  this.mainViewOffset = Math.max(0, Math.min(maxOffset, s.viewOffset|0));

  this._savedMainState = null;
};

Terminal.prototype.enterAltScreenNow = function(){
  if (this.useAlt) return;
  this._saveMainState();
  this.useAlt = true;
  this.mainViewOffset = 0;
  this.alt.reset();
  this.scheduleRender();
};

Terminal.prototype.leaveAltScreenNow = function(){
  if (!this.useAlt) return;
  this.useAlt = false;
  this._restoreMainState();
  this.scheduleRender();
};

Terminal.prototype._pushScrollbackRow = function(rowCells){
  this.mainScrollback.push(cloneRowCells(rowCells));
  if (this.mainScrollback.length > this.maxScrollback){
    this.mainScrollback.shift();
    if (this.mainViewOffset > 0) this.mainViewOffset = Math.max(0, this.mainViewOffset - 1);
  }
};

Terminal.prototype._parseCSI = function(str, startIdx){
  var i = startIdx;
  var priv = false;
  if (i < str.length && str[i] === "?"){ priv = true; i++; }
  var buf = "";
  while (i < str.length){
    var cc = str[i];
    if (cc >= "@" && cc <= "~"){
      var final = cc;
      var params = buf.length ? buf.split(";").map(function(x){ return x==="" ? 0 : parseInt(x,10); }) : [];
      return {cmd:final, params:params, priv:priv, next:i+1};
    }
    buf += cc;
    i++;
  }
  return null;
};

Terminal.prototype._applyCSI = function(cmd, params, priv){
  var b = this.buf();
  var p0 = (params && params.length) ? (params[0]|0) : 0;

  if (priv){
    if (cmd === "h" || cmd === "l"){
      var enable = (cmd === "h");
      if (p0 === 25){ b.cursorVisible = enable; return; }
      if (p0 === 1049 || p0 === 1047 || p0 === 47){
        if (enable){
          if (!this.useAlt) this._saveMainState();
          this.useAlt = true;
          this.mainViewOffset = 0;
          if (p0 === 1049) this.alt.reset();
        } else {
          this.useAlt = false;
          this._restoreMainState();
        }
        return;
      }
    }
    return;
  }

  function pn(i, def){
    return (params && params.length > i && params[i] != null) ? (params[i]|0) : def;
  }

  switch (cmd){
    case "A": b.moveCursor(b.cy - ((p0||1)|0), b.cx); break;
    case "B": b.moveCursor(b.cy + ((p0||1)|0), b.cx); break;
    case "C": b.moveCursor(b.cy, b.cx + ((p0||1)|0)); break;
    case "D": b.moveCursor(b.cy, b.cx - ((p0||1)|0)); break;

    case "H":
    case "f":{
      b.moveCursor(pn(0,1)-1, pn(1,1)-1);
      break;
    }

    case "J": b.eraseInDisplay(p0||0); break;
    case "K": b.eraseInLine(p0||0); break;
    case "m": b.setSGR(params); break;

    case "s": b.saved = {cx:b.cx, cy:b.cy}; b.wrapPending=false; break;
    case "u": b.moveCursor(b.saved.cy, b.saved.cx); b.wrapPending=false; break;

    case "r":{
      if (!params || params.length === 0) b.setScrollRegion(null, null);
      else b.setScrollRegion(pn(0,1)-1, pn(1,b.rows)-1);
      break;
    }

    case "S":{
      var nS = (p0||1)|0;
      if (!this.useAlt && b === this.main && b.scrollTop===0 && b.scrollBottom===b.rows-1){
        for (var i=0;i<nS;i++){
          b.scrollUpRegion(1, this._pushScrollbackRow.bind(this));
        }
      } else {
        b.scrollUpRegion(nS, null);
      }
      break;
    }

    case "T": b.scrollDownRegion((p0||1)|0); break;

    case "L": b.insertLines((p0||1)|0); break;
    case "M": b.deleteLines((p0||1)|0); break;

    case "@": b.insertChars((p0||1)|0); break;
    case "P": b.deleteChars((p0||1)|0); break;
    case "X": b.eraseChars((p0||1)|0); break;
  }
};

Terminal.prototype.write = function(data){
  var i=0;
  while (i < data.length){
    var ch = data[i];

    if (ch === ESC){
      if (data[i+1] === "["){
        var res = this._parseCSI(data, i+2);
        if (!res) break;
        i = res.next;
        this._applyCSI(res.cmd, res.params, res.priv);
        continue;
      }
      i++;
      continue;
    }

    if (this.useAlt){
      this.alt.putChar(ch, null);
    } else {
      var self = this;
      var canScrollback = (this.main.scrollTop===0 && this.main.scrollBottom===this.main.rows-1);
      this.main.putChar(ch, canScrollback ? function(rowOut){ self._pushScrollbackRow(rowOut); } : null);
    }
    i++;
  }
  this.scheduleRender();
};

Terminal.prototype.scheduleRender = function(){
  var self = this;
  if (this.renderScheduled) return;
  this.renderScheduled = true;
  requestAnimationFrame(function(){
    self.renderScheduled = false;
    self.render();
  });
};

Terminal.prototype.startCursorBlink = function(){
  var self = this;
  if (this._blinkTimer) return;
  this._blinkTimer = setInterval(function(){
    if (!self.cursorBlink) return;
    var b = self.buf();
    if (!b.cursorVisible) return;
    self.cursorPhase = !self.cursorPhase;
    self.scheduleRender();
  }, 530);
};

// SMART, CONTENT-PRESERVING RESIZE
Terminal.prototype.resizeToFit = function(){
  // Measure monospace cell with current font
  var probe = document.createElement("span");
  probe.textContent = "M";
  probe.style.visibility = "hidden";
  probe.style.position = "absolute";
  probe.style.whiteSpace = "pre";
  probe.style.font = getComputedStyle(this.mount).font;
  document.body.appendChild(probe);
  var rect = probe.getBoundingClientRect();
  probe.remove();

  var chW = rect.width  || 8;
  var chH = rect.height || 16;

  var mountRect = this.mount.getBoundingClientRect();
  var cols = Math.max(20, Math.floor(mountRect.width  / chW));
  var rows = Math.max(8,  Math.floor(mountRect.height / chH));

  if (cols !== this.cols || rows !== this.rows){
    var prevCols = this.cols;
    var prevRows = this.rows;

    this.cols = cols; this.rows = rows;

    var canPushMainRows = (!this.useAlt &&
                            this.main.scrollTop === 0 &&
                            this.main.scrollBottom === this.main.rows - 1);

    var self = this;

    // preserve content; push bottom rows to scrollback only on main/fullscreen
    this.main.resizeSmart(
      cols,
      rows,
      canPushMainRows ? function(outgoingRow){ self._pushScrollbackRow(outgoingRow); } : null
    );

    // Alt buffer: preserve columns, ignore scrollback (apps redraw)
    this.alt.resizeSmart(cols, rows, null);

    if (this.activeApp && typeof this.activeApp.onResize === "function"){
      try {
        this.activeApp.onResize({cols:cols, rows:rows, prevCols:prevCols, prevRows:prevRows});
      } catch (e) {
        console.error("Error in activeApp.onResize handler:", e);
      }
    }

    this._emitResize(prevCols, prevRows);
    this.scheduleRender();
  }
};

Terminal.prototype._getMainViewportRows = function(){
  var total = this.mainScrollback.length + this.main.rows;
  var offset = this.mainViewOffset;
  offset = Math.max(0, Math.min(offset, Math.max(0, total - this.rows)));

  var end = total - offset;
  var start = end - this.rows;
  if (start < 0) start = 0;

  var out = [];
  for (var i=start;i<end;i++){
    if (i < this.mainScrollback.length) out.push(this.mainScrollback[i]);
    else out.push(this.main.cells[i - this.mainScrollback.length]);
  }

  while (out.length < this.rows){
    out.unshift(this.main.blankRow());
  }
  if (out.length > this.rows) out = out.slice(out.length - this.rows);
  return out;
};

Terminal.prototype.render = function(){
  var b = this.buf();
  var visibleRows;
  var showCursor = true;
  var cursorRow = b.cy;
  var cursorCol = b.cx;

  if (this.useAlt){
    visibleRows = this.alt.cells;
  } else {
    visibleRows = this._getMainViewportRows();
    if (this.mainViewOffset > 0) showCursor = false;

    var globalCursorIndex = this.mainScrollback.length + this.main.cy;
    var total = this.mainScrollback.length + this.main.rows;
    var offset = Math.max(0, Math.min(this.mainViewOffset, Math.max(0, total - this.rows)));
    var end = total - offset;
    var start = Math.max(0, end - this.rows);

    cursorRow = globalCursorIndex - start;
    cursorCol = this.main.cx;
  }

  var rowsHtml = [];
  for (var r=0;r<this.rows;r++){
    var row = visibleRows[r] || b.blankRow();
    var html = "";
    var runAttr = null;
    var runText = "";

    function flush(){
      if (!runText) return;
      var a = runAttr || sgrReset();
      var fg = a.fg, bg = a.bg;
      if (a.inv){ var t = fg; fg = bg; bg = t; }
      var styles = [];
      if (fg) styles.push("color:"+fg);
      if (bg) styles.push("background:"+bg);
      if (a.bold) styles.push("font-weight:700");
      if (a.ul) styles.push("text-decoration:underline");
      var styleAttr = styles.length ? (' style="'+styles.join(";")+'"') : "";
      html += "<span"+styleAttr+">"+escapeHtml(runText)+"</span>";
      runText = "";
    }

    for (var c=0;c<this.cols;c++){
      var cell = row[c] || {ch:" ", attr:sgrReset()};
      var ch = cell.ch;
      var a2 = cell.attr;

      var isCursorCell = showCursor && b.cursorVisible &&
                          (r === cursorRow) && (c === cursorCol);

      if (isCursorCell){
        flush();

        var a = a2;
        var fg = a.fg, bg = a.bg;
        if (a.inv){ var tmp = fg; fg = bg; bg = tmp; }

        var styles2 = [];
        if (fg) styles2.push("color:"+fg);
        if (bg) styles2.push("background:"+bg);
        if (a.bold) styles2.push("font-weight:700");
        if (a.ul) styles2.push("text-decoration:underline");
        var styleAttr2 = styles2.length ? (' style="'+styles2.join(";")+'"') : "";

        var cls = (this.cursorBlink && this.cursorPhase) ? ' class="cursorbar"' : "";
        html += "<span"+cls+styleAttr2+">"+escapeHtml(ch)+"</span>";

        runAttr = null;
        runText = "";
        continue;
      }

      if (!runAttr || !sameAttr(runAttr, a2)){
        flush();
        runAttr = a2;
      }
      runText += ch;
    }

    flush();
    rowsHtml.push('<div class="row">'+html+'</div>');
  }

  this.mount.innerHTML = rowsHtml.join("");
};

Terminal.prototype.scrollbackScroll = function(deltaLines){
  if (this.useAlt) return;
  var total = this.mainScrollback.length + this.main.rows;
  var maxOffset = Math.max(0, total - this.rows);
  this.mainViewOffset = Math.max(0, Math.min(maxOffset, this.mainViewOffset + (deltaLines|0)));
  this.scheduleRender();
};

Terminal.prototype.scrollbackToBottom = function(){
  if (this.useAlt) return;
  this.mainViewOffset = 0;
  this.scheduleRender();
};

export { Terminal };
