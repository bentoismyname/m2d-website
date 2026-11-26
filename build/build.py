#!/usr/bin/env python3
"""Build the M2D static site.

Content comes from build/content.py (the defaults) with build/cms.json laid over it when it exists.
cms.json is written by build/pull_cms.py from Supabase (the /admin/ CMS), so whatever is edited in the
CMS wins, and anything the CMS has never touched keeps its value from content.py.

    python3 build/build.py
"""
import os, json, re, html, sys, time, datetime, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content as C
from press import PRESS as _PRESS, AWARDS as _AWARDS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E = html.escape
VER = str(int(time.time()))  # cache-bust css/js on every build
SG_TODAY = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)).date().isoformat()

# ============================ CONTENT MODEL ============================
# Fixed-size lists: the page layout is built around exactly this many items.
FIXED = {"stats": 3, "services": 4, "process": 4, "divisions": 4}
LAYOUTS = ("collage", "reveal", "horizontal", "editorial")

def _img_alt(tag):
    m = re.search(r'src="([^"]+)"', tag); a = re.search(r'alt="([^"]*)"', tag)
    return (m.group(1) if m else ""), html.unescape(a.group(1) if a else "")

def _defaults():
    site = {k: v for k, v in C.SITE.items() if k not in ("name", "short", "phone_raw")}
    press = []
    for kind, rows in (("press", _PRESS), ("award", _AWARDS)):
        for key, tag in rows:
            src, alt = _img_alt(tag); press.append(dict(name=alt, img=src, kind=kind))
    return dict(
        site=site, copy=dict(C.COPY), photos=dict(C.PHOTOS),
        stats=[dict(n=n, label=l, suffix=s) for n, l, s in C.STATS],
        services=[dict(line1=c["line1"], line2=c["line2"], sub=c["sub"].replace("<br>", "\n"), text=c["text"], img=c["img"], hover=c["hover"]) for c in C.SERVICE_COLS],
        team=[dict(name=t["name"], role=t["role"], group=t.get("group", "core"), img=t["img"], lede=t["lede"], bio=t["bio"],
                   link=C.SITE.get(t["link_key"], "") if t.get("link_key") else "", link_label=t.get("link_label", "")) for t in C.TEAM],
        story=[dict(year=s["year"], title=s["title"], img=s.get("img", ""), wide=s.get("wide", False), text=s["text"]) for s in C.STORY],
        reviews=[dict(name=n, role=r, text=q) for n, r, q in C.REVIEWS],
        process=[dict(n=n, title=t, items=list(items)) for n, t, items in C.PROCESS],
        faq_home=[dict(q=q, a=a) for q, a in C.FAQ_HOME],
        faq_about=[dict(q=q, a=a) for q, a in C.FAQ_ABOUT],
        ig=[dict(img=i) for i in C.IG_ITEMS],
        videos=[dict(id=v["id"], title=v["title"], text=v["text"]) for v in C.VIDEOS],
        work_photos=[dict(img=p, caption=c) for p, c in C.WORK_PHOTOS],
        press=press,
        divisions=[dict(name=n) for n, c in C.DIVISIONS],
    )

def _default_projects():
    out = []
    for i, p in enumerate(C.PROJECTS):
        caps = C.PROJECT_CAPTIONS.get(p["slug"], {})
        out.append(dict(
            slug=p["slug"], name=p["name"], place=p["place"], year=p["year"], type=p["type"], area=p["area"], rooms=p["rooms"],
            tagline=p["tagline"], paras=list(p["paras"]), credits=[dict(k=k, v=v) for k, v in p["credits"]],
            layout=C.PROJECT_LAYOUT.get(p["slug"], "editorial"),
            images=[dict(src=f'assets/img/{p["folder"]}/{n}.jpg', caption=caps.get(n, "")) for n in p["gallery"]],
            cover=p["cover"], portrait=p["portrait"], home=i < 6, enabled=True, tone=C.PROJECT_TONE.get(p["slug"], "")))
    return out

def _default_posts():
    rows = json.load(open(os.path.join(ROOT, "build", "posts.json"), encoding="utf-8"))
    return [dict(slug=p["slug"], title=p["title"], desc=p["desc"], date=p["date"], cover=p.get("cover", ""), body=p["body"],
                 words=p.get("words"), status="published", cats=[], seo_title="", seo_desc="") for p in rows]

def _words(body):
    return len(re.sub(r"<[^>]+>", " ", body or "").split())

def _slug(s):
    s = str(s or "").strip()
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", s): return s          # already a clean web address: keep it exactly
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("&", " and ")).strip("-")[:90]

def load_content():
    d, projects, posts = _defaults(), _default_projects(), _default_posts()
    path = os.path.join(ROOT, "build", "cms.json")
    if os.path.exists(path):
        cms = json.load(open(path, encoding="utf-8"))
        for k, v in (cms.get("content") or {}).items():
            if k in ("site", "copy", "photos") and isinstance(v, dict):
                d[k].update({kk: vv for kk, vv in v.items() if vv is not None})
            elif k in d and isinstance(v, list):
                if k in FIXED:   # keep the layout's item count: missing items fall back to the defaults
                    v = [v[i] if i < len(v) and v[i] else d[k][i] for i in range(FIXED[k])]
                d[k] = v
        if isinstance(cms.get("projects"), list): projects = cms["projects"]
        if isinstance(cms.get("posts"), list): posts = cms["posts"]
    # projects: tidy up, drop hidden ones and any without photos
    clean = []
    for p in projects:
        imgs = [i if isinstance(i, dict) else dict(src=i, caption="") for i in (p.get("images") or [])]
        imgs = [i for i in imgs if i.get("src")]
        if not imgs or p.get("enabled") is False: continue
        q = dict(p); q["images"] = imgs
        q["slug"] = _slug(p.get("slug") or p.get("name")) or "project"
        for k in ("name", "place", "year", "type", "area", "rooms", "tagline"): q[k] = str(p.get(k) or "")
        q["paras"] = [x for x in (p.get("paras") or []) if str(x).strip()] or [q["tagline"] or q["name"]]
        q["credits"] = [c if isinstance(c, dict) else dict(k=c[0], v=c[1]) for c in (p.get("credits") or [])]
        q["layout"] = p.get("layout") if p.get("layout") in LAYOUTS else "editorial"
        q["cover"] = p.get("cover") or imgs[0]["src"]
        q["portrait"] = p.get("portrait") or imgs[min(1, len(imgs) - 1)]["src"]
        clean.append(q)
    # posts: only published ones whose date has come (Singapore time), newest first
    live = []
    for p in posts:
        if (p.get("status") or "published") != "published": continue
        if str(p.get("date") or "") > SG_TODAY: continue
        q = dict(p); q["slug"] = _slug(p.get("slug") or p.get("title")) or "post"
        q["words"] = int(p.get("words") or 0) or _words(p.get("body"))
        q["desc"] = p.get("desc") or ""; q["cover"] = p.get("cover") or ""; q["cats"] = p.get("cats") or []
        live.append(q)
    live.sort(key=lambda p: str(p.get("date") or ""), reverse=True)
    d["site"]["phone_raw"] = re.sub(r"\D", "", d["site"].get("phone", "")) or C.SITE["phone_raw"]
    return d, clean, live, projects, posts

D, PROJ, POSTS, ALL_PROJECTS, ALL_POSTS = load_content()
SITE, COPY, PHOTOS = D["site"], D["copy"], D["photos"]
NAV = C.NAV
DIV_COLOURS = [c for n, c in C.DIVISIONS]
SVC_COLOURS = [c["colour"] for c in C.SERVICE_COLS]
RATIOS = json.load(open(os.path.join(ROOT, "build", "ratios.json")))

