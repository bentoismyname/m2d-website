/* M2D website admin.
   Two storage modes with the same shape: Supabase (live) and local draft (this browser only, IndexedDB).
   Pages are rebuilt from this content by build/pull_cms.py + build/build.py when someone presses Publish,
   so the website stays fully static and every animation keeps working: the CMS only ever changes words,
   photos and lists; the page layouts and effects stay in the code. */
(() => {
"use strict";
const CFG = window.M2D_CMS || {};
const LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const slugify = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
const uid = () => Math.random().toString(36).slice(2, 9);
const todaySG = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const imgUrl = src => !src ? "" : /^(https?:|data:|blob:)/.test(src) ? src : src.startsWith("/") ? ".." + src : "../" + src;
const isVideo = src => /\.mp4($|\?)|^data:video\//i.test(src || "");
const siteUrl = path => (CFG.siteUrl ? CFG.siteUrl.replace(/\/$/, "") + "/" : "../") + path;
const fmtDate = d => { try { return new Date(d + (String(d).length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; } };
const fmtTime = d => { try { return new Date(d).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return d; } };

/* small DOM builder: h("div", {class: "x", onclick: fn}, child, "text") */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "value") el.value = v;
    else if (k === "checked" || k === "disabled" || k === "selected") el[k] = !!v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  kids.flat(Infinity).forEach(c => { if (c == null || c === false) return; el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}

/* ---------- toast / modal ---------- */
let toastT;
const toast = (msg, kind = "") => { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (kind ? " toast--" + kind : ""); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, kind === "err" ? 7000 : 4200); };
function modal(build, wide) {
  const m = $("#modal"), box = $("#modalBox");
  box.className = "modal__box" + (wide ? " modal__box--wide" : "");
  box.innerHTML = "";
  const close = () => { m.hidden = true; box.innerHTML = ""; document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  box.append(h("button", { class: "modal__close", type: "button", "aria-label": "Close", onclick: close }, "×"));
  build(box, close);
  m.hidden = false; m.onclick = e => { if (e.target === m) close(); };
  document.addEventListener("keydown", onKey);
  return close;
}
const confirmBox = (text, label = "Delete", title = "Are you sure?") => new Promise(res => modal((box, close) => {
  box.append(h("h2", {}, title), h("p", {}, text), h("div", { class: "modal__foot" },
    h("button", { class: "btn", type: "button", onclick: () => { close(); res(false); } }, "Cancel"),
    h("button", { class: label === "Delete" || label === "Remove" ? "btn btn--danger" : "btn btn--primary", type: "button", onclick: () => { close(); res(true); } }, label)));
}));

/* ---------- seed: the website's current content, written by build/build.py ---------- */
let SEED = { content: {}, projects: [], posts: [], assets: [], divisions: [], service_colours: [], layouts: [], cats: [] };
const loadSeed = async () => { try { SEED = await (await fetch("seed.json?t=" + Date.now())).json(); } catch (e) { console.warn("seed.json missing", e); toast("Could not load the website content (seed.json). Run python3 build/build.py first.", "err"); } };
const OBJ_KEYS = ["site", "copy", "photos"];
function mergeContent(stored) {
  const c = clone(SEED.content) || {};
  for (const [k, v] of Object.entries(stored || {})) {
    if (k.startsWith("_")) continue;
    if (OBJ_KEYS.includes(k) && v && typeof v === "object") c[k] = Object.assign(c[k] || {}, v);
    else c[k] = v;
  }
  return c;
}
/* the article text as the website shows it (drops the author line imported from the old site) */
function cleanBody(b) {
  b = String(b || "");
  if (b.includes("<")) b = b.slice(b.indexOf("<"));
  return b.replace(/<p>\s*Updated:[^<]*<\/p>/g, "").replace(/^(\s*<p>[^<]{0,60}min read[^<]*<\/p>)/, "");
}

/* ---------- images ---------- */
const fileToDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const imageDims = f => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = URL.createObjectURL(f); });
async function shrink(file, max, quality = 0.85) {        // web-sized copies keep the website fast
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) return file;
  const dims = await imageDims(file); if (!dims) return file;
  const scale = Math.min(1, max / Math.max(dims.w, dims.h));
  if (scale === 1 && file.size < 900e3 && file.type !== "image/png") return file;
  const c = document.createElement("canvas"); c.width = Math.round(dims.w * scale); c.height = Math.round(dims.h * scale);
  const img = new Image(); img.src = URL.createObjectURL(file); await new Promise(r => img.onload = r);
  const keepPng = file.type === "image/png" && file.size < 400e3;   // small PNGs (logos) keep their transparency
  const ctx = c.getContext("2d");
  if (!keepPng) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const type = keepPng ? "image/png" : "image/jpeg";
  const blob = await new Promise(r => c.toBlob(r, type, quality));
  return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + (keepPng ? ".png" : ".jpg"), { type });
}
const altFrom = name => String(name || "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();

/* ---------- storage: local draft (IndexedDB, so photos fit) ---------- */
const IDB = {
  db: null,
  open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open("m2d-cms", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async del(k) { const db = await this.open(); return new Promise(res => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").delete(k); tx.oncomplete = () => res(); }); },
};
const LocalStore = {
  mode: "local", role: "owner", user: { email: "Local draft" }, d: null,
  async load() {
    if (this.d) return this.d;
    this.d = await IDB.get("doc").catch(() => null);
    if (!this.d) this.d = { content: {}, projects: clone(SEED.projects), posts: clone(SEED.posts), media: [], revisions: [] };
    return this.d;
  },
  async save() { try { await IDB.set("doc", this.d); } catch (e) { toast("Could not save in this browser: " + e.message, "err"); throw e; } },
  _rev(kind, ref, data) { this.d.revisions.unshift({ id: uid(), kind, ref, data: clone(data), saved_at: new Date().toISOString(), saved_by: "Local draft" }); this.d.revisions = this.d.revisions.slice(0, 200); },
  async getContent() { return mergeContent((await this.load()).content); },
  async saveContent(parts) { const d = await this.load(); const cur = mergeContent(d.content); for (const [k, v] of Object.entries(parts)) { this._rev("content", k, cur[k]); d.content[k] = clone(v); } await this.save(); },
  async listProjects() { return (await this.load()).projects; },
  async saveProject(p, oldSlug) {
    const d = await this.load(); const ref = oldSlug || p.slug; const i = d.projects.findIndex(x => x.slug === ref);
    if (i >= 0) this._rev("project", p.slug, d.projects[i]);
    p.updated_at = new Date().toISOString();
    if (i >= 0) d.projects[i] = clone(p); else d.projects.push(clone(p));
    await this.save();
  },
  async deleteProject(slug) { const d = await this.load(); d.projects = d.projects.filter(p => p.slug !== slug); await this.save(); },
  async saveOrder(slugs) { const d = await this.load(); d.projects.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug)); await this.save(); },
  async listPosts() { return (await this.load()).posts; },
  async getPost(slug) { return clone((await this.load()).posts.find(p => p.slug === slug) || null); },
  async savePost(p, oldSlug) {
    const d = await this.load(); const ref = oldSlug || p.slug; const i = d.posts.findIndex(x => x.slug === ref);
    if (i >= 0) this._rev("post", p.slug, d.posts[i]);
    p.updated_at = new Date().toISOString();
    if (i >= 0) d.posts[i] = clone(p); else d.posts.unshift(clone(p));
    await this.save();
  },
  async deletePost(slug) { const d = await this.load(); d.posts = d.posts.filter(p => p.slug !== slug); await this.save(); },
  async listRevisions(kind, ref) { return (await this.load()).revisions.filter(r => r.kind === kind && r.ref === ref).slice(0, 30); },
  async listMedia() { return (await this.load()).media; },
  async upload(file) {
    const video = /^video\//.test(file.type);
    if (video && file.size > 60e6) throw new Error("Videos must be under 50 MB.");
    const main = video ? file : await shrink(file, 2000, 0.84);
    const row = { id: uid(), path: "local/" + file.name, url: await fileToDataUrl(main), alt: altFrom(file.name), kind: video ? "video" : "image", created_at: new Date().toISOString(), bytes: main.size };
    if (!video) { row.thumb_url = await fileToDataUrl(await shrink(file, 900, 0.8)); const dm = await imageDims(main); if (dm) { row.width = dm.w; row.height = dm.h; } }
    const d = await this.load(); d.media.unshift(row); await this.save();
    return row;
  },
  async updateMedia(id, patch) { const d = await this.load(); const m = d.media.find(x => x.id === id); if (m) Object.assign(m, patch); await this.save(); },
  async deleteMedia(id) { const d = await this.load(); d.media = d.media.filter(x => x.id !== id); await this.save(); },
  async publish() { throw new Error("local"); },
  async lastPublish() { return null; },
  async exportFile() { const d = await this.load(); return { exported_at: new Date().toISOString(), content: mergeContent(d.content), projects: d.projects, posts: d.posts, media: d.media.map(m => ({ url: m.url, thumb_url: m.thumb_url, width: m.width, height: m.height })) }; },
  async importFile(data) { const d = await this.load(); if (data.content) d.content = data.content; if (Array.isArray(data.projects)) d.projects = data.projects; if (Array.isArray(data.posts)) d.posts = data.posts; await this.save(); },
  async reset() { await IDB.del("doc"); this.d = null; },
  async changePassword() { throw new Error("Passwords are used once Supabase is connected."); },
};

/* ---------- storage: Supabase ---------- */
const SupaStore = {
  mode: "supabase", client: null, user: null, role: null,
  init() { this.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey); },
  async session() { const { data } = await this.client.auth.getSession(); this.user = data.session?.user || null; return data.session; },
  async signIn(email, password) { const { error } = await this.client.auth.signInWithPassword({ email, password }); if (error) throw error; return this.session(); },
  async magic(email) { const { error } = await this.client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } }); if (error) throw error; },
  async signOut() { await this.client.auth.signOut(); this.user = null; },
  async changePassword(pw) { const { error } = await this.client.auth.updateUser({ password: pw }); if (error) throw error; },
  q(t) { return this.client.from(t); },
  async loadRole() { const { data } = await this.q("cms_users").select("role,name").ilike("email", this.user?.email || "").maybeSingle(); this.role = data?.role || null; this.userName = data?.name || ""; return this.role; },
  async settingsRows(keys) { let q = this.q("cms_settings").select("key,value"); if (keys) q = q.in("key", keys); const { data, error } = await q; if (error) throw error; return Object.fromEntries((data || []).map(r => [r.key, r.value])); },
  async meta() { return (await this.settingsRows(["_meta"]))._meta || null; },
  async getContent() { return mergeContent(await this.settingsRows()); },
  async saveContent(parts) {
    const old = await this.settingsRows(Object.keys(parts));
    for (const k of Object.keys(parts)) if (old[k] !== undefined) await this.addRevision("content", k, old[k]);
    const rows = Object.entries(parts).map(([key, value]) => ({ key, value, updated_by: this.user?.email }));
    const { error } = await this.q("cms_settings").upsert(rows); if (error) throw error;
  },
  async listProjects() { const { data, error } = await this.q("cms_projects").select("slug,data,enabled,sort,updated_at,updated_by").order("sort").order("slug"); if (error) throw error; return data.map(r => ({ ...r.data, slug: r.slug, enabled: r.enabled, sort: r.sort, updated_at: r.updated_at })); },
  async saveProject(p, oldSlug) {
    const ref = oldSlug || p.slug;
    const { data: old } = await this.q("cms_projects").select("data,sort").eq("slug", ref).maybeSingle();
    if (old) await this.addRevision("project", p.slug, old.data);
    let sort = old?.sort;
    if (sort == null) { const { data: last } = await this.q("cms_projects").select("sort").order("sort", { ascending: false }).limit(1); sort = (last?.[0]?.sort ?? 0) + 10; }
    const data = clone(p); delete data.updated_at; delete data.sort;
    const { error } = await this.q("cms_projects").upsert({ slug: p.slug, data, enabled: p.enabled !== false, sort, updated_by: this.user?.email }); if (error) throw error;
    if (oldSlug && oldSlug !== p.slug) await this.q("cms_projects").delete().eq("slug", oldSlug);
  },
  async deleteProject(slug) { const { error } = await this.q("cms_projects").delete().eq("slug", slug); if (error) throw error; },
  async saveOrder(slugs) { for (let i = 0; i < slugs.length; i++) { const { error } = await this.q("cms_projects").update({ sort: (i + 1) * 10 }).eq("slug", slugs[i]); if (error) throw error; } },
  async listPosts() { const { data, error } = await this.q("cms_posts").select("slug,title,status,published,updated_at,updated_by,cover:data->>cover,desc:data->>desc").order("published", { ascending: false }); if (error) throw error; return data.map(r => ({ ...r, date: r.published })); },
  async getPost(slug) { const { data } = await this.q("cms_posts").select("*").eq("slug", slug).maybeSingle(); return data ? { ...data.data, slug: data.slug, status: data.status, date: data.published } : null; },
  async savePost(p, oldSlug) {
    const ref = oldSlug || p.slug;
    const { data: old } = await this.q("cms_posts").select("data,status,published").eq("slug", ref).maybeSingle();
    if (old) await this.addRevision("post", p.slug, { ...old.data, status: old.status, date: old.published });
    const data = clone(p); delete data.updated_at;
    const { error } = await this.q("cms_posts").upsert({ slug: p.slug, title: p.title, status: p.status, published: p.date || todaySG(), data, updated_by: this.user?.email }); if (error) throw error;
    if (oldSlug && oldSlug !== p.slug) await this.q("cms_posts").delete().eq("slug", oldSlug);
  },
  async deletePost(slug) { const { error } = await this.q("cms_posts").delete().eq("slug", slug); if (error) throw error; },
  async listRevisions(kind, ref) { const { data, error } = await this.q("cms_revisions").select("*").eq("kind", kind).eq("ref", ref).order("saved_at", { ascending: false }).limit(30); if (error) throw error; return data; },
  async addRevision(kind, ref, data) { await this.q("cms_revisions").insert({ kind, ref, data, saved_by: this.user?.email }); },
  async listMedia() { const { data, error } = await this.q("cms_media").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  async _put(path, file) {
    const { error } = await this.client.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
    return this.client.storage.from("media").getPublicUrl(path).data.publicUrl;
  },
  async upload(file) {
    const video = /^video\//.test(file.type);
    if (video && file.size > 50e6) throw new Error("Videos must be under 50 MB. Shorten or compress it first.");
    const d = new Date(), base = `uploads/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${slugify(altFrom(file.name)) || "file"}-${uid()}`;
    const row = { alt: altFrom(file.name), kind: video ? "video" : "image", created_by: this.user?.email };
    if (video) { row.path = base + ".mp4"; row.url = await this._put(row.path, file); row.bytes = file.size; }
    else {
      const main = await shrink(file, 2400, 0.85), th = await shrink(file, 900, 0.8);
      const ext = main.type === "image/png" ? ".png" : ".jpg";
      row.path = base + ext; row.url = await this._put(row.path, main); row.thumb_url = await this._put(base + "-thumb" + ext, th); row.bytes = main.size;
      const dm = await imageDims(main); if (dm) { row.width = dm.w; row.height = dm.h; }
    }
    const { data, error } = await this.q("cms_media").insert(row).select().single(); if (error) throw error;
    return data;
  },
  async updateMedia(id, patch) { const { error } = await this.q("cms_media").update(patch).eq("id", id); if (error) throw error; },
  async deleteMedia(id) {
    const { data } = await this.q("cms_media").select("path,thumb_url").eq("id", id).maybeSingle();
    if (data?.path) { const paths = [data.path]; if (data.thumb_url) paths.push(data.path.replace(/(\.[a-z0-9]+)$/i, "-thumb$1")); await this.client.storage.from("media").remove(paths); }
    const { error } = await this.q("cms_media").delete().eq("id", id); if (error) throw error;
  },
  async api(path, body) {
    const s = await this.session(); if (!s) throw new Error("Please sign in again.");
    const r = await fetch("/api/cms/" + path, { method: "POST", headers: { Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "The request failed (" + r.status + ").");
    return j;
  },
  async publish() { return this.api("publish"); },
  async team(action, payload) { return this.api("users", { action, ...payload }); },
  async lastPublish() { const { data } = await this.q("cms_publishes").select("*").order("requested_at", { ascending: false }).limit(1); return data?.[0] || null; },
  async lastChange() {
    const pick = async t => { const { data } = await this.q(t).select("updated_at").order("updated_at", { ascending: false }).limit(1); return data?.[0]?.updated_at || null; };
    return [await pick("cms_settings"), await pick("cms_projects"), await pick("cms_posts")].filter(Boolean).sort().pop() || null;
  },
  async importSeed() {   // copies the website's current content into Supabase (first sign-in)
    const rows = Object.entries(SEED.content).map(([key, value]) => ({ key, value, updated_by: this.user?.email }));
    let r = await this.q("cms_settings").upsert(rows); if (r.error) throw r.error;
    r = await this.q("cms_projects").upsert(SEED.projects.map((p, i) => { const data = clone(p); return { slug: p.slug, data, enabled: p.enabled !== false, sort: (i + 1) * 10, updated_by: this.user?.email }; })); if (r.error) throw r.error;
    for (let i = 0; i < SEED.posts.length; i += 10) {
      r = await this.q("cms_posts").upsert(SEED.posts.slice(i, i + 10).map(p => ({ slug: p.slug, title: p.title, status: p.status || "published", published: p.date || todaySG(), data: clone(p), updated_by: this.user?.email })));
      if (r.error) throw r.error;
    }
    r = await this.q("cms_settings").upsert({ key: "_meta", value: { imported_at: new Date().toISOString(), by: this.user?.email } }); if (r.error) throw r.error;
  },
};

let store = LocalStore;
const can = (...roles) => roles.includes(store.role);

/* ---------- unsaved changes ---------- */
let dirty = false;
function setDirty(v) { dirty = v; const s = $("#saveStatus"); s.textContent = v ? "Unsaved changes" : ""; s.classList.toggle("is-dirty", v); }
window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- rich text (blog articles) ---------- */
const RT_ALLOWED = { P: [], BR: [], B: [], STRONG: [], I: [], EM: [], U: [], A: ["href"], UL: [], OL: [], LI: [], H2: [], H3: [], H4: [], BLOCKQUOTE: [], HR: [], FIGURE: [], FIGCAPTION: [], IMG: ["src", "alt"], TABLE: [], THEAD: [], TBODY: [], TR: [], TH: ["colspan", "rowspan"], TD: ["colspan", "rowspan"], SUP: [], SUB: [], IFRAME: ["src", "title"] };
const VIDEO_RX = /^https:\/\/(www\.)?(youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)[\w-]+/;
function sanitize(html) {
  const t = document.createElement("div"); t.innerHTML = html || "";
  const walk = n => {
    Array.from(n.childNodes).forEach(c => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) { c.remove(); return; }
      const tag = c.tagName;
      if (tag === "IFRAME") { if (VIDEO_RX.test(c.getAttribute("src") || "")) { Array.from(c.attributes).forEach(a => { if (!["src", "title"].includes(a.name)) c.removeAttribute(a.name); }); c.setAttribute("allowfullscreen", ""); c.setAttribute("loading", "lazy"); } else c.remove(); return; }
      if (["SCRIPT", "STYLE", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "BUTTON", "INPUT", "FORM", "META", "LINK"].includes(tag)) { c.remove(); return; }
      if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE") { const p = document.createElement("p"); while (c.firstChild) p.appendChild(c.firstChild); c.replaceWith(p); walk(p); return; }
      if (tag === "H1") { const x = document.createElement("h2"); while (c.firstChild) x.appendChild(c.firstChild); c.replaceWith(x); walk(x); return; }
      if (tag === "H5" || tag === "H6") { const x = document.createElement("h4"); while (c.firstChild) x.appendChild(c.firstChild); c.replaceWith(x); walk(x); return; }
      if (!RT_ALLOWED[tag]) { while (c.firstChild) n.insertBefore(c.firstChild, c); c.remove(); walk(n); return; }
      Array.from(c.attributes).forEach(a => { if (!RT_ALLOWED[tag].includes(a.name)) c.removeAttribute(a.name); });
      if (tag === "IMG") { const src = c.getAttribute("src") || ""; if (!/^(https?:|\/|data:image\/)/.test(src)) c.remove(); else c.setAttribute("loading", "lazy"); return; }
      if (tag === "A") {
        const href = (c.getAttribute("href") || "").trim();
        if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) c.removeAttribute("href");
        else if (/^https?:/i.test(href) && !/m2decor\.com\.sg/i.test(href)) { c.setAttribute("target", "_blank"); c.setAttribute("rel", "noopener"); }
      }
      walk(c);
    });
  };
  walk(t);
  return t.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, "").trim();
}
const ytId = s => { s = String(s || "").trim(); const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(s) ? s : s); };
function richText(value, onChange) {
  const ed = h("div", { class: "rt", contenteditable: "true", "data-placeholder": "Start writing. Use Heading for each new section." });
  ed.innerHTML = value || "";
  let range = null;
  const keep = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) range = s.getRangeAt(0); };
  const restore = () => { ed.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } };
  ed.addEventListener("keyup", keep); ed.addEventListener("mouseup", keep);
  ed.addEventListener("input", () => onChange(ed.innerHTML));
  ed.addEventListener("paste", e => {        // keep headings, lists and links from pasted text; drop everything else
    const html = e.clipboardData.getData("text/html");
    e.preventDefault();
    if (html) document.execCommand("insertHTML", false, sanitize(html));
    else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });
  const cmd = (c, v) => { restore(); document.execCommand(c, false, v ?? null); onChange(ed.innerHTML); keep(); };
  // photos and videos go in as their own block, below the paragraph, heading or list the cursor is in
  const insertBlock = html => {
    let top = range && ed.contains(range.startContainer) ? range.startContainer : null;
    while (top && top.parentNode !== ed) top = top.parentNode;
    const tmp = document.createElement("div"); tmp.innerHTML = html;
    const nodes = Array.from(tmp.childNodes);
    if (top) top.after(...nodes); else ed.append(...nodes);
    const last = nodes[nodes.length - 1]; const r = document.createRange(); r.selectNodeContents(last); r.collapse(true);
    ed.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); range = r;
    onChange(ed.innerHTML);
  };
  const B = (label, title, fn) => h("button", { type: "button", title, onmousedown: e => { e.preventDefault(); fn(); } }, label);
  const bar = h("div", { class: "rtbar" },
    B("Heading", "Section heading", () => cmd("formatBlock", "h2")),
    B("Subheading", "Smaller heading", () => cmd("formatBlock", "h3")),
    B("Text", "Normal text", () => cmd("formatBlock", "p")),
    h("i", { class: "sep" }),
    B(h("b", {}, "B"), "Bold", () => cmd("bold")),
    B(h("i", {}, "I"), "Italic", () => cmd("italic")),
    B("Link", "Link", () => { const u = prompt("Link address (https://… or /contact.html)"); if (u) cmd("createLink", u); }),
    h("i", { class: "sep" }),
    B("• List", "Bullet list", () => cmd("insertUnorderedList")),
    B("1. List", "Numbered list", () => cmd("insertOrderedList")),
    B("“ Quote", "Quote", () => cmd("formatBlock", "blockquote")),
    h("i", { class: "sep" }),
    B("Photo", "Add a photo here", () => { const saved = range; pickMedia(src => { range = saved; const alt = prompt("Describe the photo in a few words (for Google and screen readers)") || ""; const url = src.startsWith("assets/") ? "/" + src : src; insertBlock(`<img src="${esc(url)}" alt="${esc(alt)}"><p><br></p>`); }); }),
    B("YouTube", "Add a YouTube video", () => { const u = prompt("YouTube link"); if (!u) return; const id = ytId(u); if (!/^[\w-]{11}$/.test(id)) { toast("That does not look like a YouTube link.", "err"); return; } insertBlock(`<iframe src="https://www.youtube.com/embed/${id}" title="YouTube video" allowfullscreen></iframe><p><br></p>`); }),
    h("i", { class: "sep" }),
    B("Undo", "Undo", () => cmd("undo")),
    B("Clear style", "Remove bold, italic and links from the selection", () => cmd("removeFormat")));
  return h("div", { class: "rtwrap" }, bar, ed);
}

