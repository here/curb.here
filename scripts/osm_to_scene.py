#!/usr/bin/env python3
"""Bake OSM data for the Sunset & Silver Lake intersection into docs/sunset/data/scene.json.

Usage:
  scripts/osm_to_scene.py                 # fetch via scripts/overpass.sh, cache raw JSON, bake
  scripts/osm_to_scene.py --osm FILE      # bake from a saved Overpass JSON (out tags geom)

Coordinates are local metres: x east, z south (three.js: -z is north), y up relative to the
origin (the main traffic signal). Every guessed value is listed in GUESSES and flagged.
See three/three.md. Data: © OpenStreetMap contributors, ODbL 1.0.
"""
import argparse, json, math, os, subprocess, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BBOX = (34.0811, -118.2757, 34.0847, -118.2714)          # S, W, N, E (Overpass order)
LAT0, LON0 = 34.0829333, -118.273334                      # main signal node, Sunset & Silver Lake
CAFE = (34.0829003, -118.2735534, 4166608938)
KX = 111320 * math.cos(math.radians(LAT0))
KZ = 110574
CELL = 8.0                                                # terrain grid spacing, m
DENSIFY = 4.0                                             # max vertex spacing on lines, m

QUERY = f"""[out:json][timeout:90][bbox:{BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]}];
(way["highway"];way["building"];node["highway"~"crossing|traffic_signals|bus_stop|street_lamp"];
 node["natural"="tree"];way["landuse"];way["leisure"];way["natural"];node["kerb"];way["barrier"];);
out tags geom;"""

# --- guessing rules (keep in sync with three/three.md) -----------------------------------
GUESSES = {
    "lane_width": 3.4, "turn_lane_width": 3.0, "bike_lane": 1.5, "parking_lane": 2.4,
    "residential_width": 10.5, "service_width": 5.0, "footway_width": 1.5, "steps_width": 2.0,
    "sidewalk_width": {"primary": 3.0, "secondary": 2.4, "default": 1.5},
    "curb_height": 0.15, "kerb_lowered": 0.02, "kerb_raised": 0.18,
    "building_height": {"house": 5, "apartments": 9, "retail": 5, "commercial": 5, "default": 4},
    "bridge_clearance": 5.0, "signal_corner_offset": 13.0,
}
ROAD_CLASSES = {"primary", "secondary", "tertiary", "residential", "unclassified", "service",
                "living_street"}


def proj(lat, lon):
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)


def num(v):
    try:
        return float(str(v).split(";")[0].split()[0])
    except (ValueError, IndexError, AttributeError):
        return None


def densify(pts, step=DENSIFY):
    out = [pts[0]]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        n = max(1, math.ceil(math.hypot(x1 - x0, z1 - z0) / step))
        out += [(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n) for i in range(1, n + 1)]
    return out


def rect():
    x0, z1 = proj(BBOX[0], BBOX[1]); x1, z0 = proj(BBOX[2], BBOX[3])
    return x0, z0, x1, z1


def inside(p, R):
    return R[0] <= p[0] <= R[2] and R[1] <= p[1] <= R[3]


def clip_line(pts, R):
    """Clip a polyline to rectangle R; returns a list of pieces (Liang-Barsky per segment)."""
    pieces, cur = [], []
    for a, b in zip(pts, pts[1:]):
        t0, t1 = 0.0, 1.0
        dx, dz = b[0] - a[0], b[1] - a[1]
        ok = True
        for p_, q_ in ((-dx, a[0] - R[0]), (dx, R[2] - a[0]), (-dz, a[1] - R[1]), (dz, R[3] - a[1])):
            if p_ == 0:
                if q_ < 0: ok = False; break
            else:
                t = q_ / p_
                if p_ < 0: t0 = max(t0, t)
                else: t1 = min(t1, t)
        if not ok or t0 > t1:
            if len(cur) > 1: pieces.append(cur)
            cur = []; continue
        A = (a[0] + t0 * dx, a[1] + t0 * dz); B = (a[0] + t1 * dx, a[1] + t1 * dz)
        if not cur: cur = [A]
        cur.append(B)
        if t1 < 1:
            pieces.append(cur); cur = []
    if len(cur) > 1: pieces.append(cur)
    return pieces


