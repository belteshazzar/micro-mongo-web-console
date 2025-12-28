// ANSI helper factory
// Exports a function to create the ANSI API given ESC.
export function createANSI(ESC) {
  function csi(params, final) { return ESC + "[" + (params || "") + final; }
  function dec(mode, enable) { return ESC + "[?" + mode + (enable ? "h" : "l"); }
  function sgr(code) { return ESC + "[" + code + "m"; }
  function n(v, def) { v = (v == null) ? def : (v|0); return v < 1 ? 1 : v; }

  function fg(code) { return sgr(String(code)); }
  function bg(code) { return sgr(String(code)); }

  const api = {
    ESC: ESC,
    compose: function() { return Array.prototype.join.call(arguments, ""); },

    reset: function() { return sgr("0"); },
    bold: function() { return sgr("1"); },
    underline: function() { return sgr("4"); },
    inverse: function() { return sgr("7"); },

    black: function() { return fg(30); },
    red: function() { return fg(31); },
    green: function() { return fg(32); },
    yellow: function() { return fg(33); },
    blue: function() { return fg(34); },
    magenta: function() { return fg(35); },
    cyan: function() { return fg(36); },
    white: function() { return fg(37); },

    brightBlack: function() { return fg(90); },
    brightRed: function() { return fg(91); },
    brightGreen: function() { return fg(92); },
    brightYellow: function() { return fg(93); },
    brightBlue: function() { return fg(94); },
    brightMagenta: function() { return fg(95); },
    brightCyan: function() { return fg(96); },
    brightWhite: function() { return fg(97); },

    bgBlack: function() { return bg(40); },
    bgRed: function() { return bg(41); },
    bgGreen: function() { return bg(42); },
    bgYellow: function() { return bg(43); },
    bgBlue: function() { return bg(44); },
    bgMagenta: function() { return bg(45); },
    bgCyan: function() { return bg(46); },
    bgWhite: function() { return bg(47); },

    bgBrightBlack: function() { return bg(100); },
    bgBrightRed: function() { return bg(101); },
    bgBrightGreen: function() { return bg(102); },
    bgBrightYellow: function() { return bg(103); },
    bgBrightBlue: function() { return bg(104); },
    bgBrightMagenta: function() { return bg(105); },
    bgBrightCyan: function() { return bg(106); },
    bgBrightWhite: function() { return bg(107); },

    up: function(count) { return csi(String(n(count,1)), "A"); },
    down: function(count) { return csi(String(n(count,1)), "B"); },
    right: function(count) { return csi(String(n(count,1)), "C"); },
    left: function(count) { return csi(String(n(count,1)), "D"); },

    moveTo: function(row, col) { return csi(String(n(row,1)) + ";" + String(n(col,1)), "H"); },
    home: function() { return csi("", "H"); },

    saveCursor: function() { return csi("", "s"); },
    restoreCursor: function() { return csi("", "u"); },

    clear: function() { return csi("2", "J"); },
    clearLine: function() { return csi("2", "K"); },

    scrollRegion: function(top, bottom) { return csi(String(n(top,1)) + ";" + String(n(bottom,1)), "r"); },
    scrollRegionReset: function() { return csi("", "r"); },

    scrollUp: function(count) { return csi(String(n(count,1)), "S"); },
    scrollDown: function(count) { return csi(String(n(count,1)), "T"); },

    insertLine: function(count) { return csi(String(n(count,1)), "L"); },
    deleteLine: function(count) { return csi(String(n(count,1)), "M"); },

    insertChar: function(count) { return csi(String(n(count,1)), "@"); },
    deleteChar: function(count) { return csi(String(n(count,1)), "P"); },
    eraseChar: function(count) { return csi(String(n(count,1)), "X"); },

    showCursor: function() { return dec(25, true); },
    hideCursor: function() { return dec(25, false); },

    altScreenOn: function() { return dec(1049, true); },
    altScreenOff: function() { return dec(1049, false); }
  };

  return api;
}
