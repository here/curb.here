#!/usr/bin/env python3
"""Build data/photos/examples.md: up to 10 sample images per service near Cafe Tropical.

- Mapillary thumbnail URLs are signed and expire, so thumbnails are downloaded into
  data/photos/examples/mapillary/ (CC-BY-SA 4.0, attributed in the doc).
- KartaView (cdn.kartaview.org) and Panoramax URLs are stable public links, so they are hotlinked.

Usage: python3 -I scripts/make_photo_examples.py
"""
import base64, collections, datetime as dt, json, math, os, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_MD = ROOT / "data" / "photos" / "examples.md"
MLY_DIR = ROOT / "data" / "photos" / "examples" / "mapillary"
CAFE = (34.0829003, -118.2735534)          # lat, lon — Cafe Tropical, 2900 W Sunset Blvd
FOCUS = (-118.2757, 34.0811, -118.2714, 34.0847)
NEAR = (-118.2745, 34.0822, -118.2726, 34.0836)   # tighter box for Mapillary (API rejects big responses)
WIDE = (-118.285, 34.075, -118.250, 34.105)       # all of Silver Lake (Panoramax fallback)
N = 10
UA = {"User-Agent": "curb.here-research"}


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get_json(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def dist_m(lat, lon):
    dy = (lat - CAFE[0]) * 111_320
    dx = (lon - CAFE[1]) * 111_320 * math.cos(math.radians(CAFE[0]))
    return round(math.hypot(dx, dy))


def spread(items, key, n=N):
    """Round-robin across groups (e.g. year) so samples cover the range; nearest first in each group."""
    groups = collections.defaultdict(list)
    for it in sorted(items, key=lambda i: i["dist"]):
        groups[key(it)].append(it)
    order = sorted(groups, reverse=True)
    out = []
    while len(out) < n and any(groups.values()):
        for g in order:
            if groups[g] and len(out) < n:
                out.append(groups[g].pop(0))
    return out


def mapillary():
    token = os.environ.get("MAPILLARY_ACCESS_TOKEN")
    if not token:
        return [], "no MAPILLARY_ACCESS_TOKEN"
    q = urllib.parse.urlencode({"bbox": ",".join(map(str, NEAR)), "limit": 500,
                                "fields": "id,captured_at,compass_angle,geometry,is_pano,thumb_1024_url,sequence"})
    data = get_json(f"https://graph.mapillary.com/images?{q}", headers={"Authorization": f"OAuth {token}"})["data"]
    items, seen_seq = [], set()
    for i in data:
        lon, lat = i["geometry"]["coordinates"]
        items.append({"id": i["id"], "lat": lat, "lon": lon, "dist": dist_m(lat, lon), "seq": i.get("sequence"),
                      "date": dt.datetime.fromtimestamp(i["captured_at"] / 1000, dt.UTC).date().isoformat(),
                      "pano": i.get("is_pano"), "heading": i.get("compass_angle"), "thumb": i["thumb_1024_url"]})
    # one image per sequence where possible, spread across years
    uniq = []
    for it in sorted(items, key=lambda i: i["dist"]):
        if it["seq"] not in seen_seq:
            seen_seq.add(it["seq"]); uniq.append(it)
    picks = spread(uniq, key=lambda i: i["date"][:4])
    if len(picks) < N:
        picks += spread([i for i in items if i not in picks], key=lambda i: i["date"][:4], n=N - len(picks))
    MLY_DIR.mkdir(parents=True, exist_ok=True)
    for old in MLY_DIR.glob("*.jpg"):
        old.unlink()
    for p in picks:
        f = MLY_DIR / f"{p['id']}.jpg"
        with urllib.request.urlopen(urllib.request.Request(p["thumb"], headers=UA), timeout=60) as r:
            f.write_bytes(r.read())
        p["src"] = f"examples/mapillary/{f.name}"
        p["link"] = f"https://www.mapillary.com/app/?pKey={p['id']}"
    return picks, f"{len(data)} images in the near-cafe box"


def kv_cdn(storage_path):
    # "storage11/files/photo/2019/..." -> https://cdn.kartaview.org/pr:sharp/<b64url(https://storage11.openstreetcam.org/files/photo/...)>
    host, rest = storage_path.split("/", 1)
    raw = f"https://{host}.openstreetcam.org/{rest}"
    return "https://cdn.kartaview.org/pr:sharp/" + base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def kartaview():
    k = "https://api.kartaview.org"
    items = {}
    near = get_json(f"{k}/1.0/list/nearby-photos/", data=f"lat={CAFE[0]}&lng={CAFE[1]}&radius=300".encode())["currentPageItems"]
    for p in near:
        lat, lon = float(p["lat"]), float(p["lng"])
        items[p["id"]] = {"id": p["id"], "lat": lat, "lon": lon, "dist": dist_m(lat, lon), "seq": p["sequence_id"],
                          "idx": p["sequence_index"], "date": p["date_added"][:10], "heading": p.get("heading"),
                          "src": kv_cdn(p["lth_name"])}
    v2 = get_json(f"{k}/2.0/photo/?lat={CAFE[0]}&lng={CAFE[1]}&radius=300&itemsPerPage=150")["result"]["data"]
    for p in v2:
        lat, lon = float(p["lat"]), float(p["lng"])
        date = (p.get("shotDate") or "")[:10]
        if not date or date.startswith("0001"):
            date = p["dateAdded"][:10]
        items.setdefault(p["id"], {"id": p["id"], "lat": lat, "lon": lon, "dist": dist_m(lat, lon),
                                   "seq": p["sequenceId"], "idx": p["sequenceIndex"], "date": date,
                                   "heading": p.get("heading"), "src": p["imageLthUrl"]})
    allp = list(items.values())
    # one per sequence first (diversity), spread across years, then fill
    by_seq = {}
    for it in sorted(allp, key=lambda i: i["dist"]):
        by_seq.setdefault(it["seq"], it)
    picks = spread(list(by_seq.values()), key=lambda i: i["date"][:4])
    if len(picks) < N:
        rest = [i for i in sorted(allp, key=lambda i: i["dist"]) if i not in picks]
        # take evenly spaced photos so they aren't all from one spot
        step = max(1, len(rest) // (N - len(picks)))
        picks += rest[::step][: N - len(picks)]
    for p in picks:
        p["link"] = f"https://kartaview.org/details/{p['seq']}/{p['idx']}"
    return picks, f"{len(allp)} photos within ~300 m"


def panoramax():
    def search(b):
        return get_json(f"https://api.panoramax.xyz/api/search?bbox={','.join(map(str, b))}&limit=100").get("features", [])
    feats, scope = search(FOCUS), "focus box"
    if not feats:
        feats, scope = search(WIDE), "all of Silver Lake (none in the focus box)"
    picks = []
    for f in feats[:N]:
        lon, lat = f["geometry"]["coordinates"]
        a = f["assets"]
        picks.append({"id": f["id"], "lat": lat, "lon": lon, "dist": dist_m(lat, lon),
                      "date": f["properties"]["datetime"][:10], "heading": f["properties"].get("view:azimuth"),
                      "src": (a.get("sd") or a.get("thumb") or a.get("hd"))["href"],
                      "link": f"https://api.panoramax.xyz/#focus=pic&pic={f['id']}",
                      "license": f["properties"].get("license")})
    return picks, f"{len(feats)} image(s) in {scope}"


def table(picks):
    if not picks:
        return "_No images found._\n"
    cells = []
    for p in picks:
        cap = f"{p['date']} · {p['dist']} m from cafe"
        if p.get("heading") not in (None, "", "0"):
            try:
                cap += f" · heading {round(float(p['heading']))}°"
            except ValueError:
                pass
        cells.append(f'<td align="center" width="50%"><a href="{p["link"]}"><img src="{p["src"]}" width="360" alt="{p["date"]}"></a><br><sub>{cap}</sub></td>')
    rows = ["<tr>" + "".join(cells[i:i + 2]) + "</tr>" for i in range(0, len(cells), 2)]
    return "<table>\n" + "\n".join(rows) + "\n</table>\n"


def main():
    load_env()
    mly, mly_note = mapillary()
    kv, kv_note = kartaview()
    px, px_note = panoramax()
    today = dt.date.today().isoformat()
    md = f"""# Example photos — Cafe Tropical, Sunset & Silver Lake

Up to {N} sample street-level images from each service near **Cafe Tropical** (2900 W Sunset Blvd,
{CAFE[0]:.5f}, {CAFE[1]:.5f}). Generated {today} by `scripts/make_photo_examples.py`. Click an image to open it in the service's viewer.
See [photos.md](photos.md) for the comparison.

| Service | Shown | Pool | Image hosting in this doc |
|---|---|---|---|
| Mapillary | {len(mly)} | {mly_note} | thumbnails copied into the repo (signed URLs expire) |
| KartaView | {len(kv)} | {kv_note} | hotlinked from `cdn.kartaview.org` |
| Panoramax | {len(px)} | {px_note} | hotlinked from the source instance |

Picks: one image per sequence where possible, spread across capture years, nearest to the cafe first.

## Mapillary
{table(mly)}
<sub>Images © Mapillary contributors, CC-BY-SA 4.0.</sub>

## KartaView
{table(kv)}
<sub>Images © KartaView contributors, CC-BY-SA 4.0. KartaView's API reports only the upload date for most of these.</sub>

## Panoramax
{table(px)}
<sub>License per image: {", ".join(sorted({p.get("license") or "?" for p in px})) or "n/a"}.</sub>
"""
    OUT_MD.write_text(md)
    print(f"wrote {OUT_MD.relative_to(ROOT)}: mapillary={len(mly)} kartaview={len(kv)} panoramax={len(px)}")


if __name__ == "__main__":
    main()