/* ---------- form fields ---------- */
const field = (label, input, hint) => h("div", { class: "field" }, label ? h("label", {}, label) : null, input, hint ? h("p", { class: "hint" }, hint) : null);
function counter(input, max) {
  const c = h("div", { class: "counter" });
  const upd = () => { const n = input.value.length; c.textContent = `${n} / ${max}`; c.classList.toggle("is-over", n > max); };
  input.addEventListener("input", upd); upd(); return c;
}

/* picture or video field: thumbnail + choose / upload / remove */
function mediaField(value, onChange, opts = {}) {
  const wrap = h("div", { class: "pic" });
  const draw = () => {
    wrap.innerHTML = "";
    const v = value || "";
    const thumb = opts.video
      ? h("div", { class: "pic__img pic__img--video" }, v ? h("video", { src: imgUrl(v), muted: true, playsinline: true, preload: "metadata" }) : "No video")
      : h("div", { class: "pic__img", style: { backgroundImage: v ? `url("${imgUrl(v)}")` : "" } });
    const fileIn = h("input", { type: "file", accept: opts.video ? "video/mp4" : "image/*", hidden: true, onchange: async () => {
      const f = fileIn.files[0]; if (!f) return;
      try { toast("Uploading " + f.name + "…"); const row = await store.upload(f); mediaCache = null; value = row.url; onChange(value); draw(); toast("Uploaded.", "ok"); }
      catch (e) { toast("Upload failed: " + e.message, "err"); }
    } });
    wrap.append(thumb, h("div", {},
      h("div", { class: "pic__btns" },
        h("button", { type: "button", class: "btn btn--small", onclick: () => pickMedia(src => { value = src; onChange(value); draw(); }, { video: opts.video }) }, "Choose"),
        h("button", { type: "button", class: "btn btn--small", onclick: () => fileIn.click() }, opts.video ? "Upload MP4" : "Upload"),
        v && opts.allowEmpty ? h("button", { type: "button", class: "btn btn--small btn--ghost", onclick: () => { value = ""; onChange(""); draw(); } }, "Remove") : null),
      h("div", { class: "pic__name" }, v ? (v.startsWith("data:") ? "Uploaded in this browser" : v.split("/").slice(-2).join("/").split("?")[0]) : "None"), fileIn));
  };
  draw();
  return wrap;
}

