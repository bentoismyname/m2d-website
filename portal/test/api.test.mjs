// Run with:  npm test   (node --test, no extra packages)
// Uses in-memory stores through the globalThis.__M2D_STORES__ hook, so nothing touches Netlify.
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long-xx";
process.env.TEAM_PASSCODE = "open-sesame";
delete process.env.RESEND_API_KEY;

class MemStore {
  constructor() { this.m = new Map(); }
  async get(key, opts = {}) {
    if (!this.m.has(key)) return null;
    const v = this.m.get(key);
    if (opts.type === "json") return JSON.parse(v);
    if (opts.type === "arrayBuffer") return v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : new TextEncoder().encode(v).buffer;
    return v;
  }
  async set(key, value) { this.m.set(key, value instanceof ArrayBuffer ? new Uint8Array(value) : value); }
  async setJSON(key, value) { this.m.set(key, JSON.stringify(value)); }
  async delete(key) { this.m.delete(key); }
  async list() { return { blobs: [...this.m.keys()].map((key) => ({ key })) }; }
}
function freshStores() {
  return { h: new MemStore(), t: new MemStore(), s: new MemStore(), d: new MemStore(), p: new MemStore(), f: new MemStore(), o: new MemStore(), r: new MemStore() };
}

let handler, logs = [];
before(async () => {
  handler = (await import("../netlify/functions/api.mjs")).default;
  const orig = console.log; console.log = (...a) => { logs.push(a.join(" ")); orig(...a); };
});
beforeEach(() => { globalThis.__M2D_STORES__ = freshStores(); logs = []; });

