
import sliceAnsi from 'slice-ansi';
import stripAnsi from 'strip-ansi';

// TODO: remove stripAnsi calls for length

export class TermShell {

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

    this.display = {
      top: top,
      left: left,
      height: height,
      width: width,
      scroll: {
        charAtLeft: 0,
        lineAtTop: 0,
        x: 1,
        y: 1,
      },
      cursor: {
        x: 1,
        y: 1
      }
    }

    this.drawFrame = drawFrame
    this.wrap = wrap

    this._setRowsFromLines()
  }

  _setRowsFromLines() {
    const w = this.display.width - 2
    this.doc.rows = []
    for (let i = 0; i < this.doc.lines.length; i++) {
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

    this._updateMaxRowLength()
  }

  _updateMaxRowLength() {
    if (this.wrap) {
      this.doc.maxRowLength = this.display.width - 2
    } else {
      this.doc.maxRowLength = this.doc.rows.map((v) => stripAnsi(v.text).length).reduce((len, max) => Math.max(len, max), 0)
    }
  }

  draw() {
//    console.log(this.display.cursor,this.doc.pos)
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
    for (let i = 1; i < this.display.height - 1; i++) {
      this.term.write(`\x1b[${this.display.top + i};${this.display.left + 1}H`);
      this.term.write(sliceAnsi(this.doc.rows[this.display.scroll.lineAtTop + i - 1].text, this.display.scroll.charAtLeft, this.display.scroll.charAtLeft + this.display.width - 2))
    }

    // cursor pos
    this.term.write(`\x1b[${this.display.top + this.display.cursor.y};${this.display.left + this.display.cursor.x}H`);
  }

  _updateScrollX() {
    if (this.display.scroll.charAtLeft == 0) {
      this.display.scroll.x = 1;
    } else if (this.display.scroll.charAtLeft == this.doc.maxRowLength - this.display.width + 2) {
      this.display.scroll.x = this.display.width - 2;
    } else {
      this.display.scroll.x = 2 + Math.floor((this.display.scroll.charAtLeft / (this.doc.maxRowLength - this.display.width + 2)) * (this.display.width - 4));
    }
  }

  _updateScrollY() {
    if (this.display.scroll.lineAtTop == 0) {
      this.display.scroll.y = 1;
    } else if (this.display.scroll.lineAtTop == this.doc.rows.length - this.display.height + 2) {
      this.display.scroll.y = this.display.height - 2;
    } else {
      this.display.scroll.y = 2 + Math.floor((this.display.scroll.lineAtTop / (this.doc.rows.length - this.display.height + 2)) * (this.display.height - 4));
    }
  }

  _updateDisplay() {
    // check if doc.pos.char is past end of line
    if (this.doc.pos.char > stripAnsi(this.doc.lines[this.doc.pos.line]).length) {
      //const xDelta = this.doc.pos.char - stripAnsi(this.doc.rows[this.doc.pos.line].text).length
      this.doc.pos.char = stripAnsi(this.doc.lines[this.doc.pos.line]).length
      //this.display.cursor.x -= xDelta
    }

    // update cursor based on pos
    if (this.wrap) {

      // find the row for this line
      let r=-1
      for (let i=0 ; i<this.doc.rows.length ; i++) {
        if (this.doc.rows[i].line == this.doc.pos.line) {
          r = i
          break
        }
      }

      // find offset in the rows of this line
      let c = this.doc.pos.char
      r += Math.floor(c/(this.display.width-2))
      c = c % (this.display.width-2)

      // update cursor.x
      this.display.cursor.x = c - this.display.scroll.charAtLeft + 1

      // update cursor.y
      this.display.cursor.y = r - this.display.scroll.lineAtTop + 1

    } else {
      this.display.cursor.x = this.doc.pos.char - this.display.scroll.charAtLeft + 1
      this.display.cursor.y = this.doc.pos.line - this.display.scroll.lineAtTop + 1
    }

    // update horizontal scroll
    if (this.display.cursor.x < 1) {
      const scrollDelta = 1 - this.display.cursor.x
      this.display.cursor.x = 1;
      this.display.scroll.charAtLeft = Math.max(0, this.display.scroll.charAtLeft - scrollDelta);
      this._updateScrollX()
    } else if (this.display.cursor.x > this.display.width - 2) {
      const scrollDelta = this.display.cursor.x - (this.display.width - 2);
      this.display.cursor.x = this.display.width - 2;
      const rowLength = stripAnsi(this.doc.rows[this.display.cursor.y].text).length
      const needsCharAtLeft = Math.min(rowLength - this.display.width + 2, this.display.scroll.charAtLeft + scrollDelta);
      if (needsCharAtLeft > this.display.scroll.charAtLeft) {
        this.display.scroll.charAtLeft = needsCharAtLeft
      }
      this._updateScrollX()
    }

    // update vertical scroll
    if (this.display.cursor.y < 1) {
      const scrollDelta = 1 - this.display.cursor.y
      this.display.cursor.y = 1;
      this.display.scroll.lineAtTop = Math.max(0, this.display.scroll.lineAtTop - scrollDelta);
      this._updateScrollY()
    } else if (this.display.cursor.y > this.display.height - 2) {
      const scrollDelta = this.display.cursor.y - (this.display.height - 2);
      this.display.cursor.y = this.display.height - 2;
      this.display.scroll.lineAtTop = Math.min(this.doc.rows.length - this.display.height + 2, this.display.scroll.lineAtTop + scrollDelta);
      this._updateScrollY()
    }
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
