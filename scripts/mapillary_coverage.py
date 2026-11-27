#!/usr/bin/env python3
"""Count Mapillary images in a bbox by tiling (Graph API caps results per request).

Usage: scripts/mapillary_coverage.py [minlon,minlat,maxlon,maxlat]
Reads MAPILLARY_ACCESS_TOKEN from the environment or ../.env.
"""
import collections, datetime, json, os, sys, urllib.parse, urllib.request
from pathlib import Path

def load_env():
    env = Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def fetch(token, bbox, limit=2000):
    q = urllib.parse.urlencode({"bbox": ",".join(f"{x:.6f}" for x in bbox),
                                "fields": "id,captured_at,sequence,is_pano,creator", "limit": limit})
    req = urllib.request.Request(f"https://graph.mapillary.com/images?{q}",
                                 headers={"Authorization": f"OAuth {token}"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60)).get("data", [])
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        if "reduce the amount" in body:
            return None  # too big -> caller subdivides
        raise SystemExit(f"HTTP {e.code}: {body[:300]}")

def walk(token, bbox, out, depth=0):
    data = fetch(token, bbox)
    if data is None or (len(data) >= 2000 and depth < 8):
        x0, y0, x1, y1 = bbox; mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        for b in ((x0, y0, mx, my), (mx, y0, x1, my), (x0, my, mx, y1), (mx, my, x1, y1)):
            walk(token, b, out, depth + 1)
    else:
        for i in data:
            out[i["id"]] = i

def main():
    load_env()
    token = os.environ.get("MAPILLARY_ACCESS_TOKEN") or sys.exit("set MAPILLARY_ACCESS_TOKEN in .env")
    bbox = tuple(map(float, (sys.argv[1] if len(sys.argv) > 1 else "-118.285,34.075,-118.250,34.105").split(",")))
    x0, y0, x1, y1 = bbox; step = 0.005; imgs = {}
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            walk(token, (x, y, min(x + step, x1), min(y + step, y1)), imgs)
            x += step
        y += step
    vals = list(imgs.values())
    years = collections.Counter(datetime.datetime.fromtimestamp(i["captured_at"] / 1000, datetime.UTC).year
                                for i in vals if i.get("captured_at"))
    print(f"bbox: {bbox}")
    print(f"images: {len(vals)}")
    print(f"sequences: {len({i.get('sequence') for i in vals})}")
    print(f"panoramas: {sum(1 for i in vals if i.get('is_pano'))}")
    print(f"contributors: {len({(i.get('creator') or {}).get('id') for i in vals})}")
    print("years:", ", ".join(f"{k}: {v}" for k, v in sorted(years.items())))

if __name__ == "__main__":
    main()
