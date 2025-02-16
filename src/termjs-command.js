
// https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797?permalink_comment_id=3857871

const HISTORY_INTERVAL = 200
const PROMPTY = '  '
const PROMPT_LENGTH = 2

const PROMPT = '\x1b[1;34m$\x1b[0m '
const PROMPTX = '\x1b[1;34m|\x1b[0m '

const ERASE_LINE = '\x1b[2K'
const SAVE_POS = `\x1b[s`
const RESTORE_POS = `\x1b[u`

export default function(term) {
  this.historyMillis = Date.now()
  this.history = []
  this.historyPos = -1;
  this.lines = ['']
  this.x = 0
  this.y = 0
  this.edited = false

  this.up = function() {

    const now = Date.now()
    if (now > this.historyMillis + HISTORY_INTERVAL) {
      this.historyMillis = now

      if (this.y>0) { 
        // not on first line of command
        this.erase()
        this.y--
        this.x = Math.min(this.lines[this.y].length,this.x)
        this.write()
      } else if (!this.edited){
        // on first line, show previous
        const oldPos = this.historyPos
        if (this.historyPos > 0) {
          this.historyPos--;
        } else if (this.historyPos < 0) {
          this.historyPos = this.history.length - 1
        }

        if (this.historyPos != oldPos) {
          this.erase()

          this.lines = [...this.history[this.historyPos]]
          this.y = this.lines.length - 1
          this.x = this.lines[this.y].length
          this.edited = false;

          this.write()
        }
      }  
    }

    return false;
  }

  this.down = function() {
    const now = Date.now()
    if (now > this.historyMillis + HISTORY_INTERVAL) {
      this.historyMillis = now

      if (this.y < this.lines.length-1) {
        // not on last line, move down
        this.erase()
        this.y++
        this.x = Math.min(this.lines[this.y].length,this.x)
        this.write()
      } else if (this.y == this.lines.length - 1 && this.x <this.lines[this.y].length) {
        // if down on last line, go to end of line
        this.erase()
        this.x = this.lines[this.y].length
        this.write()
      } else if (!this.edited){
        // show next history command
        const oldPos = this.historyPos;
        if (this.historyPos>-1) {
          this.historyPos = Math.min(this.historyPos + 1, this.history.length)
          if (this.historyPos == this.history.length) {
            this.historyPos = -1
          }
        }

        if (this.historyPos != oldPos) {
          this.erase()

          if (this.historyPos != -1) {
            this.lines = [...this.history[this.historyPos]]
            this.y = this.lines.length-1
            this.x = this.lines[this.y].length
            this.edited = false;
          } else {
            this.lines = ['']
            this.y = 0
            this.x = 0
            this.edited = false;
          }

          this.write()
        }
      }
    }

    return false;
  }

  this.left = function() {
    if (this.x != 0) {
      this.erase()
      this.x--
      this.write()
    } else if (this.x == 0 && this.y > 0) {
      this.erase()
      this.y--
      this.x = this.lines[this.y].length
      this.write()
    }
  }

  this.right = function() {
    if (this.x != this.lines[this.y].length) {
      this.erase()
      this.x++
      this.write()
    } else if (this.x == this.lines[this.y].length && this.y < this.lines.length-1) {
      this.erase()
      this.y++
      this.x = 0
      this.write()
    }
  }

  this.insert = function(e) {
    this.erase()

    const lns = e.split('\r')
    const left  = this.lines[this.y].substring(0,this.x)
    const right = this.lines[this.y].substring(this.x)

    this.lines[this.y] = left + lns[0]

    for (let i=1 ; i<lns.length ; i++) {
      this.y++
      this.lines.splice(this.y,0,lns[i])
    }
  
    this.x = this.lines[this.y].length
    this.lines[this.y] += right
    this.edited = true; 

    this.write()
  }

  this.backspace = function() {
    if (this.lines[this.y].length > 0 && this.x > 0) {
      this.erase()

      this.x--
      const left = this.lines[this.y].substring(0,this.x)
      const rightNow = this.lines[this.y].substring(this.x+1)
      this.lines[this.y] = left + rightNow
      this.edited = true;

      this.write()
    } else if (this.x==0 && this.y>0) {
      this.erase();

      // backspace at beginning of line, join onto previous line
      const left = this.lines[this.y-1]
      const right = this.lines[this.y]
      this.lines[this.y-1] = left + right
      this.lines.splice(this.y,1)
      this.edited = true;
      this.y--
      this.x = left.length

      this.write()
    }
  }

  this.delete = function() {
    // TODO: delete at end of line

    if (this.lines[this.y].length > 0 && this.x < this.lines[this.y].length) {
      this.erase()
      const left = this.lines[this.y].substring(0,this.x)
      const rightNow = this.lines[this.y].substring(this.x+1)
      this.lines[this.y] = left + rightNow
      this.edited = true;
      this.write()
    } else if (this.x == this.lines[this.y].length && this.y < this.lines.length-1) {
      this.erase();

      const left = this.lines[this.y]
      const right = this.lines[this.y+1]
      this.lines[this.y] = left + right
      this.lines.splice(this.y+1,1)
      this.edited = true;

      this.write()
    }
  }

  this.erase = function() {

    const cols = term.cols - PROMPT_LENGTH;
    const re = new RegExp(String.raw`.{1,${cols}}`, "g");
    let row = 0
    let lineRows = []

    for (let i=0 ; i<this.lines.length ; i++) {
      let rows = this.lines[i].length == 0 ? [''] : this.lines[i].match(re)
      lineRows.push({ row: row, rows: rows })
      row += rows.length
    }

    // find row for this.y, where we are
    const onRow = lineRows[this.y].row + Math.floor(this.x / cols)    
    // go up onRow rows
    if (onRow>0) term.write(`\x1b[${onRow}A`)
    
    // set col to 1
    term.write(`\r`)

    // term.write(SAVE_POS)
let y=0
    for (let i=0 ; i<lineRows.length ; i++) {
      for (let j=0 ; j<lineRows[i].rows.length ; j++) { 
        term.write(ERASE_LINE)
        term.write('\r\n')
        y++
      }
    }

if (y>0) term.write(`\x1b[${y}A`)
  // term.write(RESTORE_POS)
  }

  this.write = function() {

    // term.write(SAVE_POS)

    const cols = term.cols - PROMPT_LENGTH;
    const re = new RegExp(String.raw`.{1,${cols}}`, "g");
    let row = 0
    let lineRows = []
let y = 0
    for (let i=0 ; i<this.lines.length ; i++) {
      let rows = this.lines[i].length == 0 ? [''] : this.lines[i].match(re)
      lineRows.push({ row: row, rows: rows })
      for (let j=0 ; j<rows.length ; j++) {
        if (j==0) {
          if (i==0) term.write(PROMPT)
          else term.write(PROMPTX)
        } else {
          term.write(PROMPTY)
        }

        term.write(rows[j])
        term.write('\r\n')
        y++
      }
      row += rows.length
    }

    // term.write(RESTORE_POS)
if (y>0) term.write(`\x1b[${y}A`)
    // go down to this.y
    let down = lineRows[this.y].row+Math.floor(this.x / cols)
    if (down>=term.rows) {
      down=10
      console.log(`down: ${down}, rows: ${term.rows}`)
    // } else {
    //   console.log(`down: ${down}, rows: ${term.rows}`)
    }
    if (down>0) term.write(`\x1b[${down}B`)
    // set col to this.x
    term.write(`\x1b[${PROMPT_LENGTH + this.x % cols + 1}G`)

  }
}