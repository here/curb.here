#!/usr/bin/env python3
"""Bake Mapillary photos (pose + intrinsics + 2048px image) for the sunset/ viewer.

Usage: scripts/photo_to_scene.py ID [ID ...] [--height M]
Writes docs/sunset/data/photos.json and docs/sunset/photos/<id>.jpg.
Reads MAPILLARY_ACCESS_TOKEN from .env (never printed). See three/three.md.

Pose: Mapillary's SfM `computed_rotation` (angle-axis, world ENU -> camera, camera x right,
y down, z forward) and `computed_geometry`. Camera height above ground isn't reliable in
Mapillary, so it's a per-photo guess (--height, default 1.2 m).
Intrinsics: perspective [f, k1, k2], with f normalised by max(width, height).
Mapillary imagery is CC BY-SA 4.0.
"""
import json, math, os, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/sunset"
LAT0, LON0 = 34.0829333, -118.273334            # keep in sync with osm_to_scene.py
KX = 111320 * math.cos(math.radians(LAT0)); KZ = 110574
FIELDS = ("id,captured_at,computed_compass_angle,computed_geometry,computed_rotation,"
          "camera_type,camera_parameters,width,height,creator,make,model,thumb_2048_url")
UA = {"User-Agent": "curb-here-research/0.1"}


def token():
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("MAPILLARY_ACCESS_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("MAPILLARY_ACCESS_TOKEN missing from .env")


def rot(r):
    th = math.sqrt(sum(a * a for a in r)); x, y, z = (a / th for a in r)
    c, s = math.cos(th), math.sin(th); C = 1 - c
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
            [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
            [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]


def main():
    args = sys.argv[1:]
    height = 1.2
    if "--height" in args:
        i = args.index("--height"); height = float(args[i + 1]); del args[i:i + 2]
    tok = token()
    path = OUT / "data/photos.json"
    photos = {p["id"]: p for p in json.loads(path.read_text())["photos"]} if path.exists() else {}
    (OUT / "photos").mkdir(parents=True, exist_ok=True)
    for pid in args:
        req = urllib.request.Request(f"https://graph.mapillary.com/{pid}?fields={FIELDS}",
                                     headers={"Authorization": f"OAuth {tok}", **UA})
        m = json.load(urllib.request.urlopen(req, timeout=60))
        if m.get("camera_type") != "perspective":
            print(f"{pid}: camera_type {m.get('camera_type')} not supported yet, skipped", file=sys.stderr)
            continue
        img = OUT / "photos" / f"{pid}.jpg"
        img.write_bytes(urllib.request.urlopen(urllib.request.Request(m["thumb_2048_url"], headers=UA),
                                               timeout=60).read())
        lon, lat = m["computed_geometry"]["coordinates"]
        R = rot(m["computed_rotation"])
        f, k1, k2 = (m["camera_parameters"] + [0, 0])[:3]
        fwd = R[2]
        photos[pid] = {
            "id": pid, "source": "mapillary", "url": f"https://www.mapillary.com/app/?pKey={pid}",
            "creator": (m.get("creator") or {}).get("username", "unknown"),
            "license": "CC BY-SA 4.0",
            "captured_at": m["captured_at"], "camera": f"{m.get('make', '')} {m.get('model', '')}".strip(),
            "image": f"photos/{pid}.jpg", "width": m["width"], "height": m["height"],
            "p": [round((lon - LON0) * KX, 2), round(-(lat - LAT0) * KZ, 2)],
            "h": height, "h_guessed": True,
            "R_enu": [[round(v, 6) for v in row] for row in R],
            "f": f, "k1": k1, "k2": k2,
            "heading": round(math.degrees(math.atan2(fwd[0], fwd[1])) % 360, 1),
            "pitch": round(math.degrees(math.asin(fwd[2])), 1),
        }
        print(f"{pid}: {photos[pid]['p']} heading {photos[pid]['heading']}", file=sys.stderr)
    path.write_text(json.dumps({"photos": list(photos.values())}, indent=1))
    import stamp_sunset; stamp_sunset.stamp()   # new ?v= so browsers and the CDN fetch the new files


if __name__ == "__main__":
    main()
