// M2D Handover Desk API — one Netlify Function serving /api/*
// Storage: Netlify Blobs (no database to set up).
// Designers sign in with one shared team passcode (env TEAM_PASSCODE).
// Homeowners read their own pack through a private link token.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

const COOKIE = "m2d_s";
const SESSION_DAYS = 30;
const MAX_BODY = 300 * 1024;
const ID_RE = /^h[a-z0-9]{6,24}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;
const FIELDS = ["customer", "handoverDate", "designer", "notes", "status", "checks", "defects", "contacts", "places", "finishAreas", "signoff"];
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function stores() {
  if (globalThis.__M2D_STORES__) return globalThis.__M2D_STORES__; // tests
  return {
    h: getStore({ name: "handovers", consistency: "strong" }),
    t: getStore({ name: "tokens", consistency: "strong" }),
    s: getStore({ name: "settings", consistency: "strong" }),
  };
}

function env(name) {
  return (globalThis.Netlify && Netlify.env && Netlify.env.get(name)) || process.env[name] || "";
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const err = (status, message) => json({ error: message }, status);

/* ---------- Sessions ---------- */
function secret() {
  const s = env("SESSION_SECRET");
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or shorter than 16 characters");
  return s;
}
function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}
function makeSession() {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  // The passcode fingerprint ties sessions to the current passcode: changing it signs everyone out.
  const pv = crypto.createHash("sha256").update(env("TEAM_PASSCODE")).digest("base64url").slice(0, 10);
  const payload = exp + "." + pv;
  return payload + "." + sign(payload);
}
function validSession(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return false;
  const parts = decodeURIComponent(m[1]).split(".");
  if (parts.length !== 3) return false;
  const payload = parts[0] + "." + parts[1];
  const good = sign(payload);
  if (good.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(parts[2]))) return false;
  if (+parts[0] < Date.now()) return false;
  const pv = crypto.createHash("sha256").update(env("TEAM_PASSCODE")).digest("base64url").slice(0, 10);
  return parts[1] === pv;
}
function cookie(value, maxAge, req) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function samePass(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* ---------- Helpers ---------- */
async function body(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 });
  try { return text ? JSON.parse(text) : {}; } catch { throw Object.assign(new Error("bad json"), { status: 400 }); }
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
  return o;
}
const newId = () => "h" + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
const newToken = () => crypto.randomBytes(18).toString("base64url");

async function allHandovers(S) {
  const { blobs } = await S.h.list();
  const rows = await Promise.all(blobs.map((b) => S.h.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
function publicView(h) {
  const c = h.customer || {};
  return {
    customer: { name: c.name || "", address: c.address || "" },
    handoverDate: h.handoverDate || "", designer: h.designer || "",
    checks: h.checks || {}, defects: (h.defects || []).filter((d) => d && d.text),
    contacts: h.contacts || {}, places: h.places || {}, finishAreas: h.finishAreas || [], signoff: h.signoff || {},
  };
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

  // Homeowner view: no login, just the private token
  if (parts[0] === "public" && parts[1] && m === "GET") {
    if (!TOKEN_RE.test(parts[1])) return err(404, "Link not found");
    const ref = await S.t.get(parts[1], { type: "json" });
    if (!ref) return err(404, "Link not found");
    const h = await S.h.get(ref.id, { type: "json" });
    if (!h || h.token !== parts[1]) return err(404, "Link not found");
    const settings = (await S.s.get("pack", { type: "json" })) || {};
    return json({ handover: publicView(h), settings });
  }

  if (parts[0] === "login" && m === "POST") {
    const pass = env("TEAM_PASSCODE");
    if (!pass) return err(500, "TEAM_PASSCODE is not set on the server.");
    const b = await body(req);
    if (!samePass(b.passcode || "", pass)) {
      await new Promise((r) => setTimeout(r, 700));
      return err(401, "That passcode didn’t work.");
    }
    return json({ ok: true }, 200, { "Set-Cookie": cookie(makeSession(), SESSION_DAYS * 86400, req) });
  }
  if (parts[0] === "logout" && m === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0, req) });
  }

  // Everything below needs a designer session
  if (!validSession(req)) return err(401, "Please sign in.");

  if (parts[0] === "me") return json({ ok: true });

  if (parts[0] === "settings") {
    if (m === "GET") return json((await S.s.get("pack", { type: "json" })) || {});
    if (m === "PUT") {
      const b = clean(await body(req));
      const v = { warranty: b.warranty || "", phone: b.phone || "", email: b.email || "", website: b.website || "" };
      await S.s.setJSON("pack", v);
      return json(v);
    }
  }

  if (parts[0] === "handovers") {
    const id = parts[1];
    if (!id) {
      if (m === "GET") return json(await allHandovers(S));
      if (m === "POST") {
        const b = pick(await body(req));
        if (!b.customer || !b.customer.name) return err(400, "Customer name is required.");
        const now = Date.now();
        const rec = { status: "progress", checks: {}, defects: [], contacts: {}, places: {}, finishAreas: [], signoff: {}, ...b, id: newId(), token: newToken(), createdAt: now, updatedAt: now };
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
        rec.token = newToken();
        rec.updatedAt = Date.now();
        await S.h.setJSON(id, rec);
        await S.t.setJSON(rec.token, { id });
        return json(rec);
      }
      if (parts[2]) return err(404, "Not found");
      if (m === "GET") return json(rec);
      if (m === "PATCH") {
        const patch = pick(await body(req));
        merge(rec, patch);
        rec.updatedAt = Date.now();
        await S.h.setJSON(id, rec);
        return json(rec);
      }
      if (m === "DELETE") {
        await S.h.delete(id);
        if (rec.token) await S.t.delete(rec.token);
        return new Response(null, { status: 204 });
      }
    }
  }
  return err(404, "Not found");
}
