import './style.css'
import '@xterm/xterm/css/xterm.css'
import 'highlight.js/styles/github.css'
import 'highlightjs-copy/styles/highlightjs-copy.css'

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import CopyButtonPlugin from 'highlightjs-copy';

hljs.addPlugin(
  new CopyButtonPlugin({
    autohide: false, // Always show the copy button
  })
);
hljs.registerLanguage('javascript', javascript);
hljs.highlightAll();

import { Terminal } from '@xterm/xterm/lib/xterm.js'
import { FitAddon } from '@xterm/addon-fit';
import Sval from './sval-fork.js';
import global from './global.js'
import termConsole from './termjs-console.js'
import mongo from 'mongols'

// https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797?permalink_comment_id=3857871

const HISTORY_INTERVAL = 200
const PROMPT = '\x1b[1;34m$\x1b[0m '
const PROMPT_LENGTH = 2
const ERASE_LINE = '\x1b[2K'
const MOVE_UP = '\x1b[A'
const MOVE_DOWN = '\x1b[B'
const MOVE_RIGHT = '\x1b[C'
const MOVE_LEFT = '\x1b[D'
const NATIVE = function() { return '#native'; }

// https://jakob-bagterp.github.io/colorist-for-python/ansi-escape-codes/standard-16-colors/#foreground-text-colors
const baseTheme = {
  foreground: '#F8F8F8',
  background: '#2D2E2C',
  selection: '#5DA5D533',
  black: '#1E1E1D',
  brightBlack: '#262625',
  red: '#CE5C5C',
  brightRed: '#FF7272',
  green: '#5BCC5B',
  brightGreen: '#72FF72',
  yellow: '#CCCC5B',
  brightYellow: '#FFFF72',
  blue: '#5D5DD3',         // \x1b[1;34m
  brightBlue: '#7279FF',   // \x1b[1;94m
  magenta: '#BC5ED1',
  brightMagenta: '#E572FF',
  cyan: '#5DA5D5',
  brightCyan: '#72F0FF',
  white: '#F8F8F8',
  brightWhite: '#FFFFFF'
};

const term = new Terminal({
  fontFamily: 'monospace',
  fontSize: 13,
  fontWeight: 300,
  drawBoldTextInBrightColors: true,
  fontWeightBold: 300,
  lineHeight: 1.2,
  fontStyle: 'normal',
  theme: baseTheme,
  cursorBlink: true,
})
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
window.onresize = function() {
  fitAddon.fit();
  // console.log(term.cols)
  // console.log(term.rows)
}

term.open(document.getElementById('terminal'));
fitAddon.fit();

term.write(PROMPT)
term.focus();

term.attachCustomKeyEventHandler((key) => {
  // allows copy/paste to work
  if (key.ctrlKey || key.metaKey || key.altKey) {
    return false;
  } else if (key.code == 'ArrowLeft') {
    return true;
  } else if (key.code == 'ArrowRight') {
    return true;
  } else if (key.code == 'ArrowUp') {
    const now = Date.now()
    if (now > historyMillis + HISTORY_INTERVAL) {
      historyMillis = now

      if (cmdY>0) { 
        // not on first line of command
        cmdY--
        cmdX = Math.min(cmd[cmdY].length,cmdX)
        term.write(MOVE_UP)
console.log('up to cmdX = ' + cmdX + ' col=' + (cmdX + (cmdY==0?PROMPT_LENGTH:0)))
        // take into account the prompt
        term.write(`\x1b[${cmdX + 5}G`)// + (cmdY==0?PROMPT_LENGTH:0)}G`)
      } else {
        // on first line, show previous
        const oldPos = historyPos
        if (historyPos > 0) {
          historyPos--;
        } else if (historyPos < 0) {
          historyPos = history.length - 1
        }

        if (historyPos != oldPos) {
          // move to col 0
          term.write(`\x1b[${0}G`)
          term.write(ERASE_LINE)
          if (oldPos != -1) {
            // erase lines
            for (let i=1 ; i<cmd.length ; i++) {
              term.write(MOVE_DOWN)
              term.write(ERASE_LINE)
            }
            // move back to first line
            for (let i=1 ; i<cmd.length ; i++) {
              term.write(MOVE_UP)
            }
          }

          term.write(PROMPT)
          cmd = [...history[historyPos]]
          cmdY = cmd.length - 1
          cmdX = cmd[cmdY].length
          term.write(cmd.join('\r\n'))
        }
      }  
    }
    return false;
  } else if (key.code == 'ArrowDown') {
    const now = Date.now()
    if (now > historyMillis + HISTORY_INTERVAL) {
      historyMillis = now

      if (cmdY < cmd.length-1) {
        // not on last line, move down
        cmdY++
        term.write(MOVE_DOWN)
        cmdX = Math.min(cmd[cmdY].length,cmdX)
        term.write(`\x1b[${cmdX}G`)
      } else {
        // show next history command
        const oldPos = historyPos;
        if (historyPos>-1) {
          historyPos = Math.min(historyPos + 1, history.length)
          if (historyPos == history.length) {
            historyPos = -1
          }
        }

        if (historyPos != oldPos) {
          // move to col 0
          term.write(`\x1b[${0}G`)
          term.write(ERASE_LINE)
          // erase lines
          for (let i=1 ; i<cmd.length ; i++) {
            term.write(MOVE_UP)
            term.write(ERASE_LINE)
          }

          term.write(PROMPT)

          if (historyPos != -1) {
            cmd = [...history[historyPos]]
            cmdY = cmd.length-1
            cmdX = cmd[cmdY].length
            console.log('down x = ' + cmdX)
            term.write(cmd.join('\r\n'))
            // term.write(`\x1b[${cmdX + (cmdY==0 ? PROMPT_LENGTH : 0)}G`)
          } else {
            cmd = ['']
            cmdY = 0
            cmdX = 0
          }
        }
      }
    }
    return false;
  }

  return true;
});

