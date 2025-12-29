import Sval from 'sval';
import { createConsole } from './console.js';
import util from 'node-inspect-extracted';
import * as MicroMongo from 'micro-mongo';

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

  const client = await MicroMongo.MongoClient.connect('mongodb://localhost:27017');
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
    ObjectId: MicroMongo.ObjectId,
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

/**
 * JavaScript REPL using sval for execution.
 * Exposes app functions and shell utilities in the global scope.
 */
export class JavaScriptREPL {
  constructor(ctx, globals) {
    this.ctx = ctx;
    this.globals = globals;
        
    this.interpreter = new Sval({
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: globals
    });

  }

  /**
   * Execute a line of JavaScript code.
   * @param {string} code - JavaScript code to execute
   * @returns {Promise<any>} - The result of the execution
   */
  async execute(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) return;

    try {
      console.log('REPL executing:', trimmed);
      const result = this.interpreter.run(trimmed);
      const value = result && typeof result.then === 'function' ? await result : result;
      console.log('REPL result:', value);

      // Print the result if it's not undefined
      if (value !== undefined) {
        const output = typeof value === 'string' ? value : util.inspect(value,{depth:0, showHidden: false});
        this.ctx.println(output);
      } else {
        this.ctx.dimln('undefined');
      }
    } catch (e) {
      this.ctx.errorln('Error: ' + (e.message || String(e)));
    }
  }
}
