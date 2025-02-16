
export class TermFrame {
  constructor(term, top, left, height, width) {
    this.term = term;
    this.top = top;
    this.left = left;
    this.height = height;
    this.width = width;
    this.x = 1;
    this.y = 1;
    this.lines = [...Array(50)].map((v, i) => `line ${i + 1} of 50`);
    this.maxLineLength = this.lines[this.lines.length - 1].length + 1;
    this.lineAtTop = 0;
    this.scrollX = 1;
    this.scrollY = 1;
    this.charAtLeft = 0;
    this.keyTime = Date.now()
    this.keyInterval = 100
  }

  draw() {
    // clear screen
    this.term.write(`\x1B[2J`);

    // corners
    this.term.write(`\x1b[${this.top};${this.left}H\u250f`);
    this.term.write(`\x1b[${this.top};${this.left + this.width - 1}H\u2513`);
    this.term.write(`\x1b[${this.top + this.height - 1};${this.left}H\u2517`);
    this.term.write(`\x1b[${this.top + this.height - 1};${this.left + this.width - 1}H\u251b`);

    // top/bottom
    for (let i = 1; i < this.width - 1; i++) {
      this.term.write(`\x1b[${this.top};${this.left + i}H\u2501`);
      this.term.write(`\x1b[${this.top + this.height - 1};${this.left + i}H\u2501`);
    }

    // left/right
    for (let i = 1; i < this.height - 1; i++) {
      this.term.write(`\x1b[${this.top + i};${this.left}H\u2503`);
      this.term.write(`\x1b[${this.top + i};${this.left + this.width - 1}H\u2503`);
    }

    // scroll bar
    this.term.write(`\x1b[${this.top + this.scrollY};${this.left + this.width - 1}H\u2507`);
    this.term.write(`\x1b[${this.top + this.height - 1};${this.left + this.scrollX}H\u2505`);

    // lines
    for (let i = 1; i < this.height - 1; i++) {
      for (let j = 1; j < this.width - 1 && j < this.lines[this.lineAtTop + i - 1].length + 1 - this.charAtLeft; j++) {
        this.term.write(`\x1b[${this.top + i};${this.left + j}H`);
        this.term.write(this.lines[this.lineAtTop + i - 1][this.charAtLeft + j - 1]);
      }
    }

    // cursor pos
    this.term.write(`\x1b[${this.top + this.y};${this.left + this.x}H`);
  }

  _updateScrollY() {
    if (this.lineAtTop == 0) {
      this.scrollY = 1;
    } else if (this.lineAtTop == this.lines.length - this.height + 2) {
      this.scrollY = this.height - 2;
    } else {
      this.scrollY = 2 + Math.floor((this.lineAtTop / (this.lines.length - this.height + 2)) * (this.height - 4));
    }
  }

  keyUp() {

    this.y--;
    if (this.y < 1) {
      this.y = 1;
      this.lineAtTop = Math.max(0, this.lineAtTop - 1);
      this._updateScrollY()
    }
    this.draw();
  }

  keyDown() {
    this.y++;
    if (this.y > this.height - 2) {
      this.y = this.height - 2;
      this.lineAtTop = Math.min(this.lines.length - this.height + 2, this.lineAtTop + 1);
      this._updateScrollY()
    }
    this.draw();
  }

  _updateScrollX() {
    if (this.charAtLeft == 0) {
      this.scrollX = 1;
    } else if (this.charAtLeft == this.maxLineLength - this.width + 2) {
      this.scrollX = this.width - 2;
    } else {
      this.scrollX = 2 + Math.floor((this.charAtLeft / (this.maxLineLength - this.width + 2)) * (this.width - 4));
    }
  }

  keyRight() {
    const lineLength = this.lines[this.lineAtTop+this.y-1].length
    this.x = Math.min(lineLength+1-this.charAtLeft,this.x+1)

    if (this.x > this.width - 2) {
      this.x = this.width - 2;

      const needsCharAtLeft = Math.min(lineLength + 1 - this.width + 2, this.charAtLeft + 1);
      if (needsCharAtLeft>this.charAtLeft) {
        this.charAtLeft = needsCharAtLeft
      }

      this._updateScrollX()
    }
    this.draw();
  }

  keyLeft() {
    this.x--; // = Math.max(1,this.x-1)
    if (this.x < 1) {
      this.x = 1;
      this.charAtLeft = Math.max(0, this.charAtLeft - 1);

      this._updateScrollX()
    }
    this.draw();
  }

  keyTab() {
    this.draw();
    // this.term.write('\t')
  }

  keyShiftTab() {
    this.draw();
    // this.term.write('\x1b[Z')
  }

  keyBackspace() {
    this.draw();
    // this.term.write('bs')
  }

  keyDelete() {
    this.draw();
    // this.term.write('del')
  }

  keyEnter() {
    this.draw();
    // this.term.write('\r\n')
  }

  insert(e) {
    this.lines[this.lineAtTop + this.y - 1] = this.lines[this.lineAtTop + this.y - 1].substring(0, this.charAtLeft + this.x - 1) + e + this.lines[this.lineAtTop + this.y - 1].substring(this.charAtLeft + this.x - 1);
    this.maxLineLength = Math.max(this.maxLineLength, this.lines[this.lineAtTop + this.y - 1].length + 1);
    this.x++;

    if (this.x > this.width - 2) {
      this.x = this.width - 2;
      this.charAtLeft = Math.min(this.maxLineLength - this.width + 2, this.charAtLeft + 1);

      this._updateScrollX()
    }

    this.draw();
    // this.term.write(e)
  }
}
