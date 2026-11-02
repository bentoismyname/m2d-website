/* M2D client portal
   Staff page (/id) and homeowner page (/my) share this file. The model, screens and wording come from Benjamin's
   Renovation Progress Tracker; only the storage and login layers changed: Supabase (shared with the website CMS)
   instead of Netlify Identity + Blobs. Without Supabase keys in admin/config.js it runs as a demo in this browser. */
(() => {
"use strict";
const MODE = window.M2D_PORTAL_MODE === "client" ? "client" : "staff";
const CFG = window.M2D_CMS || {};

// ---------- shared model (unchanged from the tracker) ----------
const PHASES = [
  ["prelim", "Preliminaries", [["design", "Design & quotation"], ["permits", "Permits & approvals"]]],
  ["foundation", "Foundation stage", [["hacking", "Hacking & demolition"], ["me", "M&E works", ["Aircon", "Electricals", "Plumbing"]],
    ["plaster", "Plastering of walls"], ["ceiling", "False ceiling & partition works"], ["wet", "Masonry, waterproofing & tiling"], ["paint", "Painting works"]]],
  ["fittings", "Fittings", [["windows", "Windows", ["Measurement", "Installation"]], ["maindoor", "Main door & gate", ["Measurement", "Installation"]],
    ["doors", "Doors", ["Measurement", "Installation"]], ["carpentry", "Carpentry works", ["Measurement", "Installation"]], ["stone", "Stone works", ["Measurement", "Installation"]],
    ["glass", "Glass works", ["Measurement", "Installation"]], ["fittings", "Lights, sanitary & appliances"]]],
  ["finishing", "Finishing", [["clean", "Final cleaning"], ["handover", "Handover"]]]
];
const PHASE_OF = Object.fromEntries(PHASES.flatMap(([ph, , list]) => list.map(([k]) => [k, ph])));
const STATUS = { todo: "Not started", doing: "In progress", done: "Done", delayed: "Delayed" };
const STAGE_FIELDS = ["status", "tStart", "tEnd", "aStart", "aEnd", "notes", "name"];
// the checklist every new project starts with; staff add, rename or remove items per project
const DEFAULT_CHECKLIST = ["Floor plan received", "Design brief signed", "Quotation accepted and deposit paid", "HDB / MCST renovation permit", "Materials and colours selected",
  "Carpentry drawings approved", "Appliance list received", "Site handover to M2D", "Defects list cleared", "Final handover and keys returned"];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const newStage = (id, name, phase, parts) => ({ id, name, phase: phase || "fittings", status: "todo", tStart: "", tEnd: "", aStart: "", aEnd: "", notes: "", photos: [],
  parts: parts ? parts.map(n => ({ id: slug(n), name: n, done: false, skip: false })) : [], skip: false, custom: false });
const normalize = p => { if (p && p.stages) p.stages.forEach(s => { if (!s.phase) s.phase = PHASE_OF[s.id] || "fittings"; if (!s.parts) s.parts = []; if (!s.photos) s.photos = []; s.skip = !!s.skip; }); if (p && !Array.isArray(p.checklist)) p.checklist = []; return p; };
function newProject(f) {
  const now = new Date().toISOString();
  return { id: uid(), name: f.name, address: f.address || "", clientName: f.clientName || "", clientEmail: (f.clientEmail || "").toLowerCase().trim(),
    designerName: f.designerName || "", designerEmail: (f.designerEmail || "").toLowerCase().trim(), designerId: f.designerId || null, staffIds: f.staffIds || [], createdAt: now, updatedAt: now,
    stages: PHASES.flatMap(([ph, , list]) => list.map(([k, n, parts]) => { const st = newStage(k, n, ph, parts); st.skip = (f.skip || []).includes(k); return st; })),
    checklist: DEFAULT_CHECKLIST.map(t => ({ id: uid() + Math.random().toString(36).slice(2, 4), text: t, done: false, at: "", by: "" })) };
}
function applyStagePatch(p, stageId, patch) {
  const s = p.stages.find(x => x.id === stageId); if (!s) return p;
  for (const k of STAGE_FIELDS) if (k in patch) s[k] = String(patch[k] ?? "").slice(0, k === "notes" ? 4000 : 200);
  let st = patch.status;
  if ("skip" in patch) s.skip = !!patch.skip;
  if (patch.part && s.parts) {
    const pt = s.parts.find(x => x.id === patch.part.id);
    if (pt) { if ("done" in patch.part) pt.done = !!patch.part.done; if ("skip" in patch.part) { pt.skip = !!patch.part.skip; if (pt.skip) pt.done = false; }
      const use = s.parts.filter(x => !x.skip), n = use.filter(x => x.done).length;
      if (use.length && n === use.length) st = s.status = "done"; else if (n && (s.status === "todo" || s.status === "done")) st = s.status = "doing"; else if (!n && s.status === "done") st = s.status = "doing";
      if (st === "doing") s.aEnd = ""; }
  }
  if (st === "doing" && !s.aStart) s.aStart = today();
  if (st === "done") { if (!s.aStart) s.aStart = today(); if (!s.aEnd) s.aEnd = today(); }
  s.updatedAt = p.updatedAt = new Date().toISOString();
  return p;
}
function applyChecklist(p, action, me) {
  const now = new Date().toISOString();
  if (action.add) p.checklist.push({ id: uid(), text: String(action.add).slice(0, 200), done: false, at: "", by: "" });
  const it = action.id && p.checklist.find(x => x.id === action.id);
  if (it) {
    if ("done" in action) { it.done = !!action.done; it.at = it.done ? now : ""; it.by = it.done ? (me && me.name) || "" : ""; }
    if ("text" in action) it.text = String(action.text).slice(0, 200);
    if (action.remove) p.checklist = p.checklist.filter(x => x.id !== action.id);
  }
  p.updatedAt = now; return p;
}
const isStaff = u => u && u.role !== "client";
const canView = (p, u) => u.role === "admin" || (p.designerId && p.designerId === u.id) || (p.staffIds || []).includes(u.id) || p.designerEmail === u.email || p.clientEmail === u.email;
const canEdit = (p, u) => u.role === "admin" || (isStaff(u) && ((p.designerId && p.designerId === u.id) || (p.staffIds || []).includes(u.id) || p.designerEmail === u.email));
const canCreate = u => u.role === "admin" || u.role === "designer";

// ---------- demo backend (this browser only) ----------
const DEMO_KEY = "m2d-portal-demo-v1";
const DEMO_USERS = {
  admin: { id: "u-admin", email: "ben@m2decor.com", name: "Benjamin", role: "admin" },
  designer: { id: "u-alicia", email: "alicia@m2decor.com", name: "Alicia", role: "designer" },
  supervisor: { id: "u-suhel", email: "suhel@m2decor.com", name: "Suhel", role: "supervisor" },
  client: { id: "u-tan", email: "tan.family@example.com", name: "Mr & Mrs Tan", role: "client" }
};
function seed() {
  const p = newProject({ name: "Tampines BTO · Blk 618C", address: "#12-345, Tampines North Drive", clientName: "Mr & Mrs Tan", clientEmail: DEMO_USERS.client.email, designerName: "Alicia", designerEmail: DEMO_USERS.designer.email, designerId: DEMO_USERS.designer.id, staffIds: [DEMO_USERS.supervisor.id] });
  const plan = { design: ["2026-09-01","2026-09-20","2026-09-01","2026-09-18","done","Final 3D and quotation signed. Thank you!"], permits: ["2026-09-21","2026-10-02","2026-09-21","2026-09-30","done","HDB renovation permit approved."],
    hacking: ["2026-10-05","2026-10-09","2026-10-05","2026-10-09","done","Kitchen wall hacked as planned. Debris cleared."],
    me: ["2026-10-12","2026-10-30","2026-10-12","","doing","Power points and kitchen piping done. Aircon piping goes in next week before the ceiling closes."],
    plaster: ["2026-11-02","2026-11-04"], ceiling: ["2026-11-05","2026-11-09"], wet: ["2026-11-09","2026-11-20"], paint: ["2026-11-23","2026-11-27"],
    carpentry: ["2026-10-26","2026-12-04","2026-10-28","","doing","Site measurement done. Kitchen and wardrobe carcasses being made at our Woodlands workshop; installation from 30 Nov."],
    maindoor: ["2026-11-02","2026-12-10","2026-11-02","","doing","Main door and gate measured on site. Installation after painting."], doors: ["2026-11-02","2026-12-10"],
    stone: ["2026-12-01","2026-12-08"], glass: ["2026-12-07","2026-12-10"], fittings: ["2026-12-09","2026-12-15"], clean: ["2026-12-17","2026-12-18"], handover: ["2026-12-21","2026-12-21"] };
  p.stages.forEach(s => { const v = plan[s.id]; if (v) { [s.tStart, s.tEnd, s.aStart = "", s.aEnd = "", s.status = "todo", s.notes = ""] = v; } });
  p.stages.find(s => s.id === "me").parts.forEach(pt => { pt.done = pt.id !== "aircon"; });
  p.stages.find(s => s.id === "windows").skip = true;
  p.stages.find(s => s.id === "carpentry").parts[0].done = true;
  p.stages.find(s => s.id === "maindoor").parts[0].done = true;
  p.checklist.slice(0, 5).forEach(c => { c.done = true; c.at = "2026-10-01T09:00:00.000Z"; c.by = "Alicia"; });
  const q = newProject({ name: "Bishan condo · Sky Habitat", address: "#20-08, Bishan Street 15", clientName: "Ms Lim", clientEmail: "lim@example.com", designerName: "Alicia", designerEmail: DEMO_USERS.designer.email, designerId: DEMO_USERS.designer.id });
  q.stages[0].status = "doing"; q.stages[0].tStart = "2026-10-20"; q.stages[0].tEnd = "2026-11-14"; q.stages[0].aStart = "2026-10-21";
  return { projects: { [p.id]: p, [q.id]: q }, photos: {} };
}
function demoDB() { try { const d = JSON.parse(localStorage.getItem(DEMO_KEY) || "null"); if (d && d.projects) return d; } catch (e) {} const s = seed(); demoSave(s); return s; }
function demoSave(db) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); return true; } catch (e) { toast("Demo storage is full, remove a photo"); return false; } }
let memDB = null;
const demoGet = () => { try { localStorage.getItem("x"); return demoDB(); } catch (e) { return memDB || (memDB = seed()); } };
const demoPut = db => { memDB = db; demoSave(db); };
let demoRole = MODE === "client" ? "client" : "designer";
if (MODE !== "client") { try { demoRole = localStorage.getItem(DEMO_KEY + "-role") || "designer"; } catch (e) {} }
const DemoAPI = {
  me: async () => DEMO_USERS[demoRole],
  list: async () => { const u = DEMO_USERS[demoRole]; return Object.values(demoGet().projects).map(normalize).filter(p => canView(p, u)); },
  get: async id => { const p = normalize(demoGet().projects[id]); if (!p || !canView(p, DEMO_USERS[demoRole])) throw new Error("Not found"); return p; },
  create: async f => { const db = demoGet(); const u = DEMO_USERS[demoRole]; const p = newProject({ ...f, designerName: f.designerName || u.name, designerEmail: f.designerEmail || u.email, designerId: f.designerId || u.id }); db.projects[p.id] = p; demoPut(db); return p; },
  save: async p => { const db = demoGet(); db.projects[p.id] = p; demoPut(db); return p; },
  addPhoto: async (id, stageId, dataUrl) => { const db = demoGet(); const p = db.projects[id]; const s = p.stages.find(x => x.id === stageId); const pid = uid(); db.photos[pid] = dataUrl; s.photos.push({ id: pid, at: new Date().toISOString() }); p.updatedAt = new Date().toISOString(); if (!demoSave(db)) { delete db.photos[pid]; s.photos.pop(); } memDB = db; return p; },
  removePhoto: async (id, stageId, photoId) => { const db = demoGet(); const p = db.projects[id]; const s = p.stages.find(x => x.id === stageId); s.photos = s.photos.filter(x => x.id !== photoId); delete db.photos[photoId]; p.updatedAt = new Date().toISOString(); demoPut(db); return p; },
  photoUrl: async (id, photoId) => demoGet().photos[photoId] || "",
  staff: async () => Object.values(DEMO_USERS).filter(u => u.role !== "client"),
  subscribe: () => () => {},
  signOut: async () => {}
};

