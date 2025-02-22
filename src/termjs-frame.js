import chalk from 'chalk';
import sliceAnsi from 'slice-ansi';
import stripAnsi from 'strip-ansi';

// TODO: remove stripAnsi calls for length

export class TermFrame {

  constructor(term, top, left, height, width, lines) {
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

    this.drawFrame = true
    this.wrap = false

    this._updateRows()
    this._calcMaxRowLength()
  }

  _updateRows() {
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
  }

  _calcMaxRowLength() {
    if (this.wrap) {
      this.doc.maxRowLength = this.display.width - 2
    } else {
      this.doc.maxRowLength = this.doc.rows.map((v) => stripAnsi(v.text).length).reduce((len, max) => Math.max(len, max), 0)
    }
  }

  draw() {
    // console.log(this)
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
    if (this.doc.pos.char > stripAnsi(this.doc.rows[this.doc.pos.line].text).length) {
      const xDelta = this.doc.pos.char - stripAnsi(this.doc.rows[this.doc.pos.line].text).length
      this.doc.pos.char = stripAnsi(this.doc.rows[this.doc.pos.line].text).length
      this.display.cursor.x -= xDelta
    }

    // update cursor.x
    this.display.cursor.x = this.doc.pos.char - this.display.scroll.charAtLeft + 1

    // update cursor.y
    this.display.cursor.y = this.doc.pos.line - this.display.scroll.lineAtTop + 1

    // update horizontal scroll
    if (this.display.cursor.x < 1) {
      const scrollDelta = 1 - this.display.cursor.x
      this.display.cursor.x = 1;
      this.display.scroll.charAtLeft = Math.max(0, this.display.scroll.charAtLeft - scrollDelta);
      this._updateScrollX()
    } else if (this.display.cursor.x > this.display.width - 2) {
      const scrollDelta = this.display.cursor.x - (this.display.width - 2);
      this.display.cursor.x = this.display.width - 2;
      const lineLength = stripAnsi(this.doc.rows[this.doc.pos.line].text).length
      const needsCharAtLeft = Math.min(lineLength + 1 - this.display.width + 2, this.display.scroll.charAtLeft + scrollDelta);
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
    if (this.doc.pos.line == this.doc.rows.length - 1) return
    this.doc.pos.line++

    this._updateDisplay()
    this.draw();
  }

  keyRight() {
    if (this.doc.pos.char != stripAnsi(this.doc.rows[this.doc.pos.line].text).length) {
      this.doc.pos.char++
    } else if (this.doc.pos.char == stripAnsi(this.doc.rows[this.doc.pos.line].text).length && this.doc.pos.line < this.doc.rows.length - 1) {
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
      this.doc.pos.char = stripAnsi(this.doc.rows[this.doc.pos.line].text).length
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
    let ln = this.doc.rows[this.doc.pos.line].text
    if (ln.length > 2 && ln[0] == ' ' && ln[1] == ' ') {
      this.doc.rows[this.doc.pos.line].text = ln.substring(2)
      this.doc.pos.char -= 2
      this._calcMaxRowLength()
      this._updateDisplay()
      this.draw();
    }
  }

  keyBackspace() {
    const row = this.doc.rows[this.doc.pos.line]

    if (stripAnsi(row.text).length > 0 && this.doc.pos.char > 0) {
      this.doc.pos.char--
      const left = sliceAnsi(row.text, 0, this.doc.pos.char)
      const rightNow = sliceAnsi(row.text, this.doc.pos.char + 1)
      row.text = left + rightNow

    } else if (this.doc.pos.char == 0 && this.doc.pos.line > 0) {
      // backspace at beginning of line, join onto previous line
      const left = this.doc.rows[this.doc.pos.line - 1].text
      const right = row.text
      this.doc.rows[this.doc.pos.line - 1].text = left + right
      this.doc.rows.splice(this.doc.pos.line, 1)
      this.doc.pos.line--
      this.doc.pos.char = stripAnsi(left).length

    } else {
      return
    }

    this._calcMaxRowLength()
    this._updateDisplay()
    this.draw();
  }

  keyDelete() {
    const row = this.doc.rows[this.doc.pos.line]

    if (stripAnsi(row.text).length > 0 && this.doc.pos.char < stripAnsi(row.text).length) {
      const left = sliceAnsi(row.text, 0, this.doc.pos.char)
      const rightNow = sliceAnsi(row.text, this.doc.pos.char + 1)
      row.text = left + rightNow

    } else if (this.doc.pos.char == stripAnsi(row.text).length && this.doc.pos.line < this.doc.rows.length - 1) {
      const left = row.text
      const right = this.doc.rows[this.doc.pos.line + 1].text
      row.text = left + right
      this.doc.rows.splice(this.doc.pos.line + 1, 1)

    } else {
      return
    }

    this._calcMaxRowLength()
    this._updateDisplay()
    this.draw();
  }

  keyEnter() {
    const row = this.doc.rows[this.doc.pos.line]
    const left = sliceAnsi(row.text, 0, this.doc.pos.char)
    const right = sliceAnsi(row.text, this.doc.pos.char)

    row.text = left

    this.doc.pos.line++
    this.doc.rows.splice(this.doc.pos.line, 0, { line: row.line, text: right })
    this.doc.pos.char = 0

    this._calcMaxRowLength()
    this._updateDisplay()
    this.draw();
  }

  insert(e) {
    const lns = e.split('\r')
    const row = this.doc.rows[this.doc.pos.line]
    const left = sliceAnsi(row.text, 0, this.doc.pos.char)
    const right = sliceAnsi(row.text, this.doc.pos.char)

    row.text = left + lns[0]

    for (let i = 1; i < lns.length; i++) {
      this.doc.pos.line++
      this.doc.rows.splice(this.doc.pos.line, 0, { line: row.line, text: lns[i] })
    }

    this.doc.pos.char = stripAnsi(this.doc.rows[this.doc.pos.line].text).length
    this.doc.rows[this.doc.pos.line].text += right

    this._calcMaxRowLength()
    this._updateDisplay()
    this.draw();
  }
}