def clip_poly(pts, R):
    """Sutherland-Hodgman clip of a polygon ring (no closing vertex) to rectangle R."""
    def cut(poly, inside_fn, inter):
        out = []
        for i, cur in enumerate(poly):
            prev = poly[i - 1]
            if inside_fn(cur):
                if not inside_fn(prev): out.append(inter(prev, cur))
                out.append(cur)
            elif inside_fn(prev):
                out.append(inter(prev, cur))
        return out
    def ix(xv):
        return lambda a, b: (xv, a[1] + (b[1] - a[1]) * (xv - a[0]) / (b[0] - a[0]))
    def iz(zv):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (zv - a[1]) / (b[1] - a[1]), zv)
    for f, i in ((lambda p: p[0] >= R[0], ix(R[0])), (lambda p: p[0] <= R[2], ix(R[2])),
                 (lambda p: p[1] >= R[1], iz(R[1])), (lambda p: p[1] <= R[3], iz(R[3]))):
        pts = cut(pts, f, i)
        if not pts: break
    return pts


def r2(p):
    return [round(p[0], 2), round(p[1], 2)]


# --- terrain from LA County building ele (ground elevation at each building) --------------
def build_terrain(samples):
    x0, z1 = proj(BBOX[0], BBOX[1])
    x1, z0 = proj(BBOX[2], BBOX[3])
    nx = int(math.ceil((x1 - x0) / CELL)) + 1
    nz = int(math.ceil((z1 - z0) / CELL)) + 1
    heights = []
    for j in range(nz):
        z = z0 + j * CELL
        for i in range(nx):
            x = x0 + i * CELL
            d = sorted(((x - sx) ** 2 + (z - sz) ** 2, e) for sx, sz, e in samples)[:12]
            if d[0][0] < 1e-6:
                heights.append(d[0][1]); continue
            w = [1 / dd for dd, _ in d]
            heights.append(sum(wi * e for wi, (_, e) in zip(w, d)) / sum(w))
    return {"x0": round(x0, 2), "z0": round(z0, 2), "cell": CELL, "nx": nx, "nz": nz,
            "heights": heights}


def sampler(t):
    def h(x, z):
        fx = min(max((x - t["x0"]) / t["cell"], 0), t["nx"] - 1.001)
        fz = min(max((z - t["z0"]) / t["cell"], 0), t["nz"] - 1.001)
        i, j = int(fx), int(fz); u, v = fx - i, fz - j
        H = t["heights"]; n = t["nx"]
        a, b = H[j * n + i], H[j * n + i + 1]
        c, d = H[(j + 1) * n + i], H[(j + 1) * n + i + 1]
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
    return h


# --- roads -------------------------------------------------------------------------------
def road_profile(t):
    """Return (carriageway width, lanes_fwd, lanes_bwd, bike, parking, guessed)."""
    hw = t["highway"]
    lanes = num(t.get("lanes"))
    f, b = num(t.get("lanes:forward")), num(t.get("lanes:backward"))
    oneway = t.get("oneway") in ("yes", "1", "true")
    if f is not None and b is not None:
        lanes = f + b
    if lanes is None:
        lanes = 1 if oneway else 2
    lanes = int(lanes)
    if f is None or b is None:
        if oneway:
            f, b = lanes, 0
        else:
            b = lanes // 2; f = lanes - b
    f, b = int(f), int(b)
    bike = 1 if t.get("cycleway") == "lane" or t.get("cycleway:both") == "lane" else 0
    if hw == "service":
        return GUESSES["service_width"], f, b, 0, 0
    if hw in ("residential", "unclassified", "living_street") and "lanes" not in t:
        return GUESSES["residential_width"], f, b, 0, 1
    has_turn = any(k.startswith("turn:lanes") for k in t)
    parking = 1 if hw in ("primary", "secondary") and not has_turn and lanes <= 4 else 0
    if hw in ("residential", "unclassified", "living_street"):
        parking = 1
    w = lanes * GUESSES["lane_width"] + bike * 2 * GUESSES["bike_lane"] \
        + parking * 2 * GUESSES["parking_lane"]
    return round(w, 2), f, b, bike, parking


