// Shared rules for both functions: who is logged in, who may see or edit a project, and storage.
import { getStore } from "@netlify/blobs";

// The four portions of an M2D renovation. Keep in step with PHASES in index.html.
export const PHASES = [
  ["prelim", "Preliminaries", [["design", "Design & quotation"], ["permits", "Permits & approvals"]]],
  ["foundation", "Foundation stage", [["hacking", "Hacking & demolition"], ["me", "M&E works", ["Aircon", "Electricals", "Plumbing"]],
    ["plaster", "Plastering of walls"], ["ceiling", "False ceiling & partition works"], ["wet", "Masonry, waterproofing & tiling"], ["paint", "Painting works"]]],
  ["fittings", "Fittings", [["windows", "Windows", ["Measurement", "Installation"]], ["maindoor", "Main door & gate", ["Measurement", "Installation"]],
    ["doors", "Doors", ["Measurement", "Installation"]], ["carpentry", "Carpentry works", ["Measurement", "Installation"]], ["stone", "Stone works", ["Measurement", "Installation"]],
    ["glass", "Glass works", ["Measurement", "Installation"]], ["fittings", "Lights, sanitary & appliances"]]],
  ["finishing", "Finishing", [["clean", "Final cleaning"], ["handover", "Handover"]]]
];
export const PHASE_IDS = PHASES.map(x => x[0]);
const PHASE_OF = Object.fromEntries(PHASES.flatMap(([ph, , list]) => list.map(([k]) => [k, ph])));
const STAGE_FIELDS = ["status", "tStart", "tEnd", "aStart", "aEnd", "notes", "name"];
const STATUSES = ["todo", "doing", "done", "delayed"];

export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

export const projects = () => getStore({ name: "projects", consistency: "strong" });
export const photos = () => getStore({ name: "photos", consistency: "strong" });

// Logged-in user from Netlify Identity: the browser sends its login token, and we ask Identity who it belongs to.
// Roles are set in the Netlify dashboard: "designer" or "admin". Everyone else is a homeowner.
export async function who(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(new URL("/.netlify/identity/user", req.url), { headers: { Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  const roles = (u.app_metadata && u.app_metadata.roles) || [];
  return {
    email: String(u.email || "").toLowerCase(),
    name: (u.user_metadata && u.user_metadata.full_name) || u.email,
    role: roles.includes("admin") ? "admin" : roles.includes("designer") ? "designer" : "client"
  };
}
export const canView = (p, u) => u.role === "admin" || p.designerEmail === u.email || p.clientEmail === u.email;
export const canEdit = (p, u) => u.role === "admin" || (u.role === "designer" && p.designerEmail === u.email);

export const getProject = async id => normalize(await projects().get("p/" + id, { type: "json" }));
export const putProject = p => projects().setJSON("p/" + p.id, p);

const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const newStage = (id, name, phase, parts) => ({ id, name, phase: PHASE_IDS.includes(phase) ? phase : "fittings", status: "todo", tStart: "", tEnd: "", aStart: "", aEnd: "", notes: "", photos: [],
  parts: parts ? parts.map(n => ({ id: slug(n), name: n, done: false, skip: false })) : [], skip: false, custom: false });
export const normalize = p => { if (p && p.stages) p.stages.forEach(s => { if (!s.phase) s.phase = PHASE_OF[s.id] || (s.id === "services" ? "foundation" : "fittings"); if (!s.parts) s.parts = []; s.skip = !!s.skip; }); return p; };
export function newProject(f) {
  const now = new Date().toISOString();
  const s = v => String(v || "").trim().slice(0, 200);
  return { id: uid(), name: s(f.name), address: s(f.address), clientName: s(f.clientName), clientEmail: s(f.clientEmail).toLowerCase(),
    designerName: s(f.designerName), designerEmail: s(f.designerEmail).toLowerCase(), createdAt: now, updatedAt: now,
    stages: PHASES.flatMap(([ph, , list]) => list.map(([k, n, parts]) => { const st = newStage(k, n, ph, parts); st.skip = Array.isArray(f.skip) && f.skip.includes(k); return st; })) };
}
export function applyStagePatch(p, stageId, patch) {
  const s = p.stages.find(x => x.id === stageId);
  if (!s) return false;
  for (const k of STAGE_FIELDS) if (k in patch) s[k] = String(patch[k] ?? "").slice(0, k === "notes" ? 4000 : 200);
  if (!STATUSES.includes(s.status)) s.status = "todo";
  let st = patch.status;
  if ("skip" in patch) s.skip = !!patch.skip; // not applicable to this project
  if (patch.part && s.parts) { // first tick starts the stage, last tick finishes it
    const pt = s.parts.find(x => x.id === patch.part.id);
    if (pt) { if ("done" in patch.part) pt.done = !!patch.part.done; if ("skip" in patch.part) { pt.skip = !!patch.part.skip; if (pt.skip) pt.done = false; }
      const use = s.parts.filter(x => !x.skip), n = use.filter(x => x.done).length;
      if (use.length && n === use.length) st = s.status = "done"; else if (n && (s.status === "todo" || s.status === "done")) st = s.status = "doing"; else if (!n && s.status === "done") st = s.status = "doing";
      if (st === "doing") s.aEnd = ""; }
  }
  if (st === "doing" && !s.aStart) s.aStart = today();
  if (st === "done") { if (!s.aStart) s.aStart = today(); if (!s.aEnd) s.aEnd = today(); }
  s.updatedAt = p.updatedAt = new Date().toISOString();
  return true;
}