# ---------- text and photo helpers ----------
def TX(s): return E(str(s or "")).replace("\n", "<br>")          # plain text, line breaks kept
def T(k): return TX(COPY.get(k, ""))
def LINES(k): return [E(x) for x in str(COPY.get(k, "")).split("\n") if x.strip()]
def U(path, r=""):                                                 # a photo path relative to the page
    path = str(path or "")
    return path if re.match(r"^(https?:|data:|/)", path) else r + path
def P(k, r=""): return U(PHOTOS.get(k, ""), r)

def thumb(path):
    m = re.match(r"^assets/img/([^/]+)/(\d+)\.jpg$", path or "")
    if m and os.path.exists(os.path.join(ROOT, f"assets/img/thumb/{m.group(1)}-{m.group(2)}.jpg")): return f"assets/img/thumb/{m.group(1)}-{m.group(2)}.jpg"
    m = re.match(r"^assets/img/cms/([^/]+)$", path or "")
    if m and os.path.exists(os.path.join(ROOT, f"assets/img/cms/thumb/{m.group(1)}")): return f"assets/img/cms/thumb/{m.group(1)}"
    return path

def _dims(fp):
    """Width and height of a local JPEG / PNG / WebP without any image library."""
    try:
        with open(fp, "rb") as f: b = f.read(65536 * 4)
        if b[:8] == b"\x89PNG\r\n\x1a\n": return struct.unpack(">II", b[16:24])
        if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
            if b[12:16] == b"VP8X": return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
            if b[12:16] == b"VP8 ": w, h = struct.unpack("<HH", b[26:30]); return w & 0x3FFF, h & 0x3FFF
            if b[12:16] == b"VP8L": bits = int.from_bytes(b[21:25], "little"); return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if b[:2] == b"\xff\xd8":
            i = 2
            while i < len(b) - 9:
                if b[i] != 0xFF: i += 1; continue
                mk = b[i + 1]
                if mk in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", b[i + 5:i + 9]); return w, h
                i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
    except Exception:
        pass
    return None

def ratio(path):
    m = re.match(r"^assets/img/([^/]+)/(\d+)\.jpg$", path or "")
    if m and f"{m.group(1)}/{m.group(2)}" in RATIOS: return RATIOS[f"{m.group(1)}/{m.group(2)}"]
    d = _dims(os.path.join(ROOT, path)) if path and not re.match(r"^(https?:|data:|/)", path) else None
    return round(d[0] / d[1], 4) if d and d[1] else 1.33

ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M8 7h9v9"/></svg>'
ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v16m0 0l-6-6m6 6l6-6"/></svg>'
ICON_IG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.2-.1 1.6-.1 4.8-.1M12 0C8.7 0 8.3 0 7.1.1 5.8.1 4.9.3 4.1.6c-.8.3-1.5.7-2.1 1.4C1.3 2.6.9 3.3.6 4.1.3 4.9.1 5.8.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.3 2.2.6 2.9.3.8.7 1.5 1.4 2.1.6.7 1.3 1.1 2.1 1.4.8.3 1.6.5 2.9.6 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.2-.3 2.9-.6.8-.3 1.5-.7 2.1-1.4.7-.6 1.1-1.3 1.4-2.1.3-.8.5-1.6.6-2.9.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.2-.6-2.9-.3-.8-.7-1.5-1.4-2.1C21.4 1.3 20.7.9 19.9.6 19.1.3 18.2.1 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zM12 16a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.9 1.4 1.4 0 000-2.9z"/></svg>'
ICON_FB = '<svg viewBox="0 0 24 24"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8h3.3z"/></svg>'
ICON_TT = '<svg viewBox="0 0 24 24"><path d="M16.6 5.8c-1-.7-1.6-1.8-1.6-3h-3.2v13.1a2.7 2.7 0 11-2.7-2.8c.3 0 .6 0 .8.1V9.9a6 6 0 00-.8-.1 6 6 0 106 6V9.3a7.5 7.5 0 004.4 1.4V7.5c-1.1 0-2.1-.6-2.9-1.7z"/></svg>'
ICON_YT = '<svg viewBox="0 0 24 24"><path d="M23 7.2c-.3-1-1-1.8-2-2C19.2 4.7 12 4.7 12 4.7s-7.2 0-9 .5c-1 .3-1.8 1-2 2C.5 9 .5 12 .5 12s0 3 .5 4.8c.3 1 1 1.8 2 2 1.8.5 9 .5 9 .5s7.2 0 9-.5c1-.3 1.8-1 2-2 .5-1.8.5-4.8.5-4.8s0-3-.5-4.8zM9.7 15.1V8.9l6 3.1-6 3.1z"/></svg>'
ICON_WA = '<svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 013.7 12 8.3 8.3 0 1112 20.3z"/></svg>'
ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>'
ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg>'
ICON_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5l-7 7 7 7"/></svg>'
ICON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5l7 7-7 7"/></svg>'
GOOGLE_LOGO = '<span class="rv__g"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Google</span>'
STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.3L12 18l-6.6 3.8 1.8-7.3L1.5 9.6 9 9z"/></svg>'

def shell(title, body, root="", transparent=False, desc="", extra_head="", extra_body="", body_class=""):
    nav = "".join(f'<a href="{root}{h}">{E(t)}</a>' for t, h in NAV if h != "contact.html")
    mnav = "".join(f'<a href="{root}{h}">{E(t)}</a>' for t, h in NAV)
    hcls = "header header--transparent" if transparent else "header"
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>try{{if(sessionStorage.getItem('m2d-intro')==='1'&&!/[?&]intro/.test(location.search))document.documentElement.classList.add('intro-seen')}}catch(e){{}}</script>
<title>{E(title)}</title>
<meta name="description" content="{E(desc or COPY.get('seo.default_desc', ''))}">
<link rel="icon" href="{root}assets/img/logo-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/css/style.css?v={VER}">
{extra_head}
</head>
<body class="{body_class}">
<header class="{hcls}">
  <div class="container">
    <a class="header__logo" href="{root}index.html" aria-label="M2D home"><img src="{root}assets/img/logo.png" alt="M2D"></a>
    <nav class="header__nav">{nav}</nav>
    <a class="header__cta" href="{root}contact.html">{T("nav.enquire")} {ICON_ARROW}</a>
    <button class="burger" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</header>
<div class="menu">
  <button class="menu__close" aria-label="Close menu">{ICON_X}</button>
  <div class="menu__links">{mnav}</div>
  <div class="menu__foot"><a href="https://wa.me/{SITE['phone_raw']}">WhatsApp {E(SITE['phone'])}</a><a href="mailto:{SITE['email']}">{E(SITE['email'])}</a><a href="{SITE['instagram']}" target="_blank" rel="noopener">@{E(SITE['ig_handle'])}</a></div>
