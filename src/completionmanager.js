// CompletionManager for shell tab completion with extensible providers

function commonPrefix(strings){
  if (!strings.length) return "";
  var p = strings[0];
  for (var i=1;i<strings.length;i++){
    var s = strings[i], j=0;
    while (j<p.length && j<s.length && p[j]===s[j]) j++;
    p = p.slice(0,j);
    if (!p) break;
  }
  return p;
}

function lexForCompletion(line, cursor){
  cursor = Math.max(0, Math.min(line.length, cursor|0));
  var tokens = [];
  var i=0, cur="", start=0, quote=null, escaping=false;

  function pushToken(endIdx){
    tokens.push({ text:cur, start:start, end:endIdx });
    cur="";
  }

  while (i<line.length){
    var ch=line[i];

    if (escaping){ cur+=ch; escaping=false; i++; continue; }
    if (ch==="\\"){ escaping=true; i++; continue; }

    if (quote){
      if (ch===quote) quote=null;
      else cur+=ch;
      i++; continue;
    }

    if (ch==="'" || ch==='"'){ quote=ch; i++; continue; }

    if (/\s/.test(ch)){
      if (cur.length) pushToken(i);
      i++;
      while (i<line.length && /\s/.test(line[i])) i++;
      start=i;
      continue;
    }

    if (!cur.length) start=i;
    cur+=ch; i++;
  }
  if (cur.length) pushToken(i);

  var tokenIndex=-1;
  for (var t=0;t<tokens.length;t++){
    if (cursor>=tokens[t].start && cursor<=tokens[t].end){ tokenIndex=t; break; }
  }
  if (tokenIndex===-1){
    var insertAt=0;
    for (var k=0;k<tokens.length;k++){
      if (tokens[k].end<=cursor) insertAt=k+1;
    }
    tokens.splice(insertAt,0,{text:"",start:cursor,end:cursor});
    tokenIndex=insertAt;
  }

  return { tokens:tokens, tokenIndex:tokenIndex };
}

function CompletionManager(opts){
  opts = opts || {};
  this.providers=[];
  this.printList = opts.printList;
  this.beep = opts.beep;
  this.maxListCols = opts.maxListCols || 6;
  this.getTermCols = opts.getTermCols || function(){ return 80; };

  this.state={
    active:false,
    line:"",
    cursor:0,
    matches:[],
    idx:0,
    replaceStart:0,
    replaceEnd:0,
    pendingList:false
  };
}

CompletionManager.prototype.register=function(provider){ this.providers.push(provider); };
CompletionManager.prototype.reset=function(){
  this.state.active=false;
  this.state.pendingList=false;
  this.state.matches=[];
};

CompletionManager.prototype._gather=function(ctx){
  var all=[];
  var replaceStart=ctx.current.start;
  var replaceEnd=ctx.current.end;

  for (var i=0;i<this.providers.length;i++){
    var p=this.providers[i];
    if (!p.isApplicable(ctx)) continue;
    var res=p.getCompletions(ctx);
    if (!res || !res.items || !res.items.length) continue;
    replaceStart=Math.min(replaceStart,res.replaceStart);
    replaceEnd=Math.max(replaceEnd,res.replaceEnd);
    for (var j=0;j<res.items.length;j++) all.push(res.items[j]);
  }

  var seen=new Set(), unique=[];
  for (var k=0;k<all.length;k++){
    var key=all[k].value;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(all[k]);
  }

  unique.sort(function(a,b){
    if ((a.type||"") === "dir" && (b.type||"") !== "dir") return -1;
    if ((b.type||"") === "dir" && (a.type||"") !== "dir") return 1;
    return (a.value||"").localeCompare(b.value||"");
  });

  return { matches:unique, replaceStart:replaceStart, replaceEnd:replaceEnd };
};

CompletionManager.prototype._formatList=function(items){
  var values=items.map(function(it){ return it.display || it.value; });
  var maxLen=0;
  for (var i=0;i<values.length;i++) maxLen=Math.max(maxLen, values[i].length);
  maxLen=Math.min(maxLen,60);
  var colW=maxLen+2;

  var colsCount=this.maxListCols;
  var termCols = this.getTermCols();
  colsCount=Math.max(1, Math.min(colsCount, Math.floor(Math.max(10, termCols)/colW)));

  var lines=[];
  for (var i2=0;i2<values.length;i2+=colsCount){
    var line="";
    for (var c=0;c<colsCount;c++){
      var idx=i2+c;
      if (idx>=values.length) break;
      var s=values[idx];
      if (s.length>maxLen) s=s.slice(0,maxLen-2)+"..";
      line+=s;
      if (c!==colsCount-1){
        var pad=colW-s.length;
        line+=new Array(pad+1).join(" ");
      }
    }
    lines.push(line.replace(/\s+$/,""));
  }
  return lines;
};

CompletionManager.prototype.applyItem=function(line, replaceStart, replaceEnd, insertValue, addSpace){
  var before=line.slice(0,replaceStart);
  var after=line.slice(replaceEnd);
  var out=before+insertValue+after;
  var cursor=before.length+insertValue.length;
  if (addSpace){
    out=out.slice(0,cursor)+" "+out.slice(cursor);
    cursor++;
  }
  return { line:out, cursor:cursor };
};

