// POST /api/cms/users: team accounts, for the owner only.
// actions: list | create {email, password, name, role} | update {email, role, name} | password {email, password} | remove {email}
import { json, missing, supa, whoIs } from "../lib/cms.mjs";

export const config = { path: "/api/cms/users" };
const ROLES = ["owner", "editor", "writer"];
const okPassword = p => typeof p === "string" && p.length >= 10;
const authUsers = async () => ((await supa("/auth/v1/admin/users?per_page=1000")).data?.users) || [];

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (missing("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY").length) return json({ error: "Team accounts are not set up yet (see CMS-SETUP.md)." }, 500);
  const me = await whoIs(req);
  if (me.error) return json({ error: me.error }, me.status);
  if (me.role !== "owner") return json({ error: "Only the owner can manage team accounts." }, 403);

  let b = {}; try { b = await req.json(); } catch {}
  const email = String(b.email || "").trim().toLowerCase();
  const role = ROLES.includes(b.role) ? b.role : "writer";

  if (b.action === "list") {
    const [rows, users] = await Promise.all([supa("/rest/v1/cms_users?select=email,name,role,added_at&order=added_at"), authUsers()]);
    const byEmail = Object.fromEntries(users.map(u => [String(u.email || "").toLowerCase(), u]));
    return json({ users: (rows.data || []).map(r => ({ ...r, hasLogin: !!byEmail[r.email.toLowerCase()], lastSignIn: byEmail[r.email.toLowerCase()]?.last_sign_in_at || null })) });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email." }, 400);

  if (b.action === "create") {
    if (!okPassword(b.password)) return json({ error: "The password needs at least 10 characters." }, 400);
    const existing = (await authUsers()).find(u => String(u.email || "").toLowerCase() === email);
    if (!existing) {
      const r = await supa("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password: b.password, email_confirm: true }) });
      if (!r.ok) return json({ error: r.data?.msg || r.data?.message || "Could not create the sign-in." }, 400);
    }
    const up = await supa("/rest/v1/cms_users", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ email, name: b.name || "", role }) });
    if (!up.ok) return json({ error: "The sign-in was made but the role could not be saved." }, 400);
    return json({ ok: true, message: existing ? "Added to the team (this email already had a sign-in)." : "Account created." });
  }
  if (b.action === "update") {
    if (email === me.email && role !== "owner") return json({ error: "You cannot remove your own owner role." }, 400);
    const r = await supa(`/rest/v1/cms_users?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify({ role, ...(b.name !== undefined ? { name: b.name } : {}) }) });
    return r.ok ? json({ ok: true }) : json({ error: "Could not update." }, 400);
  }
  if (b.action === "password") {
    if (!okPassword(b.password)) return json({ error: "The password needs at least 10 characters." }, 400);
    const u = (await authUsers()).find(x => String(x.email || "").toLowerCase() === email);
    if (!u) return json({ error: "That person has no sign-in yet." }, 404);
    const r = await supa(`/auth/v1/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ password: b.password }) });
    return r.ok ? json({ ok: true, message: "Password changed." }) : json({ error: "Could not change the password." }, 400);
  }
  if (b.action === "remove") {
    if (email === me.email) return json({ error: "You cannot remove your own account." }, 400);
    await supa(`/rest/v1/cms_users?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
    const u = (await authUsers()).find(x => String(x.email || "").toLowerCase() === email);
    if (u) await supa(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
    return json({ ok: true, message: "Removed." });
  }
  return json({ error: "Unknown action." }, 400);
};