</div>
<main>
{body}
</main>
{footer(root)}
<a class="wa" href="https://wa.me/{SITE['phone_raw']}" target="_blank" rel="noopener" aria-label="WhatsApp us">{ICON_WA}</a>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="{root}assets/js/main.js?v={VER}"></script>
{extra_body}
</body>
</html>'''

def footer(root):
    divs = "".join(f'<span><i style="background:{c}"></i>{E(d["name"])}</span>' for d, c in zip(D["divisions"], DIV_COLOURS))
    return f'''<footer class="footer">
  <div class="container">
    <div class="footer__top">
      <div class="footer__brand">
        <a class="footer__logo" href="{root}index.html"><img src="{root}assets/img/logo.png" alt="M2D"></a>
        <p>{T("footer.text")}</p>
        <div class="footer__divs">{divs}</div>
      </div>
      <div><h4>{T("footer.h_info")}</h4><ul>{"".join(f'<li><a href="{root}{h}">{E(t)}</a></li>' for t,h in NAV)}</ul></div>
      <div><h4>{T("footer.h_enquire")}</h4><ul>
        <li><a href="tel:+{SITE['phone_raw']}">{E(SITE['phone'])}</a></li>
        <li><a href="mailto:{SITE['email']}">{E(SITE['email'])}</a></li>
        <li>{E(SITE['address']).replace(', #', ',<br>#', 1)}</li>
        <li style="margin-top:14px"><div class="socials">
          <a href="{SITE['instagram']}" target="_blank" rel="noopener" aria-label="Instagram">{ICON_IG}</a>
          <a href="{SITE['facebook']}" target="_blank" rel="noopener" aria-label="Facebook">{ICON_FB}</a>
          <a href="{SITE['tiktok']}" target="_blank" rel="noopener" aria-label="TikTok">{ICON_TT}</a>
          <a href="{SITE['youtube']}" target="_blank" rel="noopener" aria-label="YouTube">{ICON_YT}</a>
        </div></li>
      </ul></div>
    </div>
    <div class="footer__bot"><span>{T("footer.copyright")}</span><span>{T("footer.right")}</span></div>
  </div>
</footer>'''

def cta(root, key="cta.home"):
    return f'''<section class="cta section--tight" style="padding:0">
  <div class="cta__bg"><img src="{P(key, root)}" alt=""></div>
  <div class="container">
    <h2 class="h-xl" data-reveal>{T("cta.title")}</h2>
    <div class="cta__side" data-reveal>
      <p>{T("cta.text")}</p>
      <a class="btn btn--light" href="{root}contact.html">{T("cta.button")} {ICON_ARROW}</a>
    </div>
  </div>
</section>'''

def faq(items):
    return '<div class="faq">' + "".join(f'<details><summary>{E(f["q"])}<i></i></summary><div class="faq__a"><p>{E(f["a"])}</p></div></details>' for f in items) + '</div>'

def post_card(p, root, feature=False):
    cat = ",".join(cats_for(p))
    d = fmt_date(p["date"])
    cls = "post post--feature" if feature else "post"
    return f'''<a class="{cls}" href="{root}blog/{p["slug"]}.html" data-cat="{cat}">
  <div class="post__media"><img src="{U(cover_of(p), root)}" alt="" loading="lazy"></div>
  <div><div class="post__meta"><span>{d}</span><span>{read_time(p)}</span></div>
  <h3 style="margin-top:10px">{E(p["title"])}</h3>
  <p style="margin-top:10px">{E(p["desc"])}</p></div>
</a>'''

CATS = ("hdb", "condo", "landed", "styles", "renovation", "lighting")
def cats_for(p):
    chosen = [c for c in (p.get("cats") or []) if c in CATS]
    if chosen: return chosen
    t = (p["title"] + " " + p["desc"]).lower(); c = []
    if "hdb" in t or "bto" in t or "resale" in t: c.append("hdb")
    if "condo" in t: c.append("condo")
    if "landed" in t or "terrace" in t: c.append("landed")
    if any(k in t for k in ("renovation", "guidelines", "budget")): c.append("renovation")
    if any(k in t for k in ("japandi", "scandinavian", "minimalist", "contemporary", "industrial", "wabi", "style", "colour", "60-30-10", "cosy")): c.append("styles")
    if "light" in t: c.append("lighting")
    return c or ["styles"]

def fmt_date(d):
    try: return datetime.date.fromisoformat(d).strftime("%d %b %Y")
    except: return d
def read_time(p): return f'{max(2, round(p["words"]/220))} min read'
def cover_of(p): return p["cover"] or "assets/img/hozon/01.jpg"

def home_projects():
    """The six works on the home page: the ones ticked "show on home page" first, topped up in portfolio order."""
    picked = [p for p in PROJ if p.get("home")][:6]
    return picked + [p for p in PROJ if p not in picked][:6 - len(picked)]

# ============================ SERVICE PANELS (home + services page) ============================
def svc_panels(r, home=False):
    """The four colour panels. A panel links to its own page once it has a link (CMS: Pages > Home > Services);
    on the home page a panel without one goes to the Services page."""
    out = ""
    for c, col in zip(D["services"], SVC_COLOURS):
        link = (c.get("link") or "").strip() or ("services.html" if home else "")
        tag, attrs = ("a", f' href="{U(link, r)}"') if link else ("div", "")
        more = f'<span class="svc__more">{T("home.svc_more")} {ICON_ARROW}</span>' if link else ""
        out += f'''<{tag} class="svc"{attrs} style="--c:{col}" data-clip>
      <img class="svc__img" src="{U(c["img"], r)}" alt="{E(c["line1"])} {E(c["line2"])}" loading="lazy">
      <img class="svc__img svc__img--hover" src="{U(c["hover"], r)}" alt="" loading="lazy">
      <div class="svc__tint"></div>
      <div class="svc__logo"><img src="{r}assets/img/logo.png" alt="M2D"><span>{TX(c["sub"])}</span></div>
      <p class="svc__text">{E(c["text"])}</p>
      {more}
      <h2 class="svc__name"><span>{E(c["line1"])}</span><span>{E(c["line2"])}</span></h2>
    </{tag}>'''
    return out

# ============================ HOME ============================
def home():
    r = ""
    partners = "".join(f'<div class="marquee__item marquee__item--{"award" if x.get("kind") == "award" else "logo"}"><img src="{U(x["img"], r)}" alt="{E(x["name"])}"></div>' for x in sorted(D["press"], key=lambda x: x.get("kind") == "award") if x.get("img"))
    ig = "".join(f'<a class="ig__item" href="{SITE["instagram"]}" target="_blank" rel="noopener"><img src="{U(i["img"], r)}" alt="" loading="lazy">{ICON_IG}</a>' for i in D["ig"] if i.get("img"))
    services = svc_panels(r, home=True)
    stats = "".join(f'<div class="stat" data-reveal class="d{i}"><div class="stat__n"><span data-count="{re.sub(r"[^0-9.]", "", str(s["n"])) or 0}">0</span><sup>{E(s["suffix"])}</sup></div><div class="stat__l">{E(s["label"])}</div></div>' for i, s in enumerate(D["stats"]))
    letters = "abcdef"
    works = "".join(f'''<a class="work work--{letters[i]}" href="{r}projects/{p["slug"]}.html" data-reveal>
      <span class="work__idx">{i+1:02d}</span>
      <div class="work__media" data-clip><img src="{U(p["portrait"] if letters[i] in "bce" else p["cover"], r)}" alt="{E(p["name"])}" loading="lazy"></div>
      <div class="work__meta"><h3>{E(p["name"])}</h3><span>{E(p["place"])} · {E(p["year"])}</span></div>
      <div class="work__tag">{E(p["area"])} · {E(p["type"])}</div>
    </a>''' for i, p in enumerate(home_projects()))
    vids = "".join(f'''<a class="vid" href="https://www.youtube.com/watch?v={E(v["id"])}" data-yt="{E(v["id"])}" data-title="{E(v["title"])}" draggable="false">
      <div class="vid__frame"><img src="https://i.ytimg.com/vi/{E(v["id"])}/hqdefault.jpg" alt="" loading="lazy"><div class="vid__play"><i>{ICON_PLAY}</i></div></div>
      <h3>{E(v["title"])}</h3><p>{E(v["text"])}</p></a>''' for v in D["videos"] if v.get("id"))
    reviews = "".join(f'<figure class="slide"><blockquote>{E(v["text"])}</blockquote><figcaption><b>{E(v["name"])}</b>{E(v["role"])}</figcaption></figure>' for v in D["reviews"])
    steps = "".join(f'<div class="step" data-reveal class="d{i}"><div class="num-outline">{E(s["n"])}</div><h3>{E(s["title"])}</h3><ul>{"".join(f"<li>{E(x)}</li>" for x in s["items"] if str(x).strip())}</ul></div>' for i, s in enumerate(D["process"]))
    posts = "".join(post_card(p, r) for p in POSTS[:3])
    hero_title = "".join(f'<span class="line"><span>{x}</span></span>' for x in LINES("home.hero_title"))
    def rev_plat(key, name, logo, url, out_of, n=0):
        try: score = float(T(f"home.rev_{key}_score"))
        except ValueError: score = 0
        fill = max(0, min(100, score / out_of * 100))
        stars = f'<span class="rv__stars" aria-hidden="true"><span>{STAR*5}</span><span style="width:{fill:.1f}%">{STAR*5}</span></span>'
        out = f'<small>/{out_of}</small>' if out_of != 5 else ''
        return f'''<a class="rv__plat" data-reveal="left" href="{url}" target="_blank" rel="noopener" aria-label="{name}: {T(f"home.rev_{key}_score")} out of {out_of}, {T(f"home.rev_{key}_count")} reviews">
        <span class="rv__logo">{logo}</span>
        <span class="rv__score">{T(f"home.rev_{key}_score")}{out}</span>{stars}
        <span class="rv__count">{T(f"home.rev_{key}_count")} reviews</span>
        <span class="rv__go">Read reviews {ICON_ARROW}</span></a>'''
    plats = "".join([
        rev_plat("google", "Google", GOOGLE_LOGO, SITE["google_reviews_tab"], 5, 0),
        rev_plat("hometrust", "Hometrust", f'<img src="{U("assets/img/reviews/hometrust.png", r)}" alt="Hometrust">', SITE["hometrust"], 10, 1),
        rev_plat("qanvast", "Qanvast", f'<img src="{U("assets/img/reviews/qanvast.svg", r)}" alt="Qanvast">', SITE["qanvast"], 5, 2),
    ])
    sats = "".join(f'\n    <figure class="rh__sat rh__sat--{i}"><img src="{P(f"home.rh_sat{i}", r)}" alt=""></figure>' for i in range(1, 7))
    body = f'''
