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
import termCommand from './termjs-command.js'
import { TermFrame } from './termjs-frame.js';

const PROMPT = '\x1b[1;34m$\x1b[0m '
const PROMPTX = '\x1b[1;34m|\x1b[0m '
const ERASE_TO_END = '\x1b[0K'
const MOVE_UP = '\x1b[A'
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
  fontWeight: 400,
  drawBoldTextInBrightColors: true,
  fontWeightBold: 400,
  lineHeight: 1.0,
  fontStyle: 'normal',
  theme: baseTheme,
  cursorBlink: true,
  scrollback: 0//1000
})

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
window.onresize = function() {
  fitAddon.fit();
}

// term.onSelectionChange(() => {
//   console.log('onSelectionChange', term.getSelection());
// });

term.onScroll((e) => { 
  console.log('onScroll', e);
  return false;
 });


term.open(document.getElementById('terminal'));
fitAddon.fit();

term.write(PROMPT)

const frame = new TermFrame(term,1,1,10,20);
frame.draw();

term.focus();

term.attachCustomWheelEventHandler(ev => {
  // TODO:
  return false;
});

term.attachCustomKeyEventHandler((key) => {
  if (key.type != 'keydown') return false

  // allows copy/paste to work
  if (key.ctrlKey || key.metaKey || key.altKey) {
  } else if (key.code == 'ArrowLeft') {
    frame.keyLeft()
  } else if (key.code == 'ArrowRight') {
    frame.keyRight()
  } else if (key.code == 'ArrowUp') {
    frame.keyUp()
  } else if (key.code == 'ArrowDown') {
    frame.keyDown();
  } else if (key.code == 'Tab') {
    key.preventDefault()
    if (key.shiftKey) {
      frame.keyShiftTab()
    } else {
      frame.keyTab()
    }
  } else if (key.code == 'Backspace') {
    frame.keyBackspace()
  } else if (key.code == 'Delete') {
    frame.keyDelete()
  } else if (key.code == 'Enter') {
    frame.keyEnter()
  } else {
    return true;
  }
  return false
});

const globalPrototype = global()

const iframe = document.getElementById('playground').contentWindow
globalPrototype.window = iframe
globalPrototype.document = iframe.document

globalPrototype.console = termConsole(term)
globalPrototype.console.help = function() {
  term.write("\r\nJavaScript Console in the Browser\r\n\n")
}
globalPrototype.console.help.toString = NATIVE
globalPrototype.console.history = async function(i) {
  if (Number.isInteger(i) && i>0 && i<=cmd.history.length) {
    const c = cmd.history[i-1].join('\r\n');
    cmd.history.push([...cmd.history[i-1]]);
    term.write(PROMPT)
    term.write(c)
    term.write('\r\n')
    await execCommand(c)
  } else {
    for (let i=0 ; i<cmd.history.length ; i++) {
      term.write(`${i+1}\t${cmd.history[i].join('\r\n\t')}\r\n`)
    }
  }
}
Object.values(globalPrototype.console).forEach((v) => v.toString = NATIVE)

globalPrototype.db = new mongo.DB();
globalPrototype.db.toString = NATIVE
Object.values(globalPrototype.db).forEach((v) => v.toString = NATIVE)

class ObjectId {
  constructor(s) {
    this.id = s ? s : Math.random().toString(36).substring(7);
  }
  toString() {
    return this.id;
  }
}
globalPrototype.ObjectId = function (s) { return new ObjectId(s); }
globalPrototype.ISODate = function (s) { return new Date(s); }

const sval = new Sval({
  ecmaVer: 'latest',
  sourceType: 'module',
  globalObject: globalPrototype
})


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
