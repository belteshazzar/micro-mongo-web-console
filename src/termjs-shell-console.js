
import util from 'node-inspect-extracted'
import Table from 'nodejs-console-table'
import { Chalk } from 'chalk';


const chalk = new Chalk({ level: 1 })

// https://developer.mozilla.org/en-US/docs/Web/API/console/log_static
// https://developer.mozilla.org/en-US/docs/Web/API/console#using_string_substitutions

function util_inspect(o) {
    if ( o === undefined) return "undefined"
    if (typeof o == 'string') return `"${o}"`
    const s = util.inspect(o,{
        compact: true})
        .replaceAll("\n","\r");
    console.log(s)
    return s
}

const DEFAULT_LABEL = "default";

export default function(shell) {

    const counts = new Map();
    const timers = new Map();
    let indent = '';

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
            shell.insert(`${indent}${label}: ${c}\r`)
        },
        countReset: function(label = DEFAULT_LABEL) {
            let c = counts.get(label);
            if (c === undefined) {
                _console.warn(`Count for '${label}' does not exist\r`)
            } else {
                counts.set(label,0)
            }
        },
        debug: function(data,...args) {
            shell.insert(`${indent}${util_inspect(data)}\r`)
        },
        dir: function(obj,options) {
            shell.insert(`${indent}${util_inspect(obj)}\r`)
        },
        dirxml: function(obj,options) {
            shell.insert(`${indent}${util_inspect(obj)}\r`)
        },
        error: function(data,...args) {
            shell.insertAnsi(`${indent}${chalk.red('ERROR:')} ${util_inspect(data)}\r`)
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
            shell.insertAnsi(`${indent}${chalk.blue('INFO:')} ${util_inspect(data)}\r`)
        },
        log: function(data,...args) {
          shell.insert(`${indent}${util_inspect(data)}\r`)
        },
        profile: function() {},
        profileEnd: function() {},
        table: function(data,columns) {
            // TODO: examples from mozilla don't all work
            // https://developer.mozilla.org/en-US/docs/Web/API/console/table_static
            _console.log(new Table(data, columns).table.replaceAll("\n","\r"))
        },
        time: function(label = DEFAULT_LABEL) {
            if (timers.has(label)) {
                _console.warn(`Timer '${label}' already exists`)
            } else {
                timers.set(label,Date.now())
            }
        },
        timeEnd: function(label = DEFAULT_LABEL) {
            const t = timers.get(label)
            if (t === undefined) {
                _console.warn(`Timer '${label}' does not exist`)
            } else {
                _console.log(`${label}: ${Date.now() - t} ms`)
                timers.delete(label)
            }
        },
        timeLog: function(label = DEFAULT_LABEL) {
            const t = timers.get(label)
            if (t === undefined) {
                _console.warn(`Timer '${label}' does not exist`)
            } else {
                _console.log(`${label}: ${Date.now() - t} ms`)
            }
        },
        timeStamp: function() {},
        trace: function(msg,...args) {
            try {
                throw new Error()
            } catch (e) {
                shell.insert(`${util_inspect(e)}\r`)
            }
        },
        warn: function(data,...args) {
            shell.insertAnsi(`${indent}${chalk.yellow('WARNING:')} ${util_inspect(data)}\r`)
        }
    };

}