// Vercel: POST /api/cms/users (team accounts, owner only). Same code as the Netlify function.
import handler from "../../netlify/functions/cms-users.mjs";
export const POST = req => handler(req);
export const GET = req => handler(req);
