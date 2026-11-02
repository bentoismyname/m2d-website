// M2D Client Portal API — one Netlify Function serving /api/*
// Grown from the Handover Desk API. Storage: Netlify Blobs (no database to set up).
//
// Who can call what:
//   Designers  — sign in with their own email + password (or the legacy shared TEAM_PASSCODE). Cookie m2d_s.
//   Customers  — sign in with email + a one-time code, or open their private /h/<token> link. Cookie m2d_c.
//   Prospects  — no login: the "Before we meet" questionnaire posts to /api/intake.
//
// See ../../API.md for the full route list.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

const COOKIE = "m2d_s";          // designer session
const CCOOKIE = "m2d_c";         // customer session
const SESSION_DAYS = 30;
const CUSTOMER_SESSION_DAYS = 14;
const MAX_BODY = 300 * 1024;     // JSON bodies
const MAX_FILE = 10 * 1024 * 1024;
const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const ID_RE = /^h[a-z0-9]{6,24}$/;
const DID_RE = /^d[a-z0-9]{6,24}$/;
const PID_RE = /^p[a-z0-9]{6,24}$/;
const FID_RE = /^f[a-z0-9]{6,24}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;
const FIELDS = ["customer", "handoverDate", "designer", "notes", "status", "checks", "defects", "contacts", "places", "finishAreas", "signoff", "schedule", "questionnaire", "appliances"];
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const STAGE_STATUS = new Set(["planned", "progress", "done"]);
const PROSPECT_STATUS = new Set(["new", "contacted", "converted", "closed"]);
const FILE_TYPES = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  dwg: "application/acad", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/* ---------- Storage ---------- */
function stores() {
  if (globalThis.__M2D_STORES__) return globalThis.__M2D_STORES__; // tests inject in-memory stores
  const mk = (name) => getStore({ name, consistency: "strong" });
  return { h: mk("handovers"), t: mk("tokens"), s: mk("settings"), d: mk("designers"), p: mk("prospects"), f: mk("files"), o: mk("otp"), r: mk("ratelimit") };
}

function env(name) {
  return (globalThis.Netlify && Netlify.env && Netlify.env.get(name)) || process.env[name] || "";
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const err = (status, message) => json({ error: message }, status);
const fail = (status, message) => Object.assign(new Error(message), { status });

/* ---------- Crypto helpers ---------- */
function secret() {
  const s = env("SESSION_SECRET");
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or shorter than 16 characters");
  return s;
}
const sign = (payload) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
const b64 = (s) => Buffer.from(String(s), "utf8").toString("base64url");
const unb64 = (s) => Buffer.from(String(s), "base64url").toString("utf8");
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
function same(a, b) {
  const ha = sha(a), hb = sha(b);
  return crypto.timingSafeEqual(ha, hb);
}
function passFingerprint() {
  return crypto.createHash("sha256").update(env("TEAM_PASSCODE")).digest("base64url").slice(0, 10);
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(String(pw), salt, 32).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored || typeof stored !== "string") return false;
  const [kind, salt, hash] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const got = crypto.scryptSync(String(pw), salt, 32).toString("base64url");
  return got.length === hash.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(hash));
}