CompletionManager.prototype.onTab=function(line, cursor, ctx){
  if (!this.state.active || this.state.line!==line || this.state.cursor!==cursor){
    this.reset();
  }

  var gathered=this._gather(ctx);
  var matches=gathered.matches;
  if (!matches.length){
    if (this.beep) this.beep();
    return { handled:true, line:line, cursor:cursor };
  }

  var replaceStart=gathered.replaceStart;
  var replaceEnd=gathered.replaceEnd;

  if (!this.state.active){
    this.state.active=true;
    this.state.line=line;
    this.state.cursor=cursor;
    this.state.matches=matches;
    this.state.idx=0;
    this.state.replaceStart=replaceStart;
    this.state.replaceEnd=replaceEnd;
    this.state.pendingList=true;

    if (matches.length===1){
      var one=matches[0];
      var addSpace=(one.type!=="dir");
      var applied=this.applyItem(line, replaceStart, replaceEnd, one.value, addSpace);
      this.reset();
      return { handled:true, line:applied.line, cursor:applied.cursor };
    }

    var common = commonPrefix(matches.map(function(m){ return m.value; }));
    if (common && common.length > (ctx.current.text||"").length){
      var applied2=this.applyItem(line, replaceStart, replaceEnd, common, false);
      this.state.line=applied2.line;
      this.state.cursor=applied2.cursor;
      return { handled:true, line:applied2.line, cursor:applied2.cursor };
    }

    return { handled:true, line:line, cursor:cursor };
  }

  if (this.state.pendingList){
    this.state.pendingList=false;
    if (this.printList) this.printList(this._formatList(this.state.matches));
    return { handled:true, line:line, cursor:cursor };
  }

  this.state.idx=(this.state.idx+1)%this.state.matches.length;
  var item=this.state.matches[this.state.idx];
  var addSpace2=(item.type!=="dir");
  var applied3=this.applyItem(this.state.line, this.state.replaceStart, this.state.replaceEnd, item.value, addSpace2);
  this.state.line=applied3.line;
  this.state.cursor=applied3.cursor;
  return { handled:true, line:applied3.line, cursor:applied3.cursor };
};

function createCommandProvider(getNames){
  return {
    id:"commands",
    isApplicable:function(ctx){ return ctx.tokenIndex===0; },
    getCompletions:function(ctx){
      var prefix=ctx.current.text||"";
      var names=getNames();
      var items=[];
      for (var i=0;i<names.length;i++){
        var n=names[i];
        if (!prefix || n.indexOf(prefix)===0){
          items.push({ value:n, display:n, type:"cmd" });
        }
      }
      return { items:items, replaceStart:ctx.current.start, replaceEnd:ctx.current.end };
    }
  };
}

function createPathProvider(opts){
  opts = opts || {};
  var normalizePath = opts.normalizePath;
  var listDirCached = opts.listDirCached;
  var refreshDirIndex = opts.refreshDirIndex;
  var getCwd = opts.getCwd || function(){ return "/"; };

  function wantsPath(cmd){
    return {cd:1, ls:1, cat:1, vim:1, touch:1, mkdir:1, less:1, tree:1, rm:1, rmdir:1, du:1}[cmd]===1;
  }
  function splitToken(token){
    var idx=token.lastIndexOf("/");
    if (idx>=0) return { dirPart:token.slice(0,idx+1), basePart:token.slice(idx+1) };
    return { dirPart:"", basePart:token };
  }
  return {
    id:"paths",
    isApplicable:function(ctx){
      if (ctx.tokenIndex===0) return false;
      var cmd=(ctx.tokens[0] && ctx.tokens[0].text) ? ctx.tokens[0].text : "";
      return wantsPath(cmd);
    },
    getCompletions:function(ctx){
      var token=ctx.current.text||"";
      var sp=splitToken(token);
      var dirPart=sp.dirPart;
      var basePart=sp.basePart;

      var cwd = getCwd();
      var listPath;
      if (dirPart.startsWith("/")) listPath=dirPart;
      else listPath = dirPart ? normalizePath(dirPart, cwd) : cwd;
      if (!listPath.startsWith("/")) listPath=normalizePath(listPath, cwd);

      // read sync cache; kick async refresh
      var list = listDirCached(listPath);
      if (!list){
        refreshDirIndex(listPath);
        return { items:[], replaceStart:ctx.current.start, replaceEnd:ctx.current.end };
      }

      var items=[];
      for (var i=0;i<list.length;i++){
        var entry=list[i];
        var isDir=entry.endsWith("/");
        var name=isDir ? entry.slice(0,-1) : entry;
        if (!basePart || name.indexOf(basePart)===0){
          var completed = dirPart + name + (isDir?"/":"");
          items.push({ value:completed, display:completed, type:(isDir?"dir":"file") });
        }
      }
      return { items:items, replaceStart:ctx.current.start, replaceEnd:ctx.current.end };
    }
  };
}

export { CompletionManager, commonPrefix, lexForCompletion, createCommandProvider, createPathProvider };
