
import './style.css'
import '@xterm/xterm/css/xterm.css'
import 'highlight.js/styles/github.css'
import 'highlightjs-copy/styles/highlightjs-copy.css'

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import CopyButtonPlugin from 'highlightjs-copy';
import { Terminal } from '@xterm/xterm/lib/xterm.js'
import { FitAddon } from '@xterm/addon-fit';
import mongo from 'mongols'
import { TermShell } from './termjs-shell.js'

import shellConsole from './termjs-shell-console.js'
import history from './termjs-shell-history.js'

// highlight on webpage
hljs.addPlugin(
  new CopyButtonPlugin({
    autohide: false, // Always show the copy button
  })
);
hljs.registerLanguage('javascript', javascript);
hljs.highlightAll();

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
  fontWeight: 100,
  drawBoldTextInBrightColors: true,
  fontWeightBold: 100,
  lineHeight: 1.0,
  fontStyle: 'normal',
  theme: baseTheme,
  cursorBlink: true,
  scrollback: 0
})

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
window.onresize = function() {
  fitAddon.fit();
}

term.open(document.getElementById('terminal'));
fitAddon.fit();

const logo = 
`\x1b[1;31m  __  __ _                  __  __                         
 \x1b[1;31m|  \\/  (_) ___ _ __ ___   |  \\/  | ___  _ __   __ _  ___  
 \x1b[1;31m| |\\/| | |/ __| '__/ _ \\  | |\\/| |/ _ \\| '_ \\ / _\` |/ _ \\ 
 \x1b[1;31m| |  | | | (__| | | (_) | | |  | | (_) | | | | (_| | (_) |
 \x1b[1;31m|_|  |_|_|\\___|_|  \\___/  |_|  |_|\\___/|_| |_|\\__, |\\___/ 
 \x1b[1;31m                                              |___/
 `

const shell = new TermShell(term,{
  top: 1,
  left: 1,
  height: term.rows,
  width: term.cols,
  drawFrame: false,
  wrap: true,
  lines: logo.split('\n'),
  plugins: [shellConsole,history]
});

term.focus();

const NATIVE = function() { return '#native'; }

const globalPrototype = shell.global

const iframe = document.getElementById('playground').contentWindow
globalPrototype.window = iframe
globalPrototype.document = iframe.document

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