/* ---------- Sessions ---------- */
// Designer cookie payload: exp.pv.uid.role.name  (legacy passcode sessions from the old desk had just exp.pv and are still accepted)
function makeSession(user) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = [exp, passFingerprint(), b64(user.id), user.role, b64(user.name)].join(".");
  return payload + "." + sign(payload);
}
function readCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}
function verifySigned(value, parts) {
  const bits = value.split(".");
  if (bits.length !== parts + 1) return null;
  const payload = bits.slice(0, parts).join(".");
  const good = sign(payload);
  const got = bits[parts];
  if (good.length !== got.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(got))) return null;
  if (+bits[0] < Date.now()) return null;
  return bits;
}
async function sessionUser(req, S) {
  const value = readCookie(req, COOKIE);
  if (!value) return null;
  const n = value.split(".").length;
  if (n === 3) { // legacy desk cookie
    const bits = verifySigned(value, 2);
    if (!bits || bits[1] !== passFingerprint()) return null;
    return { id: "team", role: "admin", name: "Team passcode" };
  }
  const bits = verifySigned(value, 5);
  if (!bits) return null;
  const id = unb64(bits[2]), role = bits[3], name = unb64(bits[4]);
  if (id === "team") { if (bits[1] !== passFingerprint()) return null; return { id, role: "admin", name }; }
  const d = await S.d.get(id, { type: "json" });
  if (!d || d.active === false) return null;
  return { id: d.id, role: d.role, name: d.name };
}
// Customer cookie payload: exp.email(b64)
function makeCustomerSession(email) {
  const exp = Date.now() + CUSTOMER_SESSION_DAYS * 864e5;
  const payload = exp + "." + b64(email);
  return payload + "." + sign(payload);
}
function customerEmail(req) {
  const value = readCookie(req, CCOOKIE);
  if (!value) return null;
  const bits = verifySigned(value, 2);
  return bits ? unb64(bits[1]) : null;
}
function cookie(name, value, maxAge, req) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/* ---------- Request helpers ---------- */
async function body(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw fail(413, "Request too large.");
  try { return text ? JSON.parse(text) : {}; } catch { throw fail(400, "Bad JSON."); }
}
function clean(v, depth = 0) {
  if (depth > 12) return null;
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => clean(x, depth + 1));
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).slice(0, 300)) if (!BAD_KEYS.has(k)) o[k] = clean(v[k], depth + 1);
    return o;
  }
  if (typeof v === "string") return v.slice(0, 2000);
  if (typeof v === "number" || typeof v === "boolean" || v === null) return v;
  return null;
}
function merge(a, b) {
  for (const k of Object.keys(b)) {
    if (BAD_KEYS.has(k)) continue;
    const v = b[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!a[k] || typeof a[k] !== "object" || Array.isArray(a[k])) a[k] = {};
      merge(a[k], v);
    } else a[k] = v;
  }
  return a;
}
function pick(src) {
  const o = {};
  for (const f of FIELDS) if (f in src) o[f] = clean(src[f]);
  if (o.schedule) o.schedule = cleanSchedule(o.schedule);
  if (o.appliances) o.appliances = cleanAppliances(o.appliances);
  return o;
}
function cleanSchedule(s) {
  const stages = Array.isArray(s.stages) ? s.stages.slice(0, 60) : [];
  return {
    stages: stages.filter((x) => x && typeof x === "object").map((x) => ({
      id: typeof x.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(x.id) ? x.id : "s" + crypto.randomBytes(3).toString("hex"),
      name: String(x.name || "").slice(0, 120),
      start: String(x.start || "").slice(0, 10),
      end: String(x.end || "").slice(0, 10),
      status: STAGE_STATUS.has(x.status) ? x.status : "planned",
      notes: String(x.notes || "").slice(0, 1000),
    })),
    updatedAt: Date.now(),
  };
}
function cleanAppliances(a) {
  return { items: clean(a.items) || {}, custom: clean(a.custom) || {}, baths: Array.isArray(a.baths) ? clean(a.baths) : [], updatedAt: Date.now() };
}
const normEmail = (e) => String(e || "").trim().toLowerCase().slice(0, 200);
const validEmail = (e) => /^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,}$/.test(e);
const newId = (p = "h") => p + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
const newToken = () => crypto.randomBytes(18).toString("base64url");
function clientIp(req) {
  return (req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim();
}
// Simple per-IP counter in Blobs: `limit` hits per hour per bucket.
async function rateLimit(S, req, bucket, limit) {
  const key = bucket + ":" + clientIp(req) + ":" + Math.floor(Date.now() / 36e5);
  const cur = (await S.r.get(key, { type: "json" })) || { n: 0 };
  if (cur.n >= limit) throw fail(429, "Too many requests. Please try again later.");
  await S.r.setJSON(key, { n: cur.n + 1 });
}

/* ---------- Records ---------- */
async function allHandovers(S) {
  const { blobs } = await S.h.list();
  const rows = await Promise.all(blobs.map((b) => S.h.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
async function allDesigners(S) {
  const { blobs } = await S.d.list();
  const rows = await Promise.all(blobs.map((b) => S.d.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
const safeDesigner = ({ passwordHash, ...d }) => d;
function publicSchedule(s) {
  if (!s || !Array.isArray(s.stages)) return { stages: [], updatedAt: s && s.updatedAt || 0 };
  return { stages: s.stages.map(({ notes, ...st }) => st), updatedAt: s.updatedAt || 0 };
}
// What a homeowner may see through the private link (no phone, email or internal notes).
function publicView(h) {
  const c = h.customer || {};
  return {
    customer: { name: c.name || "", address: c.address || "" },
    handoverDate: h.handoverDate || "", designer: h.designer || "",
    checks: h.checks || {}, defects: (h.defects || []).filter((d) => d && d.text),
    contacts: h.contacts || {}, places: h.places || {}, finishAreas: h.finishAreas || [], signoff: h.signoff || {},
    schedule: publicSchedule(h.schedule),
  };
}
// What a signed-in customer may see: the public view plus their own questionnaire, appliances and files.
function portalView(h) {
  return {
    id: h.id, ...publicView(h), status: h.status || "progress",
    questionnaire: h.questionnaire || null, appliances: h.appliances || null,
    files: (h.files || []).map(({ id, name, size, type, createdAt }) => ({ id, name, size, type, createdAt })),
  };
}
async function handoversForEmail(S, email) {
  const all = await allHandovers(S);
  return all.filter((h) => h.customer && normEmail(h.customer.email) === email);
}

/* ---------- Email (one-time codes) ---------- */
// Uses Resend if RESEND_API_KEY is set; otherwise the code is written to the function log so you can test without email.
async function sendCode(email, code) {
  const key = env("RESEND_API_KEY");
  const from = env("MAIL_FROM") || "M2D <no-reply@m2decor.com.sg>";
  const text = `Your M2D sign-in code is ${code}. It works for ${OTP_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`;
  if (!key) { console.log(`[m2d] sign-in code for ${email}: ${code}`); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Your M2D sign-in code", text }),
  });
  if (!res.ok) console.error("[m2d] email send failed", res.status, await res.text().catch(() => ""));
}

/* ---------- Files ---------- */
function extOf(name) { const m = String(name).toLowerCase().match(/\.([a-z0-9]{1,5})$/); return m ? m[1] : ""; }
function safeName(name) { return String(name || "file").replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "file"; }
async function readUpload(req) {
  const ct = req.headers.get("content-type") || "";
  if (ct.startsWith("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("file");
    if (!f || typeof f === "string") throw fail(400, "Attach the file as the 'file' field.");
    const buf = Buffer.from(await f.arrayBuffer());
    return { name: f.name || "file", type: f.type || "", buf };
  }
  const text = await req.text();
  if (text.length > MAX_FILE * 1.4 + 4096) throw fail(413, "File is larger than 10 MB.");
  let b; try { b = JSON.parse(text); } catch { throw fail(400, "Bad JSON."); }
  if (!b || typeof b.data !== "string") throw fail(400, "Send { name, type, data } with data as base64.");
  return { name: b.name || "file", type: b.type || "", buf: Buffer.from(b.data.replace(/^data:[^;]+;base64,/, ""), "base64") };
}
function fileResponse(buf, meta) {
  return new Response(buf, { status: 200, headers: {
    "Content-Type": meta.type || "application/octet-stream", "Content-Length": String(buf.byteLength),
    "Content-Disposition": `attachment; filename="${safeName(meta.name)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}

/* ---------- Router ---------- */
export default async function handler(req) {
  try {
    return await route(req);
  } catch (e) {
    if (e && e.status) return err(e.status, e.message);
    console.error(e);
    return err(500, "Something went wrong on the server.");
  }
}

async function route(req) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const m = req.method;
  const S = stores();

  /* ----- No login: homeowner private link ----- */
  if (parts[0] === "public" && parts[1] && m === "GET") {
    if (!TOKEN_RE.test(parts[1])) return err(404, "Link not found");
    const ref = await S.t.get(parts[1], { type: "json" });
    if (!ref) return err(404, "Link not found");
    const h = await S.h.get(ref.id, { type: "json" });
    if (!h || h.token !== parts[1]) return err(404, "Link not found");
    const settings = (await S.s.get("pack", { type: "json" })) || {};
    return json({ handover: publicView(h), settings });
  }

  /* ----- No login: prospect questionnaire ----- */
  if (parts[0] === "intake" && m === "POST") {
    await rateLimit(S, req, "intake", 20);
    const b = clean(await body(req));
    const answers = b && b.answers && typeof b.answers === "object" ? b.answers : b;
    const contact = {
      name: String((b.contact && b.contact.name) || answers.Name || "").slice(0, 120),
      phone: String((b.contact && b.contact.phone) || answers.Phone || "").slice(0, 40),
      email: normEmail((b.contact && b.contact.email) || answers.Email || ""),
      address: String((b.contact && b.contact.address) || answers.Address || "").slice(0, 300),
    };
    delete answers.contact;
    if (!contact.name && !contact.phone && !contact.email) return err(400, "Please include a name, phone or email so we can reply.");
    const rec = { id: newId("p"), answers, contact, status: "new", notes: "", createdAt: Date.now(), updatedAt: Date.now() };
    await S.p.setJSON(rec.id, rec);
    return json({ ok: true, id: rec.id }, 201);
  }

  /* ----- Designer sign in / out ----- */
  if (parts[0] === "login" && m === "POST") {
    await rateLimit(S, req, "login", 30);
    const b = await body(req);
    if (b && b.email) {
      const email = normEmail(b.email);
      const d = (await allDesigners(S)).find((x) => normEmail(x.email) === email);
      if (!d || d.active === false || !verifyPassword(b.password || "", d.passwordHash)) {
        await new Promise((r) => setTimeout(r, 700));
        return err(401, "That email or password didn’t work.");
      }
      const user = { id: d.id, role: d.role, name: d.name };
      return json({ ok: true, user }, 200, { "Set-Cookie": cookie(COOKIE, makeSession(user), SESSION_DAYS * 86400, req) });
    }
    const pass = env("TEAM_PASSCODE");
    if (!pass) return err(401, "Passcode sign-in is switched off. Use your email and password.");
    if (!same(b.passcode || "", pass)) {
      await new Promise((r) => setTimeout(r, 700));
      return err(401, "That passcode didn’t work.");
    }
    const user = { id: "team", role: "admin", name: "Team passcode" };
    return json({ ok: true, user }, 200, { "Set-Cookie": cookie(COOKIE, makeSession(user), SESSION_DAYS * 86400, req) });
  }
  if (parts[0] === "logout" && m === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": cookie(COOKIE, "", 0, req) });
  }

  /* ----- Customer portal (own cookie) ----- */
  if (parts[0] === "portal") return portalRoute(req, S, parts.slice(1), m, url);

  /* ----- Everything below needs a designer session ----- */
  const user = await sessionUser(req, S);
  if (!user) return err(401, "Please sign in.");
  const isAdmin = user.role === "admin";

  if (parts[0] === "me") {
    const designers = await allDesigners(S);
    return json({ ok: true, user, needsSetup: designers.length === 0 });
  }

  if (parts[0] === "designers") {
    if (!isAdmin) return err(403, "Only an admin can manage designer accounts.");
    const id = parts[1];
    if (!id) {
      if (m === "GET") return json((await allDesigners(S)).map(safeDesigner));
      if (m === "POST") {
        const b = clean(await body(req));
        const email = normEmail(b.email);
        if (!b.name || !validEmail(email)) return err(400, "Name and a valid email are required.");
        if (!b.password || String(b.password).length < 8) return err(400, "Password must be at least 8 characters.");
        if ((await allDesigners(S)).some((x) => normEmail(x.email) === email)) return err(409, "That email already has an account.");
        const rec = { id: newId("d"), name: String(b.name).slice(0, 80), email, role: b.role === "admin" ? "admin" : "designer", passwordHash: hashPassword(b.password), active: true, createdAt: Date.now(), createdBy: user.name };
        await S.d.setJSON(rec.id, rec);
        return json(safeDesigner(rec), 201);
      }
    } else {
      if (!DID_RE.test(id)) return err(404, "Not found");
      const rec = await S.d.get(id, { type: "json" });
      if (!rec) return err(404, "Not found");
      if (m === "GET") return json(safeDesigner(rec));
      if (m === "PATCH") {
        const b = clean(await body(req));
        if (b.name) rec.name = String(b.name).slice(0, 80);
        if (b.role === "admin" || b.role === "designer") { if (id === user.id && b.role !== "admin") return err(400, "You can’t remove your own admin role."); rec.role = b.role; }
        if (typeof b.active === "boolean") { if (id === user.id && !b.active) return err(400, "You can’t deactivate yourself."); rec.active = b.active; }
        if (b.password) { if (String(b.password).length < 8) return err(400, "Password must be at least 8 characters."); rec.passwordHash = hashPassword(b.password); }
        rec.updatedAt = Date.now();
        await S.d.setJSON(id, rec);
        return json(safeDesigner(rec));
      }
      if (m === "DELETE") { // deactivate, never erase (keeps "updatedBy" history meaningful)
        if (id === user.id) return err(400, "You can’t deactivate yourself.");
        rec.active = false; rec.updatedAt = Date.now();
        await S.d.setJSON(id, rec);
        return new Response(null, { status: 204 });
      }
    }
  }

  if (parts[0] === "settings") {
    if (m === "GET") return json((await S.s.get("pack", { type: "json" })) || {});
    if (m === "PUT") {
      const b = clean(await body(req));
      const v = { warranty: b.warranty || "", phone: b.phone || "", email: b.email || "", website: b.website || "" };
      await S.s.setJSON("pack", v);
      return json(v);
    }
  }

  if (parts[0] === "prospects") {
    const id = parts[1];
    if (!id && m === "GET") {
      const { blobs } = await S.p.list();
      const rows = (await Promise.all(blobs.map((b) => S.p.get(b.key, { type: "json" })))).filter(Boolean);
      return json(rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }
    if (id) {
      if (!PID_RE.test(id)) return err(404, "Not found");
      const rec = await S.p.get(id, { type: "json" });
      if (!rec) return err(404, "Not found");
      if (m === "GET") return json(rec);
      if (m === "PATCH") {
        const b = clean(await body(req));
        if (PROSPECT_STATUS.has(b.status)) rec.status = b.status;
        if (typeof b.notes === "string") rec.notes = b.notes;
        rec.updatedAt = Date.now(); rec.updatedBy = user.name;
        await S.p.setJSON(id, rec);
        return json(rec);
      }
      if (parts[2] === "convert" && m === "POST") {
        if (rec.handoverId) return err(409, "Already converted.");
        const now = Date.now();
        const h = {
          customer: { name: rec.contact.name || rec.answers.Name || "New customer", address: rec.contact.address || "", phone: rec.contact.phone || "", email: rec.contact.email || "" },
          handoverDate: "", designer: user.id === "team" ? "" : user.name, notes: "", status: "progress",
          checks: {}, defects: [], contacts: {}, places: {}, finishAreas: [], signoff: {}, schedule: { stages: [], updatedAt: now },
          questionnaire: { answers: rec.answers, submittedAt: rec.createdAt, source: "prospect" }, files: [],
          id: newId("h"), token: newToken(), createdAt: now, updatedAt: now, createdBy: user.name,
        };
        await S.h.setJSON(h.id, h);
        await S.t.setJSON(h.token, { id: h.id });
        rec.status = "converted"; rec.handoverId = h.id; rec.updatedAt = now; rec.updatedBy = user.name;
        await S.p.setJSON(id, rec);
        return json(h, 201);
      }
      if (m === "DELETE") { await S.p.delete(id); return new Response(null, { status: 204 }); }
    }
  }

  if (parts[0] === "handovers") {
    const id = parts[1];
    if (!id) {
      if (m === "GET") return json(await allHandovers(S));
      if (m === "POST") {
        const b = pick(await body(req));
        if (!b.customer || !b.customer.name) return err(400, "Customer name is required.");
        if (b.customer.email) b.customer.email = normEmail(b.customer.email);
        const now = Date.now();
        const rec = { status: "progress", checks: {}, defects: [], contacts: {}, places: {}, finishAreas: [], signoff: {}, schedule: { stages: [], updatedAt: now }, files: [], ...b, id: newId("h"), token: newToken(), createdAt: now, updatedAt: now, createdBy: user.name };
        await S.h.setJSON(rec.id, rec);
        await S.t.setJSON(rec.token, { id: rec.id });
        return json(rec, 201);
      }
    }
    if (id) {
      if (!ID_RE.test(id)) return err(404, "Not found");
      const rec = await S.h.get(id, { type: "json" });
      if (!rec) return err(404, "This pack was deleted.");

      if (parts[2] === "reset-link" && m === "POST") {
        await S.t.delete(rec.token);
        rec.token = newToken(); rec.updatedAt = Date.now(); rec.updatedBy = user.name;
        await S.h.setJSON(id, rec);
        await S.t.setJSON(rec.token, { id });
        return json(rec);
      }
      if (parts[2] === "files") {
        const fid = parts[3];
        if (!fid && m === "GET") return json(rec.files || []);
        if (!fid && m === "POST") {
          const up = await readUpload(req);
          if (!up.buf.length) return err(400, "The file is empty.");
          if (up.buf.length > MAX_FILE) return err(413, "File is larger than 10 MB.");
          const ext = extOf(up.name);
          if (!FILE_TYPES[ext]) return err(415, "Allowed files: PDF, JPG, PNG, WEBP, DWG, XLSX, DOCX.");
          const meta = { id: newId("f"), name: safeName(up.name), size: up.buf.length, type: FILE_TYPES[ext], uploadedBy: user.name, createdAt: Date.now() };
          await S.f.set(id + "/" + meta.id, up.buf);
          rec.files = (rec.files || []).concat(meta); rec.updatedAt = Date.now(); rec.updatedBy = user.name;
          await S.h.setJSON(id, rec);
          return json(meta, 201);
        }
        if (fid) {
          if (!FID_RE.test(fid)) return err(404, "Not found");
          const meta = (rec.files || []).find((f) => f.id === fid);
          if (!meta) return err(404, "File not found");
          if (m === "GET") {
            const buf = await S.f.get(id + "/" + fid, { type: "arrayBuffer" });
            if (!buf) return err(404, "File not found");
            return fileResponse(Buffer.from(buf), meta);
          }
          if (m === "DELETE") {
            await S.f.delete(id + "/" + fid);
            rec.files = rec.files.filter((f) => f.id !== fid); rec.updatedAt = Date.now(); rec.updatedBy = user.name;
            await S.h.setJSON(id, rec);
            return new Response(null, { status: 204 });
          }
        }
        return err(404, "Not found");
      }
      if (parts[2]) return err(404, "Not found");
      if (m === "GET") return json(rec);
      if (m === "PATCH") {
        const patch = pick(await body(req));
        if (patch.customer && patch.customer.email) patch.customer.email = normEmail(patch.customer.email);
        merge(rec, patch);
        if (patch.schedule) rec.schedule = patch.schedule;        // schedule and appliances are replaced whole, not merged
        if (patch.appliances) rec.appliances = patch.appliances;
        rec.updatedAt = Date.now(); rec.updatedBy = user.name;
        await S.h.setJSON(id, rec);
        return json(rec);
      }
      if (m === "DELETE") {
        for (const f of rec.files || []) await S.f.delete(id + "/" + f.id);
        await S.h.delete(id);
        if (rec.token) await S.t.delete(rec.token);
        return new Response(null, { status: 204 });
      }
    }
  }
  return err(404, "Not found");
}

/* ---------- Customer portal routes: /api/portal/* ---------- */
async function portalRoute(req, S, parts, m, url) {
  if (parts[0] === "request-code" && m === "POST") {
    await rateLimit(S, req, "otp", 10);
    const b = await body(req);
    const email = normEmail(b.email);
    if (validEmail(email) && (await handoversForEmail(S, email)).length) {
      const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
      await S.o.setJSON(email, { hash: crypto.createHmac("sha256", secret()).update(code).digest("base64url"), exp: Date.now() + OTP_MINUTES * 6e4, attempts: 0 });
      await sendCode(email, code);
    }
    return json({ ok: true }); // same answer whether or not the email is known
  }
  if (parts[0] === "verify" && m === "POST") {
    await rateLimit(S, req, "otp", 30);
    const b = await body(req);
    const email = normEmail(b.email), code = String(b.code || "").trim();
    const otp = await S.o.get(email, { type: "json" });
    const bad = () => err(401, "That code didn’t work. Please check it or ask for a new one.");
    if (!otp || otp.exp < Date.now() || otp.attempts >= OTP_MAX_ATTEMPTS) { if (otp) await S.o.delete(email); return bad(); }
    const got = crypto.createHmac("sha256", secret()).update(code).digest("base64url");
    if (got.length !== otp.hash.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(otp.hash))) {
      otp.attempts += 1; await S.o.setJSON(email, otp); return bad();
    }
    await S.o.delete(email);
    return json({ ok: true }, 200, { "Set-Cookie": cookie(CCOOKIE, makeCustomerSession(email), CUSTOMER_SESSION_DAYS * 86400, req) });
  }
  if (parts[0] === "logout" && m === "POST") return json({ ok: true }, 200, { "Set-Cookie": cookie(CCOOKIE, "", 0, req) });

  const email = customerEmail(req);
  if (!email) return err(401, "Please sign in with your email.");
  const mine = await handoversForEmail(S, email);
  if (!mine.length) return err(401, "Please sign in with your email.");
  const chosen = (id) => (id ? mine.find((h) => h.id === id) : mine[0]);

  if (parts[0] === "me" && m === "GET") {
    const settings = (await S.s.get("pack", { type: "json" })) || {};
    return json({ email, handovers: mine.map(portalView), settings });
  }
  if (parts[0] === "questionnaire" && m === "POST") {
    const b = clean(await body(req));
    const h = chosen(b.id);
    if (!h) return err(404, "Not found");
    const answers = b.answers && typeof b.answers === "object" ? b.answers : {};
    h.questionnaire = { answers, submittedAt: Date.now(), source: "customer" };
    h.updatedAt = Date.now(); h.updatedBy = "Customer";
    await S.h.setJSON(h.id, h);
    return json({ ok: true, questionnaire: h.questionnaire });
  }
  if (parts[0] === "appliances" && m === "PUT") {
    const b = clean(await body(req));
    const h = chosen(b.id);
    if (!h) return err(404, "Not found");
    h.appliances = cleanAppliances(b); h.updatedAt = Date.now(); h.updatedBy = "Customer";
    await S.h.setJSON(h.id, h);
    return json({ ok: true, appliances: h.appliances });
  }
  if (parts[0] === "files" && parts[1] && m === "GET") {
    if (!FID_RE.test(parts[1])) return err(404, "Not found");
    for (const h of mine) {
      const meta = (h.files || []).find((f) => f.id === parts[1]);
      if (meta) {
        const buf = await S.f.get(h.id + "/" + meta.id, { type: "arrayBuffer" });
        if (!buf) return err(404, "File not found");
        return fileResponse(Buffer.from(buf), meta);
      }
    }
    return err(404, "File not found");
  }
  return err(404, "Not found");
}