// ---------- live backend (Supabase, shared with the website CMS) ----------
const photoCache = {};
const rowToProject = r => normalize({ id: r.id, name: r.name, address: r.address || "", clientName: r.client_name || "", clientEmail: r.client_email || "", designerId: r.designer_id, designerName: r.designer_name || "",
  designerEmail: r.designer_email || "", staffIds: r.staff_ids || [], stages: r.stages || [], checklist: r.checklist || [], status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });
const projectToRow = p => ({ name: p.name, address: p.address, client_name: p.clientName, client_email: p.clientEmail, designer_id: p.designerId, designer_name: p.designerName, designer_email: p.designerEmail, staff_ids: p.staffIds || [], stages: p.stages, checklist: p.checklist });
const SupaAPI = {
  client: null,
  init() { this.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey); },
  async me() {
    const { data: { session } } = await this.client.auth.getSession(); if (!session) return null;
    const u = session.user, email = (u.email || "").toLowerCase();
    const { data: row } = await this.client.from("portal_users").select("name,role").eq("user_id", u.id).maybeSingle();
    let role = row && row.role, name = (row && row.name) || (u.user_metadata && u.user_metadata.name) || email;
    if (!role) { const { data: c } = await this.client.from("cms_users").select("role,name").ilike("email", email).maybeSingle(); if (c && c.role === "owner") { role = "admin"; name = c.name || name; } }
    return { id: u.id, email, name, role: role || "client" };
  },
  async list() { const { data, error } = await this.client.from("projects").select("*").order("updated_at", { ascending: false }); if (error) throw new Error(error.message); return data.map(rowToProject); },
  async get(id) { const { data, error } = await this.client.from("projects").select("*").eq("id", id).maybeSingle(); if (error) throw new Error(error.message); if (!data) throw new Error("Project not found"); return rowToProject(data); },
  async create(f) {
    const p = newProject(f); const row = projectToRow(p);
    const { data, error } = await this.client.from("projects").insert(row).select("*").single(); if (error) throw new Error(error.message);
    return rowToProject(data);
  },
  async save(p) {
    const { data, error } = await this.client.from("projects").update({ stages: p.stages, checklist: p.checklist, name: p.name, address: p.address, client_name: p.clientName, client_email: p.clientEmail, staff_ids: p.staffIds || [], designer_id: p.designerId, designer_name: p.designerName, designer_email: p.designerEmail }).eq("id", p.id).select("*").single();
    if (error) throw new Error(error.message); return rowToProject(data);
  },
  async addPhoto(id, stageId, dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${id}/${stageId}/${uid()}.jpg`;
    const up = await this.client.storage.from("project-photos").upload(path, blob, { contentType: "image/jpeg" }); if (up.error) throw new Error(up.error.message);
    await this.client.from("project_photos").insert({ project_id: id, stage_id: stageId, path });
    const p = await this.get(id); const s = p.stages.find(x => x.id === stageId); s.photos.push({ id: path, at: new Date().toISOString() }); p.updatedAt = new Date().toISOString();
    return this.save(p);
  },
  async removePhoto(id, stageId, photoId) {
    await this.client.storage.from("project-photos").remove([photoId]);
    await this.client.from("project_photos").delete().eq("path", photoId);
    const p = await this.get(id); const s = p.stages.find(x => x.id === stageId); s.photos = s.photos.filter(x => x.id !== photoId); delete photoCache[photoId];
    return this.save(p);
  },
  async photoUrl(id, photoId) {
    if (photoCache[photoId]) return photoCache[photoId];
    const { data, error } = await this.client.storage.from("project-photos").createSignedUrl(photoId, 3600); if (error) return "";
    return (photoCache[photoId] = data.signedUrl);
  },
  async staff() { const { data } = await this.client.from("portal_users").select("user_id,email,name,role").neq("role", "client").order("name"); return (data || []).map(u => ({ id: u.user_id, email: u.email, name: u.name || u.email, role: u.role })); },
  subscribe(id, cb) {
    const ch = this.client.channel("project-" + id).on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: "id=eq." + id }, payload => cb(rowToProject(payload.new))).subscribe();
    return () => this.client.removeChannel(ch);
  },
  signInStaff(email, password) { return this.client.auth.signInWithPassword({ email, password }); },
  sendCode(email) { return this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); },
  verifyCode(email, token) { return this.client.auth.verifyOtp({ email, token, type: "email" }); },
  signOut() { return this.client.auth.signOut(); },
  async admin(action, body) {
    const { data: { session } } = await this.client.auth.getSession();
    const r = await fetch("/api/portal/users", { method: "POST", headers: { Authorization: "Bearer " + (session && session.access_token), "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(body || {}) }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something went wrong"); return j;
  }
};

// ---------- UI ----------
let API = DemoAPI, LIVE = false, me = null, unsub = null;
let view = { name: "home", id: null }, current = null, open = new Set(), showNew = false, autoOpened = null, addingStage = false, tab = "stages", staffList = [];
const $ = s => document.querySelector(s);
const app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" }) : "";
const range = (a, b) => a && a === b ? fmt(a) : a || b ? (fmt(a) || "?") + " – " + (fmt(b) || "?") : "";
function ago(iso) { if (!iso) return ""; const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago"; if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short" }); }
const use = p => p.stages.filter(s => !s.skip);
const progress = p => { const n = use(p).length, d = use(p).filter(s => s.status === "done").length; return { d, n, pct: n ? Math.round(d / n * 100) : 0 }; };
const phaseName = id => (PHASES.find(x => x[0] === id) || [, "Other"])[1];
const nowPhase = p => { const act = use(p).filter(x => x.status === "doing" || x.status === "delayed");
  const ids = act.length ? [...new Set(act.map(x => x.phase))] : [(use(p).find(x => x.status !== "done") || {}).phase].filter(Boolean);
  return ids.length ? ids.map(phaseName).join(" + ") : "Completed"; };
const nowStage = p => use(p).filter(s => s.status === "doing" || s.status === "delayed").map(s => s.name).join(" · ") || (use(p).find(s => s.status === "todo") || {}).name || "Completed";
const handoverDate = p => { const h = use(p).find(s => s.id === "handover"); return h && (h.aEnd || h.tEnd); };
const editable = () => current && me && canEdit(current, me);
const roleLabel = r => ({ admin: "Admin", designer: "Designer", supervisor: "Supervisor", client: "Homeowner" }[r] || r);
let toastT;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2300); }

function renderWho() {
  $("#who").innerHTML = me ? `<span class="role">${roleLabel(me.role)}</span><span>${esc(me.name)}</span>${me.role === "admin" && MODE === "staff" ? '<button class="link" id="teamBtn" type="button">Team</button>' : ""}${LIVE ? '<button class="link" id="logout" type="button">Log out</button>' : ""}` : "";
}

// ---------- login screens ----------
let loginState = { email: "", sent: false, err: "", busy: false };
function renderLogin() {
  const L = loginState;
  if (MODE === "client") {
    app.innerHTML = `<div class="card login"><h1>Your renovation, live.</h1>
      <p>${L.sent ? `We emailed a 6-digit code to <b>${esc(L.email)}</b>. Enter it below.` : "Enter the email you gave your M2D designer and we'll send you a login code."}</p>
      <form id="loginForm">${L.sent
        ? `<label class="fld code">Login code<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required autofocus></label>`
        : `<label class="fld">Email<input name="email" type="email" autocomplete="email" required value="${esc(L.email)}" autofocus></label>`}
        ${L.err ? `<div class="err">${esc(L.err)}</div>` : ""}
        <div class="row-end">${L.sent ? `<button class="link" type="button" id="resend">Use a different email</button>` : `<span class="hint">No password needed.</span>`}
        <button class="btn primary" type="submit" ${L.busy ? "disabled" : ""}><span class="dot"></span>${L.sent ? "Log in" : "Send code"}</button></div></form></div>`;
  } else {
    app.innerHTML = `<div class="card login"><h1>M2D staff login</h1><p>Designers and site staff sign in here. Homeowners use <a href="../my/">m2decor.com/my</a>.</p>
      <form id="loginForm"><label class="fld">Email<input name="email" type="email" autocomplete="username" required value="${esc(L.email)}"></label>
        <label class="fld">Password<input name="password" type="password" autocomplete="current-password" required></label>
        ${L.err ? `<div class="err">${esc(L.err)}</div>` : ""}
        <div class="row-end"><span class="hint">Forgot it? Ask Benjamin to reset it.</span><button class="btn primary" type="submit" ${L.busy ? "disabled" : ""}><span class="dot"></span>Log in</button></div></form></div>`;
  }
}

// ---------- home ----------
async function renderHome() {
  const list = await API.list();
  if (me.role === "client" && list.length === 1) { view = { name: "project", id: list[0].id }; return renderProject(); }
  const staff = isStaff(me);
  if (staff && me.role === "admin" && !staffList.length) { try { staffList = await API.staff(); } catch (e) {} }
  app.innerHTML = `<h1>${staff ? "Your projects" : "Your renovation"}</h1>
    <p class="sub">${staff ? "Update a stage here and your homeowner sees it straight away." : "Pick a project to see its progress."}</p>
    <div style="height:18px"></div>
    ${staff ? `<div class="toolbar"><h2>${list.length} project${list.length === 1 ? "" : "s"}</h2>${canCreate(me) ? `<button class="btn primary" type="button" id="newBtn"><span class="dot"></span>New project</button>` : ""}</div>` : ""}
    ${staff && showNew ? `<form class="card form" id="newForm"><h3>New project</h3><div class="form-grid">
      <label class="fld">Project name<input name="name" required placeholder="e.g. Punggol BTO · Blk 301"></label>
      <label class="fld">Address<input name="address" placeholder="Unit and street"></label>
      <label class="fld">Homeowner name<input name="clientName" required placeholder="e.g. Mr & Mrs Lee"></label>
      <label class="fld">Homeowner email<input name="clientEmail" type="email" required placeholder="They log in with this email"></label>
      ${me.role === "admin" ? `<label class="fld">Designer<select name="designer"><option value="">Myself</option>${staffList.filter(u => u.role !== "supervisor" && u.id !== me.id).map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("")}</select></label>` : ""}
      </div>
      <div class="pick"><div class="fld" style="margin-bottom:6px">Stages that apply <span class="hint" style="text-transform:none;letter-spacing:0">· untick what this project doesn't need</span></div>
      ${PHASES.map(([id, name, list]) => `<div class="pick-row"><span class="pick-ph">${esc(name)}</span><div class="parts">${list.map(([k, n]) => `<label class="part ok"><input type="checkbox" name="use" value="${k}" checked><span>${esc(n)}</span></label>`).join("")}</div></div>`).join("")}</div>
      <div class="row-end"><span class="hint">${LIVE ? "The homeowner logs in at m2decor.com/my with a code sent to their email." : "Demo: nothing is saved to a server."}</span><span style="display:flex;gap:8px"><button class="btn" type="button" id="cancelNew">Cancel</button><button class="btn primary" type="submit">Create</button></span></div></form>` : ""}
    <div class="plist">${list.length ? list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(p => { const g = progress(p); return `<button class="card pcard" type="button" data-open-project="${esc(p.id)}">
      <strong>${esc(p.name)}</strong><span class="meta">${esc(staff ? p.clientName : p.designerName ? "Designer: " + p.designerName : "")} · updated ${ago(p.updatedAt)}</span>
      <div class="bar"><i style="width:${g.pct}%"></i></div><span class="now">${esc(nowPhase(p))} · ${esc(nowStage(p))}</span></button>`; }).join("")
      : `<p class="empty">${staff ? (canCreate(me) ? "No projects yet. Create your first one." : "No projects are assigned to you yet.") : "No project is linked to this email yet. Please check with your M2D designer."}</p>`}</div>`;
}

// ---------- team (admin) ----------
let teamState = { adding: false, err: "" };
async function renderTeam() {
  if (!LIVE) { app.innerHTML = `<div class="back"><button class="link" type="button" id="backBtn">← All projects</button></div><h1>Team</h1><p class="sub">Staff accounts are created here once the portal is connected to Supabase. In the demo, switch roles with the bar at the top.</p>`; return; }
  let users = []; try { users = (await API.admin("list")).users; } catch (e) { teamState.err = e.message; }
  app.innerHTML = `<div class="back"><button class="link" type="button" id="backBtn">← All projects</button></div><h1>Team</h1>
    <p class="sub">Each designer and supervisor gets their own login for m2decor.com/id.</p><div style="height:18px"></div>
    <div class="toolbar"><h2>${users.length} account${users.length === 1 ? "" : "s"}</h2><button class="btn primary" type="button" id="addStaff"><span class="dot"></span>Add account</button></div>
    ${teamState.adding ? `<form class="card form" id="staffForm"><div class="form-grid">
      <label class="fld">Name<input name="name" required></label><label class="fld">Email<input name="email" type="email" required></label>
      <label class="fld">Role<select name="role"><option value="designer">Designer</option><option value="supervisor">Supervisor (site)</option><option value="admin">Admin</option></select></label>
      <label class="fld">Password<input name="password" type="text" minlength="10" required placeholder="At least 10 characters"></label></div>
      ${teamState.err ? `<div class="hint warn">${esc(teamState.err)}</div>` : ""}
      <div class="row-end"><span class="hint">Tell them the password; they can't reset it themselves yet.</span><span style="display:flex;gap:8px"><button class="btn" type="button" id="cancelStaff">Cancel</button><button class="btn primary" type="submit">Create</button></span></div></form>` : ""}
    <div class="team">${users.map(u => `<div class="card trow"><div><strong>${esc(u.name || u.email)}</strong><span>${esc(u.email)} · ${roleLabel(u.role)}</span></div>
      <div class="acts"><button class="link" type="button" data-pw="${esc(u.user_id)}">New password</button>${u.user_id !== me.id ? `<button class="rm" type="button" data-rmuser="${esc(u.user_id)}">Remove</button>` : ""}</div></div>`).join("") || `<p class="empty">No staff accounts yet.</p>`}</div>`;
}

// ---------- project ----------
function stageHTML(s, i, edit) {
  const isOpen = open.has(s.id);
  const parts = s.parts.filter(x => !x.skip), pd = parts.filter(x => x.done).length;
  if (s.skip) return `<li class="stage na${isOpen ? " open" : ""}" data-stage-row="${s.id}">
    <button class="st-head" type="button" data-toggle="${s.id}" aria-expanded="${isOpen}"><span class="num">–</span>
      <span class="st-name"><strong>${esc(s.name)}</strong><small id="sub_${s.id}">Hidden from homeowner</small></span><span class="chip">Not applicable</span></button>
    ${isOpen ? `<div class="st-body"><label class="na-t"><input type="checkbox" data-skip="${s.id}" checked> Not applicable to this project</label><span class="hint">Untick to bring this stage back.</span></div>` : ""}</li>`;
  const extra = [parts.length && s.status !== "done" ? pd + "/" + parts.length + " done" : "", s.notes ? "note" : "", s.photos.length ? s.photos.length + " photo" + (s.photos.length > 1 ? "s" : "") : ""].filter(Boolean).join(" · ");
  const datesLine = s.status === "done" ? (s.aEnd ? "Completed " + fmt(s.aEnd) : "Completed") : range(s.tStart, s.tEnd) ? "Target " + range(s.tStart, s.tEnd) : "Dates to be confirmed";
  const behind = edit && s.status !== "done" && s.tEnd && s.tEnd < today();
  let body = "";
  if (isOpen && edit) {
    body = `<div class="st-body">
${s.parts.length ? `<div class="parts">${s.parts.map(pt => pt.skip ? `<span class="part na">${esc(pt.name)}</span>` : `<label class="part${pt.done ? " ok" : ""}"><input type="checkbox" data-part="${esc(pt.id)}" data-stage="${s.id}" ${pt.done ? "checked" : ""}><span>${esc(pt.name)}</span></label>`).join("")}</div>
      <div class="hint">Not needed here? ${s.parts.map(pt => `<button type="button" class="link sm" data-partskip="${esc(pt.id)}" data-stage="${s.id}" aria-pressed="${!!pt.skip}">${pt.skip ? "Bring back " : "Skip "}${esc(pt.name)}</button>`).join(" · ")}</div>` : ""}
      <div class="seg" role="group" aria-label="Status">${Object.entries(STATUS).map(([k, l]) => `<button type="button" data-status="${s.id}" data-val="${k}" aria-pressed="${s.status === k}">${l}</button>`).join("")}</div>
      ${behind ? `<div class="hint warn">Target end has passed. Mark as Delayed if it's running late, so the homeowner isn't surprised.</div>` : ""}
      <div class="dates">
        <label class="fld">Target start<input type="date" data-sf="tStart" data-stage="${s.id}" value="${esc(s.tStart)}"></label>
        <label class="fld">Target end<input type="date" data-sf="tEnd" data-stage="${s.id}" value="${esc(s.tEnd)}"></label>
        <label class="fld">Actual start<input type="date" data-sf="aStart" data-stage="${s.id}" value="${esc(s.aStart)}"></label>
        <label class="fld">Actual end<input type="date" data-sf="aEnd" data-stage="${s.id}" value="${esc(s.aEnd)}"></label>
      </div>
      <label class="fld">Update for homeowner<textarea data-sf="notes" data-stage="${s.id}" placeholder="What happened, what's next, anything they need to do">${esc(s.notes)}</textarea></label>
      <div class="photos" data-photos="${s.id}">${s.photos.map(ph => `<div class="ph" data-ph="${esc(ph.id)}"><img alt="Site photo" data-src="${esc(ph.id)}"><span class="x" role="button" tabindex="0" data-rmph="${esc(ph.id)}" data-stage="${s.id}" aria-label="Remove photo">×</span></div>`).join("")}
        <label class="addph">+ Add site photos<input type="file" accept="image/*" multiple data-upload="${s.id}"></label></div>
      <div class="row-end"><span class="hint">Saves automatically · ${s.updatedAt ? "last change " + ago(s.updatedAt) : "no changes yet"}</span><span style="display:flex;gap:14px;align-items:center"><label class="na-t sm"><input type="checkbox" data-skip="${s.id}"> Not applicable</label>${s.custom ? `<button class="rm" type="button" data-rmstage="${s.id}">Remove stage</button>` : ""}</span></div>
    </div>`;
  } else if (isOpen) {
    body = `<div class="st-body">
${parts.length ? `<div class="parts">${parts.map(pt => `<span class="part${pt.done ? " ok" : ""}"><i>${pt.done ? "✓" : ""}</i>${esc(pt.name)}</span>`).join("")}</div>` : ""}
      <div class="view-dates"><div class="fact"><div class="l">Target</div><div class="v">${esc(range(s.tStart, s.tEnd) || "To be confirmed")}</div></div>
      <div class="fact"><div class="l">Actual</div><div class="v">${esc(s.aStart ? range(s.aStart, s.aEnd).replace("?", "ongoing") : "Not started")}</div></div></div>
      ${s.notes ? `<div class="notes"><span class="t">Update from your designer${s.updatedAt ? " · " + ago(s.updatedAt) : ""}</span>${esc(s.notes)}</div>` : `<p class="empty" style="margin:0">No updates for this stage yet.</p>`}
      ${s.photos.length ? `<div class="photos">${s.photos.map(ph => `<button type="button" class="ph" data-ph="${esc(ph.id)}"><img alt="Site photo" data-src="${esc(ph.id)}"></button>`).join("")}</div>` : ""}
    </div>`;
  }
  return `<li class="stage ${s.status}${isOpen ? " open" : ""}" data-stage-row="${s.id}">
    <button class="st-head" type="button" data-toggle="${s.id}" aria-expanded="${isOpen}">
      <span class="num">${s.status === "done" ? "✓" : i + 1}</span>
      <span class="st-name"><strong>${esc(s.name)}</strong><small id="sub_${s.id}">${esc(datesLine)}${extra ? ` · <span class="has">${esc(extra)}</span>` : ""}</small></span>
      <span class="chip">${STATUS[s.status]}</span></button>${body}</li>`;
}
function tabsHTML() {
  return `<div class="seg viewtabs" role="tablist">${[["stages", "Stages"], ["timeline", "Timeline"], ["checklist", "Checklist"]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-pressed="${tab === k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>`;
}
function checklistHTML(p, edit) {
  const items = p.checklist, d = items.filter(x => x.done).length, pct = items.length ? Math.round(d / items.length * 100) : 0;
  return `<section class="card ck">
    <div class="ck-sum"><strong>${d} of ${items.length} done</strong><div class="bar"><i style="width:${pct}%"></i></div></div>
    <ul class="ck-list">${items.map(it => `<li class="ck-item${it.done ? " done" : ""}">
      <span class="tick">${edit ? `<input type="checkbox" data-ck="${esc(it.id)}" ${it.done ? "checked" : ""} aria-label="${esc(it.text)}"><i></i>` : `<i class="${it.done ? "on" : ""}"></i>`}</span>
      <span class="tx">${edit ? `<input data-cktext="${esc(it.id)}" value="${esc(it.text)}" aria-label="Item">` : esc(it.text)}</span>
      <small>${it.done ? "✓ " + ago(it.at) + (it.by ? " · " + esc(it.by) : "") : ""}${edit ? ` <button class="rm" type="button" data-ckrm="${esc(it.id)}" aria-label="Remove item">Remove</button>` : ""}</small></li>`).join("") || `<li class="empty">No items yet.</li>`}</ul>
    ${edit ? `<form class="ck-add" id="ckAdd"><input name="text" maxlength="200" placeholder="Add an item, e.g. Lighting plan approved" required><button class="btn" type="submit">Add</button></form>
      <p class="hint" style="margin:0">Ticks save automatically and show on the homeowner's page. Homeowners can't change the checklist.</p>` : `<p class="hint" style="margin:0">Your designer keeps this list up to date.</p>`}
  </section>`;
}
// Timeline (unchanged from the tracker)
const DAY = 864e5;
const dnum = d => Math.round(new Date(d + "T00:00:00Z") / DAY);
function slipOf(s, t) { if (!s.tEnd) return null; if (s.status === "done" && s.aEnd) return dnum(s.aEnd) - dnum(s.tEnd); if ((s.status === "doing" || s.status === "delayed") && t > dnum(s.tEnd)) return t - dnum(s.tEnd); return null; }
function timelineHTML(p, edit) {
  const t = dnum(today());
  const rows = use(p).filter(s => s.tStart || s.tEnd || s.aStart);
  if (!rows.length) return `<div class="card tl-empty"><p class="empty" style="margin:0">${edit ? "Add target start and end dates to the stages and the timeline builds itself." : "Your designer hasn't set the schedule yet. It'll appear here once dates are added."}</p></div>`;
  const pts = []; rows.forEach(s => { [s.tStart, s.tEnd, s.aStart, s.aEnd].forEach(d => d && pts.push(dnum(d))); });
  let lo = Math.min(...pts), hi = Math.max(...pts);
  if (rows.some(s => s.aStart && !s.aEnd)) hi = Math.max(hi, t);
  lo -= 2; hi += 3; const span = Math.max(hi - lo, 14);
  const x = n => ((n - lo) / span * 100).toFixed(2) + "%";
  const w = (a, b) => (Math.max(b - a + 1, 0.6) / span * 100).toFixed(2) + "%";
  const ticks = [], weeks = [];
  for (let n = lo; n <= lo + span; n++) { const d = new Date(n * DAY); if (d.getUTCDate() === 1 || n === lo) ticks.push([n, d.toLocaleDateString("en-SG", { month: "short", timeZone: "UTC" })]); if (d.getUTCDay() === 1) weeks.push(n); }
  if (ticks.length > 1 && ticks[1][0] - ticks[0][0] < 10) ticks.shift();
  const showToday = t >= lo && t <= lo + span;
  const ho = use(p).find(s => s.id === "handover");
  const active = use(p).filter(s => s.status === "doing" || s.status === "delayed");
  const lastDone = use(p).filter(s => s.status === "done" && s.aEnd && s.tEnd).sort((a, b) => a.aEnd.localeCompare(b.aEnd)).pop();
  const slips = active.map(s => slipOf(s, t)).filter(v => v !== null);
  const cur = slips.length ? Math.max(...slips) : active.length ? 0 : lastDone ? slipOf(lastDone, t) : 0;
  const plannedEnd = Math.max(...rows.map(s => s.tEnd ? dnum(s.tEnd) : -Infinity));
  const status = cur > 0 ? `<span class="tl-late">${cur} day${cur === 1 ? "" : "s"} behind plan</span>` : cur < 0 ? `<span class="tl-ok">${-cur} day${cur === -1 ? "" : "s"} ahead of plan</span>` : `<span class="tl-ok">On track</span>`;
  const longD = n => new Date(n * DAY).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  let body = "";
  for (const [id, name] of PHASES) {
    const list = rows.filter(s => s.phase === id); if (!list.length) continue;
    body += `<div class="tl-ph">${esc(name)}</div>`;
    for (const s of list) {
      const sl = slipOf(s, t);
      const aEnd = s.aEnd ? dnum(s.aEnd) : (s.status === "doing" || s.status === "delayed") ? t : null;
      const late = sl !== null && sl > 0;
      const plan = s.tStart || s.tEnd ? `<i class="tl-plan" style="left:${x(dnum(s.tStart || s.tEnd))};width:${w(dnum(s.tStart || s.tEnd), dnum(s.tEnd || s.tStart))}" title="Planned ${esc(range(s.tStart, s.tEnd))}"></i>` : "";
      const act = s.aStart && aEnd !== null ? `<i class="tl-act ${s.status}${late ? " late" : ""}${s.aEnd ? "" : " open"}" style="left:${x(dnum(s.aStart))};width:${w(dnum(s.aStart), aEnd)}" title="Actual ${esc(s.aStart ? range(s.aStart, s.aEnd).replace("?", "ongoing") : "")}"></i>` : "";
      const tag = sl === null ? "" : sl > 0 ? `<em class="late">+${sl}d</em>` : sl < 0 ? `<em class="ok">${sl}d</em>` : `<em class="ok">on time</em>`;
      body += `<div class="tl-row"><div class="tl-lab"><span>${esc(s.name)}</span>${tag}</div><div class="tl-track">${plan}${act}</div></div>`;
    }
  }
  return `<section class="card tl">
    <div class="tl-sum"><div class="fact"><div class="l">Schedule</div><div class="v">${status}</div></div>
      <div class="fact"><div class="l">Planned finish</div><div class="v">${isFinite(plannedEnd) ? longD(plannedEnd) : "To be confirmed"}</div></div>
      ${ho && ho.aEnd ? `<div class="fact"><div class="l">Handed over</div><div class="v">${longD(dnum(ho.aEnd))}</div></div>` : cur > 0 && isFinite(plannedEnd) ? `<div class="fact"><div class="l">If the delay holds</div><div class="v">${longD(plannedEnd + cur)}</div></div>` : ""}</div>
    <div class="tl-legend"><span><i class="tl-plan"></i>Planned</span><span><i class="tl-act done"></i>Done</span><span><i class="tl-act doing"></i>In progress</span><span><i class="tl-act late"></i>Behind plan</span>${showToday ? `<span><i class="tl-today-key"></i>Today</span>` : ""}</div>
    <div class="tl-grid"><div class="tl-axis"><div class="tl-lab"></div><div class="tl-track">${ticks.map(([n, l]) => `<span style="left:${x(n)}">${l}</span>`).join("")}</div></div>
      <div class="tl-body"><div class="tl-lines"><div class="tl-lab"></div><div class="tl-track">${weeks.map(n => `<b style="left:${x(n)}"></b>`).join("")}${ticks.map(([n]) => `<b class="m" style="left:${x(n)}"></b>`).join("")}${showToday ? `<b class="today" style="left:${x(t)}"><span>Today</span></b>` : ""}</div></div>${body}</div></div>
    <p class="hint" style="margin:22px 0 0">${edit ? "Built from the target and actual dates on each stage. Not-applicable stages are left out." : "Light bars are the plan, solid bars are what has actually happened on site."}</p></section>`;
}

async function renderProject(fresh) {
  if (!fresh) { current = await API.get(view.id); watch(); }
  const p = current, edit = editable(), g = progress(p);
  if (autoOpened !== p.id) { autoOpened = p.id; if (!edit && !open.size) p.stages.filter(s => s.status === "doing" || s.status === "delayed").forEach(s => open.add(s.id)); }
  const hd = handoverDate(p);
  const single = me.role === "client" && (await API.list()).length === 1;
  app.innerHTML = `${single ? "" : `<div class="back"><button class="link" type="button" id="backBtn">← All projects</button></div>`}
    <h1>${edit ? "Project progress" : "Your renovation"}</h1>
    <p class="sub">${edit ? "Changes save and reach the homeowner automatically." : "Your designer updates this page as work happens on site."}</p>
    <div style="height:16px"></div>
    <section class="card sum"><div class="sum-top"><div><h2>${esc(p.name)}</h2><div class="addr">${esc(p.address)}</div></div><span class="live${LIVE || !edit ? "" : " off"}" id="liveTag">Updated ${ago(p.updatedAt)}</span></div>
      <div class="phases">${PHASES.map(([id, name]) => { const l = use(p).filter(x => x.phase === id), d = l.filter(x => x.status === "done").length;
        const cls = l.length && d === l.length ? "ok" : l.some(x => x.status !== "todo") ? "on" : "";
        return `<div class="phs ${cls}"><div class="bar"><i style="width:${l.length ? Math.round(d / l.length * 100) : 0}%"></i></div><span>${esc(name)}</span></div>`; }).join("")}</div>
      <div class="facts">
        <div class="fact"><div class="l">Now · ${esc(nowPhase(p))}</div><div class="v">${esc(nowStage(p))}</div></div>
        <div class="fact"><div class="l">Progress</div><div class="v">${g.d} of ${g.n} stages</div></div>
        <div class="fact"><div class="l">Target handover</div><div class="v">${hd ? new Date(hd + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "To be confirmed"}</div></div>
        <div class="fact"><div class="l">${edit ? "Homeowner" : "Your designer"}</div><div class="v">${esc(edit ? p.clientName : p.designerName || "M2D")}</div></div>
      </div></section>
    ${tabsHTML()}${tab === "timeline" ? timelineHTML(p, edit) : tab === "checklist" ? checklistHTML(p, edit) : `${PHASES.map(([id, name], n) => { const all = p.stages.filter(x => x.phase === id), l = all.filter(x => !x.skip), shown = edit ? all : l; if (!shown.length) return "";
      const d = l.filter(x => x.status === "done").length;
      return `<section class="phase"><div class="ph-head"><span class="ph-n">${n + 1}</span><h3>${esc(name)}</h3><span class="ph-c">${!l.length ? "Not applicable" : d === l.length ? "Complete" : d + " of " + l.length + " done"}</span></div>
        <ol class="stages">${shown.map(s => stageHTML(s, l.indexOf(s), edit)).join("")}</ol></section>`; }).join("")}
    ${edit ? `<div style="height:8px"></div>${addingStage ? `<form class="card form" id="stageForm"><div class="form-grid"><label class="fld">New stage name<input name="name" required maxlength="120" placeholder="e.g. Curtains & blinds"></label><label class="fld">Portion<select name="phase">${PHASES.map(([id, name]) => `<option value="${id}"${id === "fittings" ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label></div><div class="row-end"><span class="hint">Added to the end of that portion.</span><span style="display:flex;gap:8px"><button class="btn" type="button" id="cancelStage">Cancel</button><button class="btn primary" type="submit">Add stage</button></span></div></form>` : `<button class="add" type="button" id="addStage">+ Add a stage</button>`}` : ""}`}`;
  loadPhotos();
}
async function loadPhotos() { for (const img of app.querySelectorAll("img[data-src]")) { try { img.src = await API.photoUrl(current.id, img.dataset.src); } catch (e) {} } }

// live updates: the homeowner's page (and other staff) hear about every change to the open project
function watch() {
  if (unsub) { unsub(); unsub = null; }
  if (!current) return;
  unsub = API.subscribe(current.id, p => { if (!current || p.id !== current.id) return; const a = document.activeElement; if (a && a.matches("input, textarea") && app.contains(a) && editable()) return; current = p; renderProject(true); });
}

async function go() {
  try {
    me = await API.me(); renderWho();
    if (!me) return renderLogin();
    if (MODE === "client" && isStaff(me) && LIVE) { app.innerHTML = `<div class="card login"><h1>Staff account</h1><p>You're signed in as M2D staff. The staff page is at <a href="../id/">m2decor.com/id</a>.</p><button class="btn" type="button" id="logout">Log out</button></div>`; return; }
    if (view.name === "team") return renderTeam();
    if (view.name === "project") await renderProject(); else await renderHome();
  } catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}

// ---------- saving ----------
let saveT = {};
async function saveStage(stageId, patch, rerender) {
  try {
    applyStagePatch(current, stageId, patch); current = await API.save(current);
    if (rerender) await renderProject(true); else updateHead(stageId);
    toast("Saved · homeowner can see this now");
  } catch (e) { toast(e.message); }
}
async function saveChecklist(action, rerender) {
  try { applyChecklist(current, action, me); current = await API.save(current); if (rerender) await renderProject(true); toast("Saved"); } catch (e) { toast(e.message); }
}
function updateHead(stageId) {
  const s = current.stages.find(x => x.id === stageId), i = current.stages.filter(x => x.phase === s.phase && !x.skip).indexOf(s);
  const tmp = document.createElement("div"); tmp.innerHTML = stageHTML(s, i, true);
  const sub = document.getElementById("sub_" + stageId), nsub = tmp.querySelector("#sub_" + stageId);
  if (sub && nsub) sub.innerHTML = nsub.innerHTML;
  const lt = $("#liveTag"); if (lt) lt.textContent = "Updated " + ago(current.updatedAt);
}
function resize(file, max = LIVE ? 1600 : 900, q = LIVE ? 0.82 : 0.7) {
  return new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", q)); };
    img.onerror = () => rej(new Error("Couldn't read that image")); img.src = url; });
}

