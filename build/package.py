#!/usr/bin/env python3
"""Copy the finished website into dist/ (what Netlify publishes). Leaves out the build scripts,
the handover portal, notes and the unused source videos."""
import os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
PAGES = ["index.html", "about.html", "services.html", "portfolio.html", "blog.html", "contact.html"]
FOLDERS = ["projects", "blog", "assets", "admin", "id", "my"]
SKIP = {"hero-previous.mp4", "hero-source.mp4", "hero2-source.mp4", ".DS_Store"}

shutil.rmtree(DIST, ignore_errors=True)
os.makedirs(DIST)
for p in PAGES:
    shutil.copy2(os.path.join(ROOT, p), DIST)
for f in FOLDERS:
    shutil.copytree(os.path.join(ROOT, f), os.path.join(DIST, f), ignore=lambda d, names: [n for n in names if n in SKIP])
for extra in ("robots.txt", "sitemap.xml", "favicon.ico"):
    if os.path.exists(os.path.join(ROOT, extra)): shutil.copy2(os.path.join(ROOT, extra), DIST)
size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DIST) for f in fs)
print(f"dist/ ready: {size / 1e6:.0f} MB")