/* photo picker: uploaded photos + photos already on the website */
let mediaCache = null;
async function getMedia(force) { if (!mediaCache || force) mediaCache = await store.listMedia(); return mediaCache; }
function pickMedia(done, opts = {}) {
  modal(async (box, close) => {
    box.append(h("h2", {}, opts.video ? "Choose a video" : "Choose a photo"));
    const tabs = h("div", { class: "tabs" });
    const body = h("div");
    const fileIn = h("input", { type: "file", accept: opts.video ? "video/mp4" : "image/*", multiple: !opts.video, hidden: true });
    const drop = h("div", { class: "drop", onclick: () => fileIn.click() }, opts.video ? "Click to upload an MP4 video (under 50 MB)" : h("span", {}, "Drop photos here or ", h("b", {}, "click to upload")));
    const upload = async files => {
      let last = null;
      for (const [i, f] of files.entries()) { try { toast(`Uploading ${i + 1} of ${files.length}…`); last = await store.upload(f); } catch (e) { toast("Upload failed: " + e.message, "err"); } }
      mediaCache = null;
      if (last && files.length === 1) { close(); done(last.url); toast("Uploaded.", "ok"); } else { toast("Uploaded.", "ok"); show("up"); }
    };
    fileIn.onchange = () => upload(Array.from(fileIn.files));
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("is-over"); }; drop.ondragleave = () => drop.classList.remove("is-over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("is-over"); upload(Array.from(e.dataTransfer.files)); };
    const grid = (items) => h("div", { class: "mgrid" }, items.map(it => h("div", { class: "mcard", title: it.name, onclick: () => { close(); done(it.src); } },
      isVideo(it.src) ? h("div", { class: "vid" }, "Video") : h("img", { src: imgUrl(it.thumb || it.src), loading: "lazy", alt: "" }), h("p", {}, it.name))));
    const show = async which => {
      $$("button", tabs).forEach(b => b.classList.toggle("is-on", b.dataset.t === which));
      body.innerHTML = "";
      if (which === "up") {
        body.append(drop, fileIn);
        const media = (await getMedia()).filter(m => opts.video ? m.kind === "video" || isVideo(m.url) : !(m.kind === "video" || isVideo(m.url)));
        body.append(h("p", { class: "grouphead" }, `Uploaded (${media.length})`), media.length ? grid(media.map(m => ({ src: m.url, thumb: m.thumb_url, name: m.alt || m.path }))) : h("p", { class: "hint" }, "Nothing uploaded yet."));
      } else {
        const groups = {};
        SEED.assets.forEach(a => { const g = a.split("/").slice(-2, -1)[0]; (groups[g] = groups[g] || []).push(a); });
        Object.entries(groups).forEach(([g, list]) => body.append(h("p", { class: "grouphead" }, g), grid(list.map(a => ({ src: a, thumb: a, name: a.split("/").pop() })))));
      }
    };
    tabs.append(h("button", { type: "button", "data-t": "up", onclick: () => show("up") }, "Uploaded"));
    if (!opts.video) tabs.append(h("button", { type: "button", "data-t": "site", onclick: () => show("site") }, "Already on the website"));
    box.append(tabs, body);
    show("up");
  }, true);
}