// tiny client that keeps cookies, like a browser
function client() {
  const jar = {};
  async function call(method, path, body, extra = {}) {
    const headers = { cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; "), ...(extra.headers || {}) };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await handler(new Request("https://portal.test" + path, { method, headers, body: payload }));
    const sc = res.headers.get("set-cookie");
    if (sc) { const [kv] = sc.split(";"); const [k, v] = kv.split("="); if (v) jar[k] = v; else delete jar[k]; }
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json() : res;
    return { status: res.status, data, res };
  }
  return { call, jar };
}

test("legacy passcode login still works and old desk routes behave the same", async () => {
  const c = client();
  assert.equal((await c.call("GET", "/api/handovers")).status, 401);
  assert.equal((await c.call("POST", "/api/login", { passcode: "wrong" })).status, 401);
  const login = await c.call("POST", "/api/login", { passcode: "open-sesame" });
  assert.equal(login.status, 200);
  assert.ok(c.jar.m2d_s, "session cookie set");
  const me = await c.call("GET", "/api/me");
  assert.equal(me.data.user.role, "admin");
  assert.equal(me.data.needsSetup, true);
  const created = await c.call("POST", "/api/handovers", { customer: { name: "Tan family", address: "Blk 1" }, status: "progress" });
  assert.equal(created.status, 201);
  assert.match(created.data.id, /^h[a-z0-9]+$/);
  assert.match(created.data.token, /^[A-Za-z0-9_-]{20,40}$/);
  const list = await c.call("GET", "/api/handovers");
  assert.equal(list.data.length, 1);
  const patched = await c.call("PATCH", "/api/handovers/" + created.data.id, { checks: { living_main_door: true }, defects: [{ text: "scratch", done: false }] });
  assert.equal(patched.data.checks.living_main_door, true);
  assert.equal(patched.data.updatedBy, "Team passcode");
  const settings = await c.call("PUT", "/api/settings", { warranty: "12 months", phone: "9822 1113", email: "x@y.z", website: "m2decor.com.sg" });
  assert.equal(settings.data.warranty, "12 months");
  const reset = await c.call("POST", "/api/handovers/" + created.data.id + "/reset-link");
  assert.notEqual(reset.data.token, created.data.token);
  const out = await c.call("POST", "/api/logout");
  assert.equal(out.status, 200);
  assert.equal((await c.call("GET", "/api/handovers")).status, 401);
});

test("designer accounts: admin creates one, designer logs in with email+password, cannot manage accounts", async () => {
  const admin = client();
  await admin.call("POST", "/api/login", { passcode: "open-sesame" });
  const bad = await admin.call("POST", "/api/designers", { name: "Leon", email: "leon@m2d.sg", password: "short" });
  assert.equal(bad.status, 400);
  const made = await admin.call("POST", "/api/designers", { name: "Leon Yap", email: "Leon@M2D.sg", password: "correct horse battery", role: "designer" });
  assert.equal(made.status, 201);
  assert.equal(made.data.email, "leon@m2d.sg");
  assert.equal(made.data.passwordHash, undefined, "hash never returned");
  const dup = await admin.call("POST", "/api/designers", { name: "Leon again", email: "leon@m2d.sg", password: "correct horse battery" });
  assert.equal(dup.status, 409);

  const leon = client();
  assert.equal((await leon.call("POST", "/api/login", { email: "leon@m2d.sg", password: "nope" })).status, 401);
  const ok = await leon.call("POST", "/api/login", { email: "leon@m2d.sg", password: "correct horse battery" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, "designer");
  const me = await leon.call("GET", "/api/me");
  assert.equal(me.data.user.name, "Leon Yap");
  assert.equal((await leon.call("GET", "/api/designers")).status, 403);
  const h = await leon.call("POST", "/api/handovers", { customer: { name: "Lim" } });
  assert.equal(h.data.createdBy, "Leon Yap");

  // deactivated designer is signed out on the next request
  const off = await admin.call("DELETE", "/api/designers/" + made.data.id);
  assert.equal(off.status, 204);
  assert.equal((await leon.call("GET", "/api/me")).status, 401);
  // admin cannot deactivate themself
  const adminAcct = await admin.call("POST", "/api/designers", { name: "Ben", email: "ben@m2d.sg", password: "benjamin-secret-1", role: "admin" });
  const ben = client();
  await ben.call("POST", "/api/login", { email: "ben@m2d.sg", password: "benjamin-secret-1" });
  assert.equal((await ben.call("DELETE", "/api/designers/" + adminAcct.data.id)).status, 400);
});

test("work schedule: designer saves stages, public link shows stages without notes", async () => {
  const c = client();
  await c.call("POST", "/api/login", { passcode: "open-sesame" });
  const h = (await c.call("POST", "/api/handovers", { customer: { name: "Ong" } })).data;
  const sched = { stages: [
    { id: "found", name: "Foundation works", start: "2026-11-10", end: "2026-11-28", status: "progress", notes: "Tiler delayed by 2 days" },
    { name: "Fitting", start: "2026-12-01", end: "2026-12-20", status: "bogus" },
  ] };
  const p = await c.call("PATCH", "/api/handovers/" + h.id, { schedule: sched });
  assert.equal(p.data.schedule.stages.length, 2);
  assert.equal(p.data.schedule.stages[0].notes, "Tiler delayed by 2 days");
  assert.equal(p.data.schedule.stages[1].status, "planned", "unknown status falls back to planned");
  assert.match(p.data.schedule.stages[1].id, /^s[0-9a-f]{6}$/);
  // replacing the schedule drops stages that were removed (not merged)
  const p2 = await c.call("PATCH", "/api/handovers/" + h.id, { schedule: { stages: [sched.stages[0]] } });
  assert.equal(p2.data.schedule.stages.length, 1);

  const anon = client();
  const pub = await anon.call("GET", "/api/public/" + h.token);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.handover.schedule.stages[0].name, "Foundation works");
  assert.equal(pub.data.handover.schedule.stages[0].notes, undefined, "notes stripped");
  assert.equal(pub.data.handover.customer.phone, undefined);
  assert.equal(pub.data.handover.token, undefined);
  assert.equal((await anon.call("GET", "/api/public/not-a-real-token-xxxxxxxx")).status, 404);
});

test("intake: prospect questionnaire is stored without login, designer converts it to a handover", async () => {
  const anon = client();
  const empty = await anon.call("POST", "/api/intake", { Property: "HDB BTO" });
  assert.equal(empty.status, 400, "needs some contact detail");
  const sent = await anon.call("POST", "/api/intake", { answers: { Property: "HDB BTO", Layout: "4-room", Budget: "$50–80k", Name: "Siti" }, contact: { phone: "9123 4567", email: "Siti@Example.com", address: "Blk 2 Tampines" } });
  assert.equal(sent.status, 201);
  assert.equal((await anon.call("GET", "/api/prospects")).status, 401);

  const c = client();
  await c.call("POST", "/api/login", { passcode: "open-sesame" });
  const list = await c.call("GET", "/api/prospects");
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].status, "new");
  assert.equal(list.data[0].contact.email, "siti@example.com");
  await c.call("PATCH", "/api/prospects/" + sent.data.id, { status: "contacted", notes: "Called, meeting Sat" });
  const conv = await c.call("POST", "/api/prospects/" + sent.data.id + "/convert");
  assert.equal(conv.status, 201);
  assert.equal(conv.data.customer.name, "Siti");
  assert.equal(conv.data.customer.address, "Blk 2 Tampines");
  assert.equal(conv.data.questionnaire.answers.Budget, "$50–80k");
  assert.equal((await c.call("POST", "/api/prospects/" + sent.data.id + "/convert")).status, 409);
  const pr = await c.call("GET", "/api/prospects/" + sent.data.id);
  assert.equal(pr.data.status, "converted");
  assert.equal(pr.data.handoverId, conv.data.id);
});

