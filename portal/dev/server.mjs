// Local preview of the M2D portal: serves public/ and runs the /api function on this machine.
// Data is kept in memory and saved to dev/.data.json so it survives restarts. Nothing touches Netlify.
//   node dev/server.mjs          → http://localhost:8890
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const DATA = path.join(ROOT, "dev", ".data.json");
const PORT = Number(process.env.PORT || 8890);

process.env.SESSION_SECRET ||= "local-dev-secret-not-for-production-0000";
process.env.TEAM_PASSCODE ||= "m2d-local";

class MemStore {
  constructor(name, saved) { this.name = name; this.m = new Map(Object.entries(saved || {}).map(([k, v]) => [k, v && v.__b64 ? Uint8Array.from(Buffer.from(v.__b64, "base64")) : v])); }
  async get(key, opts = {}) {
    if (!this.m.has(key)) return null;
    const v = this.m.get(key);
    if (opts.type === "json") return JSON.parse(v);
    if (opts.type === "arrayBuffer") return v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : new TextEncoder().encode(v).buffer;
    return v;
  }
  async set(key, value) { this.m.set(key, value instanceof ArrayBuffer ? new Uint8Array(value) : value); save(); }
  async setJSON(key, value) { this.m.set(key, JSON.stringify(value)); save(); }
  async delete(key) { this.m.delete(key); save(); }
  async list() { return { blobs: [...this.m.keys()].map((key) => ({ key })) }; }
  dump() { return Object.fromEntries([...this.m].map(([k, v]) => [k, v instanceof Uint8Array ? { __b64: Buffer.from(v).toString("base64") } : v])); }
}
let saved = {}; try { saved = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch {}
const names = ["h", "t", "s", "d", "p", "f", "o", "r"];
globalThis.__M2D_STORES__ = Object.fromEntries(names.map((n) => [n, new MemStore(n, saved[n])]));
let timer; function save() { clearTimeout(timer); timer = setTimeout(() => fs.writeFileSync(DATA, JSON.stringify(Object.fromEntries(names.map((n) => [n, globalThis.__M2D_STORES__[n].dump()])))), 200); }

const handler = (await import(path.join(ROOT, "netlify/functions/api.mjs"))).default;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".txt": "text/plain", ".json": "application/json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body, duplex: "half" }));
    const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let p = url.pathname.startsWith("/h/") ? "/view.html" : url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.join(PUB, path.normalize(p).replace(/^(\.\.[\/\\])+/, ""));
  if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("Not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`M2D portal (local) → http://localhost:${PORT}   team passcode: ${process.env.TEAM_PASSCODE}`));
