// OPFS - Origin Private File System API wrapper
// Provides async file operations: exists, ensureDir, listDir, readFile, writeFile, remove, fileSize, requestPersistence, estimate

const OPFS = (() => {
  const ok = !!(navigator.storage && navigator.storage.getDirectory);

  async function root() {
    if (!ok) return null;
    try { return await navigator.storage.getDirectory(); }
    catch { return null; }
  }

  function pathParts(p){ return (p||"").split("/").filter(Boolean); }

  async function getDirHandle(rootHandle, absPath, { create=false } = {}) {
    let dir = rootHandle;
    for (const part of pathParts(absPath)) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }

  async function getFileHandle(rootHandle, absPath, { create=false } = {}) {
    const parts = pathParts(absPath);
    const name = parts.pop() || "";
    const parent = await getDirHandle(rootHandle, "/" + parts.join("/"), { create });
    return await parent.getFileHandle(name, { create });
  }

  async function exists(rootHandle, absPath) {
    try { await getDirHandle(rootHandle, absPath); return { type:"dir" }; }
    catch {
      try { await getFileHandle(rootHandle, absPath); return { type:"file" }; }
      catch { return null; }
    }
  }

  async function ensureDir(rootHandle, absPath) {
    await getDirHandle(rootHandle, absPath, { create:true });
  }

  async function listDir(rootHandle, absPath) {
    const dir = await getDirHandle(rootHandle, absPath);
    const out = [];
    for await (const [name, h] of dir.entries()) {
      out.push(h.kind === "directory" ? (name + "/") : name);
    }
    out.sort();
    return out;
  }

  async function readFile(rootHandle, absPath) {
    const fh = await getFileHandle(rootHandle, absPath);
    const f  = await fh.getFile();
    return await f.text();
  }

  async function writeFile(rootHandle, absPath, content, { append=false } = {}) {
    const fh = await getFileHandle(rootHandle, absPath, { create:true });
    const ws = await fh.createWritable({ keepExistingData: append });
    try {
      if (append) {
        const size = (await fh.getFile()).size;
        await ws.write({ type:"write", position:size, data:content });
      } else {
        await ws.write(content);
      }
      await ws.close();
      return { ok:true };
    } catch (e) {
      try { await ws.close(); } catch {}
      return { ok:false, err:String(e) };
    }
  }

  async function remove(rootHandle, absPath, { recursive=false } = {}) {
    const parts = pathParts(absPath);
    const name  = parts.pop() || "";
    const parent = await getDirHandle(rootHandle, "/" + parts.join("/"));
    await parent.removeEntry(name, { recursive });
  }

  async function fileSize(rootHandle, absPath) {
    const fh = await getFileHandle(rootHandle, absPath, { create:false });
    const f  = await fh.getFile();
    return f.size|0;
  }

  async function requestPersistence(){
    try {
      const persisted = await (navigator.storage?.persisted?.() ?? Promise.resolve(false));
      if (persisted) return true;
      return await (navigator.storage?.persist?.() ?? Promise.resolve(false));
    } catch { return false; }
  }

  async function estimate(){ try { return await navigator.storage.estimate(); } catch { return null; } }

  return { ok, root, exists, ensureDir, listDir, readFile, writeFile, remove, fileSize, requestPersistence, estimate };
})();

export { OPFS };
