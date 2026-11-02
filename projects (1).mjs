// /api/projects — list, read and update renovation projects.
import { json, who, canView, canEdit, projects, getProject, putProject, newProject, newStage, applyStagePatch, uid, normalize } from "../lib/shared.mjs";

export const config = { path: "/api/projects" };

export default async (req) => {
  const me = await who(req);
  if (!me) return json(401, { error: "Please log in" });

  if (req.method === "GET") {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const p = await getProject(id);
      if (!p || !canView(p, me)) return json(404, { error: "Project not found" });
      return json(200, p);
    }
    const { blobs } = await projects().list({ prefix: "p/" });
    const all = await Promise.all(blobs.map(b => projects().get(b.key, { type: "json" }).then(normalize)));
    return json(200, all.filter(p => p && canView(p, me)));
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: "Bad request" }); }

  if (body.action === "create") {
    if (me.role === "client") return json(403, { error: "Only designers can create projects" });
    if (!body.name || !body.clientEmail) return json(400, { error: "Project name and homeowner email are needed" });
    const p = newProject({
      ...body,
      designerEmail: me.role === "admin" && body.designerEmail ? body.designerEmail : me.email,
      designerName: me.role === "admin" && body.designerName ? body.designerName : me.name
    });
    await putProject(p);
    return json(200, p);
  }

  const p = await getProject(body.id);
  if (!p || !canView(p, me)) return json(404, { error: "Project not found" });
  if (!canEdit(p, me)) return json(403, { error: "Only the project's designer can make changes" });

  if (body.action === "stage") {
    if (!applyStagePatch(p, body.stageId, body.patch || {})) return json(404, { error: "Stage not found" });
  } else if (body.action === "addStage") {
    const s = newStage("c" + uid(), String(body.name || "New stage").slice(0, 120), body.phase); s.custom = true;
    p.stages.push(s); p.updatedAt = new Date().toISOString();
  } else if (body.action === "removeStage") {
    p.stages = p.stages.filter(s => s.id !== body.stageId || !s.custom); p.updatedAt = new Date().toISOString();
  } else return json(400, { error: "Unknown action" });

  await putProject(p);
  return json(200, p);
};