const globalPrototype = global()

const iframe = document.getElementById('playground').contentWindow
globalPrototype.window = iframe
globalPrototype.document = iframe.document

globalPrototype.console = termConsole(term)
// globalPrototype.console.toString = NATIVE
globalPrototype.console.help = function() {
  term.write("JavaScript terminal in the Browser");
  term.write("\r\n")
}
globalPrototype.console.help.toString = NATIVE
globalPrototype.console.history = async function(i) {
  if (Number.isInteger(i) && i>0 && i<=history.length) {
    const c = history[i-1].join('\r\n');
    history.push([...history[i-1]]);
    term.write(PROMPT)
    term.write(c)
    term.write('\r\n')
    await execCommand(c)
  } else {
    for (let i=0 ; i<history.length ; i++) {
    }
  }
}
Object.values(globalPrototype.console).forEach((v) => v.toString = NATIVE)

globalPrototype.db = new mongo.DB();
globalPrototype.db.toString = NATIVE
Object.values(globalPrototype.db).forEach((v) => v.toString = NATIVE)

const sval = new Sval({
  ecmaVer: 'latest',
  sourceType: 'module',
  globalObject: globalPrototype
})

let historyMillis = Date.now();
let history = []
let historyPos = -1;
let cmd = ['']
let cmdX = 0;
let cmdY = 0;
const parseErrorRegex = /(\d+):(\d+)/

function parseCommand(c) {
  try {
    return sval.parse(cmd.join('\n'));
  } catch (e) {
    let m = parseErrorRegex.exec(e.message)
    if (m && cmd.length == m[1] && cmd[cmd.length-1].length == m[2]) {
      cmd.push('')
      cmdX = 0;
      cmdY++
      return null;
    }
    throw e;
  }
}

async function execCommand(astOrString) {

  historyPos = -1;
  cmd = [''];
  cmdX = 0;
  cmdY = 0;

  try {
    const res = `${await sval.run(astOrString)}`
    if (res !== 'undefined') {
      term.write(res);
      term.write('\r\n')
    }
  } catch (e) {
    term.write(`\x1b[1;31m${String(e)}\x1b[0m\r\n`)
  }

}

term.onData(async e => {

  if (e === '\r') {
    term.write(`\r\n`)

    if (cmd.length == 1 && cmd[0].trim().length == 0) {
      term.write(PROMPT)
    } else {

      try {
        const ast = parseCommand(cmd);

        if (ast) {
          history.push(cmd);
          await execCommand(ast);
          term.write(PROMPT)
        }
      } catch (e) {
        term.write(e.message)
        term.write('\r\n')
        term.write(PROMPT)
        history.push(cmd);
        historyPos = -1;
        cmdX = 0;
        cmdY = 0;
        cmd = [''];
        return
      }
    }
  } else if (e === '\x7F') { // backspace

    if (cmd[cmdY].length > 0) {
      term.write('\x1b[1D')
      cmdX--
      const left = cmd[cmdY].substring(0,cmdX)
      const rightNow = cmd[cmdY].substring(cmdX+1)
      term.write(rightNow + ' ')
      term.write(`\x1b[${rightNow.length+1}D`)
      cmd[cmdY] = left + rightNow
    }

  } else if (e === '\x1b[3~') { // delete

    if (cmd[cmdY].length > 0 && cmdX < cmd[cmdY].length) {
      const left = cmd[cmdY].substring(0,cmdX)
      const rightNow = cmd[cmdY].substring(cmdX+1)
      term.write(rightNow + ' ')
      term.write(`\x1b[${rightNow.length+1}D`)
      cmd[cmdY] = left + rightNow
    }

  } else if (e == '\x1b[D') { // left
    if (cmdX != 0) {
      cmdX--
      console.log(cmdX)
      term.write(e)
    }
  } else if (e == '\x1b[C') { // right
    if (cmdX != cmd[cmdY].length) {
      cmdX++
      console.log(cmdX)
      term.write(e)
    }
} else {
  // TODO: handle paste while in the middle of a line 
    // may be multiple lines from paste
    const lns = e.split('\r')
    const txt = lns.join('\r\n')
    term.write(txt)

    if (cmdX == 0) {
      if (cmd[cmdY].length>0) {
        term.write(cmd[cmdY])
        term.write(`\x1b[${cmd[cmdY].length}D`)
      }
      cmd[cmdY] = txt + cmd[cmdY]
    } else if (cmdX == cmd[cmdY].length) {
      cmd[cmdY] = cmd[cmdY] + txt
    } else {
      const right = cmd[cmdY].substring(cmdX)
      term.write(right)
      term.write(`\x1b[${right.length}D`)
      cmd[cmdY] = cmd[cmdY].substring(0,cmdX) + txt + right
    }
    cmdX += txt.length // TODO: handle multi-line paste
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
