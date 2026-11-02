# M2D website CMS: setup

The admin lives at **/admin/** (e.g. `https://www.m2decor.com.sg/admin/`). Until Supabase is connected it runs in
**local draft mode**: everything works, but changes stay in that browser and nothing goes live.

## What Benjamin can do in the admin

| Menu | What it changes |
|---|---|
| **Pages** | Every word and photo on Home, About, Portfolio page, Blog page, Contact, the header and footer, plus lists: press logos, Instagram photos, services panels, counters, YouTube videos, reviews, process, FAQs, team members, story chapters. Also the opening video. |
| **Portfolio** | Add a project by dropping in its photos: it appears on the Portfolio page and gets its own page with all the photos. Pick the layout (photo reveal, side scroll or magazine), reorder projects, hide or delete them. |
| **Blog** | Write articles (headings, lists, quotes, photos, YouTube), drafts, scheduled dates, cover photo, categories, Google title and description, preview. |
| **Photo library** | Every upload. Photos are resized for the web automatically (2400 px, plus a 900 px thumbnail). |
| **Settings** | Phone, email, address, hours, social links; team accounts (owner); own password. |

Every save keeps the previous version (**History** button). Nothing changes on the website until **Publish to website** is pressed.

The page layouts and animations stay in code, so the CMS can only change words, photos and list items. Lists whose
design depends on a fixed number (4 services, 3 counters, 4 process stages, 3 videos, 3 workshop photos, 4 divisions)
can be edited but not added to or removed from.

## How it works

```
admin (browser)  ──save──▶  Supabase (tables + "media" photo bucket)
       │
       └──Publish──▶ /api/cms/publish (Netlify Function) ──▶ Netlify build hook
                                                                │
   Netlify build:  build/pull_cms.py   (content + photos from Supabase into build/cms.json and assets/img/cms/)
                   build/build.py      (rebuilds every page; content.py fills anything the CMS never touched)
                   build/package.py    (copies the finished site into dist/)
```

The website stays fully static and serves its own photos, so it's fast, every page is visible to Google, and it
never depends on Supabase to load. On the first sign-in, the admin copies the current website into Supabase
(tested: the site rebuilds identically from it).

## 1. Supabase
1. supabase.com → **New project** (region: Singapore).
2. Open `supabase/schema.sql` and change the owner email near the top to the email Benjamin will sign in with.
3. **SQL Editor → New query**, paste the whole file and press **Run**.
4. **Authentication → Users → Add user → Create new user** with that same email, a strong password and **Auto Confirm User** ticked.
5. **Authentication → URL Configuration**: Site URL = the website address; add `https://<domain>/admin/` to Redirect URLs (for the "email me a sign-in link" button).

## 2. Connect the admin (public values, safe to commit)
From **Project Settings → API**, put the **Project URL** and the **anon public** key into `admin/config.js`, plus the site address:
```js
supabaseUrl: "https://xxxx.supabase.co",
supabaseAnonKey: "eyJ...",
siteUrl: "https://www.m2decor.com.sg",
```

## 3. Netlify (builds and hosts the site)
1. Put this folder in a GitHub repository (the `.gitignore` already leaves out generated files and the portal's local data).
2. Netlify → **Add new site → Import an existing project** → pick the repository. The build settings come from `netlify.toml`.
3. **Site configuration → Build & deploy → Build hooks → Add build hook** (name: CMS publish). Copy its URL.
4. **Site configuration → Environment variables** (keep these secret, never in the code):

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_ANON_KEY` | the anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key (Project Settings → API) |
| `NETLIFY_BUILD_HOOK` | the build hook URL from step 3 |

5. **Deploys → Trigger deploy**.

### Or Vercel instead of Netlify
The repository also works on Vercel: `vercel.json` holds the build settings, the `api/cms/` functions do the same
job as the Netlify ones, and a Vercel cron publishes scheduled posts each night.
1. Vercel → **Add New → Project → Import Git Repository** → GitHub → pick the repository → **Deploy** (leave the settings as they are).
2. **Settings → Git → Deploy Hooks** → name `CMS publish`, branch `main` → **Create Hook**. Copy its URL.
3. **Settings → Environment Variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` as above,
   `VERCEL_DEPLOY_HOOK` = the hook URL from step 2, and `CRON_SECRET` = any long random text (protects the nightly job).
4. **Deployments → ⋯ → Redeploy** so the new values take effect.

## 4. First sign-in
Open `/admin/`, sign in with the owner email. The admin copies the current website into the CMS on its own (a
message says so). Add other people under **Settings → Team accounts**: Owner (everything), Editor (everything but
team accounts) or Writer (blog and photos only).

## Extras
- **Scheduled posts:** a published post with a future date goes live on that date: a scheduled function rebuilds the site at 00:05 Singapore time on days with a scheduled post.
- **Before Supabase:** in local draft mode, **Settings → Download content file** saves everything changed in that browser. Build the site from it with
  `python3 build/pull_cms.py --file ~/Downloads/m2d-cms-content.json && python3 build/build.py`.
- **Without the CMS:** `python3 build/build.py` alone still builds the site from `build/content.py` (and `build/cms.json` if present).
- **Limits:** photos are resized in the browser before upload; videos must be MP4 under 50 MB. The free Supabase plan has 1 GB of storage, plenty for a few thousand web-sized photos.
