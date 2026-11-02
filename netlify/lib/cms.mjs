// Shared helpers for the CMS functions (not a function itself).
// Used by the Netlify functions (netlify/functions) and the Vercel functions (api/cms).
// Environment (Netlify: Site configuration > Environment variables; Vercel: Settings > Environment Variables):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and the build hook as
//   NETLIFY_BUILD_HOOK (Netlify) or VERCEL_DEPLOY_HOOK (Vercel)
export const env = name => (globalThis.Netlify?.env?.get(name)) || process.env[name] || "";
export const missing = (...names) => names.filter(n => !env(n));

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Supabase REST with the service key (server side only, never sent to the browser)
export async function supa(path, opts = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(env("SUPABASE_URL").replace(/\/$/, "") + path, { ...opts, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

// Who is calling, and what is their role on the M2D team?
export async function whoIs(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Please sign in.", status: 401 };
  const r = await fetch(env("SUPABASE_URL").replace(/\/$/, "") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${token}` } });
  if (!r.ok) return { error: "Your session has expired. Please sign in again.", status: 401 };
  const user = await r.json();
  const email = String(user.email || "").toLowerCase();
  const row = await supa(`/rest/v1/cms_users?select=email,name,role&email=ilike.${encodeURIComponent(email)}`);
  const me = Array.isArray(row.data) && row.data[0];
  if (!me) return { error: `${email} is not on the M2D team list.`, status: 403 };
  return { email, role: me.role, name: me.name, userId: user.id };
}

// The URL that starts a new build of the site (Netlify build hook or Vercel deploy hook)
export const buildHook = () => env("NETLIFY_BUILD_HOOK") || env("VERCEL_DEPLOY_HOOK") || env("BUILD_HOOK");

// Start a build (pulls the CMS content, rebuilds the site, deploys it)
export async function triggerBuild(title) {
  const hook = buildHook();
  const url = hook.includes("api.netlify.com") ? hook + (hook.includes("?") ? "&" : "?") + "trigger_title=" + encodeURIComponent(title) : hook;
  const r = await fetch(url, { method: "POST" });
  return r.ok;
}
