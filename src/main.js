
import './style.css'
import '@xterm/xterm/css/xterm.css'
import 'highlight.js/styles/github.css'
import 'highlightjs-copy/styles/highlightjs-copy.css'

import theme from './ansi-hljs-theme.js'
import colorize from './ansi-hljs.js'
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import CopyButtonPlugin from 'highlightjs-copy';
import { Terminal } from '@xterm/xterm/lib/xterm.js'
import { FitAddon } from '@xterm/addon-fit';
import Sval from './sval-fork.js';

import termConsole from './termjs-console.js'
import mongo from 'mongols'
//import termCommand from './termjs-command.js'
// import stripAnsi from 'strip-ansi'
import { TermShell } from './termjs-shell.js'

hljs.addPlugin(
  new CopyButtonPlugin({
    autohide: false, // Always show the copy button
  })
);
hljs.registerLanguage('javascript', javascript);
hljs.highlightAll();

//const PROMPT = '\x1b[1;34m$\x1b[0m '
const PROMPTX = '\x1b[1;34m|\x1b[0m '
const ERASE_TO_END = '\x1b[0K'
const MOVE_UP = '\x1b[A'
// const MOVE_RIGHT = '\x1b[C'
// const MOVE_LEFT = '\x1b[D'

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

//term.write(PROMPT)


const frame = new TermShell(term,{
  top: 1,
  left: 1,
  height: term.rows,
  width: 20,//term.cols,
  drawFrame: true,
  wrap: true
});

term.focus();

term.attachCustomWheelEventHandler(ev => {
  // TODO:
  return false;
});


const globalPrototype = frame.global

const iframe = document.getElementById('playground').contentWindow
globalPrototype.window = iframe
globalPrototype.document = iframe.document

globalPrototype.console = termConsole(frame)
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
