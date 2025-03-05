
import sliceAnsi from 'slice-ansi';
import stripAnsi from 'strip-ansi';

// TODO: remove stripAnsi calls for length

export class TermDocument {

  constructor(term, {
      top=1, 
      left=1, 
      height=10, 
      width=20, 
      lines=[], 
      drawFrame=true,
      wrap=false }) {

    this.term = term;

    this.doc = {
      lines: lines,
      rows: [],
      maxRowLength: 0,
      pos: {
        line: 0,
        char: 0
      }
    }

    this.drawFrame = drawFrame
    this.wrap = wrap

    this.display = {
      top: top,
      left: left,
      height: height,
      width: width,
      scroll: {
        charAtLeft: 0,
        rowAtTop: 0,
        x: (this.drawFrame?1:0),
        y: (this.drawFrame?1:0),
      },
      cursor: {
        x: (this.drawFrame?1:0),
        y: (this.drawFrame?1:0)
      }
    }

    this._initTermEvents()


    this._setRowsFromLines()
    this.draw()
  }

  docUpdated() {
  }

  _initTermEvents() {

    // term.onSelectionChange(() => {
    //   console.log('onSelectionChange', term.getSelection());
    // });

    this.term.attachCustomWheelEventHandler(ev => {
      if (ev.deltaY < 0) {
        this.display.scroll.rowAtTop = Math.max(0,this.display.scroll.rowAtTop - 1)
      } else if (ev.deltaY > 0) {
        this.display.scroll.rowAtTop = Math.min(this.doc.rows.length - 1 - this.display.height + (this.drawFrame?2:1), this.display.scroll.rowAtTop + 1);
      }
      this._updateCursorXY()
      this._updateScrollY()
      this.draw()
      ev.preventDefault()
      return false;
    });
    
    this.term.onScroll((e) => { 
      console.log(e)
      return false;
    });
    
    this.term.attachCustomKeyEventHandler((key) => {

      if (key.type != 'keydown') return false
        
      // allows copy/paste to work
      if (key.ctrlKey || key.metaKey || key.altKey) {
      } else if (key.code == 'ArrowLeft') {
        this.keyLeft()
        key.preventDefault()
      } else if (key.code == 'ArrowRight') {
        this.keyRight()
        key.preventDefault()
      } else if (key.code == 'ArrowUp') {
        this.keyUp()
      } else if (key.code == 'ArrowDown') {
        this.keyDown();
      } else if (key.code == 'Tab') {
        key.preventDefault()
        if (key.shiftKey) {
          this.keyShiftTab()
        } else {
          this.keyTab()
        }
      } else if (key.code == 'Backspace') {
        this.keyBackspace()
      } else if (key.code == 'Delete') {
        this.keyDelete()
      } else if (key.code == 'Enter') {
        this.keyEnter()
      } else if(key.code == 'Space') {
        // TODO: not sure why this is needed
        // SPACE key doesn't get through
        this.insert(' ')
      } else if (key.keyCode >= 65 && key.keyCode <= 90 && key.shiftKey) {
        // TODO: not sure why this is needed
        // SHIFT+character doesn't get through
        this.insert(key.key)
      } else {
        return true;
      }

      return false
    });
    
    
    this.term.onData(async e => {
      this.insert(e)
    })
    
  }

  _setRowsFromLines() {
    this.docUpdated()

    const w = this.display.width - (this.drawFrame?2:0)
    this.doc.rows = []
    let i = 0
    for ( ; i < this.doc.lines.length; i++) {
      let l = stripAnsi(this.doc.lines[i])
      if (l.length == 0) {
        this.doc.rows.push({ line: i, text: '' })
      } else {
        if (this.wrap) {
          let j = 0
          while (j < l.length) {
            this.doc.rows.push({ line: i, text: sliceAnsi(this.doc.lines[i], j, j + w) })
            j += w
          }
        } else {
          this.doc.rows.push({ line: i, text: this.doc.lines[i] })
        }
      }
    }

    // if the last line is full width there needs to be another row to fit the cursor if its at the end of the line
    if (stripAnsi(this.doc.rows[this.doc.rows.length-1].text).length == this.display.width - (this.drawFrame?2:0)) {
      this.doc.rows.push({ line: i, text: '' })
    }

    this._updateMaxRowLength()
  }