/* sortable: drag cards by their grip (or anywhere when no grip), plus keyboard-free up/down from callers */
function sortable(container, sel, onMove) {
  let from = null;
  container.addEventListener("dragstart", e => { const it = e.target.closest(sel); if (!it || !container.contains(it)) return; from = it; it.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", ""); } catch (x) {} });
  container.addEventListener("dragend", () => { $$(sel, container).forEach(x => x.classList.remove("is-drag", "is-over")); from = null; });
  container.addEventListener("dragover", e => { if (!from) return; const it = e.target.closest(sel); if (!it || it === from) return; e.preventDefault(); $$(sel, container).forEach(x => x.classList.toggle("is-over", x === it)); });
  container.addEventListener("drop", e => {
    if (!from) return; const it = e.target.closest(sel); if (!it || it === from) return; e.preventDefault();
    const items = $$(sel, container); onMove(items.indexOf(from), items.indexOf(it));
  });
}
const moveItem = (arr, a, b) => { const [x] = arr.splice(a, 1); arr.splice(b, 0, x); return arr; };

/* ---------- page field definitions ---------- */
const F = {
  text: (key, label, hint) => ({ type: "text", key, label, hint }),
  area: (key, label, hint) => ({ type: "area", key, label, hint }),
  lines: (key, label, hint) => ({ type: "lines", key, label, hint: hint || "Each line here is a new line on the page." }),
  photo: (key, label, hint, allowEmpty) => ({ type: "photo", key, label, hint, allowEmpty }),
  video: (key, label, hint) => ({ type: "video", key, label, hint }),
  num: (key, label, hint) => ({ type: "num", key, label, hint }),
  url: (key, label, hint) => ({ type: "url", key, label, hint }),
  yt: (key, label, hint) => ({ type: "yt", key, label, hint }),
  points: (key, label, hint) => ({ type: "points", key, label, hint: hint || "One point per line." }),
  select: (key, label, options, hint) => ({ type: "select", key, label, options, hint }),
  list: (key, label, opt) => ({ type: "list", key, label, ...opt }),
  note: text => ({ type: "note", text }),
};
const seoFields = id => [F.text(`seo.title.${id}`, "Page title (browser tab and Google)"), F.area(`seo.desc.${id}`, "Description for Google", "One or two sentences. Leave empty to use the standard description.")];
const PROCESS_LIST = F.list("process", "The four stages", { fixed: true, title: i => `${i.n} · ${i.title}`, item: [F.text("n", "Number"), F.text("title", "Title"), F.points("items", "Points")] });

const PAGES = [
  { id: "home", name: "Home", url: "index.html", img: "assets/video/hero-poster.jpg", blurb: "Opening video, services, counters, reviews, process and FAQ.", sections: [
    { t: "Loading screen", d: "The orange screen with the M2D logo when the website opens.", f: [F.text("home.preloader_tag", "Line under the logo")] },
    { t: "Opening video", d: "Plays once when the home page opens, then the title appears over it.", f: [F.video("home.hero_video", "Video", "MP4, landscape, under 50 MB. Short clips (4 to 8 seconds) work best."), F.photo("home.hero_poster", "Still photo", "Shown while the video loads. Use the last frame of the video so the change is invisible.")] },
    { t: "Opening words", f: [F.lines("home.hero_title", "Big title"), F.area("home.hero_text", "Text"), F.text("home.hero_button", "Button")] },
    { t: "As featured in", d: "The moving strip of press and award logos.", f: [F.text("home.featured_title", "Heading"),
      F.list("press", "Logos", { title: i => i.name || "New logo", thumb: i => i.img, add: { name: "", img: "", kind: "press" }, item: [F.photo("img", "Logo", "A PNG with a transparent background looks best."), F.text("name", "Name", "For Google and screen readers."), F.select("kind", "Type", [["press", "Press"], ["award", "Award"]])] })] },
    { t: "Instagram strip", f: [F.text("home.ig_eyebrow", "Small heading"), F.text("home.ig_follow", "Link text"),
      F.list("ig", "Photos", { min: 4, title: (i, n) => `Photo ${n + 1}`, thumb: i => i.img, add: { img: "" }, item: [F.photo("img", "Photo")] })] },
    { t: "Our services", d: "The four coloured division panels. Each panel shows a second photo when you hover over it.", f: [F.lines("home.svc_tag", "Small text on the left"), F.text("home.svc_word1", "Title, first word"), F.text("home.svc_word2", "Title, second word"), F.text("home.svc_more", "Hover link text"),
      F.list("services", "Panels", { fixed: true, colours: () => SEED.service_colours, title: i => `${i.line1} ${i.line2}`, thumb: i => i.img, item: [F.text("line1", "Name, first line"), F.text("line2", "Name, second line"), F.lines("sub", "Name next to the logo on hover"), F.area("text", "Hover text"), F.photo("img", "Photo"), F.photo("hover", "Hover photo")] })] },
    { t: "Why M2D (the orange band)", f: [F.text("home.why_eyebrow", "Small heading"), F.lines("home.why_title", "Title"), F.area("home.why_text", "Text"),
      F.list("stats", "Counters", { fixed: true, title: i => `${i.n}${i.suffix} ${i.label}`, item: [F.num("n", "Number", "Numbers only. It counts up from 0 when it scrolls into view."), F.text("suffix", "After the number", "For example +"), F.text("label", "Label")] })] },
    { t: "Real homes (the photo scene)", d: "Six small photos float around a big one that grows to full screen as you scroll.", f: [F.text("home.rh_eyebrow", "Small heading"), F.lines("home.rh_title", "Title"), F.text("home.rh_button", "Button"), F.photo("home.rh_main", "Big middle photo"), F.text("home.rh_main_alt", "Describe the middle photo"),
      ...[1, 2, 3, 4, 5, 6].map(i => F.photo(`home.rh_sat${i}`, `Small photo ${i}`))] },
    { t: "YouTube", f: [F.text("home.yt_eyebrow", "Small heading"), F.lines("home.yt_title", "Title"), F.text("home.yt_link", "Link text"),
      F.list("videos", "Videos", { add: { id: "", title: "", text: "" }, title: i => i.title, item: [F.yt("id", "YouTube link", "Paste the video's link from YouTube."), F.text("title", "Title"), F.area("text", "Text")] })] },
    { t: "Reviews", f: [F.text("home.rev_eyebrow", "Small heading"), F.text("home.rev_score", "Score shown big", "For example 4.8"), F.area("home.rev_text", "Text"), F.lines("home.rev_sources", "Review sites", "One per line."), F.text("home.rev_link", "Link text"),
      F.list("reviews", "Reviews", { title: i => i.name || "New review", add: { name: "", role: "Homeowner", text: "" }, item: [F.text("name", "Name"), F.text("role", "Under the name", "For example Homeowners"), F.area("text", "Review")] })] },
    { t: "The process", d: "The four stages also show on the About page.", f: [F.text("home.proc_eyebrow", "Small heading"), F.lines("home.proc_title", "Title"), F.text("home.proc_link", "Link text"), PROCESS_LIST] },
    { t: "Latest articles", d: "The three newest blog posts appear here by themselves.", f: [F.text("home.blog_eyebrow", "Small heading"), F.lines("home.blog_title", "Title"), F.text("home.blog_button", "Button")] },
    { t: "FAQ", f: [F.text("home.faq_eyebrow", "Small heading"), F.lines("home.faq_title", "Title"), F.area("home.faq_text", "Text"),
      F.list("faq_home", "Questions", { title: i => i.q || "New question", add: { q: "", a: "" }, item: [F.text("q", "Question"), F.area("a", "Answer")] })] },
    { t: "Closing banner", d: "The \"Next step\" banner at the bottom of most pages. The words are the same everywhere; each page can have its own photo.", f: [F.lines("cta.title", "Title"), F.area("cta.text", "Text"), F.text("cta.button", "Button"), F.photo("cta.home", "Photo on the home page and on blog articles")] },
    { t: "Google", f: seoFields("home") },
  ] },
  { id: "about", name: "About us", url: "about.html", img: "assets/img/westcoast/01.jpg", blurb: "Opening photo, philosophy, team, story, how we work.", sections: [
    { t: "Opening photo", d: "Full-screen photo that shrinks into a frame as you scroll.", f: [F.photo("about.hero", "Photo"), F.text("about.hero_alt", "Describe the photo"), F.lines("about.corner_tl", "Words top left"), F.lines("about.corner_br", "Words bottom right"), F.text("about.label", "Label bottom left")] },
    { t: "Design philosophy", d: "The white panel that rises over the photo.", f: [F.text("about.ph_eyebrow", "Small heading"), F.text("about.ph_title", "Title"), F.area("about.ph_p1", "First paragraph"), F.area("about.ph_p2", "Second paragraph"), F.lines("about.ph_cap", "Small caption")] },
    { t: "Team photo, mission and vision", f: [F.photo("about.team", "Team photo"), F.text("about.team_alt", "Describe the photo"), F.text("about.th_eyebrow", "Small heading"), F.lines("about.th_title", "Title"), F.text("about.mission_title", "Mission heading"), F.area("about.mission_text", "Mission"), F.text("about.vision_title", "Vision heading"), F.area("about.vision_text", "Vision")] },
    { t: "Our team", d: "Click a portrait on the website to open the person's page. Put the creative team first, then the core crew: the big title switches between \"creative team\" and \"core team\" as you scroll.", f: [F.text("about.team_eyebrow", "Small heading"), F.lines("about.team_title", "Title"), F.area("about.team_lede", "Text"), F.text("about.team_vert", "Small sideways text"),
      F.list("team", "People", { title: i => `${i.name || "New person"}`, sub: i => i.role, thumb: i => i.img, add: { name: "", role: "", group: "core", img: "", lede: "", bio: "" }, item: [F.photo("img", "Portrait", "A tall photo works best."), F.text("name", "Name"), F.text("role", "Role"), F.select("group", "Team", [["creative", "Creative team"], ["core", "Core crew"]]), F.area("lede", "Question", "Shown big on the person's page."), F.area("bio", "Answer", "Type | to start a new paragraph.")] })] },
    { t: "Our story", f: [F.lines("about.story_tag", "Small text on the left"), F.text("about.story_word1", "Title, first part"), F.text("about.story_word2", "Title, second part"),
      F.list("story", "Chapters", { title: i => `${i.year} · ${i.title}`, thumb: i => i.img, add: { year: "", title: "", img: "", text: "" }, item: [F.text("year", "Year or label"), F.text("title", "Title"), F.photo("img", "Photo", "Remove the photo to show the four division colours instead.", true), F.area("text", "Text")] })] },
    { t: "How we work", f: [F.text("about.work_eyebrow", "Small heading"), F.lines("about.work_title", "Title"), F.area("about.work_lede", "Text"),
      F.list("work_photos", "Photos (they loop in a sliding strip; add as many as you like)", { title: i => i.caption || "New photo", thumb: i => i.img, add: { img: "", caption: "" }, item: [F.photo("img", "Photo"), F.text("caption", "Caption")] })] },
    { t: "The process", f: [F.text("about.proc_eyebrow", "Small heading"), F.lines("about.proc_title", "Title"), F.note("The four stages are the same as on the Home page; change them there.")] },
    { t: "FAQ", f: [F.text("about.faq_eyebrow", "Small heading"), F.lines("about.faq_title", "Title"),
      F.list("faq_about", "Questions", { title: i => i.q || "New question", add: { q: "", a: "" }, item: [F.text("q", "Question"), F.area("a", "Answer")] })] },
    { t: "Closing banner", f: [F.photo("cta.about", "Photo"), F.note("The banner's words are shared by every page; change them on the Home page.")] },
    { t: "Google", f: seoFields("about") },
  ] },
  { id: "portfolio", name: "Portfolio page", url: "portfolio.html", img: "assets/img/punggol/01.jpg", blurb: "The words around the photo strip. Projects are under Portfolio.", sections: [
    { t: "Words on the page", d: "The projects themselves are added and edited under Portfolio in the menu.", f: [F.text("portfolio.title", "Title"), F.text("portfolio.scroll", "Bottom left label"), F.text("portfolio.homes", "Word after the number of projects"), F.text("portfolio.hint", "Hint in gallery view")] },
    { t: "Project pages", f: [F.photo("cta.project", "Closing banner photo on every project page")] },
    { t: "Google", f: seoFields("portfolio") },
  ] },
  { id: "blog", name: "Blog page", url: "blog.html", img: "assets/img/chaseki/09.jpg", blurb: "Heading and intro of the blog page. Articles are under Blog.", sections: [
    { t: "Heading", d: "The articles themselves are written under Blog in the menu.", f: [F.text("blog.eyebrow", "Small heading"), F.text("blog.title", "Title"), F.area("blog.lede", "Intro")] },
    { t: "Closing banner", f: [F.photo("cta.blog", "Photo")] },
    { t: "Google", f: seoFields("blog") },
  ] },
  { id: "contact", name: "Contact us", url: "contact.html", img: "assets/img/punggol/01.jpg", blurb: "Hero photo and headings. Phone, email and hours are in Settings.", sections: [
    { t: "Hero", f: [F.photo("contact.hero", "Photo"), F.text("contact.eyebrow", "Small heading"), F.lines("contact.title", "Title"), F.area("contact.lede", "Text")] },
    { t: "Contact details headings", d: "The phone number, email, address and hours themselves are in Settings > Contact details.", f: [F.text("contact.h_wa", "Phone heading"), F.text("contact.h_email", "Email heading"), F.text("contact.h_studio", "Address heading"), F.text("contact.h_hours", "Hours heading"), F.text("contact.h_follow", "Social media heading")] },
    { t: "Google", f: seoFields("contact") },
  ] },
  { id: "footer", name: "Header, footer and Google", url: "index.html", img: "assets/img/home/01.jpg", blurb: "Footer text, division names, the Enquire button and the standard Google description.", sections: [
    { t: "Header", f: [F.text("nav.enquire", "Button at the top right")] },
    { t: "Footer", f: [F.area("footer.text", "Text under the logo"), F.text("footer.h_info", "First column heading"), F.text("footer.h_enquire", "Third column heading"), F.text("footer.copyright", "Bottom left"), F.text("footer.right", "Bottom right"),
      F.list("divisions", "The four divisions", { fixed: true, colours: () => SEED.divisions.map(d => d.colour), title: i => i.name, item: [F.text("name", "Name")] })] },
    { t: "Google", f: [F.area("seo.default_desc", "Standard description for Google", "Used by every page that has no description of its own.")] },
  ] },
];

/* render one page's sections; `state` is the whole content object, `touch(key)` marks a part as changed */
function renderSections(container, sections, state, touch) {
  sections.forEach(sec => {
    const card = h("section", { class: "card" }, h("h2", {}, sec.t), sec.d ? h("p", { class: "hint" }, sec.d) : null);
    sec.f.forEach(f => card.append(renderTopField(f, state, touch)));
    container.append(card);
  });
}
function renderTopField(f, state, touch) {
  if (f.type === "note") return h("p", { class: "hint", style: { margin: "4px 0 10px" } }, f.text);
  if (f.type === "list") return renderList(f, state, touch);
  const bucket = (f.type === "photo" || f.type === "video") ? "photos" : "copy";
  state[bucket] = state[bucket] || {};
  return renderField(f, () => state[bucket][f.key], v => { state[bucket][f.key] = v; touch(bucket); });
}
function renderField(f, get, set) {
  const v = get();
  let input, extra = null;
  switch (f.type) {
    case "area": input = h("textarea", { value: v ?? "", oninput: e => set(e.target.value) }); break;
    case "lines": input = h("textarea", { class: "is-short", value: v ?? "", rows: Math.max(2, String(v || "").split("\n").length), oninput: e => set(e.target.value) }); break;
    case "points": input = h("textarea", { value: (v || []).join("\n"), oninput: e => set(e.target.value.split("\n").map(x => x.trim()).filter(Boolean)) }); break;
    case "num": input = h("input", { type: "text", inputmode: "numeric", value: v ?? "", oninput: e => { const c = e.target.value.replace(/[^0-9.]/g, ""); if (c !== e.target.value) e.target.value = c; set(c); } }); break;
    case "select": input = h("select", { onchange: e => set(e.target.value) }, f.options.map(([val, lab]) => h("option", { value: val, selected: val === v }, lab))); break;
    case "url": input = h("input", { type: "url", value: v ?? "", placeholder: "https://", oninput: e => set(e.target.value.trim()) }); break;
    case "yt": input = h("input", { type: "text", value: v ? "https://www.youtube.com/watch?v=" + v : "", oninput: e => set(ytId(e.target.value)) });
      extra = v ? h("img", { src: `https://i.ytimg.com/vi/${v}/mqdefault.jpg`, style: { width: "160px", borderRadius: "6px", marginTop: "4px" }, alt: "" }) : null; break;
    case "photo": input = mediaField(v, set, { allowEmpty: f.allowEmpty }); break;
    case "video": input = mediaField(v, set, { video: true }); break;
    default: input = h("input", { type: "text", value: v ?? "", oninput: e => set(e.target.value) });
  }
  return h("div", { class: "field" }, f.label ? h("label", {}, f.label) : null, input, extra, f.hint ? h("p", { class: "hint" }, f.hint) : null);
}
function renderList(f, state, touch) {
  const arr = state[f.key] = state[f.key] || [];
  const wrap = h("div", { class: "field" }, h("div", { class: "lbl" }, f.label));
  const box = h("div", { class: "items" });
  const open = new Set();
  const draw = () => {
    box.innerHTML = "";
    const colours = f.colours ? f.colours() : null;
    arr.forEach((it, i) => {
      const body = h("div", { class: "item__body" });
      f.item.forEach(sf => body.append(renderField(sf, () => it[sf.key], v => { it[sf.key] = v; touch(f.key); title.firstChild.textContent = (f.title ? f.title(it, i) : "") || "Untitled"; if (f.thumb && th) th.style.backgroundImage = `url("${imgUrl(f.thumb(it))}")`; })));
      const title = h("span", { class: "item__title" }, (f.title ? f.title(it, i) : "") || "Untitled", f.sub && f.sub(it) ? h("small", {}, f.sub(it)) : null);
      const th = f.thumb ? h("span", { class: "item__thumb", style: { backgroundImage: f.thumb(it) ? `url("${imgUrl(f.thumb(it))}")` : "" } }) : null;
      const dot = colours ? h("span", { class: "item__thumb", style: { background: colours[i] || "#ccc", width: "14px", height: "14px", borderRadius: "50%" } }) : null;
      const item = h("div", { class: "item" + (open.has(i) ? "" : " is-closed"), draggable: f.fixed ? null : "true" },
        h("div", { class: "item__head", onclick: e => { if (e.target.closest("button")) return; item.classList.toggle("is-closed"); if (item.classList.contains("is-closed")) open.delete(i); else open.add(i); } },
          f.fixed ? null : h("span", { class: "item__grip", title: "Drag to reorder" }, "⋮⋮"), dot, th, title,
          f.fixed ? null : h("button", { type: "button", class: "iconbtn", title: "Move up", disabled: i === 0, onclick: () => { moveItem(arr, i, i - 1); touch(f.key); draw(); } }, "↑"),
          f.fixed ? null : h("button", { type: "button", class: "iconbtn", title: "Move down", disabled: i === arr.length - 1, onclick: () => { moveItem(arr, i, i + 1); touch(f.key); draw(); } }, "↓"),
          f.fixed ? null : h("button", { type: "button", class: "iconbtn iconbtn--danger", title: "Remove", onclick: async () => { if (f.min && arr.length <= f.min) { toast(`Keep at least ${f.min}.`, "err"); return; } if (await confirmBox(`Remove "${(f.title ? f.title(it, i) : "") || "this item"}"?`, "Remove")) { arr.splice(i, 1); open.clear(); touch(f.key); draw(); } } }, "×")),
        body);
      box.append(item);
    });
  };
  if (!f.fixed) sortable(box, ".item", (a, b) => { moveItem(arr, a, b); open.clear(); touch(f.key); draw(); });
  draw();
  wrap.append(box);
  if (!f.fixed && f.add) wrap.append(h("div", { class: "addrow" }, h("button", { type: "button", class: "btn btn--small", onclick: () => { arr.push(clone(f.add)); open.add(arr.length - 1); touch(f.key); draw(); } }, "+ Add")));
  return wrap;
}

/* ---------- version history ---------- */
async function showHistory(kind, ref, onRestore, label) {
  let rows = [];
  try { rows = await store.listRevisions(kind, ref); } catch (e) { toast(e.message, "err"); return; }
  modal((box, close) => {
    box.append(h("h2", {}, "Earlier versions" + (label ? ": " + label : "")),
      h("p", { class: "hint" }, "A copy is kept every time something is saved. Loading one puts it in the editor; press Save to keep it."));
    if (!rows.length) { box.append(h("p", { class: "empty" }, "No earlier versions yet.")); return; }
    box.append(h("div", { class: "list" }, rows.map(r => h("div", { class: "row" }, h("div", { class: "row__main" }, h("b", {}, fmtTime(r.saved_at)), h("span", {}, r.saved_by || "")),
      h("div", { class: "row__side" }, h("button", { type: "button", class: "btn btn--small", onclick: () => { close(); onRestore(r.data, r); } }, "Load this version"))))));
  });
}

/* ================================================================ views */
const content = () => $("#content");
const phead = (title, text, ...actions) => h("div", { class: "phead" }, h("div", {}, h("h1", {}, title), text ? h("p", {}, text) : null), actions.length ? h("div", { class: "phead__actions" }, actions) : null);
const crumb = (...parts) => h("div", { class: "crumb" }, parts.map((p, i) => [i ? " / " : "", p.href ? h("a", { href: p.href }, p.t) : p.t]));
const routes = {};

/* ---------- dashboard ---------- */
routes.dash = async () => {
  const c = content(); c.innerHTML = "";
  const [projects, posts] = await Promise.all([can("owner", "editor") ? store.listProjects() : [], store.listPosts()]);
  const live = posts.filter(p => p.status === "published" && (p.date || "") <= todaySG()).length;
  const drafts = posts.filter(p => p.status !== "published").length;
  c.append(phead(`Hello${store.userName ? ", " + store.userName.split(" ")[0] : ""}`, "Change any words or photos on the website, add projects to the portfolio and write blog posts. Changes go live when you press Publish."));
  // publish status
  const pub = h("section", { class: "card" });
  c.append(pub);
  if (store.mode === "local") {
    pub.append(h("div", { class: "card__head" }, h("div", {}, h("h2", {}, "Local draft mode"), h("p", {}, "Supabase is not connected yet. Everything you change is kept in this browser so you can try the admin out. Once Supabase is connected, the same changes are made for real and Publish updates the website."))),
      h("div", { class: "addrow" }, h("button", { type: "button", class: "btn", onclick: exportContent }, "Download content file"), h("span", { class: "hint" }, "For your web developer: build the site from it with build/pull_cms.py --file.")));
  } else {
    pub.append(h("p", { class: "hint" }, "Checking…"));
    (async () => {
      const [last, change] = await Promise.all([store.lastPublish().catch(() => null), store.lastChange().catch(() => null)]);
      pub.innerHTML = "";
      const pending = change && (!last || change > last.requested_at);
      pub.append(h("div", { class: "card__head" }, h("div", {}, h("h2", {}, pending ? "You have changes that are not on the website yet" : "The website is up to date"),
        h("p", {}, last ? `Last published ${fmtTime(last.requested_at)} by ${last.requested_by || "someone"}.` : "Not published from the admin yet.")),
        h("button", { type: "button", class: "btn btn--primary", onclick: publishNow }, "Publish to website")));
    })();
  }
  const tiles = h("div", { class: "tiles" });
  if (can("owner", "editor")) {
    tiles.append(h("a", { class: "tile", href: "#/pages" }, h("div", { class: "tile__img", style: { backgroundImage: `url("../assets/img/westcoast/01.jpg")` } }), h("b", {}, "Pages"), h("span", {}, "Words and photos on Home, About, Contact and the rest.")));
    tiles.append(h("a", { class: "tile", href: "#/portfolio" }, h("div", { class: "tile__img", style: { backgroundImage: `url("../assets/img/punggol/01.jpg")` } }), h("b", {}, `Portfolio · ${projects.length} projects`), h("span", {}, "Add a project with its photos, or change the order.")));
  }
  tiles.append(h("a", { class: "tile", href: "#/blog" }, h("div", { class: "tile__img", style: { backgroundImage: `url("../assets/img/chaseki/09.jpg")` } }), h("b", {}, `Blog · ${live} live${drafts ? `, ${drafts} draft${drafts > 1 ? "s" : ""}` : ""}`), h("span", {}, "Write a new article or edit one.")));
  tiles.append(h("a", { class: "tile", href: "#/photos" }, h("div", { class: "tile__img", style: { backgroundImage: `url("../assets/img/hozon/02.jpg")` } }), h("b", {}, "Photo library"), h("span", {}, "Every photo you have uploaded.")));
  c.append(h("p", { class: "section-title" }, "Edit"), tiles);
  c.append(h("p", { class: "section-title" }, "Quick start"), h("section", { class: "card" }, h("ol", { class: "steps" },
    h("li", {}, "Open a page, a project or a blog post and change what you need."),
    h("li", {}, "Press Save. Nothing changes on the website yet."),
    h("li", {}, "When you are happy, press Publish to website (top right). The website updates in about two minutes."))));
};

/* ---------- pages ---------- */
routes.pages = async (id) => {
  const c = content(); c.innerHTML = "";
  if (!id) {
    c.append(phead("Pages", "Every word and photo on the website. Pick a page to edit it."));
    c.append(h("div", { class: "tiles" }, PAGES.map(p => h("a", { class: "tile", href: "#/pages/" + p.id }, h("div", { class: "tile__img", style: { backgroundImage: `url("${imgUrl(p.img)}")` } }), h("b", {}, p.name), h("span", {}, p.blurb)))));
    c.append(h("p", { class: "section-title" }, "Also"), h("div", { class: "tiles" }, h("a", { class: "tile", href: "#/settings" }, h("b", {}, "Contact details"), h("span", {}, "Phone, email, address, hours and social media, used across the whole website."))));
    return;
  }
  const page = PAGES.find(p => p.id === id); if (!page) { location.hash = "#/pages"; return; }
  const state = await store.getContent();
  const changed = new Set();
  const touch = k => { changed.add(k); setDirty(true); };
  const save = async () => {
    if (!changed.size) { toast("Nothing to save."); return; }
    const parts = {}; changed.forEach(k => parts[k] = state[k]);
    try { await store.saveContent(parts); changed.clear(); setDirty(false); toast("Saved. Press Publish to website when you are ready.", "ok"); }
    catch (e) { toast("Save failed: " + e.message, "err"); }
  };
  const keys = new Set(); page.sections.forEach(s => s.f.forEach(f => { if (f.type === "list") keys.add(f.key); else if (f.type === "photo" || f.type === "video") keys.add("photos"); else if (f.type !== "note") keys.add("copy"); }));
  const hist = () => modal((box, close) => {
    box.append(h("h2", {}, "Earlier versions"), h("p", { class: "hint" }, "Pick which part of the page to look at."));
    box.append(h("div", { class: "list" }, [...keys].map(k => h("button", { type: "button", class: "row", style: { width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left" }, onclick: () => { close(); showHistory("content", k, data => { state[k] = data; touch(k); routesRender(); toast("Older version loaded. Press Save to keep it.", "ok"); }, PART_NAMES[k] || k); } },
      h("div", { class: "row__main" }, h("b", {}, PART_NAMES[k] || k))))));
  });
  const routesRender = () => {
    c.innerHTML = "";
    c.append(crumb({ t: "Pages", href: "#/pages" }, { t: page.name }));
    c.append(phead(page.name, page.blurb, h("a", { class: "btn", href: siteUrl(page.url), target: "_blank", rel: "noopener" }, "View page ↗"), h("button", { type: "button", class: "btn", onclick: hist }, "History"), h("button", { type: "button", class: "btn btn--dark", onclick: save }, "Save")));
    renderSections(c, page.sections, state, touch);
    c.append(h("div", { class: "addrow" }, h("button", { type: "button", class: "btn btn--dark", onclick: save }, "Save changes")));
  };
  routesRender();
  bindSaveKey(save);
};
const PART_NAMES = { copy: "Words", photos: "Page photos", press: "Press logos", ig: "Instagram photos", services: "Services panels", stats: "Counters", videos: "YouTube videos", reviews: "Reviews", process: "Process stages", faq_home: "Home FAQ", faq_about: "About FAQ", team: "Team", story: "Our story", work_photos: "How we work photos", divisions: "Divisions", site: "Contact details" };
let saveKeyHandler = null;
function bindSaveKey(fn) { saveKeyHandler = fn; }
document.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "s" && saveKeyHandler) { e.preventDefault(); saveKeyHandler(); } });

/* ---------- portfolio ---------- */
const LAYOUT_INFO = {
  reveal: { name: "Photo reveal", text: "Title on the side, one big photo in the middle; as you scroll four more open out to the corners, then the rest run down the page.", min: 6,
    svg: `<svg viewBox="0 0 120 70"><rect x="6" y="14" width="22" height="3" fill="#bbb"/><rect x="6" y="20" width="16" height="2" fill="#ccc"/><rect x="42" y="18" width="40" height="30" fill="#E37F32" opacity=".85"/><rect x="88" y="6" width="18" height="12" fill="#c9bfb3"/><rect x="88" y="52" width="18" height="12" fill="#c9bfb3"/><rect x="34" y="54" width="14" height="10" fill="#c9bfb3"/><rect x="34" y="4" width="14" height="10" fill="#c9bfb3"/></svg>` },
  horizontal: { name: "Side scroll", text: "The page scrolls sideways like a magazine spread, with text panels between the photos.", min: 8,
    svg: `<svg viewBox="0 0 120 70"><rect x="4" y="16" width="22" height="38" fill="#fff"/><rect x="7" y="22" width="14" height="3" fill="#bbb"/><rect x="30" y="16" width="30" height="38" fill="#E37F32" opacity=".85"/><rect x="64" y="8" width="20" height="54" fill="#c9bfb3"/><rect x="88" y="16" width="30" height="38" fill="#c9bfb3"/><path d="M50 66h20" stroke="#999" stroke-width="1.5"/><path d="M66 63l4 3-4 3" fill="none" stroke="#999" stroke-width="1.5"/></svg>` },
  editorial: { name: "Magazine", text: "A big cover photo with the project name, then a magazine grid of photos in mixed sizes.", min: 6,
    svg: `<svg viewBox="0 0 120 70"><rect x="8" y="4" width="40" height="5" fill="#bbb"/><rect x="8" y="12" width="104" height="24" fill="#E37F32" opacity=".85"/><rect x="8" y="40" width="60" height="26" fill="#c9bfb3"/><rect x="72" y="40" width="40" height="16" fill="#c9bfb3"/><rect x="72" y="58" width="40" height="8" fill="#ddd"/></svg>` },
};
routes.portfolio = async (slug) => {
  if (slug) return editProject(slug);
  const c = content(); c.innerHTML = "";
  let projects = clone(await store.listProjects());
  c.append(phead("Portfolio", "Every project on the Portfolio page, in the order shown there. Drag to change the order. The first photo of each project is the one on the Portfolio page.",
    h("a", { class: "btn", href: siteUrl("portfolio.html"), target: "_blank", rel: "noopener" }, "View portfolio ↗"),
    h("a", { class: "btn btn--primary", href: "#/portfolio/new" }, "+ Add project")));
  const list = h("div", { class: "list" });
  const draw = () => {
    list.innerHTML = "";
    if (!projects.length) list.append(h("p", { class: "empty" }, "No projects yet."));
    projects.forEach((p, i) => {
      const first = p.images?.[0]?.src;
      list.append(h("div", { class: "row item" + (p.enabled === false ? " is-hidden" : ""), draggable: "true", style: { cursor: "grab" } },
        h("span", { class: "item__grip" }, "⋮⋮"),
        h("div", { class: "row__img", style: { backgroundImage: first ? `url("${imgUrl(first)}")` : "" } }),
        h("a", { class: "row__main", href: "#/portfolio/" + p.slug, style: { textDecoration: "none" } }, h("b", {}, p.name || "Untitled"), h("span", {}, `${p.place || ""}${p.year ? " · " + p.year : ""} · ${(p.images || []).length} photos`)),
        h("div", { class: "row__side" },
          h("span", { class: "chip" }, LAYOUT_INFO[p.layout]?.name || "Magazine"),
          p.enabled === false ? h("span", { class: "chip chip--draft" }, "Hidden") : null,
          h("button", { type: "button", class: "iconbtn", title: "Move up", disabled: i === 0, onclick: () => reorder(i, i - 1) }, "↑"),
          h("button", { type: "button", class: "iconbtn", title: "Move down", disabled: i === projects.length - 1, onclick: () => reorder(i, i + 1) }, "↓"),
          h("a", { class: "btn btn--small", href: "#/portfolio/" + p.slug }, "Edit"))));
    });
  };
  const reorder = async (a, b) => {
    moveItem(projects, a, b); draw();
    try { await store.saveOrder(projects.map(p => p.slug)); toast("Order saved. Press Publish to website when you are ready.", "ok"); } catch (e) { toast("Could not save the order: " + e.message, "err"); }
  };
  sortable(list, ".row", reorder);
  draw();
  c.append(list);
};

async function editProject(slug) {
  const c = content(); c.innerHTML = "";
  const all = await store.listProjects();
  const isNew = slug === "new";
  const found = all.find(p => p.slug === slug);
  if (!isNew && !found) { c.append(h("p", { class: "empty" }, "That project was not found."), h("a", { class: "btn", href: "#/portfolio" }, "Back to Portfolio")); return; }
  const p = isNew ? { slug: "", name: "", place: "", year: String(new Date().getFullYear()), type: "Residential · ", area: "", rooms: "", tagline: "", paras: [""], layout: "reveal", enabled: true,
    credits: [{ k: "Design team", v: "Benjamin Toh Jun Jie" }, { k: "Construction & build", v: "M2D Carpentry" }, { k: "3D illustrations", v: "M2D Interior & Consultancy" }, { k: "Photographer", v: "M2D Interior" }], images: [] } : clone(found);
  p.images = (p.images || []).map(x => typeof x === "string" ? { src: x, caption: "" } : x);
  p.credits = (p.credits || []).map(x => Array.isArray(x) ? { k: x[0], v: x[1] } : x);
  const oldSlug = isNew ? null : p.slug;
  let slugTouched = !isNew;
  const touch = () => setDirty(true);

  const save = async () => {
    p.name = p.name.trim();
    if (!p.name) { toast("Give the project a name first.", "err"); return; }
    if (!p.images.length) { toast("Add at least one photo.", "err"); return; }
    p.slug = slugify(p.slug || p.name);
    if (all.some(x => x.slug === p.slug && x.slug !== oldSlug)) { toast("Another project already uses this web address. Change the name or the web address.", "err"); return; }
    p.cover = p.images[0].src;
    if (!p.images.some(x => x.src === p.portrait)) p.portrait = p.images[Math.min(1, p.images.length - 1)].src;
    p.paras = p.paras.map(x => x.trim()).filter(Boolean);
    if (!p.paras.length) p.paras = [p.tagline || p.name];
    p.credits = p.credits.filter(x => x.k || x.v);
    try {
      await store.saveProject(p, oldSlug); setDirty(false);
      toast("Saved. Press Publish to website when you are ready.", "ok");
      if (isNew || oldSlug !== p.slug) location.hash = "#/portfolio/" + p.slug; else editProject(p.slug);
    } catch (e) { toast("Save failed: " + e.message, "err"); }
  };
  bindSaveKey(save);

  c.append(crumb({ t: "Portfolio", href: "#/portfolio" }, { t: isNew ? "New project" : p.name }));
  c.append(phead(isNew ? "New project" : p.name, isNew ? "Upload the photos, fill in the details and pick a page layout. The project goes on the Portfolio page and gets its own page." : `${p.place}${p.year ? " · " + p.year : ""}`,
    isNew ? null : h("a", { class: "btn", href: siteUrl(`projects/${p.slug}.html`), target: "_blank", rel: "noopener" }, "View page ↗"),
    isNew ? null : h("button", { type: "button", class: "btn", onclick: () => showHistory("project", p.slug, data => { Object.assign(p, clone(data)); setDirty(true); toast("Older version loaded. Press Save to keep it.", "ok"); drawAll(); }, p.name) }, "History"),
    h("button", { type: "button", class: "btn btn--dark", onclick: save }, "Save")));

  const main = h("div"), side = h("div", { class: "editor__side" });
  c.append(h("div", { class: "editor" }, main, side));

  // --- photos
  const photosCard = h("section", { class: "card" });
  const fileIn = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
  const dropLabel = () => h("span", {}, "Drop the project's photos here or ", h("b", {}, "click to upload"), h("br"), h("small", {}, "Several at once is fine. Large photos are resized for the web automatically."));
  const drop = h("div", { class: "drop", onclick: () => fileIn.click() }, dropLabel());
  const grid = h("div", { class: "photos" });
  const countWarn = h("div");
  const upload = async files => {
    files = files.filter(f => /^image\//.test(f.type)); if (!files.length) return;
    for (const [i, f] of files.entries()) {
      drop.firstChild.textContent = `Uploading ${i + 1} of ${files.length}…`;
      try { const row = await store.upload(f); p.images.push({ src: row.url, caption: "" }); touch(); drawPhotos(); }
      catch (e) { toast(`${f.name}: ${e.message}`, "err"); }
    }
    mediaCache = null; drop.firstChild.replaceWith(dropLabel()); toast(`${files.length} photo${files.length > 1 ? "s" : ""} added. Press Save to keep them.`, "ok");
  };
  fileIn.onchange = () => { upload(Array.from(fileIn.files)); fileIn.value = ""; };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("is-over"); }; drop.ondragleave = () => drop.classList.remove("is-over");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("is-over"); upload(Array.from(e.dataTransfer.files)); };
  const drawPhotos = () => {
    grid.innerHTML = "";
    p.images.forEach((im, i) => {
      const tags = [];
      if (i === 0) tags.push("Cover");
      if (p.layout === "reveal" && i >= 1 && i <= 4) tags.push("Corner");
      grid.append(h("div", { class: "ph", draggable: "true" },
        h("div", { class: "ph__img", style: { backgroundImage: `url("${imgUrl(im.src)}")` }, title: "Drag to reorder" }, h("span", { class: "ph__n" }, String(i + 1).padStart(2, "0")), h("span", { class: "ph__tags" }, tags.map(t => h("span", {}, t)))),
        h("div", { class: "ph__body" },
          h("input", { type: "text", placeholder: "Caption (optional)", value: im.caption || "", oninput: e => { im.caption = e.target.value; touch(); } }),
          h("div", { class: "ph__btns" },
            i ? h("button", { type: "button", title: "Use as the cover", onclick: () => { moveItem(p.images, i, 0); touch(); drawPhotos(); } }, "Make cover") : h("button", { type: "button", class: "is-on", disabled: true }, "Cover"),
            h("button", { type: "button", title: "Move left", disabled: i === 0, onclick: () => { moveItem(p.images, i, i - 1); touch(); drawPhotos(); } }, "←"),
            h("button", { type: "button", title: "Move right", disabled: i === p.images.length - 1, onclick: () => { moveItem(p.images, i, i + 1); touch(); drawPhotos(); } }, "→"),
            h("button", { type: "button", title: "Remove from this project", onclick: () => { p.images.splice(i, 1); touch(); drawPhotos(); } }, "Remove")))));
    });
    const min = LAYOUT_INFO[p.layout]?.min || 6;
    countWarn.innerHTML = "";
    if (p.images.length && p.images.length < min) countWarn.append(h("p", { class: "warn" }, `This layout looks best with ${min} or more photos. You have ${p.images.length}.`));
  };
  sortable(grid, ".ph", (a, b) => { moveItem(p.images, a, b); touch(); drawPhotos(); });
  photosCard.append(h("div", { class: "card__head" }, h("div", {}, h("h2", {}, `Photos`), h("p", {}, "The first photo is the cover: it is the one on the Portfolio page and the main photo of the project page. Drag photos to change their order on the page."))),
    h("div", { class: "addrow", style: { marginTop: 0, marginBottom: "12px" } }, h("button", { type: "button", class: "btn btn--small", onclick: () => pickMedia(src => { p.images.push({ src, caption: "" }); touch(); drawPhotos(); }) }, "+ Add from photo library")),
    drop, fileIn, countWarn, grid);
  main.append(photosCard);

  // --- details
  const fld = (key, label, hint, opts = {}) => {
    const input = opts.area ? h("textarea", { value: p[key] || "", oninput: e => { p[key] = e.target.value; touch(); if (opts.after) opts.after(); } })
      : h("input", { type: "text", value: p[key] || "", placeholder: opts.ph || "", oninput: e => { p[key] = e.target.value; touch(); if (opts.after) opts.after(); } });
    return field(label, input, hint);
  };
  const slugIn = h("input", { type: "text", value: p.slug, oninput: e => { slugTouched = true; p.slug = slugify(e.target.value); touch(); } });
  const details = h("section", { class: "card" }, h("h2", {}, "Details"), h("p", { class: "hint" }, "Shown on the project page."),
    h("div", { class: "grid2" },
      fld("name", "Project name", "For example Nimbus", { after: () => { if (!slugTouched) { p.slug = slugify(p.name); slugIn.value = p.slug; slugIn.dispatchEvent(new Event("sync")); } } }),
      fld("place", "Place", "Shown as the big title on most layouts, e.g. 443 Punggol")),
    h("div", { class: "grid3" }, fld("year", "Year"), fld("area", "Size", "e.g. 1,033 sqft · 96 sqm"), fld("rooms", "Rooms", "e.g. 3 Bed · 2 Bath")),
    fld("type", "Type", "e.g. Residential · 4-Room BTO"),
    fld("tagline", "Short intro", "One or two sentences. Also used as the description for Google.", { area: true }));
  const parasBox = h("div", { class: "items" });
  const drawParas = () => {
    parasBox.innerHTML = "";
    p.paras.forEach((t, i) => parasBox.append(h("div", { class: "field", style: { marginBottom: "4px" } },
      h("div", { style: { display: "flex", gap: "8px", alignItems: "flex-start" } },
        h("textarea", { value: t, placeholder: i === 0 ? "The opening story of the project" : "Another paragraph", style: { flex: 1 }, oninput: e => { p.paras[i] = e.target.value; touch(); } }),
        h("button", { type: "button", class: "iconbtn iconbtn--danger", title: "Remove", onclick: () => { p.paras.splice(i, 1); if (!p.paras.length) p.paras.push(""); touch(); drawParas(); } }, "×")))));
  };
  drawParas();
  details.append(h("div", { class: "field" }, h("div", { class: "lbl" }, "Story"), h("p", { class: "hint" }, "The first paragraph is shown large. The others are placed between the photos."), parasBox,
    h("div", { class: "addrow" }, h("button", { type: "button", class: "btn btn--small", onclick: () => { p.paras.push(""); touch(); drawParas(); } }, "+ Paragraph"))));
  const credBox = h("div");
  const drawCreds = () => {
    credBox.innerHTML = "";
    p.credits.forEach((cr, i) => credBox.append(h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: "8px", marginBottom: "8px" } },
      h("input", { type: "text", value: cr.k, placeholder: "Role", oninput: e => { cr.k = e.target.value; touch(); } }),
      h("input", { type: "text", value: cr.v, placeholder: "Name", oninput: e => { cr.v = e.target.value; touch(); } }),
      h("button", { type: "button", class: "iconbtn iconbtn--danger", onclick: () => { p.credits.splice(i, 1); touch(); drawCreds(); } }, "×"))));
  };
  drawCreds();
  details.append(h("div", { class: "field" }, h("div", { class: "lbl" }, "Credits"), credBox, h("div", { class: "addrow", style: { marginTop: "4px" } }, h("button", { type: "button", class: "btn btn--small", onclick: () => { p.credits.push({ k: "", v: "" }); touch(); drawCreds(); } }, "+ Credit"))));
  main.append(details);

  // --- side: layout, visibility, address
  const layCard = h("section", { class: "card" }, h("h2", {}, "Page layout"), h("p", { class: "hint" }, "How the project page moves as you scroll."));
  const lays = h("div", { class: "layouts", style: { gridTemplateColumns: "1fr" } });
  const drawLays = () => {
    lays.innerHTML = "";
    Object.entries(LAYOUT_INFO).forEach(([k, L]) => lays.append(h("button", { type: "button", class: "lay" + (p.layout === k ? " is-on" : ""), onclick: () => { p.layout = k; touch(); drawLays(); drawPhotos(); } },
      h("span", { html: L.svg }), h("b", {}, L.name), h("span", {}, L.text + ` Best with ${L.min}+ photos.`))));
  };
  drawLays(); layCard.append(lays);
  const vis = h("section", { class: "card" }, h("h2", {}, "On the website"),
    h("label", { class: "check", style: { margin: "10px 0 14px" } }, h("input", { type: "checkbox", checked: p.enabled !== false, onchange: e => { p.enabled = e.target.checked; touch(); } }), "Show this project on the website"),
    field("Web address", slugIn, isNew ? "Made from the name. Only letters, numbers and dashes." : "Changing it breaks links people have already shared."),
    h("p", { class: "hint" }, "m2decor.com.sg/projects/", h("b", {}, p.slug || "…"), ".html"));
  const delCard = isNew ? null : h("section", { class: "card" }, h("h2", {}, "Delete"), h("p", { class: "hint", style: { marginBottom: "12px" } }, "Removes the project and its page at the next publish. To take it off the website for a while, untick \"Show this project\" instead."),
    h("button", { type: "button", class: "btn btn--danger", onclick: async () => { if (await confirmBox(`Delete "${p.name}"? Its page goes at the next publish.`)) { try { await store.deleteProject(oldSlug); setDirty(false); toast("Deleted.", "ok"); location.hash = "#/portfolio"; } catch (e) { toast(e.message, "err"); } } } }, "Delete project"));
  side.append(layCard, vis, delCard, h("button", { type: "button", class: "btn btn--dark", onclick: save, style: { width: "100%" } }, "Save project"));
  $(".hint b", vis).textContent = p.slug || "…";
  ["input", "sync"].forEach(ev => slugIn.addEventListener(ev, () => $(".hint b", vis).textContent = p.slug || "…"));
  const drawAll = () => { drawPhotos(); drawParas(); drawCreds(); drawLays(); };
  drawPhotos();
}

