import Sval from 'sval';
import { createConsole } from './console.js';
import {inspect} from 'node-inspect-extracted';
import * as MicroMongo from 'micro-mongo';
console.log('Imported MicroMongo in repl.js:', MicroMongo);


export async function createGlobals(ctx) {

  const { ansi, println, errorln, dimln, ANSI, OPFS, appManager, term, normalizePath, splitDirFile, refreshDirIndex, appLaunchers } = ctx;

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
      inspect: inspect,
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
    ...(appLaunchers || {})
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
      console.log('REPL result:', result);

      // Print the result if it's not undefined
     if (result !== undefined) {
        const output = typeof result === 'string' ? result : inspect(result);
        this.ctx.println(output);
     } else {
        this.ctx.dimln('undefined');
     }
    } catch (e) {
      this.ctx.errorln('Error: ' + (e.message || String(e)));
    }
  }
}
