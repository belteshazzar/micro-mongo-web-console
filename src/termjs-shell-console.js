
import util from 'node-inspect-extracted'
import { Chalk } from 'chalk';
import stripAnsi from 'strip-ansi'

const chalk = new Chalk({ level: 1 })

const getStringWidth = (str) => stripAnsi(str).length

const tableChars = {
  middleMiddle: '─',
  rowMiddle: '┼',
  topRight: '┐',
  topLeft: '┌',
  leftMiddle: '├',
  topMiddle: '┬',
  bottomRight: '┘',
  bottomLeft: '└',
  bottomMiddle: '┴',
  rightMiddle: '┤',
  left: '│ ',
  right: ' │',
  middle: ' │ ',
};

const renderRow = (row, columnWidths) => {
  // console.log(row)
  let out = tableChars.left;
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    const len = getStringWidth(`${cell}`);
    const needed = (columnWidths[i] - len);
    // round(needed) + ceil(needed) will always add up to the amount
    // of spaces we need while also left justifying the output.
    out += cell + ' '.repeat(Math.ceil(needed));
    if (i !== row.length - 1)
      out += tableChars.middle;
  }
  out += tableChars.right;
  return out;
};

const renderTable = (head, columns) => {

  const rows = [];
//  console.log(head,columns)
  const columnWidths = head.map((h) => getStringWidth(`${h}`));
  const longestColumn = Math.max( ... columns.map((a) => {
//    console.log(a,a.length)
    return a.length
  }));

  for (let i = 0; i < head.length; i++) {
    const column = columns[i];
  //  console.log(i,columns[i])
    for (let j = 0; j < longestColumn; j++) {
      if (rows[j] === undefined)
        rows[j] = [];
      const value = rows[j][i] =
        column.hasOwnProperty(j) ? column[j] : '';
      const width = columnWidths[i] || 0;
      const counted = getStringWidth(`${value}`);
      columnWidths[i] = Math.max(width, counted);
    }
  }

  // console.log(rows)

  const divider = columnWidths.map((i) =>
    tableChars.middleMiddle.repeat(i + 2));

  let result = [tableChars.topLeft +
    divider.join(tableChars.topMiddle) +
    tableChars.topRight,
    renderRow(head, columnWidths),
    tableChars.leftMiddle +
    divider.join(tableChars.rowMiddle) +
    tableChars.rightMiddle];

  for (const row of rows)
    result.push(`${renderRow(row, columnWidths)}`);

  result.push(tableChars.bottomLeft +
    divider.join(tableChars.bottomMiddle) +
    tableChars.bottomRight);

  return result;
};


const DEFAULT_LABEL = "default";