test("customer OTP login: sees only own records, can save questionnaire and appliances", async () => {
  const c = client();
  await c.call("POST", "/api/login", { passcode: "open-sesame" });
  const a = (await c.call("POST", "/api/handovers", { customer: { name: "Alice", email: "alice@example.com", phone: "9111" }, notes: "internal: budget tight" })).data;
  const b = (await c.call("POST", "/api/handovers", { customer: { name: "Bob", email: "bob@example.com" } })).data;

  const alice = client();
  assert.equal((await alice.call("GET", "/api/portal/me")).status, 401);
  // unknown email: same 200, no code logged
  assert.equal((await alice.call("POST", "/api/portal/request-code", { email: "nobody@example.com" })).status, 200);
  assert.equal(logs.filter((l) => l.includes("sign-in code")).length, 0);
  assert.equal((await alice.call("POST", "/api/portal/request-code", { email: "Alice@Example.com" })).status, 200);
  const line = logs.find((l) => l.includes("sign-in code for alice@example.com"));
  assert.ok(line, "code logged when no email provider is set");
  const code = line.match(/: (\d{6})$/)[1];
  assert.equal((await alice.call("POST", "/api/portal/verify", { email: "alice@example.com", code: "000000" })).status, 401);
  const v = await alice.call("POST", "/api/portal/verify", { email: "alice@example.com", code });
  assert.equal(v.status, 200);
  assert.ok(alice.jar.m2d_c);
  assert.equal(alice.jar.m2d_s, undefined, "customer cookie is separate from the designer cookie");
  // code is single-use
  assert.equal((await alice.call("POST", "/api/portal/verify", { email: "alice@example.com", code })).status, 401);

  const me = await alice.call("GET", "/api/portal/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.handovers.length, 1);
  assert.equal(me.data.handovers[0].id, a.id);
  assert.equal(me.data.handovers[0].customer.email, undefined, "customer page never shows email");
  assert.equal(me.data.handovers[0].notes, undefined, "internal notes hidden");
  assert.equal(me.data.handovers[0].token, undefined);
  assert.equal(JSON.stringify(me.data).includes(b.id), false, "Bob's record is not visible to Alice");

  // customer can't reach designer routes with the customer cookie
  assert.equal((await alice.call("GET", "/api/handovers")).status, 401);
  assert.equal((await alice.call("GET", "/api/handovers/" + b.id)).status, 401);

  const q = await alice.call("POST", "/api/portal/questionnaire", { answers: { Cooking: "Heavy cooking", Household: "Couple, Kids" } });
  assert.equal(q.status, 200);
  const app = await alice.call("PUT", "/api/portal/appliances", { items: { kitchen_hob: { buy: true, model: "Bosch PXE" } }, custom: {}, baths: [{ id: "bath1", name: "Master bath" }] });
  assert.equal(app.status, 200);
  const rec = (await c.call("GET", "/api/handovers/" + a.id)).data;
  assert.equal(rec.questionnaire.answers.Cooking, "Heavy cooking");
  assert.equal(rec.questionnaire.source, "customer");
  assert.equal(rec.appliances.items.kitchen_hob.model, "Bosch PXE");
  assert.equal(rec.updatedBy, "Customer");

  // 5 wrong attempts burn the code
  await alice.call("POST", "/api/portal/request-code", { email: "alice@example.com" });
  for (let i = 0; i < 5; i++) await alice.call("POST", "/api/portal/verify", { email: "alice@example.com", code: "123456" });
  const real = logs.filter((l) => l.includes("sign-in code for alice@example.com")).pop().match(/: (\d{6})$/)[1];
  assert.equal((await alice.call("POST", "/api/portal/verify", { email: "alice@example.com", code: real })).status, 401);
  assert.equal((await alice.call("POST", "/api/portal/logout")).status, 200);
  assert.equal((await alice.call("GET", "/api/portal/me")).status, 401);
});

test("files: designer uploads (json + multipart), limits enforced, customer downloads only their own", async () => {
  const c = client();
  await c.call("POST", "/api/login", { passcode: "open-sesame" });
  const a = (await c.call("POST", "/api/handovers", { customer: { name: "Alice", email: "alice@example.com" } })).data;
  const b = (await c.call("POST", "/api/handovers", { customer: { name: "Bob", email: "bob@example.com" } })).data;

  const pdf = Buffer.from("%PDF-1.4 hello");
  const up = await c.call("POST", "/api/handovers/" + a.id + "/files", { name: "Floor plan (final).pdf", type: "application/pdf", data: pdf.toString("base64") });
  assert.equal(up.status, 201);
  assert.equal(up.data.size, pdf.length);
  assert.equal(up.data.type, "application/pdf");
  assert.equal(up.data.uploadedBy, "Team passcode");
  const exe = await c.call("POST", "/api/handovers/" + a.id + "/files", { name: "virus.exe", data: pdf.toString("base64") });
  assert.equal(exe.status, 415);
  const big = await c.call("POST", "/api/handovers/" + a.id + "/files", { name: "big.pdf", data: Buffer.alloc(10 * 1024 * 1024 + 1, 1).toString("base64") });
  assert.equal(big.status, 413);

  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "site photo.png");
  const up2 = await c.call("POST", "/api/handovers/" + b.id + "/files", fd);
  assert.equal(up2.status, 201);
  assert.equal(up2.data.type, "image/png");

  const list = await c.call("GET", "/api/handovers/" + a.id + "/files");
  assert.equal(list.data.length, 1);
  const dl = await c.call("GET", "/api/handovers/" + a.id + "/files/" + up.data.id);
  assert.equal(dl.status, 200);
  assert.match(dl.res.headers.get("content-disposition"), /attachment; filename="Floor plan \(final\)\.pdf"/);
  assert.equal(Buffer.from(await dl.res.arrayBuffer()).toString(), "%PDF-1.4 hello");

  // Alice logs in and can download hers but not Bob's
  const alice = client();
  await alice.call("POST", "/api/portal/request-code", { email: "alice@example.com" });
  const code = logs.find((l) => l.includes("alice@example.com")).match(/: (\d{6})$/)[1];
  await alice.call("POST", "/api/portal/verify", { email: "alice@example.com", code });
  const me = await alice.call("GET", "/api/portal/me");
  assert.equal(me.data.handovers[0].files.length, 1);
  assert.equal(me.data.handovers[0].files[0].uploadedBy, undefined, "uploader name not shown to customer");
  assert.equal((await alice.call("GET", "/api/portal/files/" + up.data.id)).status, 200);
  assert.equal((await alice.call("GET", "/api/portal/files/" + up2.data.id)).status, 404);

  // delete removes bytes and metadata; deleting the handover removes its files too
  assert.equal((await c.call("DELETE", "/api/handovers/" + a.id + "/files/" + up.data.id)).status, 204);
  assert.equal((await c.call("GET", "/api/handovers/" + a.id + "/files/" + up.data.id)).status, 404);
  assert.equal((await c.call("DELETE", "/api/handovers/" + b.id)).status, 204);
  assert.equal(globalThis.__M2D_STORES__.f.m.size, 0, "no orphan file bytes");
});

test("hardening: prototype keys ignored, oversize JSON rejected, rate limit trips", async () => {
  const c = client();
  await c.call("POST", "/api/login", { passcode: "open-sesame" });
  const h = (await c.call("POST", "/api/handovers", { customer: { name: "X" } })).data;
  const p = await c.call("PATCH", "/api/handovers/" + h.id, { checks: { __proto__: { polluted: true }, ok: true }, files: [{ id: "fake" }], token: "stolen" });
  assert.equal(p.data.checks.ok, true);
  assert.equal(({}).polluted, undefined);
  assert.equal(p.data.files.length, 0, "files cannot be set through PATCH");
  assert.equal(p.data.token, h.token, "token cannot be changed through PATCH");
  const huge = await c.call("PATCH", "/api/handovers/" + h.id, { notes: "x".repeat(301 * 1024) });
  assert.equal(huge.status, 413);
  const anon = client();
  let last;
  for (let i = 0; i < 21; i++) last = await anon.call("POST", "/api/intake", { contact: { name: "n" } }, { headers: { "x-forwarded-for": "1.2.3.4" } });
  assert.equal(last.status, 429);
});