  _updateMaxRowLength() {
    if (this.wrap) {
      this.doc.maxRowLength = this.display.width - (this.drawFrame?2:0)
    } else {
      this.doc.maxRowLength = this.doc.rows.map((v) => stripAnsi(v.text).length).reduce((len, max) => Math.max(len, max), 0)
    }
  }

  draw() {

    // clear screen
    this.term.write(`\x1B[2J`);

    if (this.drawFrame) {
      // corners
      this.term.write(`\x1b[${this.display.top};${this.display.left}H\u250c`);
      this.term.write(`\x1b[${this.display.top};${this.display.left + this.display.width - 1}H\u2510`);
      this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left}H\u2514`);
      this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left + this.display.width - 1}H\u2518`);

      // top/bottom
      for (let i = 1; i < this.display.width - 1; i++) {
        this.term.write(`\x1b[${this.display.top};${this.display.left + i}H\u2500`);
        this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left + i}H\u2500`);
      }

      // left/right
      for (let i = 1; i < this.display.height - 1; i++) {
        this.term.write(`\x1b[${this.display.top + i};${this.display.left}H\u2502`);
        this.term.write(`\x1b[${this.display.top + i};${this.display.left + this.display.width - 1}H\u2502`);
      }

      // scroll bar
      this.term.write(`\x1b[${this.display.top + this.display.scroll.y};${this.display.left + this.display.width - 1}H\u2506`);
      this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left + this.display.scroll.x}H\u2504`);
    }

    // rows
    for (let i = (this.drawFrame?1:0) ; i < this.display.height - (this.drawFrame?1:0) ; i++) {
      let r = this.display.scroll.rowAtTop + i - (this.drawFrame?1:0)
      // console.log(this.display.scroll.rowAtTop,i,this.doc.rows.length,r)
      if (r<0 || r >= this.doc.rows.length) continue
      this.term.write(`\x1b[${this.display.top + i};${this.display.left + (this.drawFrame?1:0)}H`);
      this.term.write(sliceAnsi(this.doc.rows[this.display.scroll.rowAtTop + i - (this.drawFrame?1:0)].text, this.display.scroll.charAtLeft, this.display.scroll.charAtLeft + this.display.width - (this.drawFrame?2:0)))
    }

    // cursor pos
    if (this.display.cursor.y >= (this.drawFrame?1:0) && this.display.cursor.y < this.display.height - (this.drawFrame?1:0)) {
      this.term.write('\x1b[?25h') // display cursor
      this.term.write(`\x1b[${this.display.top + this.display.cursor.y};${this.display.left + this.display.cursor.x}H`);
    } else {
      this.term.write('\x1b[?25l') // hide cursor
    }
  }

  _updateScrollX() {
    if (!this.drawFrame) return

    if (this.display.scroll.charAtLeft == 0) {
      this.display.scroll.x = 1;
    } else if (this.display.scroll.charAtLeft == this.doc.maxRowLength - this.display.width + 2) {
      this.display.scroll.x = this.display.width - 2;
    } else {
      this.display.scroll.x = 2 + Math.floor((this.display.scroll.charAtLeft / (this.doc.maxRowLength - this.display.width + 2)) * (this.display.width - 4));
    }
  }

  _updateScrollY() {
    if (!this.drawFrame) return

    if (this.display.scroll.rowAtTop == 0) {
      this.display.scroll.y = 1;
    } else if (this.display.scroll.rowAtTop == this.doc.rows.length - this.display.height + 2) {
      this.display.scroll.y = this.display.height - 2;
    } else {
      this.display.scroll.y = 2 + Math.floor((this.display.scroll.rowAtTop / (this.doc.rows.length - this.display.height + 2)) * (this.display.height - 4));
    }
  }

  _updateCursorXY() {
    this.display.cursor.x = this.display.cursor.char - this.display.scroll.charAtLeft + (this.drawFrame?1:0)
    this.display.cursor.y = this.display.cursor.row - this.display.scroll.rowAtTop + (this.drawFrame?1:0)
  }

