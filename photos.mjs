// /api/photos — site photos per stage. Only the project's designer can add or remove; designer and homeowner can view.
import { json, who, canView, canEdit, photos, getProject, putProject, uid } from "../lib/shared.mjs";

export const config = { path: "/api/photos" };

export default async (req) => {
  const me = await who(req);
  if (!me) return json(401, { error: "Please log in" });

  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const p = await getProject(q.get("id"));
    if (!p || !canView(p, me)) return json(404, { error: "Not found" });
    const r = await photos().getWithMetadata(p.id + "/" + q.get("photo"), { type: "arrayBuffer" });
    if (!r) return json(404, { error: "Not found" });
    return new Response(r.data, { headers: { "Content-Type": r.metadata.type || "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: "Bad request" }); }
  const p = await getProject(body.id);
  if (!p || !canView(p, me)) return json(404, { error: "Project not found" });
  if (!canEdit(p, me)) return json(403, { error: "Only the project's designer can change photos" });
  const s = p.stages.find(x => x.id === body.stageId);
  if (!s) return json(404, { error: "Stage not found" });

  if (body.action === "add") {
    const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(body.dataUrl || "");
    if (!m) return json(400, { error: "That file isn't a photo" });
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 4 * 1024 * 1024) return json(413, { error: "Photo is too large" });
    const photoId = uid();
    await photos().set(p.id + "/" + photoId, buf, { metadata: { type: m[1] } });
    s.photos.push({ id: photoId, at: new Date().toISOString() });
  } else if (body.action === "remove") {
    s.photos = s.photos.filter(x => x.id !== body.photoId);
    await photos().delete(p.id + "/" + body.photoId);
  } else return json(400, { error: "Unknown action" });

  s.updatedAt = p.updatedAt = new Date().toISOString();
  await putProject(p);
  return json(200, p);
};
