
import util from 'node-inspect-extracted'
import Table from 'nodejs-console-table'

// https://developer.mozilla.org/en-US/docs/Web/API/console/log_static
// https://developer.mozilla.org/en-US/docs/Web/API/console#using_string_substitutions

function util_inspect(o) {
    if ( o === undefined) return "undefined"
    if (typeof o == 'string') return `\x1b[32m${o}\x1b[0m`
    return util.inspect(o,{
        compact: true,
        stylize: util.stylizeWithColor})
        .replaceAll("\n","\n\r");
}

const DEFAULT_LABEL = "default";

export default function termConsole(term) {

    const counts = new Map();
    const timers = new Map();
    let indent = '';

    let console = {
        assert: function(assertion) {
            if (!assertion) throw new Error('Assertion failed')
        },
        clear: function() {
            term.clear()
        },
        count: function(label = DEFAULT_LABEL) {
            let c = counts.get(label)
            if (c === undefined) {
                c = 1
            } else {
                c++
            }
            counts.set(label,c)
            term.write(`${indent}${label}: ${c}\n\r`)
        },
        countReset: function(label = DEFAULT_LABEL) {
            let c = counts.get(label);
            if (c === undefined) {
                console.warn(`Count for '${label}' does not exist`)
            } else {
                counts.set(label,0)
            }
        },
        debug: function(data,...args) {
            term.write(`${indent}${util_inspect(data)}\n\r`)
        },
        dir: function(obj,options) {
            term.write(`${indent}${util_inspect(obj)}\n\r`)
        },
        dirxml: function(obj,options) {
            term.write(`${indent}${util_inspect(obj)}\n\r`)
        },
        error: function(data,...args) {
            term.write(`${indent}\x1b[91mERROR:\x1b[0m ${util_inspect(data)}\x1b[0m\n\r`)
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
            term.write(`${indent}\x1b[94mINFO:\x1b[0m ${util_inspect(data)}\x1b[0m\n\r`)
        },
        log: function(data,...args) {
          //console.log(data)
            term.insert(`${indent}${util_inspect(data)}\n\r`)
        },
        profile: function() {},
        profileEnd: function() {},
        table: function(data,columns) {
            // TODO: examples from mozilla don't all work
            // https://developer.mozilla.org/en-US/docs/Web/API/console/table_static
            console.log(new Table(data, columns).table.replaceAll("\n","\n\r"))
        },
        time: function(label = DEFAULT_LABEL) {
            if (timers.has(label)) {
                console.warn(`Timer '${label}' already exists`)
            } else {
                timers.set(label,Date.now())
            }
        },
        timeEnd: function(label = DEFAULT_LABEL) {
            const t = timers.get(label)
            if (t === undefined) {
                console.warn(`Timer '${label}' does not exist`)
            } else {
                console.log(`${label}: ${Date.now() - t} ms`)
                timers.delete(label)
            }
        },
        timeLog: function(label = DEFAULT_LABEL) {
            const t = timers.get(label)
            if (t === undefined) {
                console.warn(`Timer '${label}' does not exist`)
            } else {
                console.log(`${label}: ${Date.now() - t} ms`)
            }
        },
        timeStamp: function() {},
        trace: function(msg,...args) {
            try {
                throw new Error()
            } catch (e) {
                term.write(`${util_inspect(e)}`)
            }
        },
        warn: function(data,...args) {
            term.write(`${indent}\x1b[93mWARNING:\x1b[0m ${util_inspect(data)}\x1b[0m\n\r`)
        }
    };

    return console;
}