#!/usr/bin/env python3
"""Fetch the CMS content into build/cms.json, which build/build.py lays over build/content.py.

Two sources:
  1. Supabase (the live CMS). Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
     Netlify runs this before every build:  python3 build/pull_cms.py && python3 build/build.py
  2. A content file downloaded from the admin while it runs in local draft mode:
     python3 build/pull_cms.py --file ~/Downloads/m2d-cms-content.json

Photos and videos uploaded in the CMS are downloaded into assets/img/cms/ (thumbnails into
assets/img/cms/thumb/), so the website serves every photo itself and never depends on Supabase to load.
Uses only the Python standard library.
"""
import base64, hashlib, json, mimetypes, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "cms.json")
MEDIA_DIR = os.path.join(ROOT, "assets", "img", "cms")
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "image/svg+xml": ".svg"}


def get(table, query=""):
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{query}", headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def from_supabase():
    settings = {row["key"]: row["value"] for row in get("cms_settings", "select=key,value")}
    meta = settings.pop("_meta", None) or {}
    imported = bool(meta.get("imported_at"))
    projects = [dict(r["data"], slug=r["slug"], enabled=r.get("enabled", True)) for r in get("cms_projects", "select=slug,data,enabled,sort&order=sort.asc,slug.asc")]
    posts = [dict(r["data"], slug=r["slug"], status=r.get("status") or "draft", date=str(r.get("published") or r["data"].get("date") or "")) for r in get("cms_posts", "select=slug,status,published,data&order=published.desc")]
    media = get("cms_media", "select=url,thumb_url,width,height")
    # until the current website has been copied into the CMS, keep the projects and posts from content.py
    return dict(content=settings, projects=projects if imported else None, posts=posts if imported else None, media=media)


def from_file(path):
    d = json.load(open(os.path.expanduser(path), encoding="utf-8"))
    return dict(content=d.get("content") or {}, projects=d.get("projects"), posts=d.get("posts"), media=d.get("media") or [])


# ---------- photos and videos: keep a local copy of everything uploaded in the CMS ----------
def _save(src, folder):
    """Download (or decode) one uploaded file; returns its path inside the site, or None."""
    os.makedirs(folder, exist_ok=True)
    h = hashlib.sha1(src.encode("utf-8")).hexdigest()[:16]
    if src.startswith("data:"):
        m = re.match(r"data:([\w/+.-]+);base64,(.*)$", src, re.S)
        if not m: return None
        ext = EXT.get(m.group(1), ".jpg"); fp = os.path.join(folder, h + ext)
        if not os.path.exists(fp): open(fp, "wb").write(base64.b64decode(m.group(2)))
    else:
        ext = os.path.splitext(src.split("?")[0])[1].lower() or ".jpg"
        if ext not in EXT.values() and ext != ".jpeg": ext = ".jpg"
        fp = os.path.join(folder, h + ext)
        if not os.path.exists(fp):
            try:
                with urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": "m2d-build"}), timeout=120) as r:
                    data = r.read()
                open(fp, "wb").write(data)
            except Exception as e:
                print("  could not download", src[:90], e); return None
    return os.path.relpath(fp, ROOT).replace(os.sep, "/")


def localise(cms):
    thumbs = {m["url"]: m.get("thumb_url") for m in cms.get("media") or [] if m.get("url")}
    found = {}

    def is_upload(s):
        return isinstance(s, str) and (s.startswith("data:image/") or s.startswith("data:video/") or "/storage/v1/object/public/" in s)

    def local(src):
        if src in found: return found[src]
        path = _save(src, MEDIA_DIR)
        if path and thumbs.get(src):   # thumbnail goes to assets/img/cms/thumb/ with the same file name
            tp = _save(thumbs[src], os.path.join(MEDIA_DIR, "_t"))
            if tp:
                os.makedirs(os.path.join(MEDIA_DIR, "thumb"), exist_ok=True)
                os.replace(os.path.join(ROOT, tp), os.path.join(MEDIA_DIR, "thumb", os.path.basename(path)))
        found[src] = path or src
        return found[src]

    url_rx = re.compile(r'(?:https?://[^"\'\s)]+/storage/v1/object/public/[^"\'\s)]+|data:image/[\w+.-]+;base64,[A-Za-z0-9+/=]+)')

    def walk(v):
        if isinstance(v, dict): return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list): return [walk(x) for x in v]
        if is_upload(v) and url_rx.fullmatch(v): return local(v)
        if isinstance(v, str) and ("<img" in v or "<iframe" in v):   # an article body: photos inside it
            return url_rx.sub(lambda m: "/" + local(m.group(0)) if local(m.group(0)) != m.group(0) else m.group(0), v)
        return v

    out = dict(content=walk(cms["content"]), projects=walk(cms["projects"]), posts=walk(cms["posts"]))
    tmp = os.path.join(MEDIA_DIR, "_t")
    if os.path.isdir(tmp) and not os.listdir(tmp): os.rmdir(tmp)
    return out, len(found)


def main():
    args = sys.argv[1:]
    if "--file" in args:
        cms = from_file(args[args.index("--file") + 1])
    elif URL and KEY:
        cms = from_supabase()
    else:
        print("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set: leaving build/cms.json as it is.")
        return
    out, n = localise(cms)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    pj = "content.py" if out["projects"] is None else len(out["projects"])
    ps = "content.py" if out["posts"] is None else len(out["posts"])
    print(f"CMS content: {len(out['content'])} sections, projects: {pj}, posts: {ps}, {n} uploaded files saved locally")


if __name__ == "__main__":
    main()
