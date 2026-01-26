import Sval from 'sval';
import { createConsole } from './console.js';
import util from 'node-inspect-extracted';
import * as BabyMongo from 'babymongo/browser';

function buildCommandGlobals(commands){
  if (!commands || typeof commands !== "object") return {};
  const globals = { commands: commands };
  Object.keys(commands).forEach(function(name){
    const cmd = commands[name];
    if (typeof cmd !== "function") return;
    globals[name] = async function(...args){
      return cmd(args);
    };
  });
  globals.runCommand = async function(name, ...args){
    const cmd = commands[name];
    if (!cmd) throw new Error("Unknown command: " + name);
    return cmd(args);
  };
  return globals;
}


export async function createGlobals(ctx) {

  const { ansi, println, errorln, dimln, ANSI, OPFS, appManager, term, normalizePath, splitDirFile, refreshDirIndex, appLaunchers, commands } = ctx;

  const bridge = await BabyMongo.WorkerBridge.create({
    workerUrl: "/babymongo-shell/dist/assets/babymongo-server-worker.js"
  });
  const client = await BabyMongo.MongoClient.connect('mongodb://localhost:27017', {
    workerBridge: bridge
  });
  const db = client.db('myapp');

  return {
    // Standard output functions
    // print: ansi,
    // println: println,
    // error: errorln,
    // dimln: dimln,
    
    // Console object
    console: createConsole({ ansi, println, errorln, dimln, ANSI }),
    util: {
      inspect: util.inspect,
    },

    db: db,
    ObjectId: BabyMongo.ObjectId,
    // 
    // ANSI helper
    // ANSI: ANSI,
    
    // Terminal access
    // term: term,
    
    // OPFS access
    // OPFS: OPFS,
    
    // App manager (for launching apps)
    // appManager: appManager,
    
    // Path utilities
    // normalizePath: normalizePath,
    // splitDirFile: splitDirFile,
    // refreshDirIndex: refreshDirIndex,
    
    // App launchers (if provided)
    ...(appLaunchers || {}),

    // Shell commands exposed as globals for the REPL
    ...buildCommandGlobals(commands)
  };
}

const ERROR_LINE_REGEX = /(?<msg>[^(]+)\((?<line>[0-9]+):(?<column>[0-9]+)\)/;
const ERROR_KEYWORD_REGEX = /The keyword '(?<keyword>\w+)' is reserved/;
/**
 * JavaScript REPL using sval for execution.
 * Exposes app functions and shell utilities in the global scope.
 */
export class JavaScriptREPL {
  constructor(ctx, globals) {
    this.ctx = ctx;
    this.globals = globals;
        
    this.interpreter = new Sval({
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals
    });

  }

  isCompleteCommand(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) return true;

    try {
      this.interpreter.parse(trimmed);
      // Successfully parsed - command is complete
      return true;
    } catch (parseError) {
      const errorMsg = parseError.message || '';
      
      // Check if the error occurs at or near the end of input (suggesting incomplete code)
      const match = ERROR_LINE_REGEX.exec(errorMsg);
      
      if (!match) {
        // If we can't parse the error message format, assume incomplete
        return false;
      }

      let lines = trimmed.split('\n');
      
      const lineNum = parseInt(match.groups.line, 10);

      if (lineNum != lines.length) {
        // Error not on the last line - likely a real syntax error
        return true;
      }

      const lastLine = lines[lines.length - 1];
      const column = parseInt(match.groups.column, 10);
      const msg = match.groups.msg;
      
      // Error at the end of input typically means incomplete
      if (msg === 'Unexpected token ' && column >= lastLine.length) {
        return false;
      }
      
      // Check for incomplete keyword
      if (msg.startsWith('The keyword')) {
        const keywordMatch = ERROR_KEYWORD_REGEX.exec(msg);
        if (keywordMatch) {
          const keyword = keywordMatch.groups.keyword;
          if (column + keyword.length >= lastLine.length) {
            return false;
          }
        }
      }
      
      // Check for common incomplete patterns
      if (msg.includes('Unterminated') || msg.includes('unexpected end')) {
        return false;
      }
      
      // Error in the middle of input - likely a real syntax error
      return true;
    }
  }

  /**
   * Execute a line of JavaScript code.
   * @param {string} code - JavaScript code to execute
   * @returns {Promise<any>} - The result of the execution
   */
  async execute(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) return true;

    // Validate that code is complete before executing
    if (!this.isCompleteCommand(trimmed)) {
      // This shouldn't happen if commitShellLine is working correctly
      return false;
    }

    try {
      const result = this.interpreter.run(trimmed);
      const value = result && typeof result.then === 'function' ? await result : result;

      // Print the result if it's not undefined
      if (value !== undefined) {
        this.globals.console.log(value);
      } else {
        this.ctx.dimln('undefined');
      }
    } catch (e) {
      this.globals.console.error('Error: ' + (e.message || String(e)));
    }

    return true;
  }
}