/* ---------- blog ---------- */
const postState = p => p.status !== "published" ? ["Draft", "chip--draft"] : (p.date || "") > todaySG() ? ["Scheduled " + fmtDate(p.date), "chip--soon"] : ["Live", "chip--ok"];
routes.blog = async (slug) => {
  if (slug) return editPost(slug);
  const c = content(); c.innerHTML = "";
  const posts = (await store.listPosts()).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  let filter = "all", q = "";
  c.append(phead("Blog", "Articles on the Blog page, newest first. The three newest also show on the Home page.", h("a", { class: "btn", href: siteUrl("blog.html"), target: "_blank", rel: "noopener" }, "View blog ↗"), h("a", { class: "btn btn--primary", href: "#/blog/new" }, "+ New post")));
  const list = h("div", { class: "list" });
  const filt = h("div", { class: "filters" }, [["all", "All"], ["live", "Live"], ["draft", "Drafts"]].map(([k, l]) => h("button", { type: "button", class: k === filter ? "is-on" : "", onclick: e => { filter = k; $$("button", filt).forEach(b => b.classList.toggle("is-on", b === e.target)); draw(); } }, l)));
  const search = h("input", { type: "text", class: "search", placeholder: "Search titles", oninput: e => { q = e.target.value.toLowerCase(); draw(); } });
  c.append(h("div", { class: "addrow", style: { margin: "0 0 14px", justifyContent: "space-between" } }, filt, search), list);
  const draw = () => {
    list.innerHTML = "";
    const rows = posts.filter(p => (filter === "all" || (filter === "draft" ? p.status !== "published" : p.status === "published")) && (!q || (p.title || "").toLowerCase().includes(q)));
    if (!rows.length) list.append(h("p", { class: "empty" }, "No posts here."));
    rows.forEach(p => { const [lab, cls] = postState(p); list.append(h("a", { class: "row", href: "#/blog/" + p.slug },
      h("div", { class: "row__img", style: { backgroundImage: p.cover ? `url("${imgUrl(p.cover)}")` : "" } }),
      h("div", { class: "row__main" }, h("b", {}, p.title || "Untitled"), h("span", {}, fmtDate(p.date))),
      h("div", { class: "row__side" }, h("span", { class: "chip " + cls }, lab)))); });
  };
  draw();
};
const CAT_NAMES = { hdb: "HDB & BTO", condo: "Condo", landed: "Landed", styles: "Styles", renovation: "Renovation", lighting: "Lighting" };
async function editPost(slug) {
  const c = content(); c.innerHTML = "";
  const isNew = slug === "new";
  const found = isNew ? null : await store.getPost(slug);
  if (!isNew && !found) { c.append(h("p", { class: "empty" }, "That post was not found."), h("a", { class: "btn", href: "#/blog" }, "Back to Blog")); return; }
  const all = await store.listPosts();
  const p = isNew ? { slug: "", title: "", desc: "", date: todaySG(), cover: "", body: "", status: "draft", cats: [], seo_title: "", seo_desc: "" } : clone(found);
  p.body = cleanBody(p.body); p.cats = p.cats || [];
  const oldSlug = isNew ? null : p.slug;
  let slugTouched = !isNew;
  const touch = () => setDirty(true);
  const save = async (status) => {
    p.title = (p.title || "").trim();
    if (!p.title) { toast("Give the post a title first.", "err"); return; }
    p.slug = slugify(p.slug || p.title);
    if (all.some(x => x.slug === p.slug && x.slug !== oldSlug)) { toast("Another post already uses this web address. Change the title or the web address.", "err"); return; }
    if (status) p.status = status;
    p.body = sanitize(p.body);
    p.words = p.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    if (p.status === "published" && !p.cover) { toast("Add a cover photo before publishing the post.", "err"); return; }
    try {
      await store.savePost(p, oldSlug); setDirty(false);
      toast(p.status === "published" ? ((p.date || "") > todaySG() ? `Saved. It goes live on ${fmtDate(p.date)} (after you press Publish to website).` : "Saved as live. Press Publish to website to put it online.") : "Draft saved. It is not on the website.", "ok");
      if (isNew || oldSlug !== p.slug) location.hash = "#/blog/" + p.slug; else editPost(p.slug);
    } catch (e) { toast("Save failed: " + e.message, "err"); }
  };
  bindSaveKey(() => save());
  const [lab, cls] = postState(p);
  c.append(crumb({ t: "Blog", href: "#/blog" }, { t: isNew ? "New post" : p.title }));
  c.append(phead(isNew ? "New post" : p.title, null,
    h("span", { class: "chip " + cls }, isNew ? "New" : lab),
    h("button", { type: "button", class: "btn", onclick: () => preview(p) }, "Preview"),
    isNew ? null : h("button", { type: "button", class: "btn", onclick: () => showHistory("post", p.slug, data => { Object.assign(p, clone(data)); p.body = cleanBody(p.body); setDirty(true); toast("Older version loaded. Press Save to keep it.", "ok"); editPostDraw(); }, p.title) }, "History")));
  const main = h("div"), side = h("div", { class: "editor__side" });
  c.append(h("div", { class: "editor" }, main, side));
  const editPostDraw = () => {
    main.innerHTML = ""; side.innerHTML = "";
    const titleIn = h("input", { type: "text", value: p.title, placeholder: "Title", style: { fontSize: "20px", fontWeight: 600, padding: "12px 14px" }, oninput: e => { p.title = e.target.value; touch(); if (!slugTouched) { p.slug = slugify(p.title); slugIn.value = p.slug; } } });
    const descIn = h("textarea", { class: "is-short", value: p.desc, placeholder: "Two lines that make people want to read it", oninput: e => { p.desc = e.target.value; touch(); } });
    main.append(h("section", { class: "card" }, field("Title", titleIn), field("Summary", descIn, "Shown on the article cards and to Google."), counter(descIn, 160)),
      h("section", { class: "card" }, h("h2", { style: { marginBottom: "12px" } }, "Article"), richText(p.body, v => { p.body = v; touch(); })),
      h("section", { class: "card" }, h("h2", {}, "Google"), h("p", { class: "hint" }, "Optional. Leave empty to use the title and summary."),
        (() => { const i = h("input", { type: "text", value: p.seo_title || "", placeholder: p.title, oninput: e => { p.seo_title = e.target.value; touch(); } }); return [field("Title for Google", i), counter(i, 60)]; })(),
        (() => { const i = h("textarea", { class: "is-short", value: p.seo_desc || "", placeholder: p.desc, oninput: e => { p.seo_desc = e.target.value; touch(); } }); return [field("Description for Google", i), counter(i, 160)]; })()));
    const slugIn = h("input", { type: "text", value: p.slug, oninput: e => { slugTouched = true; p.slug = slugify(e.target.value); touch(); } });
    side.append(
      h("section", { class: "card" }, h("h2", {}, "Publish"),
        h("p", { class: "hint", style: { margin: "4px 0 12px" } }, p.status === "published" ? "This post is set to live." : "This post is a draft: only you can see it here."),
        field("Date", h("input", { type: "date", value: p.date || todaySG(), onchange: e => { p.date = e.target.value; touch(); } }), "A future date waits until that day."),
        h("div", { style: { display: "grid", gap: "8px" } },
          h("button", { type: "button", class: "btn btn--primary", onclick: () => save("published") }, p.status === "published" ? "Save" : "Save and make live"),
          h("button", { type: "button", class: "btn", onclick: () => save("draft") }, p.status === "published" ? "Change back to draft" : "Save draft"))),
      h("section", { class: "card" }, h("h2", { style: { marginBottom: "10px" } }, "Cover photo"), mediaField(p.cover, v => { p.cover = v; touch(); })),
      h("section", { class: "card" }, h("h2", {}, "Categories"), h("p", { class: "hint", style: { marginBottom: "8px" } }, "For the filters on the Blog page. Leave all empty to choose automatically from the title."),
        h("div", { style: { display: "grid", gap: "6px" } }, Object.entries(CAT_NAMES).map(([k, l]) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: p.cats.includes(k), onchange: e => { p.cats = e.target.checked ? [...new Set([...p.cats, k])] : p.cats.filter(x => x !== k); touch(); } }), l)))),
      h("section", { class: "card" }, h("h2", { style: { marginBottom: "10px" } }, "Web address"), slugIn, h("p", { class: "hint", style: { marginTop: "6px" } }, isNew ? "Made from the title." : "Changing it breaks links people have already shared.")),
      isNew ? null : h("section", { class: "card" }, h("h2", {}, "Delete"), h("p", { class: "hint", style: { margin: "4px 0 12px" } }, "Removes the article at the next publish. Changing it back to draft hides it instead."),
        h("button", { type: "button", class: "btn btn--danger", onclick: async () => { if (await confirmBox(`Delete "${p.title}"?`)) { try { await store.deletePost(oldSlug); setDirty(false); toast("Deleted.", "ok"); location.hash = "#/blog"; } catch (e) { toast(e.message, "err"); } } } }, "Delete post")));
  };
  editPostDraw();
}
function preview(p) {
  const body = sanitize(p.body);
  const css = "../assets/css/style.css";
  const doc = `<!doctype html><html class="static"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="${css}"><style>[data-reveal],[data-clip]{opacity:1!important;transform:none!important;clip-path:none!important}body{padding-top:20px}</style></head><body>
    <article class="page-hero" style="padding-bottom:60px"><div class="container article">
    <span class="eyebrow">M2D Journal</span>
    <h1 class="h-xl" style="margin-top:18px;text-transform:none;letter-spacing:0;font-size:clamp(30px,4.2vw,58px)">${esc(p.title || "Untitled")}</h1>
    <div class="article__meta"><span>${esc(fmtDate(p.date))}</span><span>${Math.max(2, Math.round(body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 220))} min read</span><span>M2D Journal</span></div>
    ${p.cover ? `<div class="article__hero"><img src="${esc(imgUrl(p.cover))}" alt=""></div>` : ""}
    <div class="article__body">${body}</div></div></article></body></html>`;
  modal(box => { box.append(h("h2", {}, "Preview"), h("p", { class: "hint" }, "How the article reads on the website.")); const f = h("iframe", { class: "preview", title: "Preview" }); f.srcdoc = doc; box.append(f); }, true);
}

