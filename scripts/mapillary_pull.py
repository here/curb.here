#!/usr/bin/env python3
"""Pull Mapillary images for a bbox: GeoJSON points, per-sequence tracks, optional thumbnails.

Usage: scripts/mapillary_pull.py [minlon,minlat,maxlon,maxlat] [--thumbs]
Default bbox is the focus area (project.md). Writes:
  photos/data/mapillary-focus-images.geojson   one Point per image
  photos/data/mapillary-focus-tracks.geojson   one LineString per sequence (in-bbox part, by capture time)
  photos/cache/mapillary/<id>.jpg              256px thumbnails with --thumbs (gitignored)
Reads MAPILLARY_ACCESS_TOKEN from the environment or ../.env.
"""
import collections, datetime, json, os, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOCUS = "-118.2757,34.0811,-118.2714,34.0847"
FIELDS = "id,captured_at,compass_angle,computed_compass_angle,geometry,computed_geometry,sequence,is_pano,creator,thumb_256_url"
UA = {"User-Agent": "curb-here-research/0.1"}

def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def fetch(token, bbox, limit=2000):
    q = urllib.parse.urlencode({"bbox": ",".join(f"{x:.6f}" for x in bbox), "fields": FIELDS, "limit": limit})
    req = urllib.request.Request(f"https://graph.mapillary.com/images?{q}",
                                 headers={"Authorization": f"OAuth {token}", **UA})
    try:
        return json.load(urllib.request.urlopen(req, timeout=90)).get("data", [])
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        if "reduce the amount" in body:
            return None
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

def iso(ms):
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

def main():
    load_env()
    token = os.environ.get("MAPILLARY_ACCESS_TOKEN") or sys.exit("set MAPILLARY_ACCESS_TOKEN in .env")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    bbox = tuple(map(float, (args[0] if args else FOCUS).split(",")))
    imgs = {}
    walk(token, bbox, imgs)
    x0, y0, x1, y1 = bbox
    feats, seqs = [], collections.defaultdict(list)
    for i in imgs.values():
        geom = i.get("computed_geometry") or i.get("geometry")
        if not geom:
            continue
        lon, lat = geom["coordinates"]
        if not (x0 <= lon <= x1 and y0 <= lat <= y1):
            continue
        heading = i.get("computed_compass_angle", i.get("compass_angle"))
        props = {"id": i["id"], "captured_at": iso(i["captured_at"]) if i.get("captured_at") else None,
                 "heading": round(heading, 1) if heading is not None else None,
                 "is_pano": bool(i.get("is_pano")), "sequence": i.get("sequence"),
                 "creator": (i.get("creator") or {}).get("username"),
                 "url": f"https://www.mapillary.com/app/?pKey={i['id']}"}
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]},
                      "properties": props})
        seqs[props["sequence"]].append((i.get("captured_at") or 0, [round(lon, 7), round(lat, 7)], props))
    feats.sort(key=lambda f: (f["properties"]["sequence"] or "", f["properties"]["captured_at"] or ""))
    tracks = []
    for sid, pts in seqs.items():
        pts.sort(key=lambda p: p[0])
        coords = [p[1] for p in pts]
        if len(coords) < 2:
            continue
        tracks.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                       "properties": {"sequence": sid, "images": len(coords),
                                      "start": pts[0][2]["captured_at"], "end": pts[-1][2]["captured_at"],
                                      "is_pano": pts[0][2]["is_pano"], "creator": pts[0][2]["creator"]}})
    tracks.sort(key=lambda t: t["properties"]["start"] or "")
    outdir = ROOT / "photos/data"; outdir.mkdir(parents=True, exist_ok=True)
    for name, fs in (("images", feats), ("tracks", tracks)):
        p = outdir / f"mapillary-focus-{name}.geojson"
        p.write_text(json.dumps({"type": "FeatureCollection", "features": fs}, separators=(",", ":")) + "\n")
        print(f"wrote {p.relative_to(ROOT)} ({len(fs)} features)")
    if "--thumbs" in sys.argv:
        cache = ROOT / "photos/cache/mapillary"; cache.mkdir(parents=True, exist_ok=True)
        todo = [(i["id"], i["thumb_256_url"]) for i in imgs.values()
                if i.get("thumb_256_url") and not (cache / f"{i['id']}.jpg").exists()]
        def get(t):
            iid, url = t
            try:
                (cache / f"{iid}.jpg").write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
                return 1
            except Exception as e:
                print(f"thumb {iid}: {e}", file=sys.stderr); return 0
        with ThreadPoolExecutor(8) as ex:
            n = sum(ex.map(get, todo))
        print(f"thumbs: {n} new, {len(list(cache.glob('*.jpg')))} cached in {cache.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