  _updateDisplay() {
    // check if doc.pos.char is past end of line
    if (this.doc.pos.char > stripAnsi(this.doc.lines[this.doc.pos.line]).length) {
      this.doc.pos.char = stripAnsi(this.doc.lines[this.doc.pos.line]).length
    }

    // update cursor based on pos
    if (this.wrap) {

      // find the row for this line
      this.display.cursor.row = -1
      for (let i=0 ; i<this.doc.rows.length ; i++) {
        if (this.doc.rows[i].line == this.doc.pos.line) {
          this.display.cursor.row = i
          break
        }
      }

      // find offset in the rows of this line
      this.display.cursor.char = this.doc.pos.char
      this.display.cursor.row += Math.floor(this.display.cursor.char/(this.display.width - (this.drawFrame?2:0)))
      this.display.cursor.char = this.display.cursor.char % (this.display.width - (this.drawFrame?2:0))
    } else {
      this.display.cursor.char = this.doc.pos.char
      this.display.cursor.row = this.doc.pos.line
    }

    this._updateCursorXY()

    // update horizontal scroll
    if (this.display.cursor.x < (this.drawFrame?1:0)) {
      const scrollDelta = (this.drawFrame?1:0) - this.display.cursor.x
      this.display.cursor.x = (this.drawFrame?1:0);
      this.display.scroll.charAtLeft = Math.max(0, this.display.scroll.charAtLeft - scrollDelta);
    } else if (this.display.cursor.x > this.display.width - (this.drawFrame?2:1)) {
      const scrollDelta = this.display.cursor.x - (this.display.width - (this.drawFrame?2:0));
      this.display.cursor.x = this.display.width - (this.drawFrame?2:0);
      this.display.scroll.charAtLeft += scrollDelta
    }
    this._updateScrollX()

    // update vertical scroll
    if (this.display.cursor.y < (this.drawFrame?1:0)) {
      const scrollDelta = (this.drawFrame?1:0) - this.display.cursor.y
      this.display.cursor.y = (this.drawFrame?1:0);
      this.display.scroll.rowAtTop = Math.max(0, this.display.scroll.rowAtTop - scrollDelta);
    } else if (this.display.cursor.y > this.display.height - (this.drawFrame?2:1)) {
      const scrollDelta = this.display.cursor.y - (this.display.height - (this.drawFrame?2:1));
      this.display.cursor.y = this.display.height - (this.drawFrame?2:1);
      this.display.scroll.rowAtTop = Math.min(this.doc.rows.length - this.display.height + (this.drawFrame?2:1), this.display.scroll.rowAtTop + scrollDelta);
    } else if (this.display.scroll.rowAtTop + this.display.height - (this.drawFrame?2:0) > this.doc.rows.length) {
      const scrollDelta = this.doc.rows.length - (this.display.height-(this.drawFrame?2:0)) - this.display.scroll.rowAtTop
      const fix = - this.display.scroll.rowAtTop + scrollDelta
      // console.log(scrollDelta,fix)
      this.display.cursor.y -= scrollDelta
      this.display.scroll.rowAtTop += scrollDelta
      if (this.display.scroll.rowAtTop<0) {
        this.display.cursor.y += this.display.scroll.rowAtTop
        this.display.scroll.rowAtTop = 0
      }
      // console.log(this.display.cursor.y,this.display.scroll.rowAtTop)
    }

    // console.log('update scroll y')
    this._updateScrollY()
  }

  keyUp() {
    if (this.doc.pos.line == 0) return
    this.doc.pos.line--

    this._updateDisplay()
    this.draw();
  }

  keyDown() {
    if (this.doc.pos.line == this.doc.lines.length - 1) return
    this.doc.pos.line++

    this._updateDisplay()
    this.draw();
  }

