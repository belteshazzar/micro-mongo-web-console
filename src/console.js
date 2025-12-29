import util from 'node-inspect-extracted';

/**
 * Create a console object that mirrors the standard JavaScript console API
 * but outputs to the terminal instead of the browser console.
 */
export function createConsole({ ansi, println, errorln, dimln, ANSI }) {
  // Helper to format console arguments
  const formatArgs = (...args) => {
    return args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object' || typeof arg === 'function') {
        return util.inspect(arg, { colors: false, depth: 4 });
      }
      return String(arg);
    }).join(' ');
  };

  // State for timers and counters
  const timers = {};
  const counts = {};

  return {
    log: (...args) => println(formatArgs(...args)),
    
    error: (...args) => errorln(formatArgs(...args)),
    
    warn: (...args) => ansi(ANSI.yellow() + formatArgs(...args) + ANSI.reset() + "\r\n"),
    
    info: (...args) => println(formatArgs(...args)),
    
    debug: (...args) => dimln(formatArgs(...args)),
    
    dir: (obj) => {
      try {
        println(util.inspect(obj, { colors: false, depth: null }));
      } catch (e) {
        println(String(obj));
      }
    },
    
    table: (data) => {
      try {
        println(util.inspect(data, { colors: false, depth: 2 }));
      } catch (e) {
        println(String(data));
      }
    },
    
    clear: () => ansi(ANSI.clear() + ANSI.home()),
    
    trace: (...args) => {
      println(formatArgs(...args));
      try {
        throw new Error('Stack trace');
      } catch (e) {
        errorln(e.stack || '');
      }
    },
    
    assert: (condition, ...args) => {
      if (!condition) {
        errorln('Assertion failed: ' + formatArgs(...args));
      }
    },
    
    count: (label = 'default') => {
      counts[label] = (counts[label] || 0) + 1;
      println(label + ': ' + counts[label]);
    },
    
    countReset: (label = 'default') => {
      counts[label] = 0;
    },
    
    group: (...args) => println(formatArgs(...args)),
    
    groupCollapsed: (...args) => println(formatArgs(...args)),
    
    groupEnd: () => {},
    
    time: (label = 'default') => {
      timers[label] = Date.now();
    },
    
    timeEnd: (label = 'default') => {
      if (timers[label]) {
        const elapsed = Date.now() - timers[label];
        println(label + ': ' + elapsed + 'ms');
        delete timers[label];
      }
    },
    
    timeLog: (label = 'default', ...args) => {
      if (timers[label]) {
        const elapsed = Date.now() - timers[label];
        println(label + ': ' + elapsed + 'ms ' + formatArgs(...args));
      }
    }
  };
}