<div class="preloader" aria-hidden="true">
  <div class="pl__layer pl__layer--orange">
    <div class="pl__mark">
      <span class="pl__ghost pl__ghost--ink" data-n="4"></span><span class="pl__ghost pl__ghost--green" data-n="3"></span><span class="pl__ghost pl__ghost--red" data-n="2"></span><span class="pl__ghost pl__ghost--brown" data-n="1"></span>
      <div class="pl__logo"><span class="pl__piece"><img src="assets/img/logo-m.png" alt=""></span><span class="pl__piece"><img src="assets/img/logo-2.png" alt=""></span><span class="pl__piece"><img src="assets/img/logo-d.png" alt="M2D"></span></div>
    </div>
    <div class="pl__tag">{T("home.preloader_tag")}</div>
  </div>
</div>
<section class="hero">
  <div class="hero__media"><video autoplay muted playsinline preload="auto" poster="{P("home.hero_poster", r)}"><source src="{P("home.hero_video", r)}" type="video/mp4"></video><script>(function(v){{if(document.documentElement.classList.contains('intro-seen')&&v){{v.autoplay=false;v.removeAttribute('autoplay');v.pause();v.poster="{P("home.hero_end", r)}";}}}})(document.currentScript.previousElementSibling)</script></div>
  <div class="hero__shade"></div>
  <div class="container hero__content">
    <h1 class="hero__title">{hero_title}</h1>
    <div class="hero__aside">
      <p>{T("home.hero_text")}</p>
      <a class="btn" href="portfolio.html">{T("home.hero_button")} {ICON_ARROW}</a>
    </div>
  </div>
</section>

<section id="intro" class="section" style="padding-bottom:0">
  <div class="container">
    <div class="marquee-head marquee-head--center"><h2 class="h-md" data-reveal>{T("home.featured_title")}</h2></div>
  </div>
  <div class="marquee" style="margin-top:22px" data-reveal="fade"><div class="marquee__track">{partners}{partners}</div></div>
</section>

<section class="ig">
  <div class="container ig__head">
    <div data-reveal="left"><span class="eyebrow">{T("home.ig_eyebrow")}</span><div class="ig__handle" style="margin-top:12px">@<b>{E(SITE["ig_handle"])}</b></div></div>
    <a class="link" href="{SITE['instagram']}" target="_blank" rel="noopener" data-reveal="right">{T("home.ig_follow")} {ICON_ARROW}</a>
  </div>
  <div class="ig__track" data-reveal="fade">{ig}{ig}</div>
</section>

<section class="mag">
  <div class="container">
    <div class="mag__title">
      <div class="tag" data-reveal>{T("home.svc_tag")}</div>
      <div class="word1" data-reveal="left">{T("home.svc_word1")}</div>
      <div class="word2" data-reveal="right">{T("home.svc_word2")}</div>
      <img class="logo-mini" src="assets/img/logo.png" alt="">
    </div>
  </div>
  <div class="svc-grid">{services}</div>
</section>

