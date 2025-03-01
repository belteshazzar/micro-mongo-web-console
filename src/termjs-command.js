
// https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797?permalink_comment_id=3857871

const HISTORY_INTERVAL = 200
const PROMPTY = '  '

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




  let cmd = new termCommand(term)
  const parseErrorRegex = /(.*) \((\d+):(\d+)\)/
  
  function parseCommand(c) {
    try {
      return sval.parse(cmd.lines.join('\n'));
    } catch (e) {
      let m = parseErrorRegex.exec(e.message)
  
      if (m && (
        (cmd.lines.length == m[2] && cmd.lines[cmd.lines.length-1].length == m[3])
        ||
        (m[1] == 'Unterminated template'))) {
        cmd.lines.push('')
        cmd.x = 0;
        cmd.y++
        return null;
      }
      throw e;
    }
  }
  
  async function execCommand(astOrString) {
  
    cmd.historyPos = -1;
    cmd.lines = [''];
    cmd.x = 0;
    cmd.y = 0;
    cmd.edited = false;
  
    try {
      const res = await sval.run(astOrString)
      if (res !== undefined) {
        globalPrototype.console.log(res);
      }
    } catch (e) {
      term.write(`\x1b[1;31m${String(e)}\x1b[0m\r\n`)
    }
  
  }
  
  term.onData(async e => {
  
    frame.insert(e)
    return
  
    if (e === '\r') {
  
      if (cmd.y == cmd.lines.length-1 && cmd.x == cmd.lines[cmd.y].length) {
        term.write(`\r\n`)
  
        if (cmd.lines.length == 1 && cmd.lines[0].trim().length == 0) {
          term.write(PROMPT)
        } else {
  
          try {
            const ast = parseCommand(cmd);
  
            if (ast) {
              cmd.history.push(cmd.lines);
              await execCommand(ast);
              term.write(PROMPT)
            } else {
              term.write(PROMPTX)
            }
          } catch (e) {
            term.write(e.message)
            term.write('\r\n')
            term.write(PROMPT)
            cmd.history.push(cmd.lines);
            cmd.historyPos = -1;
            cmd.x = 0;
            cmd.y = 0;
            cmd.lines = [''];
            cmd.edited = false;
            return
          }
        }
      } else {
        // in middle of command, split line
  
        const left  = cmd.lines[cmd.y].substring(0,cmd.x)
        const right = cmd.lines[cmd.y].substring(cmd.x)
  
        cmd.lines[cmd.y] = left
        term.write(ERASE_TO_END) // clear to end of line
        term.write('\r\n')
        cmd.y++
        cmd.lines.splice(cmd.y,0,right)
        term.write(PROMPTX)
        term.write(right)
        term.write(ERASE_TO_END) // clear to end of line
        term.write('\r')
        // term.write(PROMPTX)
        cmd.edited = true
  
        for (let i=cmd.y+1; i<cmd.lines.length ; i++) {
          term.write('\n')
          term.write(PROMPTX)
          term.write(cmd.lines[i])
          term.write(ERASE_TO_END)
          term.write('\r')
        }
        for (let i=cmd.y+1; i<cmd.lines.length ; i++) {
          term.write(MOVE_UP)
        }      
        term.write(PROMPTX)
      }
    // } else if (e === '\x7F') {
    //   cmd.backspace()
    // } else if (e === '\x1b[3~') {
    //   cmd.delete()
    // } else if (e == MOVE_LEFT) {
    //   cmd.left()
    // } else if (e == MOVE_RIGHT) {
    //   cmd.right()
    // } else if (e == '\t') {
    //   console.log(e)
    // } else if (e == '\x1b[Z') {
    //   console.log(e)
    } else {
      console.log(e)
      cmd.insert(e)
    }
  })
  
  
  // test script
  // -------------------------
  // sval.run(`
  
  // import Airplane from 'https://raw.githubusercontent.com/belteshazzar/micro-mongo-web-console/refs/heads/belteshazzar/dev/examples/airplane.js'
  // import Indirect from 'https://raw.githubusercontent.com/belteshazzar/micro-mongo-web-console/refs/heads/belteshazzar/dev/examples/indirect.js'
  // import Chained from 'https://raw.githubusercontent.com/belteshazzar/micro-mongo-web-console/refs/heads/belteshazzar/dev/examples/chained.js'
  
  // Airplane.availableAirplanes.forEach( a => {
  //   console.log(a.name + " " + a.fuelCapacity);
  // })
  
  // function x() {
  //   return 4;
  // }
  // console.log(x());
  
  // console.log(Airplane);
  // console.log(Indirect);
  // console.log(Chained);
  
  // function main() {
  //   return new Promise( resolve => {
  //     console.log(3);
  //     resolve(4);
  //     console.log(5);
  //   });
  // }
  
  // async function f(){
  //   console.log(2);
  //   let r = await main();
  //   console.log(r);
  // }
  
  // console.log(1);
  // f();
  // console.log(6);
  // `)
  // -------------------------
  }