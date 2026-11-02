# M2D Client Portal

Grown from Benjamin's **Handover Desk**. The designer desk and the homeowner link page work exactly as before; the server part now also supports designer accounts, a work schedule per customer, the website questionnaire, the appliance checklist, customer files and a customer sign-in.

- **Designer desk** – `https://<your-site>/` – designers sign in with their own email and password (the team passcode still works for now)
- **Homeowner page** – `https://<your-site>/h/<private-link>` – view-only, with Save as PDF
- **Customer portal** – sign in with email + a one-time code to see the work schedule, fill the questionnaire and appliance list, and download files *(front end still to be built; the API is ready, see `API.md`)*
- **Prospect questionnaire** – the website's "Before we meet" form posts to `/api/intake` *(wiring still to be done)*

Each customer record has:
1. **Handover record** – checklist, defects, sign-off
2. **Home care pack** – project contacts, home quick reference, material finishes by area, maintenance schedule, care guides, warranty
3. **Work schedule** – stages with dates and status, visible to the customer (internal notes stay private)
4. **Questionnaire answers**, **appliance list** and **files** (drawings, quotes, photos)

Records are stored in Netlify Blobs, which is built into Netlify. There is no database to set up.

---

## 1. Put it on Netlify (one time, about 15 minutes)

> Netlify Drop (drag-and-drop) **won't work** for this site, because it has a server part. Use one of the two ways below.

### Option A – Netlify CLI (quickest)
On your computer, in this folder:

```bash
npm install
npx netlify-cli login            # opens the browser to sign in to Netlify
npx netlify-cli sites:create --name m2d-portal
npx netlify-cli deploy --prod
```

### Option B – GitHub (best if you'll keep improving it)
1. Create a **private** GitHub repo and upload this folder (without `node_modules`).
2. In Netlify: **Add new site → Import an existing project → GitHub**, then pick the repo. The settings come from `netlify.toml`, so just press Deploy.
3. Every change pushed to GitHub redeploys the site automatically.

## 2. Set the environment variables

In Netlify, go to **Site configuration → Environment variables** and add:

| Key | Required | Value |
|---|---|---|
| `SESSION_SECRET` | yes | A random string of at least 32 characters. Make one with `openssl rand -base64 32`, or mash the keyboard |
| `TEAM_PASSCODE` | at first | The shared passcode. Needed to sign in before any designer accounts exist |
| `RESEND_API_KEY` | for customer sign-in | An API key from [resend.com](https://resend.com) (free tier is enough). Without it, customer sign-in codes are only written to the function log |
| `MAIL_FROM` | with Resend | e.g. `M2D <no-reply@m2decor.com.sg>`. The domain must be verified in Resend |

Then go to **Deploys → Trigger deploy → Deploy site** so the new values take effect.

## 3. Create the first admin account

1. Open the site and sign in with the **team passcode**.
2. Create an account for yourself with role **admin** (`POST /api/designers`, or the Accounts screen once the front end has it), then sign out and sign back in with your email and password.
3. Create one account per designer (role **designer**). Designers can do everything in the desk except manage accounts.
4. When everyone has an account, **remove `TEAM_PASSCODE`** in Netlify and redeploy. From then on only email + password works.

To remove a designer who leaves: deactivate their account. They are signed out immediately and can't sign back in. Every record keeps `updatedBy`, so you can still see who changed what.

## 4. Use your company address (optional)

To open it at `portal.m2decor.com.sg`:
1. In Netlify, go to **Domain management → Add a domain** and enter `portal.m2decor.com.sg`.
2. Where your domain is managed (your registrar or website host's DNS settings), add a **CNAME** record:
   - Name: `portal`
   - Value: `<your-site-name>.netlify.app`
3. Wait for DNS to update (usually under an hour). Netlify then turns on HTTPS automatically.

Your main website is not touched. This only adds a subdomain.

## 5. First use
1. Click **Company details** and fill in the warranty period, phone/WhatsApp, email and website. These appear on every customer's pack.
2. Click **New handover** for each customer. Fill in the customer's **email**: it is what lets them sign in to the portal.
3. Use **Copy homeowner link** to share the read-only pack by WhatsApp or email. The homeowner always sees the latest version.
4. **New link** replaces a customer's link, for example if it was sent to the wrong person. The old link stops working immediately.

## Good to know
- **Privacy:** homeowner links are long random codes. Anyone who has a link can view that pack, so send it only to the homeowner. Internal notes, schedule notes, the customer's phone number and email, and who uploaded a file are never shown to customers. The site tells search engines not to index it.
- **Customer sign-in codes** last 10 minutes and are single-use; five wrong tries burn the code.
- **Files:** up to 10 MB each; PDF, JPG, PNG, WEBP, DWG, XLSX and DOCX only. They are deleted with the record.
- **Your data lives with the Netlify site.** Deleting the site deletes the records.
- **Editing the pack content:** checklist items, room list, care guides and the maintenance schedule are in `public/assets/pack.js`.

## Developing

```bash
npm install
npm test                 # runs test/api.test.mjs with in-memory storage, no Netlify needed
npx netlify-cli dev      # runs the site + function locally (set the env vars in a .env file first)
```

`API.md` lists every route with its body and response. The front end for the customer portal and the designer "Accounts", "Schedule", "Prospects" and "Files" screens is the next piece to build on top of it.

## Files
```
netlify.toml                  Netlify settings and the /h/ link route
netlify/functions/api.mjs     The server part: sign-in, records, schedule, prospects, files, customer portal
public/index.html             Designer desk (unchanged from the Handover Desk)
public/view.html              Homeowner page (unchanged)
public/assets/pack.js         Pack content and the two customer documents
public/assets/*.png|jpg       Logo, cover photo, browser icon
test/api.test.mjs             Automated tests
API.md                        Route reference for front-end work
reference/                    Benjamin's originals: the old api.mjs, the prospect questionnaire and the appliance checklist pages
```
