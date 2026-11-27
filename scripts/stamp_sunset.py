#!/usr/bin/env python3
"""Stamp docs/sunset/index.html with a content hash: <script src="./main.js?v=HASH">.

main.js reads ?v= from its own URL and adds it to the data and photo requests, so one page
load always gets a consistent set of files, and a change to any file gives new URLs that
no browser or CDN has cached yet. Run this after changing anything in docs/sunset/
(osm_to_scene.py and photo_to_scene.py run it for you), and commit index.html with the change.
"""
import hashlib, re
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent / "docs/sunset"


def stamp():
    h = hashlib.sha256()
    for f in sorted(p for p in DIR.rglob("*") if p.is_file() and p.name != "index.html"):
        h.update(str(f.relative_to(DIR)).encode()); h.update(f.read_bytes())
    v = h.hexdigest()[:10]
    idx = DIR / "index.html"
    html = idx.read_text()
    new = re.sub(r'src="\./main\.js(\?v=[0-9a-f]*)?"', f'src="./main.js?v={v}"', html)
    if new != html:
        idx.write_text(new)
    return v


if __name__ == "__main__":
    print(stamp())