  keyRight() {
    if (this.doc.pos.char != stripAnsi(this.doc.lines[this.doc.pos.line]).length) {
      this.doc.pos.char++
    } else if (this.doc.pos.char == stripAnsi(this.doc.lines[this.doc.pos.line]).length && this.doc.pos.line < this.doc.lines.length - 1) {
      this.doc.pos.line++
      this.doc.pos.char = 0
    } else {
      return
    }

    this._updateDisplay()
    this.draw();
  }

  keyLeft() {
    if (this.doc.pos.char > 0) {
      this.doc.pos.char--
    } else if (this.doc.pos.char == 0 && this.doc.pos.line > 0) {
      this.doc.pos.line--
      this.doc.pos.char = stripAnsi(this.doc.lines[this.doc.pos.line]).length
    } else {
      return
    }

    this._updateDisplay()
    this.draw();
  }

  keyTab() {
    this.insert('  ')
  }

  keyShiftTab() {
    let ln = this.doc.lines[this.doc.pos.line]
    if (ln.length > 2 && ln[0] == ' ' && ln[1] == ' ') {
      this.doc.lines[this.doc.pos.line] = ln.substring(2)
      this.doc.pos.char -= 2
      this._setRowsFromLines()
      this._updateDisplay()
      this.draw();
    }
  }

  keyBackspace() {
    const line = this.doc.lines[this.doc.pos.line]

    if (stripAnsi(line).length > 0 && this.doc.pos.char > 0) {
      this.doc.pos.char--
      const left = sliceAnsi(line, 0, this.doc.pos.char)
      const rightNow = sliceAnsi(line, this.doc.pos.char + 1)
      this.doc.lines[this.doc.pos.line] = left + rightNow

    } else if (this.doc.pos.char == 0 && this.doc.pos.line > 0) {
      // backspace at beginning of line, join onto previous line
      const left = this.doc.lines[this.doc.pos.line - 1]
      const right = line
      this.doc.lines[this.doc.pos.line - 1] = left + right
      this.doc.lines.splice(this.doc.pos.line, 1)
      this.doc.pos.line--
      this.doc.pos.char = stripAnsi(left).length
    } else {
      return
    }

    this._setRowsFromLines()
    this._updateDisplay()
    this.draw();
  }

  keyDelete() {
    const line = this.doc.lines[this.doc.pos.line]

    if (stripAnsi(line).length > 0 && this.doc.pos.char < stripAnsi(line).length) {
      const left = sliceAnsi(line, 0, this.doc.pos.char)
      const rightNow = sliceAnsi(line, this.doc.pos.char + 1)
      this.doc.lines[this.doc.pos.line] = left + rightNow

    } else if (this.doc.pos.char == stripAnsi(line).length && this.doc.pos.line < this.doc.lines.length - 1) {
      const left = line
      const right = this.doc.lines[this.doc.pos.line + 1]
      this.doc.lines[this.doc.pos.line] = left + right
      this.doc.lines.splice(this.doc.pos.line + 1, 1)

    } else {
      return
    }

    this._setRowsFromLines()
    this._updateDisplay()
    this.draw();
  }

  keyEnter() {
    const line = this.doc.lines[this.doc.pos.line]
    const left = sliceAnsi(line, 0, this.doc.pos.char)
    const right = sliceAnsi(line, this.doc.pos.char)

    this.doc.lines[this.doc.pos.line] = left

    this.doc.pos.line++
    this.doc.lines.splice(this.doc.pos.line, 0, right )
    this.doc.pos.char = 0

    this._setRowsFromLines()
    this._updateDisplay()
    this.draw();
  }

  insert(e) {
    const lns = e.split('\r')
    const line = this.doc.lines[this.doc.pos.line]
    const left = sliceAnsi(line, 0, this.doc.pos.char)
    const right = sliceAnsi(line, this.doc.pos.char)

    this.doc.lines[this.doc.pos.line] = left + lns[0]

    for (let i = 1; i < lns.length; i++) {
      this.doc.pos.line++
      this.doc.lines.splice(this.doc.pos.line, 0, lns[i])
    }

    this.doc.pos.char = stripAnsi(this.doc.lines[this.doc.pos.line]).length
    this.doc.lines[this.doc.pos.line] += right

    this._setRowsFromLines()
    this._updateDisplay()
    this.draw();
  }
}
