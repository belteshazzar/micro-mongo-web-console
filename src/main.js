import './style.css'
import '@xterm/xterm/css/xterm.css'
import { Terminal } from '@xterm/xterm/lib/xterm.js'
import { FitAddon } from '@xterm/addon-fit';
import Sval from './sval.js';
import util from 'node-inspect-extracted'
import Global from './global.js'

const globalObj = new Global()
// https://developer.mozilla.org/en-US/docs/Web/API/console/log_static
// https://developer.mozilla.org/en-US/docs/Web/API/console#using_string_substitutions

function util_inspect(o) {
  return util.inspect(o,{
    compact: true,
    stylize: util.stylizeWithColor})
    .replaceAll("\n","\n\r");
}


globalObj.console = {
  assert: window.console.assert,
  debug: window.console.debug,
  error: window.console.error,
  log: function(m) {
    term.write(util_inspect(m));
    term.write("\n\r")
  }
}
globalObj.db = {

}
globalObj.fs = {
  ls: function() {
    term.write("example.js\n\r")
  }
}
globalObj.help = function() {
  term.write("JavaScript terminal in the Browser");
  term.write("\n\r")
}

const sval = new Sval({
  ecmaVer: 'latest',
  sourceType: 'module',
  globalObject: globalObj
})




sval.run(`
import Airplane from 'https://raw.githubusercontent.com/DaveEveritt/js-module-example/master/airplane.js'
`);

const term = new Terminal({
  'theme': {
    background: 'rgb(46, 49, 56)',
    foreground: 'rgb(204, 204, 204)',
    cursor: 'rgb(204, 204, 204)'

  }
})

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal'));
fitAddon.fit();
window.onresize = function() {
  fitAddon.fit();
  // console.log(term.cols)
  // console.log(term.rows)
}
term.write('$ ')

let history = []
let historyPos = -1;
let cmd = ''

const parseErrorRegex = /(\d+):(\d+)/

term.onData(e => {
  if (e === '\r') {
    term.write(`\r\n`)

    try {
      sval.parse(cmd);
    } catch (e) {
      let m = parseErrorRegex.exec(e.message)
      let lines = cmd.split('\n')
      if (m && lines.length == m[1] && lines[lines.length-1].length == m[2]) {
        cmd += '\n'
        return;
      } else {
        term.write(e.message)
        term.write('\n\r$ ')
        cmd = '';
        return
      }
    }

    try {
      term.write(`${sval.run(cmd)}`);
    } catch (e) {
      term.write(`${String(e)}`);
    }

    term.write('\n\r$ ')
    cmd = '';
  } else if (e === '\x7F') {
    if (cmd.length > 0) {
      term.write('\b \b')
      cmd = cmd.slice(0,-1)
    }
  } else if (e.length == 3 && e.charCodeAt(0) == 27 && e.charCodeAt(1) == 91 ) {
    switch (e.charCodeAt(2)) {
      case 65: // up
        break;
      case 66: // down
        break;
      case 67: // right
        break;
      case 68: // left
        break;
      default: console.log(e.charCodeAt(2))
    }

  } else {
    term.write(e)
    cmd += e
  }
})
