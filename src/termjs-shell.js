
import { TermDocument } from './termjs-document.js';
import stripAnsi from 'strip-ansi'
import Sval from './sval-fork.js';
import global from './global.js'

import theme from './ansi-hljs-theme.js'
import colorize from './ansi-hljs.js'
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);


let x = hljs.highlight(`let x = { name: "fred", v`, {language: 'javascript', ignoreIllegals: true})
let y = colorize(x.value,{theme})


let doc = [...Array(30)].map((v, i) => `\x1b[1;34m$\x1b[0m line ${i + 1} of 50`)
doc[2] += ' this is the longest line'
doc[1] = y

const PROMPT = '\x1b[1;34m$\x1b[0m '


const PARSE_ERROR_REGEX = /(.*) \((\d+):(\d+)\)/
  
  

export class TermShell extends TermDocument {

  constructor(t,o) {
    o.lines = doc
    o.prompt = o.prompt || PROMPT
    o.lines.push(o.prompt)
    
    super(t,o)

    // this.global = global()
    this.sval = new Sval({
      ecmaVer: 'latest',
      sourceType: 'module',
      globalObject: global()
    })

this.global = this.sval.options.globalObject

    this.prompt = o.prompt
    this.promptLength = stripAnsi(this.prompt).length


    this.history = ['1','2','3']
    this.historyPos = -1;
    this.promptOnLine = this.doc.lines.length-1
    this._updateDisplay()
    this.draw()
  }

  isCompleteJavascriptStatement(cmd) {
    try {
      this.sval.parse(cmd.join('\n'));
      return true
    } catch (e) {
      let m = PARSE_ERROR_REGEX.exec(e.message)
      if (m && (
        (cmd.length == m[2] && cmd[cmd.length-1].length == m[3])
        ||
        (m[1] == 'Unterminated template'))) {
          return false;
      }
      throw e;
    }
  }

  _updateDisplay() {
    this.doc.pos.line = Math.max(this.promptOnLine,this.doc.pos.line)
    if (this.doc.pos.line == this.promptOnLine) {
      this.doc.pos.char = Math.max(this.promptLength,this.doc.pos.char)
    }
    super._updateDisplay()
  }

  keyUp() {
    if (this.doc.pos.line==this.promptLine) {
      // if (this.doc.pos.char == this.promptLength) {
      console.log("previous history")

      const oldPos = this.historyPos
      if (this.historyPos > 0) {
        this.historyPos--;
      } else if (this.historyPos < 0) {
        this.historyPos = this.history.length - 1
      }

      if (this.historyPos != oldPos) {
        this.doc.lines[this.doc.lines.length-1] = this.prompt + this.history[this.historyPos]
        this.doc.pos.char = this.doc.lines[this.doc.lines.length-1].length
        this._setRowsFromLines()
      }

      this._updateDisplay()
      this.draw();
  
    } else {
      super.keyUp();
    }
  }

  keyDown() {
    if (this.doc.pos.line==this.doc.lines.length-1) {
      const lineLength = stripAnsi(this.doc.lines[this.doc.pos.line]).length
      if (this.doc.pos.char == lineLength) {
        console.log("next history")

        // show next history command
        const oldPos = this.historyPos;
        if (this.historyPos>-1) {
          this.historyPos = Math.min(this.historyPos + 1, this.history.length)
          if (this.historyPos == this.history.length) {
            this.historyPos = -1
          }
        }

        if (this.historyPos != oldPos) {

          if (this.historyPos == -1) {
            this.doc.lines[this.doc.lines.length-1] = this.prompt
          } else {
            this.doc.lines[this.doc.lines.length-1] = this.prompt + this.history[this.historyPos]
          }
          this.doc.pos.char = this.doc.lines[this.doc.lines.length-1].length
          this._setRowsFromLines()
        }

      } else {
        this.doc.pos.char = lineLength
      }

      this._updateDisplay()
      this.draw();
  
    } else {
      super.keyDown()
    }
  }

  keyTab() {
    super.keyTab()
  }

  keyShiftTab() {
    super.keyShiftTab()
  }

  keyBackspace() {
    super.keyBackspace()
  }

  keyDelete() {
    super.keyDelete()
  }

  keyEnter() {
    super.keyEnter()

    const that = this

    async function execCommand(cmd) {
  
      // cmd.historyPos = -1;
      // cmd.lines = [''];
      // cmd.x = 0;
      // cmd.y = 0;
      // cmd.edited = false;
    
      try {
        const res = await that.sval.run(cmd.join('\n'))
        if (res !== undefined) {
          // console.log(res)
          that.global.console.log(res);
        }
      } catch (e) {
        that.doc.lines[that.doc.pos.line] = `\x1b[1;31m${String(e)}\x1b[0m`
        that.doc.lines.push('')
        that.doc.pos.line = that.doc.lines.length-1
        // console.log(that.doc)
      }
    
    }
    
    // on last line - which is new empty line
    if (this.doc.pos.line == this.doc.lines.length - 1 && this.doc.lines[this.doc.pos.line].length == 0) {

      let commandLines = this.doc.lines.slice(this.promptOnLine,this.doc.lines.length - 1)
      commandLines = commandLines.map((line) => stripAnsi(line))
      commandLines[0] = commandLines[0].slice(2)

      if (commandLines.join('').trim() == '') {
        console.log('more ...')
      } else {
      

        // try {
          let complete = this.isCompleteJavascriptStatement(commandLines)
          if (complete) {

            execCommand(commandLines).then((r) => {
              this.doc.lines[this.doc.pos.line] = this.prompt
              this.doc.pos.char = this.promptLength
              this.promptOnLine = this.doc.pos.line
              this._setRowsFromLines()
              this._updateDisplay()
              this.draw(); 
            })
      
          // } else {
          //   console.log('more ...')
          }
        // } catch (e) {
        //   console.log('error')
        //   this.doc.lines[this.doc.pos.line] = `${e}`
        //   this.doc.lines.push(this.prompt)
        //   this.doc.pos.line++
        //   this.doc.pos.char = this.promptLength
        //   this.promptOnLine = this.doc.pos.line

        //   this._setRowsFromLines()
        //   this._updateDisplay()
        //   this.draw();
    
        // }
      }
    }

  }

  insert(e) {
    super.insert(e)

    let commandLines = this.doc.lines.slice(this.promptOnLine)
    commandLines = commandLines.map((line) => stripAnsi(line))
    commandLines[0] = commandLines[0].slice(2)

    let x = hljs.highlight(commandLines.join('\n'), {language: 'javascript', ignoreIllegals: true})
    const colored = colorize(x.value,{theme}).split('\n')

    this.doc.lines[this.promptOnLine] = this.prompt + colored[0]
    for (let i=this.promptOnLine+1 ; i<this.doc.lines.length ; i++ ) {
      this.doc.lines[i] = colored[i-this.promptOnLine]
    }

    this._setRowsFromLines()
    this._updateDisplay()
    this.draw();

  }

  docUpdated() {

    

    // console.log("doc update")
  }
}
