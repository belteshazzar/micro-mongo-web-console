
// https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797?permalink_comment_id=3857871

import { TermDocument } from './termjs-document.js';
import stripAnsi from 'strip-ansi'
import Sval from './sval-fork.js';
import global from './global.js'

import theme from './ansi-hljs-theme.js'
import colorize from './ansi-hljs.js'
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);

const PROMPT = '\x1b[1;34m$\x1b[0m '
const PARSE_ERROR_REGEX = /(.*) \((\d+):(\d+)\)/

export class TermShell extends TermDocument {

  constructor(t,o) {
    o.lines = o.lines || []
    o.prompt = o.prompt || PROMPT
    o.plugins = o.plugins || []
    
    super(t,o)

    this.global = global()

    o.plugins.forEach((p) => {
      p(this)
    })

    this.prompt = o.prompt
    this.promptLength = stripAnsi(this.prompt).length
    this.history = []
    this.historyPos = -1;

    this.reset()
    this.addPrompt()
  }

  addPrompt() {
    this.doc.lines.push(this.prompt)
    this.promptOnLine = this.doc.lines.length-1
    this.doc.pos.line = this.promptOnLine
    this.doc.pos.char = this.promptLength

    this._setRowsFromLines()
    super._updateDisplay()
    this.draw();
  }

  clear() {
    this.doc.lines = []
    this.addPrompt()
    this._setRowsFromLines()
    super._updateDisplay()
    this.draw();
  }

  reset() {
    this.sval = new Sval({
      ecmaVer: 'latest',
      sourceType: 'module',
      globalObject: this.global
    })    
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
    if (this.doc.pos.line==this.promptOnLine) {

      const oldPos = this.historyPos
      if (this.historyPos > 0) {
        this.historyPos--;
      } else if (this.historyPos < 0) {
        this.historyPos = this.history.length - 1
      }

      if (this.historyPos != oldPos) {
        this.doc.lines.splice(this.promptOnLine)
        let cmd = [...this.history[this.historyPos]]
        cmd = this.colorize(cmd.join('\n')).split('\n')
        cmd[0] = this.prompt + cmd[0]
        this.doc.lines.push(...cmd)
        this.doc.pos.line = this.doc.lines.length-1
        this.doc.pos.char = this.doc.lines[this.doc.pos.line].length
        this._setRowsFromLines()
      }

      this._updateDisplay()
      this.draw();
  
    } else {
      super.keyUp();
    }
  }

  keyDown() {
    if (this.doc.pos.line==this.doc.lines.length-1) {//} && this.doc.pos.line==this.promptOnLine) {
      const lineLength = stripAnsi(this.doc.lines[this.doc.pos.line]).length
      if (this.doc.pos.char == lineLength) {

        // show next history command
        const oldPos = this.historyPos;
        if (this.historyPos>-1) {
          this.historyPos = Math.min(this.historyPos + 1, this.history.length)
          if (this.historyPos == this.history.length) {
            this.historyPos = -1
          }
        }

        if (this.historyPos != oldPos) {

          this.doc.lines.splice(this.promptOnLine)
  
          if (this.historyPos == -1) {
            this.doc.lines.push(this.prompt)
          } else {
            let cmd = [...this.history[this.historyPos]]
            cmd = this.colorize(cmd.join('\n')).split('\n')
            cmd[0] = this.prompt + cmd[0]
            this.doc.lines.push(...cmd)
          }
          this.doc.pos.line = this.doc.lines.length-1
          this.doc.pos.char = this.doc.lines[this.doc.pos.line].length
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
    if (this.doc.pos.line == this.promptOnLine && this.doc.pos.char <= this.promptLength) return
    super.keyBackspace()
  }

  keyDelete() {
    super.keyDelete()
  }

  execCommand(cmd) {
    const that = this

    that.history.push(cmd)
    that.historyPos = -1

    // remove the empty line
    that.doc.lines = that.doc.lines.slice(0,-1)
    that.addPrompt()
  
    that.sval.run(cmd.join('\n'))
      .then((v) => {
        if (v !== undefined) {
          that.global.console.log(v);
        }
      })
      .catch((e) => {
        that.insertBeforePrompt([`\x1b[1;31m${String(e)}\x1b[0m`])
      })
  }

  keyEnter() {
    super.keyEnter()

    // if on last line and its empty
    if (this.doc.pos.line == this.doc.lines.length - 1 && this.doc.lines[this.doc.pos.line].length == 0) {

      let commandLines = this.doc.lines.slice(this.promptOnLine,-1)
      // remove ansi
      commandLines = commandLines.map((line) => stripAnsi(line))
      // remove prompt
      commandLines[0] = commandLines[0].slice(2)

      if (commandLines.join('').trim() != '') {
        try {
          let complete = this.isCompleteJavascriptStatement(commandLines)
          if (complete) {
            this.execCommand(commandLines)
          }
        } catch (e) {
          // remove the empty line
          this.doc.lines = this.doc.lines.slice(0,-1)
          this.addPrompt()
          this.insertBeforePrompt([`\x1b[1;31m${String(e)}\x1b[0m`])
        }
      }
    }
  }

  insertBeforePrompt(newLines) {
    const oldLines = this.doc.lines.slice(0,this.promptOnLine)
    const promptLines = this.doc.lines.slice(this.promptOnLine)

    this.doc.lines = [...oldLines, ...newLines, ...promptLines]
    this.promptOnLine += newLines.length
    this.doc.pos.line += newLines.length

    this._setRowsFromLines()
    this._updateDisplay()
    this.draw();
  }

  insertAnsi(e) {
    super.insert(e)
  }

  colorize(js) {
    let x = hljs.highlight(js, {language: 'javascript', ignoreIllegals: true})
    return colorize(x.value,{theme})
  }

  insert(e) {
    super.insert(e)

    let commandLines = this.doc.lines.slice(this.promptOnLine)
    commandLines = commandLines.map((line) => stripAnsi(line))
    commandLines[0] = commandLines[0].slice(2)

    const colored = this.colorize(commandLines.join('\n')).split('\n')

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