def seg_dist(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p
    dx, dz = bx - ax, bz - az
    L = dx * dx + dz * dz
    s = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / L))
    return math.hypot(px - ax - s * dx, pz - az - s * dz)


def bake(elements):
    H = None
    samples, buildings, roads, sidewalks, crossings, footways = [], [], [], [], [], []
    areas, kerbs, signals, labels = [], [], [], {}
    for e in elements:
        t = e.get("tags", {})
        if e["type"] == "way" and "building" in t and "geometry" in e:
            ring = [proj(p["lat"], p["lon"]) for p in e["geometry"]]
            ele = num(t.get("ele"))
            if ele is not None:
                cx = sum(p[0] for p in ring) / len(ring); cz = sum(p[1] for p in ring) / len(ring)
                samples.append((cx, cz, ele))
    terrain = build_terrain(samples)
    H = sampler(terrain)
    y0 = H(0, 0)
    terrain["heights"] = [round(h - y0, 2) for h in terrain["heights"]]
    terrain["source"] = "IDW of LA County building ele (OSM), 12 nearest"
    H = sampler(terrain)

    def bake_way(e, t, pts):
        hw = t.get("highway")
        if "building" in t:
            kind = t["building"]
            h = num(t.get("height")); g = h is None
            if g:
                hb = GUESSES["building_height"]
                h = hb.get(kind, hb["default"])
            if pts[0] == pts[-1]:
                pts = pts[:-1]
            b = {"id": e["id"], "ring": [r2(p) for p in pts], "h": round(h, 2), "kind": kind}
            if g: b["guessed"] = True
            if t.get("name"): b["name"] = t["name"]
            buildings.append(b)
        elif hw in ROAD_CLASSES:
            w, f, b, bike, park = road_profile(t)
            line = densify(pts)
            r = {"id": e["id"], "line": [r2(p) for p in line], "w": w, "f": f, "b": b,
                 "bike": bike, "park": park, "kind": hw, "guessed": True}
            if t.get("name"): r["name"] = t["name"]
            if t.get("bridge") == "yes":
                r["bridge"] = True
                ya, yb = H(*line[0]), H(*line[-1])
                r["y"] = [round(ya + (yb - ya) * i / max(1, len(line) - 1), 2)
                          for i in range(len(line))]
            for k in ("turn:lanes:forward", "turn:lanes:backward"):
                if k in t: r[k.replace("turn:lanes:", "turn_")] = t[k]
            roads.append(r)
        elif hw == "footway" and t.get("footway") == "sidewalk":
            sidewalks.append({"id": e["id"], "line": densify(pts), "bridge": t.get("bridge") == "yes"})
        elif hw == "footway" and t.get("footway") == "crossing":
            crossings.append({"id": e["id"], "line": [r2(p) for p in densify(pts, 1.0)],
                              "markings": t.get("crossing:markings", "unknown")})
        elif hw in ("footway", "path", "pedestrian", "steps"):
            footways.append({"id": e["id"], "line": [r2(p) for p in densify(pts)],
                             "kind": hw, "w": GUESSES["steps_width" if hw == "steps" else "footway_width"]})
        elif pts[0] == pts[-1] and (t.get("leisure") or t.get("landuse") or t.get("natural")):
            kind = t.get("leisure") or t.get("landuse") or t.get("natural")
            areas.append({"id": e["id"], "ring": [r2(p) for p in pts[:-1]], "kind": kind,
                          **({"name": t["name"]} if t.get("name") else {})})

    def bake_node(e, t):
        p = proj(e["lat"], e["lon"])
        if t.get("kerb"):
            kerbs.append({"id": e["id"], "p": r2(p), "kind": t["kerb"],
                          "tactile": t.get("tactile_paving") == "yes"})
        if t.get("highway") == "traffic_signals":
            signals.append({"id": e["id"], "p": r2(p)})

    R = rect()
    for e in elements:
        t = e.get("tags", {})
        if e["type"] == "way" and "geometry" in e:
            full = [proj(p["lat"], p["lon"]) for p in e["geometry"]]
            if "building" in t:   # keep whole buildings whose centroid is inside
                cx = sum(p[0] for p in full) / len(full); cz = sum(p[1] for p in full) / len(full)
                parts = [full] if inside((cx, cz), R) else []
            elif full[0] == full[-1] and "highway" not in t:   # areas: clip polygon
                ring = clip_poly(full[:-1], R)
                parts = [ring + ring[:1]] if len(ring) >= 3 else []
            else:   # lines: clip, possibly into several pieces
                parts = [densify(pc) for pc in clip_line(full, R)]
            for pts in parts:
                bake_way(e, t, pts)
        elif e["type"] == "node" and inside(proj(e["lat"], e["lon"]), R):
            bake_node(e, t)

    # sidewalk width from the nearest road class
    for s in sidewalks:
        mid = s["line"][len(s["line"]) // 2]
        best, cls, by = 1e9, "default", None
        for r in roads:
            L = r["line"]
            for a, b in zip(L, L[1:]):
                d = seg_dist(mid, a, b)
                if d < best:
                    best, cls = d, r["kind"]
        sw = GUESSES["sidewalk_width"]
        s["w"] = sw.get(cls, sw["default"]) if best < 25 else sw["default"]
        s["line"] = [r2(p) for p in s["line"]]
        s["guessed"] = True
        if s["bridge"]:
            s["y"] = [round(H(*s["line"][0]) + (H(*s["line"][-1]) - H(*s["line"][0])) * i
                            / max(1, len(s["line"]) - 1), 2) for i in range(len(s["line"]))]
        else:
            del s["bridge"]

    # signal poles at four corners, oriented along the nearest primary/secondary road (guess)
    poles = []
    for sg in signals:
        best, ang = 1e9, 0.0
        for r in roads:
            if r["kind"] not in ("primary", "secondary"): continue
            L = r["line"]
            for a, b in zip(L, L[1:]):
                d = seg_dist(sg["p"], a, b)
                if d < best:
                    best, ang = d, math.atan2(b[1] - a[1], b[0] - a[0])
        off = GUESSES["signal_corner_offset"]
        for k in range(4):
            a = ang + math.pi / 4 + k * math.pi / 2
            poles.append({"p": r2((sg["p"][0] + off * math.cos(a), sg["p"][1] + off * math.sin(a))),
                          "toward": r2(sg["p"]), "guessed": True})

    # street labels: one per name, at the midpoint of the longest way
    for r in roads:
        n = r.get("name")
        if not n: continue
        L = r["line"]
        length = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(L, L[1:]))
        if length > labels.get(n, (0,))[0]:
            labels[n] = (length, L[len(L) // 2])
    cafe = proj(CAFE[0], CAFE[1])
    return {
        "meta": {
            "origin": {"lat": LAT0, "lon": LON0, "note": "traffic signal, Sunset & Silver Lake"},
            "bbox": BBOX, "baked": datetime.date.today().isoformat(),
            "attribution": "© OpenStreetMap contributors, ODbL 1.0",
            "axes": "x east, z south, y up (m, relative to origin ground)",
            "guesses": GUESSES,
        },
        "terrain": terrain, "buildings": buildings, "roads": roads, "sidewalks": sidewalks,
        "crossings": crossings, "footways": footways, "areas": areas, "kerbs": kerbs,
        "signals": signals, "poles": poles,
        "labels": [{"text": n, "p": r2(p)} for n, (_, p) in labels.items()],
        "pois": [{"name": "Cafe Tropical", "id": CAFE[2], "p": r2(cafe)}],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", help="saved Overpass JSON (out tags geom)")
    ap.add_argument("--out", default=os.path.join(ROOT, "docs/sunset/data/scene.json"))
    a = ap.parse_args()
    if a.osm:
        raw = open(a.osm).read()
    else:
        raw = subprocess.run([os.path.join(ROOT, "scripts/overpass.sh"), QUERY],
                             capture_output=True, text=True, check=True).stdout
        os.makedirs(os.path.join(ROOT, "three/cache"), exist_ok=True)
        open(os.path.join(ROOT, "three/cache/osm.json"), "w").write(raw)
    scene = bake(json.loads(raw)["elements"])
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(scene, f, separators=(",", ":"))
    c = {k: len(v) for k, v in scene.items() if isinstance(v, list)}
    print(f"wrote {a.out} ({os.path.getsize(a.out)//1024} KB): {c}", file=sys.stderr)


if __name__ == "__main__":
    main()
