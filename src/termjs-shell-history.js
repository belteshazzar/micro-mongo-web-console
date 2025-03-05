
export default function(shell) {

  shell.global.console.history = function(i) {
    if (Number.isInteger(i) && i>0 && i<=shell.history.length) {
      const c = shell.history[i-1]
      shell.history.push([...c]);
      shell.insertAnsi(`${shell.prompt}${shell.colorize(c.join('\n')).split('\n').join('\r')}\r`)
      shell.promptOnLine = shell.doc.lines.length
      shell.execCommand(c)
    } else {
      for (let i=0 ; i<shell.history.length ; i++) {
        shell.insertAnsi(`${i+1}\t${shell.colorize(shell.history[i].join('\n')).split('\n').join('\r')}\r`)
      }
    }
  }

}