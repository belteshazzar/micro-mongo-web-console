
import util from 'node-inspect-extracted'
import Table from 'nodejs-console-table'
import { Chalk } from 'chalk';


const chalk = new Chalk({ level: 1 })

// https://developer.mozilla.org/en-US/docs/Web/API/console/log_static
// https://developer.mozilla.org/en-US/docs/Web/API/console#using_string_substitutions


const DEFAULT_LABEL = "default";

export default function(shell) {

    const counts = new Map();
    const timers = new Map();
    let indent = '';

    function util_inspect(o) {
      if ( o === undefined) return "undefined"
      if (typeof o == 'string') return `"${o}"`
      return util.inspect(o,{
          compact: true})
    }
  
    shell.global.console = {
        assert: function(assertion) {
            if (!assertion) throw new Error('Assertion failed')
        },
        clear: function() {
            shell.clear()
        },
        count: function(label = DEFAULT_LABEL) {
            let c = counts.get(label)
            if (c === undefined) {
                c = 1
            } else {
                c++
            }
            counts.set(label,c)
            shell.insertBeforePrompt([`${indent}${label}: ${c}`])
        },
        countReset: function(label = DEFAULT_LABEL) {
            let c = counts.get(label);
            if (c === undefined) {
                shell.global.console.warn(`Count for '${label}' does not exist`)
            } else {
                counts.set(label,0)
            }
        },
        debug: function(data,...args) {
            shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(data))}`])
        },
        dir: function(obj,options) {
            shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(obj))}`])
        },
        dirxml: function(obj,options) {
            shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(obj))}`])
        },
        error: function(data,...args) {
            shell.insertBeforePrompt([`${indent}${chalk.red('ERROR:')} ${shell.colorize(util_inspect(data))}`])
        },
        group: function(label) {
            indent += '   '
        },
        groupCollapsed: function() {
            indent += '   '
        },
        groupEnd: function() {
            indent = indent.length > 3 ? indent.slice(-3) : ''
        },
        info: function(data,...args) {
            shell.insertBeforePrompt([`${indent}${chalk.blue('INFO:')} ${shell.colorize(util_inspect(data))}`])
        },
        log: function(data,...args) {
          shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(data))}`])
        },
        profile: function() {},
        profileEnd: function() {},
        reset: function() {
          shell.reset()
        },
        table: function(data,columns) {
            // TODO: examples from mozilla don't all work
            // https://developer.mozilla.org/en-US/docs/Web/API/console/table_static
            shell.global.console.log(new Table(data, columns).table.replaceAll("\n","\r"))
        },
        time: function(label = DEFAULT_LABEL) {
            if (timers.has(label)) {
                shell.global.console.warn(`Timer '${label}' already exists`)
            } else {
                timers.set(label,Date.now())
            }
        },
        timeEnd: function(label = DEFAULT_LABEL) {
            const t = timers.get(label)
            if (t === undefined) {
                shell.global.console.warn(`Timer '${label}' does not exist`)
            } else {
                shell.insertBeforePrompt([`${label}: ${Date.now() - t} ms`])
                timers.delete(label)
            }
        },
        timeLog: function(label = DEFAULT_LABEL) {
            const t = timers.get(label)
            if (t === undefined) {
                shell.global.console.warn(`Timer '${label}' does not exist`)
            } else {
                shell.insertBeforePrompt([`${indent}${label}: ${Date.now() - t} ms`])
            }
        },
        timeStamp: function() {},
        trace: function(msg,...args) {
            try {
                throw new Error()
            } catch (e) {
              let s = `${util.inspect(e)}`.split('\n')
              s[0] = s[0].slice(1)
              s[s.length-1] = s[s.length-1].slice(0,-1)
              s = s.map((v) => `${indent}${v}`)
              shell.insertBeforePrompt(s)
            }
        },
        warn: function(data,...args) {
            shell.insertBeforePrompt([`${indent}${chalk.yellow('WARNING:')} ${shell.colorize(util_inspect(data))}`])
        }
    };

}