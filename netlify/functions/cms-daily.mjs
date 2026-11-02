// Every night at 00:05 Singapore time: if a blog post is scheduled for today, rebuild the site so it goes live.
// (Also keeps the free Supabase project awake, since it is asked something every day.)
import { env, missing, supa, triggerBuild } from "../lib/cms.mjs";

export const config = { schedule: "5 16 * * *" };   // 16:05 UTC = 00:05 SGT

export default async () => {
  if (missing("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NETLIFY_BUILD_HOOK").length) return;
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const r = await supa(`/rest/v1/cms_posts?select=slug&status=eq.published&published=eq.${today}`);
  if (Array.isArray(r.data) && r.data.length) await triggerBuild(`Scheduled posts for ${today}`);
};
