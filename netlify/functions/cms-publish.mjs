// POST /api/cms/publish: a team member presses "Publish to website".
// Rebuilds the static site from the CMS content through the build hook (Netlify or Vercel).
import { json, missing, supa, whoIs, triggerBuild, buildHook } from "../lib/cms.mjs";

export const config = { path: "/api/cms/publish" };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (missing("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY").length || !buildHook())
    return json({ error: "Publishing is not set up yet: the website's hosting settings are missing some values (see CMS-SETUP.md)." }, 500);
  const me = await whoIs(req);
  if (me.error) return json({ error: me.error }, me.status);

  // a publish already started in the last minute covers this one too
  const last = await supa("/rest/v1/cms_publishes?select=requested_at&order=requested_at.desc&limit=1");
  const lastAt = Array.isArray(last.data) && last.data[0] ? Date.parse(last.data[0].requested_at) : 0;
  if (Date.now() - lastAt < 60_000) return json({ ok: true, message: "Already publishing. The website updates in about two minutes." });

  const ok = await triggerBuild(`CMS publish by ${me.email}`);
  await supa("/rest/v1/cms_publishes", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ requested_by: me.email, status: ok ? "started" : "failed" }) });
  if (!ok) return json({ error: "The host did not accept the publish request. Check the build hook in the hosting settings." }, 502);
  return json({ ok: true, message: "Publishing. The website updates in about two minutes." });
};