export default function (shell) {

  const counts = new Map();
  const timers = new Map();
  let indent = '';

  function util_inspect(o) {
    if (o === undefined) return "undefined"
    if (typeof o == 'string') return `"${o}"`
    return util.inspect(o, {
      compact: true
    })
  }

  shell.global.console = {
    assert: function (assertion) {
      if (!assertion) throw new Error('Assertion failed')
    },
    clear: function () {
      shell.clear()
    },
    count: function (label = DEFAULT_LABEL) {
      let c = counts.get(label)
      if (c === undefined) {
        c = 1
      } else {
        c++
      }
      counts.set(label, c)
      shell.insertBeforePrompt([`${indent}${label}: ${c}`])
    },
    countReset: function (label = DEFAULT_LABEL) {
      let c = counts.get(label);
      if (c === undefined) {
        shell.insertBeforePrompt([`${indent}${chalk.yellow('WARNING:')} Count for '${label}' does not exist`])
      } else {
        counts.set(label, 0)
      }
    },
    debug: function (data, ...args) {
      shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(data))}`])
    },
    dir: function (obj, options) {
      shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(obj))}`])
    },
    dirxml: function (obj, options) {
      shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(obj))}`])
    },
    error: function (data, ...args) {
      shell.insertBeforePrompt([`${indent}${chalk.red('ERROR:')} ${shell.colorize(util_inspect(data))}`])
    },
    group: function (label) {
      indent += '   '
    },
    groupCollapsed: function () {
      indent += '   '
    },
    groupEnd: function () {
      indent = indent.length > 3 ? indent.slice(-3) : ''
    },
    info: function (data, ...args) {
      shell.insertBeforePrompt([`${indent}${chalk.blue('INFO:')} ${shell.colorize(util_inspect(data))}`])
    },
    log: function (data, ...args) {
      shell.insertBeforePrompt([`${indent}${shell.colorize(util_inspect(data))}`])
    },
    profile: function () { },
    profileEnd: function () { },
    reset: function () {
      shell.reset()
    },
    table: (tabularData, properties) => {
      let headingsMap = null
      if (properties !== undefined) {
        if (!Array.isArray(properties)) throw new Error('properties must be an array')
        headingsMap = new Map()
        properties.forEach((v) => headingsMap.set(v,v))
      }

      if (tabularData === null || typeof tabularData !== 'object') {
        return
      }

      if (Array.isArray(tabularData)) {
        const row0 = tabularData[0]

        if (Array.isArray(row0)) {
          // array of arrays
          let headings = ['(index)']
          const columns = [[]]
          for (let i=0 ; i<row0.length ; i++) {
            if (headingsMap == null || headingsMap.has(i)) {
              headings.push(i)
              columns.push([])
            }
          }
          for (let r=0 ; r<tabularData.length ; r++) {
            columns[0][r] = r
            for (let c=1 ; c<headings.length ; c++) {
              columns[c][r] = tabularData[r][headings[c]]
            }
          }
          shell.insertBeforePrompt(renderTable(headings,columns))
        } else if (row0 !== null && typeof row0 === 'object') {
          // array of objects
          let headings = ['(index)']
          Object.keys(row0).sort().forEach((k) => {
            if (headingsMap == null || headingsMap.has(k)) {
              headings.push(k)
            }
          })
          let columns = []
          headings.forEach((v) => columns.push([]))
          for (let r=0 ; r<tabularData.length ; r++) {
            columns[0].push(r)
            for (let c=1 ; c<headings.length ; c++) {
              columns[c].push(tabularData[r][headings[c]])
            }
          }
          shell.insertBeforePrompt(renderTable(headings,columns))
        } else {
          // array of primitives
          let headings = ['(index)','Values']
          const columns = [[],[]]
          for (let r=0 ; r<tabularData.length ; r++) {
            columns[0][r] = r
            columns[1][r] = tabularData[r]
          }
          shell.insertBeforePrompt(renderTable(headings,columns))
        }
      } else if (tabularData !== null && typeof tabularData === 'object') {
        const row0 = tabularData[Object.keys(tabularData)[0]]

        if (row0 != null && typeof row0 === 'object') {
          // object of objects
          let headings = ['(index)']
          Object.keys(row0).sort().forEach((k) => {
            if (headingsMap == null || headingsMap.has(k)) {
              headings.push(k)
            }
          })
          let columns = []
          headings.forEach((v) => columns.push([]))
          Object.keys(tabularData).sort().forEach((r) => {
            columns[0].push(r)
            for (let c=1 ; c<headings.length ; c++) {
              columns[c].push(tabularData[r][headings[c]])
            }
          })
          shell.insertBeforePrompt(renderTable(headings,columns))
        } else {
          // object
          let headings = ['(index)','Values']
          let columns = [[],[]]
          Object.keys(tabularData).sort().forEach((k) => {
            columns[0].push(k)
            columns[1].push(tabularData[k])
          })
          shell.insertBeforePrompt(renderTable(headings,columns))
        }
      }
    },
    time: function (label = DEFAULT_LABEL) {
      if (timers.has(label)) {
        shell.insertBeforePrompt([`${indent}${chalk.yellow('WARNING:')} Timer '${label}' already exists`])
      } else {
        timers.set(label, Date.now())
      }
    },
    timeEnd: function (label = DEFAULT_LABEL) {
      const t = timers.get(label)
      if (t === undefined) {
        shell.insertBeforePrompt([`${indent}${chalk.yellow('WARNING:')} Timer '${label}' does not exist`])
      } else {
        shell.insertBeforePrompt([`${label}: ${Date.now() - t} ms`])
        timers.delete(label)
      }
    },
    timeLog: function (label = DEFAULT_LABEL) {
      const t = timers.get(label)
      if (t === undefined) {
        shell.insertBeforePrompt([`${indent}${chalk.yellow('WARNING:')} Timer '${label}' does not exist`])
      } else {
        shell.insertBeforePrompt([`${indent}${label}: ${Date.now() - t} ms`])
      }
    },
    timeStamp: function () { },
    trace: function (msg, ...args) {
      try {
        throw new Error()
      } catch (e) {
        let s = `${util.inspect(e)}`.split('\n')
        s[0] = s[0].slice(1)
        s[s.length - 1] = s[s.length - 1].slice(0, -1)
        s = s.map((v) => `${indent}${v}`)
        shell.insertBeforePrompt(s)
      }
    },
    warn: function (data, ...args) {
      shell.insertBeforePrompt([`${indent}${chalk.yellow('WARNING:')} ${shell.colorize(util_inspect(data))}`])
    }
  };
}