// Vercel: POST /api/portal/users — portal accounts, for the admin only.
// actions: list | create {email, password, name, role} | update {user_id, role, name} | password {user_id, password} | remove {user_id}
// Clients never need an account made here: they sign in at /my with a code sent to the email on their project.
import { env, json, missing, supa } from "../../netlify/lib/cms.mjs";

const ROLES = ["admin", "designer", "supervisor"];
const okPassword = p => typeof p === "string" && p.length >= 10;

async function whoIs(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Please sign in.", status: 401 };
  const r = await fetch(env("SUPABASE_URL").replace(/\/$/, "") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  if (!r.ok) return { error: "Your session has expired. Please sign in again.", status: 401 };
  const user = await r.json();
  const email = String(user.email || "").toLowerCase();
  const row = await supa(`/rest/v1/portal_users?select=role&user_id=eq.${user.id}`);
  let role = Array.isArray(row.data) && row.data[0] && row.data[0].role;
  if (!role) { const c = await supa(`/rest/v1/cms_users?select=role&email=ilike.${encodeURIComponent(email)}`); if (Array.isArray(c.data) && c.data[0] && c.data[0].role === "owner") role = "admin"; }
  return { email, role: role || "client", userId: user.id };
}

async function handler(req) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (missing("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY").length) return json({ error: "Portal accounts are not set up yet: the Supabase keys are missing in the hosting settings." }, 500);
  const me = await whoIs(req);
  if (me.error) return json({ error: me.error }, me.status);
  if (me.role !== "admin") return json({ error: "Only the admin can manage accounts." }, 403);

  let b = {}; try { b = await req.json(); } catch {}
  const role = ROLES.includes(b.role) ? b.role : "designer";

  if (b.action === "list") {
    const rows = await supa("/rest/v1/portal_users?select=user_id,email,name,role,created_at&role=neq.client&order=created_at");
    return json({ users: rows.data || [] });
  }
  if (b.action === "create") {
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email." }, 400);
    if (!okPassword(b.password)) return json({ error: "The password needs at least 10 characters." }, 400);
    const existing = ((await supa("/auth/v1/admin/users?per_page=1000")).data?.users || []).find(u => String(u.email || "").toLowerCase() === email);
    let id = existing && existing.id;
    if (!id) {
      const r = await supa("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password: b.password, email_confirm: true, user_metadata: { name: b.name || "" } }) });
      if (!r.ok) return json({ error: r.data?.msg || r.data?.message || "Could not create the sign-in." }, 400);
      id = r.data.id;
    }
    const up = await supa("/rest/v1/portal_users", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: id, email, name: b.name || "", role }) });
    if (!up.ok) return json({ error: "The sign-in was made but the role could not be saved." }, 400);
    return json({ ok: true, message: existing ? "Added to the team (this email already had a sign-in)." : "Account created." });
  }
  if (b.action === "update") {
    if (!b.user_id) return json({ error: "Missing account." }, 400);
    if (b.user_id === me.userId && role !== "admin") return json({ error: "You cannot remove your own admin role." }, 400);
    const r = await supa(`/rest/v1/portal_users?user_id=eq.${encodeURIComponent(b.user_id)}`, { method: "PATCH", body: JSON.stringify({ role, ...(b.name !== undefined ? { name: b.name } : {}) }) });
    return r.ok ? json({ ok: true }) : json({ error: "Could not update." }, 400);
  }
  if (b.action === "password") {
    if (!okPassword(b.password)) return json({ error: "The password needs at least 10 characters." }, 400);
    const r = await supa(`/auth/v1/admin/users/${encodeURIComponent(b.user_id)}`, { method: "PUT", body: JSON.stringify({ password: b.password }) });
    return r.ok ? json({ ok: true, message: "Password changed." }) : json({ error: "Could not change the password." }, 400);
  }
  if (b.action === "remove") {
    if (b.user_id === me.userId) return json({ error: "You cannot remove your own account." }, 400);
    await supa(`/rest/v1/portal_users?user_id=eq.${encodeURIComponent(b.user_id)}`, { method: "DELETE" });
    await supa(`/auth/v1/admin/users/${encodeURIComponent(b.user_id)}`, { method: "DELETE" });
    return json({ ok: true, message: "Removed." });
  }
  return json({ error: "Unknown action." }, 400);
}

export const POST = req => handler(req);
export const GET = req => handler(req);
