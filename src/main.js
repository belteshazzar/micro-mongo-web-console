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

const historyInterval = 300
const PROMPT = '\x1b[1;34m$\x1b[0m '
const DEL_LINE = '\x1b[2K\r'
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
    if (now > historyMillis + historyInterval) {
      historyMillis = now

      const oldPos = historyPos
      if (historyPos > 0) {
        historyPos--;
      } else if (historyPos < 0) {
        historyPos = history.length - 1
      }

      if (historyPos != oldPos) {
        term.write(DEL_LINE)
        term.write(PROMPT)
        cmd = history[historyPos]
        cmdPos = cmd.length
        term.write(cmd)
      }
  
    }
    return false;
  } else if (key.code == 'ArrowDown') {
    const now = Date.now()
    if (now > historyMillis + historyInterval) {
      historyMillis = now

      const oldPos = historyPos;
      if (historyPos>-1) {
        historyPos = Math.min(historyPos + 1, history.length)
        if (historyPos == history.length) {
          historyPos = -1
        }
      }

      if (historyPos != oldPos) {

        term.write(DEL_LINE)
        term.write(PROMPT)

        if (historyPos != -1) {
          cmd = history[historyPos]
          cmdPos = cmd.length
          term.write(cmd)
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
globalPrototype.console.toString = NATIVE
Object.values(globalPrototype.console).forEach((v) => v.toString = NATIVE)
globalPrototype.db = new mongo.DB();
globalPrototype.db.toString = NATIVE
Object.values(globalPrototype.db).forEach((v) => v.toString = NATIVE)
globalPrototype.help = function() {
  term.write("JavaScript terminal in the Browser");
  term.write("\n\r")
}
globalPrototype.help.toString = NATIVE
globalPrototype.history = async function(i) {
  if (Number.isInteger(i) && i>0 && i<=history.length) {
    const c = history[i-1];
    history.push(c);
    term.write(PROMPT)
    term.write(c)
    term.write('\r\n')
    await execCommand(c)
  } else {
    for (let i=0 ; i<history.length ; i++) {
      term.write(`${i+1}\t${history[i]}\n\r`)
    }
  }
}
globalPrototype.history.toString = NATIVE

const sval = new Sval({
  ecmaVer: 'latest',
  sourceType: 'module',
  globalObject: globalPrototype
})

let historyMillis = Date.now();
let history = []
let historyPos = -1;
let cmd = ''
let cmdPos = 0;
const parseErrorRegex = /(\d+):(\d+)/

function parseCommand(c) {
  try {
    return sval.parse(cmd);
  } catch (e) {
    let m = parseErrorRegex.exec(e.message)
    let lines = cmd.split('\n')
    if (m && lines.length == m[1] && lines[lines.length-1].length == m[2]) {
      cmd += '\n'
      cmdPos++
      return null;
    }
    throw e;
  }
}

async function execCommand(astOrString) {

  historyPos = -1;
  cmdPos = 0;
  cmd = '';

  try {
    const res = `${await sval.run(astOrString)}`
    if (res !== 'undefined') {
      term.write(res);
      term.write('\n\r')
    }
  } catch (e) {
    term.write(`\x1b[1;31m${String(e)}\x1b[0m\n\r`)
  }

}

term.onData(async e => {

  if (e === '\r') {
    term.write(`\r\n`)

    try {
      const ast = parseCommand(cmd);

      if (ast) {

        history.push(cmd);
        await execCommand(ast);

        term.write(PROMPT)
      }
    } catch (e) {
      term.write(e.message)
      term.write('\n\r')
      term.write(PROMPT)
      history.push(cmd);
      historyPos = -1;
      cmdPos = 0;
      cmd = '';
      return
    }

  } else if (e === '\x7F') { // backspace

    if (cmd.length > 0) {
      term.write('\x1b[1D')
      cmdPos--
      const left = cmd.substring(0,cmdPos)
      const rightNow = cmd.substring(cmdPos+1)
      term.write(rightNow + ' ')
      term.write(`\x1b[${rightNow.length+1}D`)
      cmd = left + rightNow
    }

  } else if (e === '\x1b[3~') { // delete

    if (cmd.length > 0 && cmdPos < cmd.length) {
      const left = cmd.substring(0,cmdPos)
      const rightNow = cmd.substring(cmdPos+1)
      term.write(rightNow + ' ')
      term.write(`\x1b[${rightNow.length+1}D`)
      cmd = left + rightNow
    }

  } else if (e == '\x1b[D') { // left
    if (cmdPos != 0) {
      cmdPos--
      term.write(e)
    }
  } else if (e == '\x1b[C') { // right
    if (cmdPos != cmd.length) {
      cmdPos++
      term.write(e)
    }
} else {
    // may be multiple lines from paste
    const txt = e.replaceAll('\r','\r\n')
    term.write(txt)
    if (cmdPos == 0) {
      if (cmd.length>0) {
        term.write(cmd)
        term.write(`\x1b[${cmd.length}D`)
      }
      cmd = txt + cmd
    } else if (cmdPos == cmd.length) {
      cmd = cmd + txt
    } else {
      const right = cmd.substring(cmdPos)
      term.write(right)
      term.write(`\x1b[${right.length}D`)
      cmd = cmd.substring(0,cmdPos) + txt + right
    }
    cmdPos += txt.length
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