/* ---------- photo library ---------- */
routes.photos = async () => {
  const c = content(); c.innerHTML = "";
  c.append(phead("Photo library", "Everything you have uploaded. You can also upload straight from any photo on a page, project or post."));
  const fileIn = h("input", { type: "file", accept: "image/*,video/mp4", multiple: true, hidden: true });
  const drop = h("div", { class: "drop", onclick: () => fileIn.click() }, h("span", {}, "Drop photos here or ", h("b", {}, "click to upload")));
  const grid = h("div", { class: "mgrid" });
  const draw = async () => {
    const media = await getMedia(true);
    grid.innerHTML = "";
    if (!media.length) grid.append(h("p", { class: "hint" }, "Nothing uploaded yet."));
    media.forEach(m => grid.append(h("div", { class: "mcard", onclick: () => openMedia(m) }, isVideo(m.url) || m.kind === "video" ? h("div", { class: "vid" }, "Video") : h("img", { src: imgUrl(m.thumb_url || m.url), alt: "", loading: "lazy" }), h("p", {}, m.alt || m.path))));
  };
  const openMedia = m => modal((box, close) => {
    const alt = h("input", { type: "text", value: m.alt || "" });
    box.append(h("h2", {}, "Photo"), isVideo(m.url) ? h("video", { src: m.url, controls: true, style: { maxWidth: "100%" } }) : h("img", { src: imgUrl(m.url), alt: "", style: { maxWidth: "100%", maxHeight: "50vh", display: "block", marginBottom: "14px", borderRadius: "8px" } }),
      field("Description", alt, "A few words about the photo."),
      m.width ? h("p", { class: "hint" }, `${m.width} × ${m.height} px`) : null,
      h("div", { class: "modal__foot" },
        h("button", { type: "button", class: "btn btn--danger", onclick: async () => { if (await confirmBox("Pages still using this photo will show an empty space until you choose another one.")) { try { await store.deleteMedia(m.id); close(); draw(); } catch (e) { toast(e.message, "err"); } } } }, "Delete"),
        h("button", { type: "button", class: "btn btn--primary", onclick: async () => { await store.updateMedia(m.id, { alt: alt.value }); close(); draw(); } }, "Save")));
  });
  const up = async files => { for (const [i, f] of files.entries()) { try { toast(`Uploading ${i + 1} of ${files.length}…`); await store.upload(f); } catch (e) { toast(`${f.name}: ${e.message}`, "err"); } } toast("Done.", "ok"); draw(); };
  fileIn.onchange = () => up(Array.from(fileIn.files));
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("is-over"); }; drop.ondragleave = () => drop.classList.remove("is-over");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("is-over"); up(Array.from(e.dataTransfer.files)); };
  c.append(drop, fileIn, h("p", { class: "grouphead" }, "Uploaded"), grid);
  draw();
};

