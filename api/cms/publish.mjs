// Vercel: POST /api/cms/publish. Same code as the Netlify function.
import handler from "../../netlify/functions/cms-publish.mjs";
export const POST = req => handler(req);
export const GET = req => handler(req);