// ---------- events ----------
document.addEventListener("click", async e => {
  const t = e.target;
  const rb = t.closest("#demoRole [data-role]");
  if (rb) { demoRole = rb.dataset.role; try { localStorage.setItem(DEMO_KEY + "-role", demoRole); } catch (er) {}
    document.querySelectorAll("#demoRole button").forEach(b => b.setAttribute("aria-pressed", b.dataset.role === demoRole));
    view = { name: "home", id: null }; open.clear(); showNew = false; staffList = []; return go(); }
  if (t.closest("#logout")) { await API.signOut(); me = null; view = { name: "home", id: null }; loginState = { email: "", sent: false, err: "", busy: false }; return go(); }
  if (t.closest("#resend")) { loginState = { email: loginState.email, sent: false, err: "", busy: false }; return renderLogin(); }
  if (t.closest("#teamBtn")) { view = { name: "team" }; return go(); }
  if (t.closest("#addStaff")) { teamState.adding = true; teamState.err = ""; return renderTeam(); }
  if (t.closest("#cancelStaff")) { teamState.adding = false; return renderTeam(); }
  const pw = t.closest("[data-pw]");
  if (pw) { const np = window.prompt("New password for this account (at least 10 characters):"); if (!np) return; try { await API.admin("password", { user_id: pw.dataset.pw, password: np }); toast("Password changed"); } catch (er) { toast(er.message); } return; }
  const ru = t.closest("[data-rmuser]");
  if (ru) { if (!window.confirm("Remove this account? They will no longer be able to log in.")) return; try { await API.admin("remove", { user_id: ru.dataset.rmuser }); toast("Removed"); await renderTeam(); } catch (er) { toast(er.message); } return; }
  if (t.closest("#newBtn")) { showNew = !showNew; await renderHome(); const f = app.querySelector("#newForm input"); if (f) f.focus(); return; }
  if (t.closest("#cancelNew")) { showNew = false; return renderHome(); }
  if (t.closest("#backBtn")) { view = { name: "home", id: null }; open.clear(); if (unsub) { unsub(); unsub = null; } return go(); }
  const op = t.closest("[data-open-project]");
  if (op) { view = { name: "project", id: op.dataset.openProject }; open.clear(); tab = "stages"; window.scrollTo(0, 0); return go(); }
  const rmph = t.closest("[data-rmph]");
  if (rmph) { e.stopPropagation(); try { current = await API.removePhoto(current.id, rmph.dataset.stage, rmph.dataset.rmph); await renderProject(true); toast("Photo removed"); } catch (er) { toast(er.message); } return; }
  const ph = t.closest(".ph");
  if (ph) { const img = ph.querySelector("img"); if (img && img.src) { const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img alt="Site photo" src="${img.src}">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb); } return; }
  const tg = t.closest("[data-toggle]");
  if (tg) { const id = tg.dataset.toggle; open.has(id) ? open.delete(id) : open.add(id); await renderProject(true);
    const h = app.querySelector(`[data-toggle="${id}"]`); if (h) h.focus({ preventScroll: true }); return; }
  const vt = t.closest("[data-tab]");
  if (vt) { tab = vt.dataset.tab; await renderProject(true); return; }
  const ps = t.closest("[data-partskip]");
  if (ps) { const skip = ps.getAttribute("aria-pressed") !== "true"; await saveStage(ps.dataset.stage, { part: { id: ps.dataset.partskip, skip } }, true); return; }
  const st = t.closest("[data-status]");
  if (st) { const s = current.stages.find(x => x.id === st.dataset.status); const val = st.dataset.val; if (s.status === val) return;
    await saveStage(s.id, { status: val }, true); const b = app.querySelector(`[data-status="${s.id}"][data-val="${val}"]`); if (b) b.focus({ preventScroll: true }); return; }
  if (t.closest("#addStage")) { addingStage = true; await renderProject(true); const f = app.querySelector("#stageForm input"); if (f) f.focus(); return; }
  if (t.closest("#cancelStage")) { addingStage = false; return renderProject(true); }
  const rs = t.closest("[data-rmstage]");
  if (rs) { current.stages = current.stages.filter(s => s.id !== rs.dataset.rmstage || !s.custom); current.updatedAt = new Date().toISOString(); current = await API.save(current); open.delete(rs.dataset.rmstage); await renderProject(true); toast("Stage removed"); return; }
  const ckrm = t.closest("[data-ckrm]");
  if (ckrm) { await saveChecklist({ id: ckrm.dataset.ckrm, remove: true }, true); return; }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.cktext) { clearTimeout(saveT["ck" + t.dataset.cktext]); saveT["ck" + t.dataset.cktext] = setTimeout(() => saveChecklist({ id: t.dataset.cktext, text: t.value }), 700); return; }
  if (!t.dataset.sf || t.type === "date") return;
  const id = t.dataset.stage, f = t.dataset.sf;
  clearTimeout(saveT[id + f]); saveT[id + f] = setTimeout(() => saveStage(id, { [f]: t.value }), 700);
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.ck) return saveChecklist({ id: t.dataset.ck, done: t.checked }, true);
  if (t.dataset.skip) { await saveStage(t.dataset.skip, { skip: t.checked }, true); toast(t.checked ? "Marked not applicable · hidden from homeowner" : "Stage brought back"); return; }
  if (t.dataset.part) return saveStage(t.dataset.stage, { part: { id: t.dataset.part, done: t.checked } }, true);
  if (t.dataset.sf && t.type === "date") return saveStage(t.dataset.stage, { [t.dataset.sf]: t.value }, false);
  if (t.dataset.upload) {
    const files = [...t.files]; if (!files.length) return; toast("Uploading " + files.length + " photo" + (files.length > 1 ? "s" : "") + "…");
    try { for (const f of files) current = await API.addPhoto(current.id, t.dataset.upload, await resize(f)); await renderProject(true); toast("Photos added · homeowner can see them"); }
    catch (er) { toast(er.message); }
  }
});
document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "loginForm") {
    e.preventDefault(); const fd = new FormData(f); loginState.busy = true; loginState.err = ""; renderLogin();
    try {
      if (MODE === "client") {
        if (!loginState.sent) { loginState.email = String(fd.get("email")).trim().toLowerCase(); const { error } = await API.sendCode(loginState.email); if (error) throw error; loginState.sent = true; }
        else { const { error } = await API.verifyCode(loginState.email, String(fd.get("code")).replace(/\s/g, "")); if (error) throw error; loginState = { email: "", sent: false, err: "", busy: false }; return go(); }
      } else {
        loginState.email = String(fd.get("email")).trim().toLowerCase();
        const { error } = await API.signInStaff(loginState.email, String(fd.get("password"))); if (error) throw error;
        loginState = { email: "", sent: false, err: "", busy: false }; return go();
      }
    } catch (er) { loginState.err = /invalid|credentials/i.test(er.message) ? "That email or password isn't right." : /rate|limit/i.test(er.message) ? "Too many attempts. Please wait a few minutes and try again." : er.message; }
    loginState.busy = false; return renderLogin();
  }
  if (f.id === "staffForm") { e.preventDefault(); const fd = new FormData(f); try { const r = await API.admin("create", { name: fd.get("name"), email: fd.get("email"), role: fd.get("role"), password: fd.get("password") }); teamState.adding = false; teamState.err = ""; staffList = []; await renderTeam(); toast(r.message || "Account created"); } catch (er) { teamState.err = er.message; await renderTeam(); } return; }
  if (f.id === "ckAdd") { e.preventDefault(); const text = String(new FormData(f).get("text")).trim(); if (text) await saveChecklist({ add: text }, true); return; }
  if (f.id === "stageForm") { e.preventDefault(); const fd = new FormData(f), name = fd.get("name").trim(); if (!name) return;
    try { const s = newStage("c" + uid(), name, fd.get("phase")); s.custom = true; current.stages.push(s); current.updatedAt = new Date().toISOString(); current = await API.save(current); addingStage = false; await renderProject(true); toast("Stage added"); } catch (er) { toast(er.message); } return; }
  if (f.id !== "newForm") return; e.preventDefault();
  const fd = new FormData(f), d = Object.fromEntries(fd), on = fd.getAll("use");
  d.skip = PHASES.flatMap(x => x[2].map(y => y[0])).filter(k => !on.includes(k)); delete d.use;
  if (me.role === "admin" && d.designer) { const u = staffList.find(x => x.id === d.designer); if (u) { d.designerId = u.id; d.designerName = u.name; d.designerEmail = u.email; } }
  if (!d.designerId) { d.designerId = me.id; d.designerName = me.name; d.designerEmail = me.email; }
  delete d.designer;
  try { const p = await API.create(d); showNew = false; view = { name: "project", id: p.id }; open.clear(); open.add(p.stages[0].id); await go(); toast(LIVE ? "Created · the homeowner can log in at m2decor.com/my" : "Project created"); }
  catch (er) { toast(er.message); }
});

