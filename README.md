# M2D — Interior Design & Consultancy website

Static site (plain HTML/CSS/JS), generated from editable content.

## CMS (admin)
Open `/admin/` (locally http://localhost:8871/admin/). Benjamin can change every word and photo, add portfolio
projects by uploading photos, and write blog posts; **Publish to website** rebuilds the site. It runs in local draft
mode until Supabase is connected: see **CMS-SETUP.md**. CMS content overrides `build/content.py` at build time.

## Edit content (by hand)
- `build/content.py` — everything editable: nav, services, projects, team bios, story slides, FAQ, reviews, partners, Instagram tiles, contact details, Benjamin's personal-brand link (`benjamin_link`).
- `build/posts.json` — the 20 blog articles (title, date, cover, body HTML).
- Photos live in `assets/img/<project>/NN.jpg`, team in `assets/img/about/`, hero video in `assets/video/hero.mp4`.

## Rebuild pages after editing
```bash
python3 build/build.py
```

## Preview locally
```bash
python3 -m http.server 8871
```
then open http://localhost:8871

## Deploy
Netlify, from a GitHub repository (`netlify.toml` has the build command; see CMS-SETUP.md). Without the CMS,
`python3 build/build.py && python3 build/package.py` gives a ready-to-upload `dist/` folder for any static host.

## Notes / to-dos
- Instagram strip uses project photos as placeholders; for a live @m2dinterior feed add an embed (e.g. Behold, Elfsight, SnapWidget) or the Instagram Graph API.
- "Working with" marquee uses text wordmarks; drop real logos into `assets/img/partners/` and set `img` in `PARTNERS`.
- Contact form opens WhatsApp / email with the message pre-filled (no backend). Swap in Formspree/Netlify Forms if you want submissions stored.
- `?static=1` on any URL disables entrance animations (handy for screenshots/print).
- The loading screen and opening video play once per browser tab; returning to Home in the same tab shows the finished hero. Add `?intro` to the URL to force it.
- Portfolio shows ONE cover photo per project (the first entry in each project's `gallery`); the full photo set lives on the project page. Eleven projects: six from the old site plus five from Benjamin's Drive (1C Cantonment, 27 West Coast, 443 Punggol, 48 Strathmore, 128 Bedok North). The Drive names/taglines/copy are drafts and area/rooms are marked TBC until Benjamin confirms; Drive folders for 173 Seng Kang East, 233B Upper Aljunied and 651C Ang Mo Kio were empty.
- Portfolio page is a full-screen interactive view (`assets/js/portfolio.js`): a scroll/drag filmstrip of every project photo with captions, and a switch (top-left) that gathers all photos into a stack and bursts them into a draggable dark gallery. Photos come from each project's `gallery` list in `content.py`; thumbnails are generated into `assets/img/thumb/` and ratios in `build/ratios.json`. Clicking a photo opens its project page.
- Project pages use one of three layouts, set per project in `PROJECT_LAYOUT` (content.py): `reveal` (title card opens, 4 photos spread out, then story + photo write-ups), `horizontal` (side-scrolling story panels), `editorial` (vertical magazine grid). Per-photo captions can be added in `PROJECT_CAPTIONS`; the card background tone in `PROJECT_TONE`.
- "As featured in" strip logos are inline SVG wordmarks in `build/press.py` (CNA is the official SVG). Replace any entry with a real logo file when you have one.
- Home "Our Services" = four division columns (`SERVICE_COLS` in content.py): resting photo, hover photo, division colour, logo and blurb.
- Preloader: logo letters stack in (`assets/img/logo-m.png`, `logo-2.png`, `logo-d.png`), then the four division colours wipe up in order (orange, brown, red, green). Order and colours are in `assets/css/style.css` under "Preloader".
- Every heading/paragraph outside the animated stages gets an automatic entrance (`data-reveal="words"`, assigned in main.js). On About, the team photo section slides up over the pinned philosophy panel.
- About page order: scroll-open sequence (image grows, "About us", splits with the philosophy panel) → team photo with mission & vision → team portraits → history → workshop photos & process → FAQ.
