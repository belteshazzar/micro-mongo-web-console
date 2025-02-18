import chalk from 'chalk';
import sliceAnsi from 'slice-ansi';
import stripAnsi from 'strip-ansi';

// TODO: remove stripAnsi calls for length

export class TermFrame {

  constructor(term, top, left, height, width, lines) {
    this.term = term;

    this.doc = {
      lines: lines,
      maxLineLength: 0,
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

    this._calcMaxLineLength()
    this.drawFrame = true

    // const PROMPT = '\x1b[1;34m$\x1b[0m '
    // console.log(PROMPT.length)
    // for (let i=0 ; i<PROMPT.length ; i++) {
    //   console.log(PROMPT[i])
    // }
    // console.log(PROMPT.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').length)

    // const string = 'The quick brown ' + chalk.red('fox jumped over ') +
    // 'the lazy ' + chalk.green('dog and then ran away with the unicorn.');
  
    // console.log(sliceAnsi(string, 20, 30));
    // console.log(sliceAnsi(PROMPT, 1));
    // console.log(sliceAnsi(PROMPT, 2));

    // console.log(stripAnsi('\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007'))
  }

  _calcMaxLineLength() {
    this.doc.maxLineLength = this.doc.lines.map((v) => stripAnsi(v).length).reduce((len,max) => Math.max(len,max),0)
  }

  draw() {
    // console.log(this)
    // clear screen
    this.term.write(`\x1B[2J`);
//     this.term.write(`\x1b[${1};${1}H`);
//     const PROMPT = '\x1b[1;34m$#\x1b[0m '
// this.term.write(PROMPT+'\n\r')
// this.term.write(sliceAnsi(PROMPT, 1)+'\n\r');
// this.term.write(sliceAnsi(PROMPT, 2)+'\n\r');
// return

    if (this.drawFrame) {
      // corners
      this.term.write(`\x1b[${this.display.top};${this.display.left}H\u250f`);
      this.term.write(`\x1b[${this.display.top};${this.display.left + this.display.width - 1}H\u2513`);
      this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left}H\u2517`);
      this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left + this.display.width - 1}H\u251b`);

      // top/bottom
      for (let i = 1; i < this.display.width - 1; i++) {
        this.term.write(`\x1b[${this.display.top};${this.display.left + i}H\u2501`);
        this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left + i}H\u2501`);
      }

      // left/right
      for (let i = 1; i < this.display.height - 1; i++) {
        this.term.write(`\x1b[${this.display.top + i};${this.display.left}H\u2503`);
        this.term.write(`\x1b[${this.display.top + i};${this.display.left + this.display.width - 1}H\u2503`);
      }

      // scroll bar
      this.term.write(`\x1b[${this.display.top + this.display.scroll.y};${this.display.left + this.display.width - 1}H\u2507`);
      this.term.write(`\x1b[${this.display.top + this.display.height - 1};${this.display.left + this.display.scroll.x}H\u2505`);
    }

    // lines
    for (let i = 1; i < this.display.height - 1; i++) {
      this.term.write(`\x1b[${this.display.top + i};${this.display.left+1}H`);
      this.term.write(sliceAnsi(this.doc.lines[this.display.scroll.lineAtTop+i-1],this.display.scroll.charAtLeft,this.display.scroll.charAtLeft+this.display.width-2))
    }

    // cursor pos
    this.term.write(`\x1b[${this.display.top + this.display.cursor.y};${this.display.left + this.display.cursor.x}H`);
  }

  _updateScrollX() {
    if (this.display.scroll.charAtLeft == 0) {
      this.display.scroll.x = 1;
    } else if (this.display.scroll.charAtLeft == this.doc.maxLineLength - this.display.width + 2) {
      this.display.scroll.x = this.display.width - 2;
    } else {
      this.display.scroll.x = 2 + Math.floor((this.display.scroll.charAtLeft / (this.doc.maxLineLength - this.display.width + 2)) * (this.display.width - 4));
    }
  }

  _updateScrollY() {
    if (this.display.scroll.lineAtTop == 0) {
      this.display.scroll.y = 1;
    } else if (this.display.scroll.lineAtTop == this.doc.lines.length - this.display.height + 2) {
      this.display.scroll.y = this.display.height - 2;
    } else {
      this.display.scroll.y = 2 + Math.floor((this.display.scroll.lineAtTop / (this.doc.lines.length - this.display.height + 2)) * (this.display.height - 4));
    }
  }

  _updateDisplay() {
    // check if doc.pos.char is past end of line
    if (this.doc.pos.char > stripAnsi(this.doc.lines[this.doc.pos.line]).length) {
      const xDelta = this.doc.pos.char - stripAnsi(this.doc.lines[this.doc.pos.line]).length
      this.doc.pos.char = stripAnsi(this.doc.lines[this.doc.pos.line]).length
      this.display.cursor.x -= xDelta
    }

    // update cursor.x
    this.display.cursor.x = this.doc.pos.char-this.display.scroll.charAtLeft+1

    // update cursor.y
    this.display.cursor.y = this.doc.pos.line-this.display.scroll.lineAtTop+1

    // update horizontal scroll
    if (this.display.cursor.x < 1) {
      const scrollDelta = 1-this.display.cursor.x
      this.display.cursor.x = 1;
      this.display.scroll.charAtLeft = Math.max(0, this.display.scroll.charAtLeft - scrollDelta);
      this._updateScrollX()
    } else if (this.display.cursor.x > this.display.width - 2) {
      const scrollDelta = this.display.cursor.x - (this.display.width - 2);
      this.display.cursor.x = this.display.width - 2;
      const lineLength = stripAnsi(this.doc.lines[this.doc.pos.line]).length
      const needsCharAtLeft = Math.min(lineLength + 1 - this.display.width + 2, this.display.scroll.charAtLeft + scrollDelta);
      if (needsCharAtLeft>this.display.scroll.charAtLeft) {
        this.display.scroll.charAtLeft = needsCharAtLeft
      }
      this._updateScrollX()
    }

    // update vertical scroll
    if (this.display.cursor.y < 1) {
      const scrollDelta = 1-this.display.cursor.y
      this.display.cursor.y = 1;
      this.display.scroll.lineAtTop = Math.max(0, this.display.scroll.lineAtTop - scrollDelta);
      this._updateScrollY()
    } else if (this.display.cursor.y > this.display.height - 2) {
      const scrollDelta = this.display.cursor.y - (this.display.height - 2);
      this.display.cursor.y = this.display.height - 2;
      this.display.scroll.lineAtTop = Math.min(this.doc.lines.length - this.display.height + 2, this.display.scroll.lineAtTop + scrollDelta);
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
    if (this.doc.pos.line == this.doc.lines.length-1) return
    this.doc.pos.line++

    this._updateDisplay()
    this.draw();
  }

  keyRight() {
    if (this.doc.pos.char != stripAnsi(this.doc.lines[this.doc.pos.line]).length) {
      this.doc.pos.char++
    } else if (this.doc.pos.char == stripAnsi(this.doc.lines[this.doc.pos.line]).length && this.doc.pos.line < this.doc.lines.length-1) {
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
    if (ln.length>2 && ln[0]==' ' && ln[1]==' ') {
      this.doc.lines[this.doc.pos.line] = ln.substring(2)
      this.doc.pos.char -= 2
      this._updateDisplay()
      this.draw();
    }
  }

  keyBackspace() {
    if (stripAnsi(this.doc.lines[this.doc.pos.line]).length > 0 && this.doc.pos.char > 0) {
      this.doc.pos.char--
      const left = this.doc.lines[this.doc.pos.line].sliceAnsi(0,this.doc.pos.char)
      const rightNow = this.doc.lines[this.doc.pos.line].sliceAnsi(this.doc.pos.char+1)
      this.doc.lines[this.doc.pos.line] = left + rightNow

    } else if (this.doc.pos.char==0 && this.doc.pos.line>0) {
      // backspace at beginning of line, join onto previous line
      const left = this.doc.lines[this.doc.pos.line-1]
      const right = this.doc.lines[this.doc.pos.line]
      this.doc.lines[this.doc.pos.line-1] = left + right
      this.doc.lines.splice(this.doc.pos.line,1)
      this.doc.pos.line--
      this.doc.pos.char = stripAnsi(left).length

    } else {
      return
    }

    this._calcMaxLineLength()
    this._updateDisplay()
    this.draw();
}

  keyDelete() {
    if (stripAnsi(this.doc.lines[this.doc.pos.line]).length > 0 && this.doc.pos.char < stripAnsi(this.doc.lines[this.doc.pos.line]).length) {
      const left = this.doc.lines[this.doc.pos.line].sliceAnsi(0,this.doc.pos.char)
      const rightNow = this.doc.lines[this.doc.pos.line].sliceAnsi(this.doc.pos.char+1)
      this.doc.lines[this.doc.pos.line] = left + rightNow

    } else if (this.doc.pos.char == stripAnsi(this.doc.lines[this.doc.pos.line]).length && this.doc.pos.line < this.doc.lines.length-1) {
      const left = this.doc.lines[this.doc.pos.line]
      const right = this.doc.lines[this.doc.pos.line+1]
      this.doc.lines[this.doc.pos.line] = left + right
      this.doc.lines.splice(this.doc.pos.line+1,1)

    } else {
      return
    }

    this._calcMaxLineLength()
    this._updateDisplay()
    this.draw();
}

  keyEnter() {
    const left  = this.doc.lines[this.doc.pos.line].sliceAnsi(0,this.doc.pos.char)
    const right = this.doc.lines[this.doc.pos.line].sliceAnsi(this.doc.pos.char)
    this.doc.lines[this.doc.pos.line] = left
    this.doc.pos.line++
    this.doc.lines.splice(this.doc.pos.line,0,right)
    this.doc.pos.char = 0

    this._calcMaxLineLength()
    this._updateDisplay()
    this.draw();
  }

  insert(e) {
    const lns = e.split('\r')
    const left  = this.doc.lines[this.doc.pos.line].sliceAnsi(0,this.doc.pos.char)
    const right = this.doc.lines[this.doc.pos.line].sliceAnsi(this.doc.pos.char)
    this.doc.lines[this.doc.pos.line] = left + lns[0]

    for (let i=1 ; i<lns.length ; i++) {
      this.doc.pos.line++
      this.doc.lines.splice(this.doc.pos.line,0,lns[i])
    }
  
    this.doc.pos.char = stripAnsi(this.doc.lines[this.doc.pos.line]).length
    this.doc.lines[this.doc.pos.line] += right

    this._calcMaxLineLength()
    this._updateDisplay()
    this.draw();
  }
}