// ---------- keep the page fresh (fallback to live updates) ----------
async function refresh() {
  if (!me || document.hidden) return;
  const a = document.activeElement; if (a && a.matches("input, textarea") && app.contains(a)) return;
  try {
    if (view.name === "project" && !addingStage) { const p = await API.get(view.id); if (!current || p.updatedAt !== current.updatedAt) { current = p; await renderProject(true); } else { const lt = $("#liveTag"); if (lt) lt.textContent = "Updated " + ago(current.updatedAt); } }
    else if (view.name === "home" && !showNew) await renderHome();
  } catch (e) {}
}
let lastPoll = 0;
setInterval(() => { if (LIVE && Date.now() - lastPoll < 30000) return; lastPoll = Date.now(); refresh(); }, 4000);
document.addEventListener("visibilitychange", refresh);
window.addEventListener("storage", e => { if (e.key === DEMO_KEY && !LIVE) refresh(); });

// ---------- start: live when Supabase is configured, demo otherwise ----------
async function start() {
  const forceDemo = /[?&]demo\b/.test(location.search);
  if (!forceDemo && CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
    LIVE = true; API = SupaAPI; SupaAPI.init();
    SupaAPI.client.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { me = null; view = { name: "home", id: null }; go(); } });
    go();
  } else {
    $("#demoBar").hidden = false;
    document.querySelectorAll("#demoRole button").forEach(b => b.setAttribute("aria-pressed", b.dataset.role === demoRole));
    go();
  }
}
start();
})();
