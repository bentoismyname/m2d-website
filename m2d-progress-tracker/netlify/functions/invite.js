// /.netlify/functions/invite — emails a homeowner a "set your password" invite.
// Uses the older function style on purpose: only that style gets Netlify Identity's admin token.
exports.handler = async (event, context) => {
  const cc = context.clientContext || {};
  const roles = (cc.user && cc.user.app_metadata && cc.user.app_metadata.roles) || [];
  if (!cc.user) return { statusCode: 401, body: JSON.stringify({ error: "Please log in" }) };
  if (!roles.includes("designer") && !roles.includes("admin")) return { statusCode: 403, body: JSON.stringify({ error: "Only designers can invite homeowners" }) };
  let email = "";
  try { email = String(JSON.parse(event.body || "{}").email || "").trim().toLowerCase(); } catch (e) {}
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { statusCode: 400, body: JSON.stringify({ error: "Check the homeowner's email" }) };
  const r = await fetch(cc.identity.url + "/invite", {
    method: "POST",
    headers: { Authorization: "Bearer " + cc.identity.token, "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  // 422 means they already have an account or invite, which is fine.
  const ok = r.ok || r.status === 422;
  return { statusCode: ok ? 200 : 502, body: JSON.stringify(ok ? { invited: r.ok, existing: r.status === 422 } : { error: "Invite email couldn't be sent" }) };
};
