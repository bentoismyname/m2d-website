#!/usr/bin/env python3
"""Old Wix addresses (m2decor.com before the move) -> the new pages, so Google links and bookmarks keep working.
Writes the list into vercel.json ("redirects") and netlify.toml (between the REDIRECTS markers).
Run it again after changing the list:  python3 build/redirects.py
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "build"))

PAGES = {
    "/aboutm2d": "/about.html", "/contactus": "/contact.html", "/projects": "/portfolio.html", "/blog": "/blog.html",
    "/services": "/services.html", "/privacy-policy": "/", "/sitemap": "/", "/menu": "/", "/home": "/",
    # old full-gallery pages
    "/hotelathome": "/projects/hotel-at-home.html", "/japandispirit": "/projects/japandi-spirit.html",
    "/embraceserenity": "/projects/embrace-serenity.html", "/hozon": "/projects/hozon.html",
    "/ubbanfusion": "/projects/urban-fusion.html", "/ubbanfusion-1": "/projects/chaseki.html",
    # old project list pages
    "/projects/hotel-at-home": "/projects/hotel-at-home.html", "/projects/japandispirit": "/projects/japandi-spirit.html",
    "/projects/embrace-serenity": "/projects/embrace-serenity.html", "/projects/the-hozon": "/projects/hozon.html",
    "/projects/urban-grain": "/projects/urban-fusion.html", "/projects/chaseki": "/projects/chaseki.html",
    "/projects/victorian-revival": "/projects/rattan.html",
}

def clean(u):
    """/about.html -> /about, /index.html -> / (the site runs with clean addresses)."""
    u = re.sub(r"\.html$", "", u)
    return re.sub(r"(^|/)index$", r"\1", u) or "/"

def our_projects():
    return sorted(f[:-5] for f in os.listdir(os.path.join(ROOT, "projects")) if f.endswith(".html"))

def page_rules():
    """PAGES with clean destinations, leaving out any old address that is now a real page itself."""
    return [(s, clean(d)) for s, d in PAGES.items() if s != clean(d)]

def our_posts():
    return sorted(f[:-5] for f in os.listdir(os.path.join(ROOT, "blog")) if f.endswith(".html"))

def vercel_rules():
    rules = [{"source": s, "destination": d, "permanent": True} for s, d in page_rules()]
    ours = "|".join(re.escape(p) for p in our_projects())
    rules += [
        {"source": "/projects/:slug(solis.*)", "destination": "/projects/oak-and-ember", "permanent": True},
        # any other old project address that isn't one of our pages -> the portfolio
        {"source": "/projects/:slug((?!(?:" + ours + ")(?:$|/))[^./]+)", "destination": "/portfolio", "permanent": True},
    ]
    posts = our_posts()
    if posts:
        rules.append({"source": "/post/:slug(" + "|".join(re.escape(p) for p in posts) + ")", "destination": "/blog/:slug", "permanent": True})
    rules += [
        {"source": "/post/:slug*", "destination": "/blog", "permanent": True},
        {"source": "/blog/categories/:c*", "destination": "/blog", "permanent": True},
        {"source": "/blog/page/:p*", "destination": "/blog", "permanent": True},
        {"source": "/services/:s+", "destination": "/services", "permanent": True},
    ]
    return rules

def netlify_block():
    out = ["# REDIRECTS START (written by build/redirects.py)"]
    def r(f, t): out.append(f'[[redirects]]\n  from = "{f}"\n  to = "{t}"\n  status = 301\n')
    for s, d in page_rules(): r(s, d)
    r("/projects/solis-*", "/projects/oak-and-ember")
    for p in our_posts(): r(f"/post/{p}", f"/blog/{p}")
    for f in ("/post/*", "/blog/categories/*", "/blog/page/*"): r(f, "/blog")
    r("/services/*", "/services")
    r("/projects/*", "/portfolio")   # Netlify only uses this when no real page matches
    out.append("# REDIRECTS END")
    return "\n".join(out)

if __name__ == "__main__":
    vp = os.path.join(ROOT, "vercel.json"); v = json.load(open(vp))
    v["cleanUrls"] = True; v["redirects"] = vercel_rules(); json.dump(v, open(vp, "w"), indent=2); open(vp, "a").write("\n")
    np_ = os.path.join(ROOT, "netlify.toml"); n = open(np_).read()
    n = re.sub(r"\n# REDIRECTS START.*?# REDIRECTS END\n?", "\n", n, flags=re.S).rstrip() + "\n\n" + netlify_block() + "\n"
    open(np_, "w").write(n)
    print(f"vercel.json: {len(v['redirects'])} redirects; netlify.toml updated")
