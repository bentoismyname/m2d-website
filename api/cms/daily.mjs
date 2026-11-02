// Vercel cron (see vercel.json): every night at 00:05 Singapore time, publish blog posts scheduled for today.
// Same code as the Netlify scheduled function. Vercel signs cron calls with CRON_SECRET when that is set.
import run from "../../netlify/functions/cms-daily.mjs";
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  await run();
  return new Response("ok");
}