/* ---------- settings ---------- */
const SITE_FIELDS = [
  ["phone", "Phone / WhatsApp", "With the country code, e.g. +65 9822 1113. The WhatsApp button uses this number."], ["email", "Email"], ["address", "Address"],
  ["hours", "Opening hours", "Each line is a new line on the Contact page.", true], ["instagram", "Instagram link"], ["ig_handle", "Instagram name", "Without the @, e.g. m2dinterior"],
  ["facebook", "Facebook link"], ["tiktok", "TikTok link"], ["youtube", "YouTube link"], ["google_reviews", "Google reviews link", "The \"Read all on Google\" link on the Home page."],
];
routes.settings = async () => {
  const c = content(); c.innerHTML = "";
  c.append(phead("Settings", null));
  if (can("owner", "editor")) {
    const state = await store.getContent(); const site = state.site = state.site || {};
    let changed = false;
    const card = h("section", { class: "card" }, h("h2", {}, "Contact details"), h("p", { class: "hint" }, "Used everywhere on the website at once: header menu, footer, Contact page and the WhatsApp button."));
    const g = h("div", { class: "grid2" });
    SITE_FIELDS.forEach(([k, label, hint, area]) => g.append(field(label, area ? h("textarea", { class: "is-short", value: site[k] || "", oninput: e => { site[k] = e.target.value; changed = true; setDirty(true); } }) : h("input", { type: "text", value: site[k] || "", oninput: e => { site[k] = e.target.value.trim(); changed = true; setDirty(true); } }), hint)));
    const saveSite = async () => { if (!changed) { toast("Nothing to save."); return; } try { await store.saveContent({ site }); changed = false; setDirty(false); toast("Saved. Press Publish to website when you are ready.", "ok"); } catch (e) { toast("Save failed: " + e.message, "err"); } };
    bindSaveKey(saveSite);
    card.append(g, h("div", { class: "addrow" }, h("button", { type: "button", class: "btn btn--dark", onclick: saveSite }, "Save contact details"), h("button", { type: "button", class: "btn", onclick: () => showHistory("content", "site", data => { Object.assign(site, data); changed = true; setDirty(true); routes.settings(); }, "Contact details") }, "History")));
    c.append(card);
  }
  if (store.mode === "supabase") {
    const pw = h("input", { type: "password", placeholder: "At least 10 characters", autocomplete: "new-password" });
    c.append(h("section", { class: "card" }, h("h2", {}, "Your password"), h("p", { class: "hint" }, `Signed in as ${store.user?.email}.`), h("div", { class: "grid2" }, field("New password", pw)),
      h("button", { type: "button", class: "btn", onclick: async () => { if (pw.value.length < 10) { toast("Use at least 10 characters.", "err"); return; } try { await store.changePassword(pw.value); pw.value = ""; toast("Password changed.", "ok"); } catch (e) { toast(e.message, "err"); } } }, "Change password")));
    if (can("owner")) { const tc = h("section", { class: "card", id: "teamCard" }, h("h2", {}, "Team accounts"), h("p", { class: "hint" }, "Loading…")); c.append(tc); renderTeam(tc); }
  } else {
    const imp = h("input", { type: "file", accept: "application/json", hidden: true, onchange: async () => { try { const data = JSON.parse(await imp.files[0].text()); await store.importFile(data); toast("Content file loaded.", "ok"); routes.settings(); } catch (e) { toast("That file could not be read: " + e.message, "err"); } } });
    c.append(h("section", { class: "card" }, h("h2", {}, "Local draft"), h("p", { class: "hint" }, "Supabase is not connected, so everything is kept in this browser. Download the content file to hand it to your web developer, or start again from the live website's content."),
      h("div", { class: "addrow" }, h("button", { type: "button", class: "btn", onclick: exportContent }, "Download content file"), h("button", { type: "button", class: "btn", onclick: () => imp.click() }, "Load a content file"), imp,
        h("button", { type: "button", class: "btn btn--danger", onclick: async () => { if (await confirmBox("Everything changed in this browser will be lost.", "Clear", "Start again?")) { await store.reset(); setDirty(false); toast("Cleared.", "ok"); routes.settings(); } } }, "Clear local draft"))));
  }
};
const ROLE_INFO = { owner: "everything, including team accounts", editor: "pages, portfolio, blog, photos and contact details", writer: "blog and photos only" };
async function renderTeam(card) {
  let users = [];
  try { users = (await store.team("list")).users; } catch (e) { card.innerHTML = ""; card.append(h("h2", {}, "Team accounts"), h("p", { class: "hint" }, e.message)); return; }
  card.innerHTML = "";
  const roleSel = (val, onchange) => h("select", { onchange }, [["owner", "Owner"], ["editor", "Editor"], ["writer", "Writer"]].map(([v, l]) => h("option", { value: v, selected: v === val }, l)));
  card.append(h("h2", {}, "Team accounts"), h("p", { class: "hint" }, `Give each person their own sign-in. Owner: ${ROLE_INFO.owner}. Editor: ${ROLE_INFO.editor}. Writer: ${ROLE_INFO.writer}.`),
    h("table", { class: "tbl" }, h("tbody", {}, users.map(u => h("tr", {},
      h("td", {}, u.email, h("div", { class: "muted" }, [u.name, u.lastSignIn ? "last signed in " + fmtDate(u.lastSignIn.slice(0, 10)) : u.hasLogin ? "" : "no sign-in yet"].filter(Boolean).join(" · "))),
      h("td", {}, u.email === store.user?.email ? h("span", { class: "chip" }, u.role) : roleSel(u.role, async e => { try { await store.team("update", { email: u.email, role: e.target.value }); toast("Role changed.", "ok"); } catch (x) { toast(x.message, "err"); renderTeam(card); } })),
      h("td", { style: { textAlign: "right" } }, u.email === store.user?.email ? null : [
        h("button", { type: "button", class: "btn btn--small", onclick: async () => { const pw = prompt(`New password for ${u.email} (at least 10 characters)`); if (!pw) return; try { await store.team("password", { email: u.email, password: pw }); toast("Password changed.", "ok"); } catch (x) { toast(x.message, "err"); } } }, "New password"), " ",
        h("button", { type: "button", class: "iconbtn iconbtn--danger", title: "Remove", onclick: async () => { if (!await confirmBox(`${u.email} will no longer be able to sign in.`, "Remove")) return; try { await store.team("remove", { email: u.email }); toast("Removed.", "ok"); renderTeam(card); } catch (x) { toast(x.message, "err"); } } }, "×")]))))));
  const em = h("input", { type: "email", placeholder: "name@company.com" }), nm = h("input", { type: "text" }), pw = h("input", { type: "text", placeholder: "At least 10 characters", autocomplete: "new-password" }), rl = roleSel("writer");
  card.append(h("h3", { style: { margin: "18px 0 10px" } }, "Add a person"), h("div", { class: "grid2" }, field("Email", em), field("Name", nm)), h("div", { class: "grid2" }, field("Password", pw, "Share it with them privately. They can change it in Settings."), field("Role", rl)),
    h("div", { class: "addrow" }, h("button", { type: "button", class: "btn btn--primary", onclick: async () => { try { const r = await store.team("create", { email: em.value, name: nm.value, password: pw.value, role: rl.value }); toast(r.message || "Account created.", "ok"); renderTeam(card); } catch (x) { toast(x.message, "err"); } } }, "Create account"),
      h("button", { type: "button", class: "btn btn--small", onclick: () => { const a = new Uint32Array(3); crypto.getRandomValues(a); pw.value = Array.from(a, n => n.toString(36)).join("-"); } }, "Suggest a password")));
}

