// Minimal Mongosh-like app using MongoDB Atlas Data API
// Supports: connect dataapi <baseUrl> <apiKey> <dataSource> <database>
// Commands: use <db>, db.<collection>.find(<filter>[, <options>]),
//           db.<collection>.insertOne(<doc>),
//           db.<collection>.updateOne(<filter>, <update>),
//           db.<collection>.deleteOne(<filter>),
//           show help, exit

class DataApiTransport {
  constructor({ baseUrl, apiKey, dataSource, database }){
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.dataSource = dataSource;
    this.database = database;
  }
  setDatabase(db){ this.database = db; }
  async request(op, body){
    const url = this.baseUrl + "/action/" + op;
    const payload = Object.assign({}, body, {
      dataSource: this.dataSource,
      database: this.database
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok){
      const txt = await res.text().catch(()=>"");
      throw new Error("HTTP " + res.status + ": " + txt);
    }
    return res.json();
  }
  async find(collection, filter, options){
    const body = { collection, filter: filter || {} };
    if (options && typeof options === 'object') Object.assign(body, options);
    return this.request('find', body);
  }
  async insertOne(collection, doc){
    return this.request('insertOne', { collection, document: doc });
  }
  async updateOne(collection, filter, update){
    return this.request('updateOne', { collection, filter, update });
  }
  async deleteOne(collection, filter){
    return this.request('deleteOne', { collection, filter });
  }
}

function parseArgsTopLevel(str){
  // Split by commas not inside brackets/braces/strings
  const args = [];
  let cur = '';
  let depth = 0; // for {} and []
  let inStr = false, quote = '';
  for (let i=0;i<str.length;i++){
    const ch = str[i];
    if (inStr){
      if (ch === '\\') { cur += ch; if (i+1<str.length) { cur += str[++i]; } continue; }
      if (ch === quote){ inStr = false; quote = ''; }
      cur += ch; continue;
    }
    if (ch === '"' || ch === '\''){ inStr = true; quote = ch; cur += ch; continue; }
    if (ch === '{' || ch === '['){ depth++; cur += ch; continue; }
    if (ch === '}' || ch === ']'){ depth = Math.max(0, depth-1); cur += ch; continue; }
    if (ch === ',' && depth === 0){ args.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function tryParseJSON(str){
  try { return { ok:true, value: JSON.parse(str) }; } catch(e){ return { ok:false, error:e }; }
}

export class MongoshApp {
  constructor(){
    this.line = '';
    this.cursor = 0;
    this.history = [];
    this.hidx = 0;
    this.transport = null;
    this.currentDb = null;
  }
  _prompt(){ return this.currentDb ? ("mongosh("+this.currentDb+")> ") : "mongosh> "; }
  _println(ctx, s){ ctx.println(s==null?"":String(s)); }
  _ansi(ctx, s){ ctx.ansi(s); }
  _renderLine(ctx){
    this._ansi(ctx, "\r" + ctx.ANSI.clearLine());
    this._ansi(ctx, this._prompt());
    this._ansi(ctx, this.line);
    const b = ctx.term.buf();
    const row = b.cy;
    const col = this._prompt().length + this.cursor;
    this._ansi(ctx, ctx.ANSI.moveTo(row+1, col+1));
  }
  onStart(ctx){
    this._ansi(ctx, ctx.ANSI.altScreenOn());
    this._ansi(ctx, ctx.ANSI.clear() + ctx.ANSI.home());
    this._println(ctx, "Mongosh (minimal) - Data API mode");
    this._println(ctx, "Type 'help' for commands. 'exit' to leave.");
    this._ansi(ctx, this._prompt());
    this._renderLine(ctx);
  }
  onResize(info, ctx){ this._renderLine(ctx); }
  onExit(ctx){ this._ansi(ctx, ctx.ANSI.altScreenOff()); }

  async _handleCommand(ctx, line){
    const trimmed = (line||'').trim();
    if (!trimmed) return;
    if (trimmed === 'help'){
      this._println(ctx,
        "Commands:\n"+
        "  connect dataapi <baseUrl> <apiKey> <dataSource> <database>\n"+
        "  use <database>\n"+
        "  db.<collection>.find(<filter>[, <options>])\n"+
        "  db.<collection>.insertOne(<doc>)\n"+
        "  db.<collection>.updateOne(<filter>, <update>)\n"+
        "  db.<collection>.deleteOne(<filter>)\n"+
        "  exit\n"
      );
      return;
    }
    if (trimmed === 'exit' || trimmed === 'quit') { ctx.exit(); return; }

    // connect dataapi ...
    let m = trimmed.match(/^connect\s+dataapi\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
    if (m){
      const [ , baseUrl, apiKey, dataSource, database ] = m;
      this.transport = new DataApiTransport({ baseUrl, apiKey, dataSource, database });
      this.currentDb = database;
      this._println(ctx, "Connected (Data API). Database: " + database);
      return;
    }

    // use <db>
    m = trimmed.match(/^use\s+(\S+)$/);
    if (m){
      const db = m[1];
      if (!this.transport){ this._println(ctx, "Not connected. Use 'connect dataapi ...' first."); return; }
      this.transport.setDatabase(db);
      this.currentDb = db;
      this._println(ctx, "switched to db " + db);
      return;
    }

    // db.<collection>.<method>(...)
    m = trimmed.match(/^db\.(\w+)\.(\w+)\((.*)\)\s*$/);
    if (m){
      const collection = m[1];
      const method = m[2];
      const argsStr = m[3].trim();
      if (!this.transport){ this._println(ctx, "Not connected. Use 'connect dataapi ...' first."); return; }
      try {
        const argsParts = parseArgsTopLevel(argsStr);
        let result;
        if (method === 'find'){
          const a0 = argsParts[0] || '{}';
          const a1 = argsParts[1] || null;
          const p0 = tryParseJSON(a0); if (!p0.ok) throw new Error('Invalid JSON filter');
          const p1 = a1 ? tryParseJSON(a1) : { ok:true, value:null };
          if (a1 && !p1.ok) throw new Error('Invalid JSON options');
          result = await this.transport.find(collection, p0.value, p1.value || undefined);
        } else if (method === 'insertOne'){
          const a0 = argsParts[0] || '{}';
          const p0 = tryParseJSON(a0); if (!p0.ok) throw new Error('Invalid JSON document');
          result = await this.transport.insertOne(collection, p0.value);
        } else if (method === 'updateOne'){
          const a0 = argsParts[0] || '{}';
          const a1 = argsParts[1] || '{}';
          const p0 = tryParseJSON(a0); if (!p0.ok) throw new Error('Invalid JSON filter');
          const p1 = tryParseJSON(a1); if (!p1.ok) throw new Error('Invalid JSON update');
          result = await this.transport.updateOne(collection, p0.value, p1.value);
        } else if (method === 'deleteOne'){
          const a0 = argsParts[0] || '{}';
          const p0 = tryParseJSON(a0); if (!p0.ok) throw new Error('Invalid JSON filter');
          result = await this.transport.deleteOne(collection, p0.value);
        } else {
          this._println(ctx, "Unsupported method: " + method);
          return;
        }
        this._println(ctx, JSON.stringify(result, null, 2));
      } catch (e) {
        this._println(ctx, "Error: " + String(e.message || e));
      }
      return;
    }

    this._println(ctx, "Unrecognized command. Type 'help'.");
  }

  onKey(e, ctx){
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;

    if (key === 'Enter'){
      e.preventDefault();
      const line = this.line;
      this._println(ctx, '');
      this.history.push(line);
      this.hidx = this.history.length;
      this.line = '';
      this.cursor = 0;
      Promise.resolve().then(()=>this._handleCommand(ctx, line)).then(()=>{
        if (ctx.isRunning()){
          this._ansi(ctx, this._prompt());
          this._renderLine(ctx);
        }
      });
      return;
    }

    if (key === 'Backspace'){
      e.preventDefault();
      if (this.cursor > 0){
        this.line = this.line.slice(0, this.cursor-1) + this.line.slice(this.cursor);
        this.cursor--;
        this._renderLine(ctx);
      }
      return;
    }

    if (key === 'ArrowLeft'){ e.preventDefault(); this.cursor = Math.max(0, this.cursor-1); this._renderLine(ctx); return; }
    if (key === 'ArrowRight'){ e.preventDefault(); this.cursor = Math.min(this.line.length, this.cursor+1); this._renderLine(ctx); return; }

    if (key === 'ArrowUp'){
      e.preventDefault();
      if (!this.history.length) return;
      this.hidx = Math.max(0, this.hidx-1);
      this.line = this.history[this.hidx] || '';
      this.cursor = this.line.length;
      this._renderLine(ctx);
      return;
    }
    if (key === 'ArrowDown'){
      e.preventDefault();
      if (!this.history.length) return;
      this.hidx = Math.min(this.history.length, this.hidx+1);
      this.line = (this.hidx === this.history.length) ? '' : (this.history[this.hidx] || '');
      this.cursor = this.line.length;
      this._renderLine(ctx);
      return;
    }

    if (ctrl && (key === 'c' || key === 'C')){ e.preventDefault(); ctx.exit(); return; }

    if (key.length === 1 && !ctrl && !e.altKey){
      e.preventDefault();
      this.line = this.line.slice(0, this.cursor) + key + this.line.slice(this.cursor);
      this.cursor++;
      this._renderLine(ctx);
      return;
    }
  }
}