<section class="section section--orange">
  <div class="container">
    <div class="sec-head"><div><span class="eyebrow">{T("home.why_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("home.why_title")}</h2></div>
    <p class="lede" style="color:rgba(255,255,255,.85)">{T("home.why_text")}</p></div>
    <div class="stats">{stats}</div>
  </div>
</section>

<section class="rh">
  <div class="rh__stage">
    <div class="rh__head"><span class="eyebrow">{T("home.rh_eyebrow")}</span><h2 class="h-xl">{T("home.rh_title")}</h2></div>{sats}
    <a class="rh__main" href="portfolio.html"><img src="{P("home.rh_main", r)}" alt="{T("home.rh_main_alt")}">
      <span class="rh__cta"><span class="rh__cta-title"><span class="rh__cta-line">{T("portfolio.title")}</span></span><span class="btn btn--light">{T("home.rh_button")} {ICON_ARROW}</span></span>
    </a>
  </div>
</section>

<section class="section section--stone">
  <div class="container">
    <div class="sec-head"><div><span class="eyebrow">{T("home.yt_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("home.yt_title")}</h2></div><a class="link" href="{SITE['youtube']}" target="_blank" rel="noopener">{T("home.yt_link")} {ICON_ARROW}</a></div>
  </div>
  <div class="wk wk--vids" data-wk><div class="wk__track">{vids}</div></div>
</section>

<section class="section">
  <div class="container rv">
    <div class="rv__head" data-reveal>
      <h2 class="h-lg">{T("home.rev_title")}</h2>
      <p class="body">{T("home.rev_text")}</p>
    </div>
    <div class="rv__plats">{plats}</div>
    <div class="slider rv__slider" data-reveal>
      <div class="slider__track">{reviews}</div>
    </div>
  </div>
</section>

<section class="section section--stone">
  <div class="container">
    <div class="sec-head"><div><span class="eyebrow">{T("home.proc_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("home.proc_title")}</h2></div><a class="link" href="about.html">{T("home.proc_link")} {ICON_ARROW}</a></div>
    <div class="steps">{steps}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="sec-head"><div><span class="eyebrow">{T("home.blog_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("home.blog_title")}</h2></div><a class="btn" href="blog.html">{T("home.blog_button")} {ICON_ARROW}</a></div>
    <div class="posts">{posts}</div>
  </div>
</section>

<section class="section section--stone">
  <div class="container grid grid-2" style="align-items:start">
    <div data-reveal><span class="eyebrow">{T("home.faq_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("home.faq_title")}</h2><p class="body" style="max-width:380px;margin-top:22px;text-align:left">{T("home.faq_text")}</p><a class="btn" href="contact.html" style="margin-top:28px">{T("home.faq_button")} {ICON_ARROW}</a></div>
    <div data-reveal>{faq(D["faq_home"])}</div>
  </div>
</section>

{cta(r)}
'''
    return shell(COPY.get("seo.title.home", ""), body, r, transparent=True, desc=COPY.get("seo.desc.home", ""))

# ============================ ABOUT ============================
def about():
    r = ""
    divs = "".join(f'<div class="story__div" style="background:{c}"><img src="assets/img/logo.png" alt="M2D"><span>{E(d["name"])}</span></div>' for d, c in zip(D["divisions"], DIV_COLOURS))
    story_rows = ""
    for s in D["story"]:
        media = f'<div class="story__divs">{divs}</div>' if s.get("divs") or not s.get("img") else f'<div class="mag__frame{" mag__frame--wide" if s.get("wide") else ""}"><img src="{U(s["img"], r)}" alt="" loading="lazy"></div>'
        story_rows += f'''<div class="mag__row">
      <div class="mag__media" data-reveal="left">{media}</div>
      <div class="mag__text" data-reveal="right"><span class="eyebrow orange">{E(s["year"])}</span><h3 class="dash" style="margin-top:14px">{E(s["title"])}</h3><p class="body">{E(s["text"])}</p></div>
    </div>'''
    photos = "".join(f'<figure class="wk__item"><img src="{U(p["img"], r)}" alt="{E(p.get("caption") or "")}" loading="lazy" draggable="false"></figure>' for p in D["work_photos"] if p.get("img"))
    steps = "".join(f'<div class="step" data-reveal><div class="num-outline">{E(s["n"])}</div><h3>{E(s["title"])}</h3><ul>{"".join(f"<li>{E(x)}</li>" for x in s["items"] if str(x).strip())}</ul></div>' for s in D["process"])
    people = ""
    for t in D["team"]:
        people += f'''<article class="tp" data-name="{E(t["name"])}" data-role="{E(t["role"])}" data-lede="{E(t["lede"])}" data-bio="{E(t["bio"])}" data-group="{"core" if t.get("group") == "core" else "creative"}" tabindex="0">
      <div class="tp__cap"><b>{E(t["name"])}</b><span>{E(t["role"])}</span><em>Read it</em></div>
      <div class="tp__media" data-clip><img src="{U(t["img"], r)}" alt="{E(t["name"])}" loading="lazy"></div>
    </article>'''
    corner_tl = "".join(f"<i>{x}</i>" for x in LINES("about.corner_tl"))
    ao_phs = "".join(f'<figure class="ao__ph ao__ph--{i}"><img src="{P(f"about.op{i}", r)}" alt="" loading="eager"></figure>' for i in range(1, 5) if PHOTOS.get(f"about.op{i}"))
    # the opener: the hero video (plays as it expands) or, without one, the photo
    if PHOTOS.get("about.hero_video"):
        v = PHOTOS["about.hero_video"]
        big, small = v[:-4] + "-2560.mp4", v[:-4] + "-1280.mp4"
        if v.endswith(".mp4") and os.path.exists(os.path.join(ROOT, big)) and os.path.exists(os.path.join(ROOT, small)):
            # a prepared clip comes in three sizes (name.mp4, name-2560.mp4, name-1280.mp4): big screens, desktops, phones
            srcs = (f'<source src="{U(big, r)}" type="video/mp4" media="(min-width:1600px)">'
                    f'<source src="{U(v, r)}" type="video/mp4" media="(min-width:901px)">'
                    f'<source src="{U(small, r)}" type="video/mp4">')
        else:
            srcs = f'<source src="{P("about.hero_video", r)}" type="video/mp4">'
        ao_media = f'<video class="ao__video" muted playsinline preload="auto" poster="{P("about.hero_poster", r)}" aria-label="M2D interior design and renovation">{srcs}</video>'
    else:
        ao_media = f'<img src="{P("about.hero", r)}" alt="{T("about.hero_alt")}">'
    corner_br = "".join(f"<i>{x}</i>" for x in LINES("about.corner_br"))
    body = f'''
<section class="about-open">
  <div class="ao__stage">
    {ao_phs}
    <div class="ao__img">{ao_media}<span class="ao__corner ao__corner--tag">{corner_br}</span><span class="ao__corner ao__corner--about">{corner_tl}</span></div>
    <span class="ao__label">{T("about.label")}</span>
    <div class="ao__panel">
      <span class="eyebrow">{T("about.ph_eyebrow")}</span>
      <h2>{T("about.ph_title")}</h2>
      <p class="body">{T("about.ph_p1")}</p>
      <p class="body">{T("about.ph_p2")}</p>
      <div class="dots"><i></i><i></i><i></i><i></i></div>
      <div class="ao__cap">{T("about.ph_cap")}</div>
    </div>
  </div>
</section>

<section class="team-hero">
  <div class="team-hero__bg"><img src="{P("about.team", r)}" alt="{T("about.team_alt")}"></div>
  <div class="container">
    <span class="eyebrow">{T("about.th_eyebrow")}</span>
    <h2 class="h-xl">{T("about.th_title")}</h2>
    <div class="mv">
      <div class="mv__item" data-reveal><h3>{T("about.mission_title")}</h3><p>{T("about.mission_text")}</p></div>
      <div class="mv__item" data-reveal><h3>{T("about.vision_title")}</h3><p>{T("about.vision_text")}</p></div>
    </div>
  </div>
</section>

<section class="team-ed">
  <div class="container">
    <div class="sec-head" style="margin-bottom:0"><div><span class="eyebrow">{T("about.team_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("about.team_title")}</h2></div><p class="lede">{T("about.team_lede")}</p></div>
    <span class="team-ed__vert">{T("about.team_vert")}</span>
    <div class="team-ed__ghost"><span>Our</span><span class="ink team-ed__which">creative team</span></div>
    <div class="team-ed__list" style="margin-top:clamp(40px,6vw,90px)">{people}</div>
  </div>
</section>
<div class="spread" aria-modal="true" role="dialog">
  <div class="spread__book">
    <button class="spread__close" aria-label="Close">{ICON_X}</button>
    <div class="spread__photo"><img src="" alt=""><span class="sig"></span></div>
    <div class="spread__page">
      <img class="spread__logo" src="assets/img/logo.png" alt="M2D">
      <div class="spread__role"></div>
      <h3 class="spread__title"><span></span><b></b></h3>
      <p class="spread__lede"></p>
      <div class="spread__body"></div>
      <div class="spread__foot"><div></div><div><button class="spread__prev">Previous</button><button class="spread__next">Next</button></div></div>
    </div>
  </div>
</div>

<section class="mag mag--story">
  <div class="container">
    <div class="mag__title">
      <div class="tag" data-reveal>{T("about.story_tag")}</div>
      <div class="word1" data-reveal="left">{T("about.story_word1")}</div>
      <div class="word2" data-reveal="right">{T("about.story_word2")}</div>
      <img class="logo-mini" src="assets/img/logo.png" alt="">
    </div>
    {story_rows}
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="sec-head"><div><span class="eyebrow">{T("about.work_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("about.work_title")}</h2></div><p class="lede">{T("about.work_lede")}</p></div>
  </div>
  <div class="wk" data-wk><div class="wk__track">{photos}</div></div>
</section>

<section class="section section--stone">
  <div class="container">
    <div class="sec-head"><div><span class="eyebrow">{T("about.proc_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("about.proc_title")}</h2></div></div>
    <div class="steps">{steps}</div>
  </div>
</section>

<section class="section">
  <div class="container grid grid-2" style="align-items:start">
    <div data-reveal><span class="eyebrow">{T("about.faq_eyebrow")}</span><h2 class="h-lg" style="margin-top:14px">{T("about.faq_title")}</h2></div>
    <div data-reveal>{faq(D["faq_about"])}</div>
  </div>
</section>
{cta(r, "cta.about")}
'''
    return shell(COPY.get("seo.title.about", ""), body, r, desc=COPY.get("seo.desc.about", ""))

# ============================ PORTFOLIO ============================
def portfolio():
    r = ""
    items = []
    # one photo per project in the portfolio (its first photo); the full set lives on each project page
    for p in PROJ:
        first = p["images"][0]["src"]
        items.append(dict(src=thumb(first), r=ratio(first), name=p["name"], place=p["place"], year=p["year"], slug=p["slug"], tone=p.get("tone") or "#FFFFFF"))
    cards = "".join(f'''<a class="pf__item" href="projects/{it["slug"]}.html" data-r="{it["r"]}" data-i="{i}" data-tone="{E(it["tone"])}">
      <img src="{U(it["src"], r)}" alt="{E(it["name"])}" draggable="false" loading="eager">
      <span class="pf__cap"><b>{E(it["name"])}</b><span>{E(it["place"])} · {E(it["year"])}</span></span>
    </a>''' for i, it in enumerate(items))
    body = f'''
<section class="pf" data-total="{len(items)}">
  <div class="pf__ui pf__ui--tl">
    <button class="pf__switch" type="button" aria-pressed="false"><span class="pf__sw-track"><i></i></span><span class="pf__sw-label" data-strip="Gallery view" data-gallery="Strip view">Gallery view</span></button>
  </div>
  <div class="pf__ui pf__ui--bl"><b>{T("portfolio.scroll")}</b><span>{len(PROJ)} {T("portfolio.homes")}</span><i class="pf__bar"><em></em></i></div>
  <div class="pf__ui pf__ui--bc"><h1>{T("portfolio.title")}<span>·</span></h1></div>
  <div class="pf__ui pf__ui--br"><span class="pf__cur">01</span> / {len(items):02d}</div>
  <div class="pf__hint">{T("portfolio.hint")}</div>
  <div class="pf__world">{cards}</div>
</section>
'''
    return shell(COPY.get("seo.title.portfolio", ""), body, r, desc=COPY.get("seo.desc.portfolio", ""), extra_body=f'<script src="assets/js/portfolio.js?v={VER}"></script>', body_class="is-portfolio")

def project(idx):
    p = PROJ[idx]; r = "../"
    g = p["images"]
    layout = p["layout"]
    def cap(n, i): return n.get("caption") or f'{p["name"]} · {i+1:02d}'
    def src(n): return U(n["src"], r)
    credits = "".join(f'<dt>{E(c.get("k", ""))}</dt><dd>{E(c.get("v", ""))}</dd>' for c in p["credits"])
    paras = p["paras"]
    prev = PROJ[(idx - 1) % len(PROJ)]; nxt = PROJ[(idx + 1) % len(PROJ)]
    nav = f'''<section class="container" style="margin-top:clamp(56px,8vw,120px)">
  <div class="proj-nav">
    <a href="{prev["slug"]}.html"><span>Previous</span><b>{E(prev["name"])}</b></a>
    <a href="{nxt["slug"]}.html"><span>Next</span><b>{E(nxt["name"])}</b></a>
  </div>
</section>'''
    def text_rows(photos):
        """Each paragraph sits beside a photo, alternating sides. Returns (rows html, photos left over)."""
        n = min(len(paras), len(photos))
        if not n: return "", photos
        texts = [paras[i] for i in range(n)]
        if len(paras) > n: texts[-1] = " ".join([texts[-1]] + paras[n:])
        out = ""
        for i in range(n):
            side = "pa__row--r" if i % 2 else ""
            out += f'<div class="pa__row {side}"><figure data-clip><img src="{src(photos[i])}" alt="{E(p["name"])}, {E(p["place"])}" loading="lazy"></figure><div class="pa__row-txt" data-reveal><p class="body">{E(texts[i])}</p></div></div>'
        return out, photos[n:]
    title = f'{p["name"]} · M2D Portfolio'

    if layout == "collage":
        # write-up beside a tight mosaic of photos; the photos fly in from the corners. Text and mosaic swap sides each block.
        PATTERNS = {5: "e", 4: "a", 3: "b", 2: "d", 1: "s"}
        def mosaic(photos):
            cls = PATTERNS[len(photos)]
            tiles = "".join(f'<figure class="mz__t"><img src="{src(n)}" alt="{E(p["name"])}, {E(p["place"])}" loading="lazy"></figure>' for n in photos)
            return f'<div class="mz mz--{cls}" data-mz>{tiles}</div>'
        photos = list(g); blocks = ""; i = 0
        while photos:
            left_paras = max(1, len(paras) - i)
            n = max(2, min(5, round(len(photos) / left_paras)))   # share the photos out across the paragraphs
            n = min(n, len(photos))
            if len(photos) - n == 1: n = min(5, len(photos))     # never leave a single photo on its own
            take, photos = photos[:n], photos[n:]
            text = paras[i] if i < len(paras) else ""
            if i == len(paras) - 1 and i < len(paras): text = text   # last paragraph
            side = "cl__block--r" if i % 2 else ""
            txt = f'<div class="cl__text" data-reveal><p class="body">{E(text)}</p></div>' if text else ""
            blocks += f'<div class="cl__block {side}{" cl__block--solo" if not text else ""}">{txt}{mosaic(take)}</div>'
            i += 1
        # paragraphs left over (more text than mosaics): plain text blocks at the end
        for t in paras[i:]:
            blocks += f'<div class="cl__block cl__block--textonly"><div class="cl__text" data-reveal><p class="body">{E(t)}</p></div></div>'
        body = f'''
<section class="proj-hero proj-hero--collage">
  <div class="container">
    <div class="proj-hero__top">
      <div><span class="eyebrow proj-hero__eyebrow">{T("portfolio.title")}</span><h1 class="display">{E(p["name"])}</h1><p class="lede proj-hero__tag">{E(p["tagline"])}</p></div>
      <div class="meta">{E(p["place"])} · {E(p["year"])}<br>({E(p["type"])})</div>
    </div>
  </div>
  <div class="container proj-hero__coverwrap"><div class="proj-cover" data-clip><img src="{U(p["cover"], r)}" alt="{E(p["name"])}"></div></div>
</section>
<div class="cl-wrap"><section id="story" class="container cl">{blocks}</section></div>
{nav}
{cta(r, "cta.project")}
'''
        return shell(title, body, r, desc=p["tagline"], body_class="is-collage")

    if layout == "reveal":
        main_n = g[0]; corners_n = (g[1:5] + g[1:5])[:4]; rest = g[5:] if len(g) > 5 else g[1:]
        spread = "".join(f'<figure class="pa__ph pa__ph--{i+1}"><img src="{src(n)}" alt=""></figure>' for i, n in enumerate(corners_n))
        rows, left = text_rows(rest)
        for i, n in enumerate(left):
            side = "pa__row--r" if (i + len(paras)) % 2 else ""
            rows += f'<div class="pa__row pa__row--solo {side}"><figure data-clip><img src="{src(n)}" alt="{E(p["name"])}" loading="lazy"></figure></div>'
        body = f'''
<section class="pa">
  <div class="pa__side">
    <span class="eyebrow no-line">{E(p["name"])} · {E(p["year"])}</span>
    <h1 class="pa__title">{E(p["place"])}</h1>
    <p>{E(p["tagline"])}</p>
  </div>
  <figure class="pa__main"><img src="{src(main_n)}" alt="{E(p["name"])}"></figure>
  {spread}
</section>
<section id="story" class="container pa__rows">{rows}</section>
{nav}
{cta(r, "cta.project")}
'''
        return shell(title, body, r, desc=p["tagline"], body_class="is-reveal")

    if layout == "horizontal":
        panels = f'''<div class="hs__panel hs__panel--title" style="--bg:url('{g[0]["src"] if g[0]["src"].startswith(("http","/")) else "/" + g[0]["src"]}')"><span class="eyebrow">{E(p["name"])} · {E(p["year"])}</span><h1 class="display">{E(p["place"])}</h1><p class="lede">{E(p["tagline"])}</p></div>'''
        k = 0
        for i, n in enumerate(g):
            if i % 3 == 0 and k < len(paras):
                panels += f'<div class="hs__panel hs__panel--txt"><p class="body">{E(paras[k])}</p></div>'; k += 1
            tall = "hs__panel--tall" if i % 3 == 1 else ""
            first = " hs__panel--first" if i == 0 else ""
            panels += f'<div class="hs__panel hs__panel--img {tall}{first}"><figure><img src="{src(n)}" alt="{E(p["name"])}, {E(p["place"])}" loading="lazy"></figure></div>'
        panels += f'<div class="hs__panel hs__panel--end"><a class="hs__next" href="{nxt["slug"]}.html"><span>Next project</span><b>{E(nxt["name"])}</b></a></div>'
        body = f'''
<section class="hs">
  <div class="hs__wrap"><div class="hs__track">{panels}</div></div>
  <div class="hs__bar"><i></i></div>
</section>
{nav}
{cta(r, "cta.project")}
'''
        return shell(title, body, r, desc=p["tagline"], body_class="is-horizontal")

    # editorial (vertical magazine grid)
    def im(n, cls): return f'<figure class="{cls}" data-clip><img src="{src(n)}" alt="{E(p["name"])}" loading="lazy"></figure>'
    rows, rest = text_rows(g[1:])
    gallery = ""
    layouts = ["g-l", "g-r", "g-half g-offset", "g-half", "g-full", "g-l2", "g-r2", "g-half", "g-half g-offset", "g-full"]
    for i, n in enumerate(rest):
        cls = layouts[i % len(layouts)]
        if i == len(rest) - 1 and cls.split()[0] in ("g-l", "g-l2", "g-half"): cls = "g-full"
        gallery += im(n, cls)
    body = f'''
<section class="proj-hero">
  <div class="container">
    <div class="proj-hero__top">
      <div><span class="eyebrow proj-hero__eyebrow">{T("portfolio.title")}</span><h1 class="display">{E(p["name"])}</h1><p class="lede proj-hero__tag">{E(p["tagline"])}</p></div>
      <div class="meta">{E(p["place"])} · {E(p["year"])}<br>({E(p["type"])})</div>
    </div>
  </div>
  <div class="container" style="margin-top:clamp(28px,4vw,60px)"><div class="proj-cover" data-clip><img src="{U(p["cover"], r)}" alt="{E(p["name"])}"></div></div>
</section>
<section id="story" class="container pa__rows">{rows}</section>
<section class="container"><div class="proj-gallery">{gallery}</div></section>
{nav}
{cta(r, "cta.project")}
'''
    return shell(title, body, r, desc=p["tagline"])

# ============================ SERVICES ============================
def services_page():
    r = ""
    body = f'''
<section class="chero">
  <div class="chero__bg"><img src="{P("services.hero", r)}" alt=""></div>
  <div class="container chero__in">
    <span class="eyebrow">{T("services.eyebrow")}</span>
    <h1 class="display">{T("services.title")}</h1>
    <p class="lede">{T("services.lede")}</p>
  </div>
</section>
<section class="svc-page">
  <div class="svc-grid">{svc_panels(r)}</div>
</section>
{cta(r, "cta.home")}
'''
    return shell(COPY.get("seo.title.services", ""), body, r, desc=COPY.get("seo.desc.services", ""))

# ============================ BLOG ============================
def blog():
    r = ""
    cards = (post_card(POSTS[0], r, feature=True) + "".join(post_card(p, r) for p in POSTS[1:])) if POSTS else ""
    filters = [("all", "All"), ("hdb", "HDB & BTO"), ("condo", "Condo"), ("landed", "Landed"), ("styles", "Styles"), ("renovation", "Renovation"), ("lighting", "Lighting")]
    fb = "".join(f'<button data-filter="{k}" class="{"is-active" if k=="all" else ""}">{v}</button>' for k, v in filters)
    body = f'''
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">{T("blog.eyebrow")}</span>
    <div class="page-hero__row">
      <h1 class="display">{T("blog.title")}</h1>
      <p class="lede">{T("blog.lede")}</p>
    </div>
  </div>
</section>
<section class="container" style="padding-bottom:clamp(60px,8vw,120px)">
  <div class="filters">{fb}</div>
  <div class="posts">{cards}</div>
</section>
{cta(r, "cta.blog")}
'''
    return shell(COPY.get("seo.title.blog", ""), body, r, desc=COPY.get("seo.desc.blog", ""))

def post_page(p):
    r = "../"
    body_html = p["body"] or ""
    body_html = body_html[body_html.find("<"):] if "<" in body_html else body_html
    body_html = re.sub(r'<p>\s*Updated:[^<]*</p>', '', body_html)
    body_html = re.sub(r'^(\s*<p>[^<]{0,60}min read[^<]*</p>)', '', body_html)
    body_html = body_html.replace('src="/assets/', f'src="{r}assets/').replace('href="/', f'href="{r}')
    related = [x for x in POSTS if x["slug"] != p["slug"] and set(cats_for(x)) & set(cats_for(p))][:3] or [x for x in POSTS if x["slug"] != p["slug"]][:3]
    rel = "".join(post_card(x, r) for x in related)
    body = f'''
<article class="page-hero" style="padding-bottom:0">
  <div class="container article">
    <span class="eyebrow">{" · ".join(c.upper() for c in cats_for(p))}</span>
    <h1 class="h-xl" style="margin-top:18px;text-transform:none;letter-spacing:0;font-size:clamp(30px,4.2vw,58px)">{E(p["title"])}</h1>
    <div class="article__meta"><span>{fmt_date(p["date"])}</span><span>{read_time(p)}</span><span>M2D Journal</span></div>
    <div class="article__hero" data-clip><img src="{U(cover_of(p), r)}" alt=""></div>
    <div class="article__body">{body_html}</div>
    <div class="article__foot"><a class="link" href="{r}blog.html">{ICON_L} Back to journal</a><a class="link" href="{r}contact.html">Talk to us {ICON_ARROW}</a></div>
  </div>
</article>
<section class="section"><div class="container"><div class="sec-head"><span class="eyebrow">Keep reading</span></div><div class="posts">{rel}</div></div></section>
{cta(r)}
'''
    return shell(p.get("seo_title") or f'{p["title"]} · M2D Journal', body, r, desc=p.get("seo_desc") or p["desc"])

# ============================ CONTACT ============================
def contact():
    r = ""
    body = f'''
<section class="chero">
  <div class="chero__bg"><img src="{P("contact.hero", r)}" alt=""></div>
  <div class="container chero__in">
    <span class="eyebrow">{T("contact.eyebrow")}</span>
    <h1 class="display">{T("contact.title")}</h1>
    <p class="lede">{T("contact.lede")}</p>
  </div>
</section>
<section class="container contact" style="padding-bottom:clamp(60px,8vw,120px)">
  <div class="contact__info" data-reveal>
    <div class="contact__block"><h4>{T("contact.h_wa")}</h4><a href="https://wa.me/{SITE['phone_raw']}" target="_blank" rel="noopener">{E(SITE['phone'])}</a></div>
    <div class="contact__block"><h4>{T("contact.h_email")}</h4><a href="mailto:{SITE['email']}">{E(SITE['email'])}</a></div>
    <div class="contact__block"><h4>{T("contact.h_studio")}</h4><p>{E(SITE['address']).replace(', #', ',<br>#', 1)}</p></div>
    <div class="contact__block"><h4>{T("contact.h_hours")}</h4><p>{TX(SITE.get('hours', ''))}</p></div>
    <div class="contact__block"><h4>{T("contact.h_follow")}</h4><div class="socials">
      <a href="{SITE['instagram']}" target="_blank" rel="noopener" aria-label="Instagram">{ICON_IG}</a>
      <a href="{SITE['facebook']}" target="_blank" rel="noopener" aria-label="Facebook">{ICON_FB}</a>
      <a href="{SITE['tiktok']}" target="_blank" rel="noopener" aria-label="TikTok">{ICON_TT}</a>
      <a href="{SITE['youtube']}" target="_blank" rel="noopener" aria-label="YouTube">{ICON_YT}</a></div></div>
  </div>
  <form class="form" id="enquiry" data-reveal data-to="{E(SITE['email'])}" data-thanks="{T("contact.form_thanks")}" data-error="{T("contact.form_error")}" data-sending="{T("contact.form_sending")}" data-wait="{T("contact.form_wait")}">
    <div class="field"><label for="f-name">Name</label><input id="f-name" name="name" required></div>
    <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" required></div>
    <div class="field"><label for="f-phone">Phone number</label><input id="f-phone" name="phone" type="tel" required></div>
    <div class="field"><label for="f-prop">Type of property</label><select id="f-prop" name="property"><option>HDB (resale)</option><option>HDB BTO</option><option>Condominium</option><option>Landed</option><option>Commercial</option></select></div>
    <div class="field field--full"><label for="f-src">How do you know us?</label><select id="f-src" name="source"><option>Google</option><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Facebook</option><option>Friend / referral</option><option>Other</option></select></div>
    <div class="field field--full"><label for="f-msg">Tell us about your home</label><textarea id="f-msg" name="message" placeholder="Size, key date, must-haves, budget range…"></textarea></div>
    <div class="form__trap" aria-hidden="true"><label>Leave this empty<input name="_honey" tabindex="-1" autocomplete="off"></label></div>
    <div class="form__foot"><p class="form__note">{T("contact.form_note")} <a href="https://wa.me/{SITE['phone_raw']}" target="_blank" rel="noopener">WhatsApp us</a>.</p><button class="btn btn--orange" type="submit">{T("contact.form_send")} {ICON_ARROW}</button></div>
    <p class="form__status" role="status" aria-live="polite" hidden></p>
  </form>
</section>
<div class="map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=M2%20Decor%20Pte%20Ltd&ll=1.454737,103.7983522&z=17&hl=en&output=embed" title="M2 Decor Pte Ltd on Google Maps"></iframe></div>
'''
    return shell(COPY.get("seo.title.contact", ""), body, r, desc=COPY.get("seo.desc.contact", ""), body_class="is-contact")

# ============================ WRITE ============================
def w(path, s):
    full = os.path.join(ROOT, path); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8").write(s); print("wrote", path)

def site_assets():
    """Every photo already on the website, for the CMS photo picker."""
    out = []
    base = os.path.join(ROOT, "assets", "img")
    for dp, dn, fn in os.walk(base):
        rel = os.path.relpath(dp, ROOT).replace(os.sep, "/")
        if "/thumb" in rel or rel.endswith("/press"): continue
        for f in sorted(fn):
            if re.search(r"\.(jpe?g|png|webp)$", f, re.I) and not f.startswith("logo"): out.append(f"{rel}/{f}")
    return sorted(out)

def write_sitemap():
    """sitemap.xml + robots.txt so Google finds every page on the live address."""
    base = (D["site"].get("url") or "https://m2decor.com").rstrip("/")
    today = SG_TODAY
    urls = [("/", today, "1.0"), ("/about", today, "0.8"), ("/services", today, "0.9"), ("/portfolio", today, "0.9"), ("/blog", today, "0.8"), ("/contact", today, "0.7")]
    urls += [(f"/projects/{p['slug']}", today, "0.8") for p in PROJ]
    urls += [(f"/blog/{p['slug']}", str(p.get("date") or today)[:10], "0.6") for p in POSTS]
    xml = "".join(f"<url><loc>{base}{u}</loc><lastmod>{d}</lastmod><priority>{pr}</priority></url>" for u, d, pr in urls)
    open(os.path.join(ROOT, "sitemap.xml"), "w").write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{xml}</urlset>\n')
    open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /id/\nDisallow: /my/\n\nSitemap: {base}/sitemap.xml\n")
    print(f"wrote sitemap.xml ({len(urls)} pages) + robots.txt")

def write_seed():
    """admin/seed.json: the site's current content, which the CMS starts from (and imports into Supabase)."""
    seed = dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(), content=D, projects=ALL_PROJECTS, posts=ALL_POSTS,
                assets=site_assets(), divisions=[dict(name=d["name"], colour=c) for d, c in zip(D["divisions"], DIV_COLOURS)],
                service_colours=SVC_COLOURS, layouts=list(LAYOUTS), cats=list(CATS))
    full = os.path.join(ROOT, "admin", "seed.json"); os.makedirs(os.path.dirname(full), exist_ok=True)
    json.dump(seed, open(full, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("wrote admin/seed.json")

def prune(folder, keep):
    """Remove pages of projects or posts that were deleted or renamed in the CMS."""
    d = os.path.join(ROOT, folder)
    if not os.path.isdir(d): return
    for f in os.listdir(d):
        if f.endswith(".html") and f not in keep: os.remove(os.path.join(d, f)); print("removed", f"{folder}/{f}")

if __name__ == "__main__":
    w("index.html", home()); w("about.html", about()); w("portfolio.html", portfolio()); w("blog.html", blog()); w("contact.html", contact()); w("services.html", services_page())
    for i in range(len(PROJ)): w(f"projects/{PROJ[i]['slug']}.html", project(i))
    for p in POSTS: w(f"blog/{p['slug']}.html", post_page(p))
    prune("projects", {f"{p['slug']}.html" for p in PROJ}); prune("blog", {f"{p['slug']}.html" for p in POSTS})
    write_sitemap()
    write_seed()