/* ---------- publish / export ---------- */
async function exportContent() {
  const data = await store.exportFile();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: "m2d-cms-content.json" }); document.body.append(a); a.click(); a.remove();
}
async function publishNow() {
  if (dirty) { toast("Save your changes first, then publish.", "err"); return; }
  if (store.mode === "local") {
    modal((box, close) => box.append(h("h2", {}, "Publishing needs Supabase"),
      h("p", {}, "This admin is in local draft mode, so your changes are only in this browser. Once Supabase is connected, this button updates the website in about two minutes."),
      h("p", { class: "hint" }, "Your web developer can already build the website from your changes: download the content file and run build/pull_cms.py --file with it."),
      h("div", { class: "modal__foot" }, h("button", { type: "button", class: "btn", onclick: close }, "Close"), h("button", { type: "button", class: "btn btn--primary", onclick: () => { exportContent(); close(); } }, "Download content file"))));
    return;
  }
  const b = $("#publishBtn"); b.disabled = true;
  try { const r = await store.publish(); toast(r.message || "Publishing. The website updates in about two minutes.", "ok"); if ((location.hash || "#/") === "#/") route(); }
  catch (e) { toast(e.message, "err"); }
  finally { setTimeout(() => b.disabled = false, 4000); }
}

/* ---------- router ---------- */
let current = location.hash;
async function route() {
  const hash = location.hash || "#/";
  const [, name = "", arg] = hash.match(/^#\/?([^/]*)\/?(.*)$/) || [];
  const view = { "": "dash", pages: "pages", portfolio: "portfolio", blog: "blog", photos: "photos", settings: "settings" }[name] || "dash";
  const allowed = $(`#sideNav a[data-route="${view}"]`);
  if (allowed && allowed.dataset.role && !allowed.dataset.role.split(" ").includes(store.role)) { location.hash = "#/blog"; return; }
  $$("#sideNav a").forEach(a => a.classList.toggle("is-on", a.dataset.route === view));
  $("#app").classList.remove("is-menu");
  saveKeyHandler = null; setDirty(false);
  window.scrollTo(0, 0);
  try { await routes[view](arg ? decodeURIComponent(arg) : undefined); }
  catch (e) { console.error(e); content().innerHTML = ""; content().append(h("div", { class: "card" }, h("h2", {}, "Something went wrong"), h("p", { class: "hint" }, e.message || String(e)))); }
}
window.addEventListener("hashchange", () => {
  if (dirty && !confirm("You have unsaved changes. Leave without saving?")) { history.replaceState(null, "", current); return; }
  current = location.hash; route();
});

/* ---------- boot ---------- */
async function showApp() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#localBanner").hidden = store.mode !== "local";
  $("#modeBadge").textContent = store.mode === "local" ? "Local draft" : (store.role || "");
  $("#sideUser").textContent = store.mode === "local" ? "Not signed in (local draft)" : store.user?.email || "";
  $("#signOut").hidden = store.mode === "local";
  if (CFG.siteUrl) $("#siteLink").href = CFG.siteUrl;
  $$("#sideNav a[data-role]").forEach(a => a.hidden = !a.dataset.role.split(" ").includes(store.role));
  route();
}
async function boot() {
  await loadSeed();
  $("#publishBtn").onclick = publishNow;
  $("#menuBtn").onclick = () => $("#app").classList.toggle("is-menu");
  if (!LIVE) { store = LocalStore; await store.load(); return showApp(); }
  store = SupaStore; store.init();
  $("#signOut").onclick = async () => { await store.signOut(); location.reload(); };
  const enter = async () => {
    const role = await store.loadRole();
    if (!role) { await store.signOut(); showLogin(`${store.user?.email || "This account"} is not on the M2D team list. Ask the owner to add you.`); return; }
    if (can("owner", "editor")) {
      const meta = await store.meta().catch(() => null);
      if (!meta?.imported_at) { toast("First sign-in: copying the website's current content into the CMS…"); try { await store.importSeed(); toast("The website's content is now in the CMS.", "ok"); } catch (e) { toast("Could not copy the website's content: " + e.message, "err"); } }
    }
    showApp();
  };
  const session = await store.session();
  if (session) return enter();
  showLogin();
  $("#loginForm").onsubmit = async e => {
    e.preventDefault(); const f = e.target; $("#loginErr").hidden = true;
    try { await store.signIn(f.email.value.trim(), f.password.value); await enter(); }
    catch (x) { showLogin(x.message === "Invalid login credentials" ? "That email and password do not match." : x.message); }
  };
  $("#magicBtn").onclick = async () => {
    const email = $("#loginForm").email.value.trim(); if (!email) { showLogin("Type your email first."); return; }
    try { await store.magic(email); showLogin("Check your email for a sign-in link.", true); } catch (x) { showLogin(x.message); }
  };
  store.client.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" && $("#app").hidden) enter(); });
}
function showLogin(msg, ok) {
  $("#app").hidden = true; $("#login").hidden = false;
  const er = $("#loginErr"); er.hidden = !msg; er.textContent = msg || ""; er.style.color = ok ? "var(--ok)" : "";
}
boot();
})();
