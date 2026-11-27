# three.js: Sunset & Silver Lake in the browser

Plan for a 3D model of the **Sunset Blvd & Silver Lake Blvd** intersection, around Cafe Tropical, that you can look around with the mouse.
- Geometry comes from OSM. Where OSM has no value, we guess and record the guess (see [Guessing rules](#guessing-rules)).
- Field photos (Mapillary, KartaView, Panoramax) are **out of scope for now**.
- Hosting: GitHub Pages serves static files, and a Cloudflare Worker (deployed with `wrangler`) serves them at **https://curb.here/sunset/**.

## What OSM has here (checked 2026-11-27, focus bbox via overpass.ch)
One query returned 532 elements (buildings, highways, crossings, kerbs, signals, landuse, barriers).

| Layer | In OSM | Notes for 3D |
|---|---|---|
| Buildings | 311 footprints. **304 have `height` and `ele`** (LA County building import: `lacounty:bld_id`, `start_date`). | Height runs 0.5–15.3 m, with a mean of 5.9 m. `ele` runs 101.5–148.7 m, so the area is **hilly** (a 47 m relief inside 400 m), and terrain matters. There are no `building:levels`. Some values are lists like `4.3;3.9`; take the first. |
| Sunset Blvd | 9 ways, `highway=primary`. Lanes run 4–7 and have `lanes:forward/backward`, `turn:lanes:*`, `cycleway=lane` and `sidewalk:both=separate`. | Way **30528196** is a `bridge=yes` with `layer=1`, just east of the intersection (about 34.08247,-118.27271 to 34.08266,-118.27298). Check what passes under it before modelling it. |
| Silver Lake Blvd | 5 ways, `highway=secondary`, with 2–5 lanes and some turn lanes. | Tagging is good enough to set the lane count and turn arrows per segment. |
| Other roads | 24 residential, 13 service and 2 steps (one is Music Box Steps, way 37120567). | Widths are guessed. |
| Sidewalks | 62 `footway=sidewalk` lines and 20 `footway=crossing`. | The sidewalks are mapped as **separate lines**, so draw them from their real centerlines. |
| Kerbs | 34 `barrier=kerb` nodes: 21 `kerb=lowered` and 14 `kerb=raised`. | These go at curb ramps; between them, use a standard curb. |
| Crossings | 47 tagged. `crossing:markings` is zebra 9, ladder 8, yes 4, no 22. | Paint these as stripe textures on the road. |
| Signals | 3 `traffic_signals` nodes. The main one is **34.0829333, -118.273334**, next to the cafe. | Use this node as the **scene origin**. Place signal poles at the corners (guessed). |
| Green | Laurel and Hardy Park, plus 3 swimming pools. | Use flat colored polygons. |
| Trees, lamps, poles | **None mapped** (0 `natural=tree`). | Leave them out or add a few by hand; see "Later" below. |

Attribution, shown on the page: **© OpenStreetMap contributors, ODbL 1.0**.

## Architecture
```
scripts/osm_to_scene.py   (offline; runs scripts/overpass.sh; raw JSON cached in three/cache/, gitignored)
        │  Overpass JSON → terrain from building ele, clipped to the bbox
        ▼
docs/sunset/data/scene.json   (projected to local metres, committed, ~145 KB)
        │
docs/sunset/index.html + main.js   (three.js 0.170.0 from jsDelivr through an import map; no build step)
        │  GitHub Pages: branch main, folder /docs
        ▼
https://here.github.io/curb.here/sunset/
        │  Cloudflare Worker (wrangler), route curb.here/sunset*
        ▼
https://curb.here/sunset/
```

**Bake the data offline. The browser must never call Overpass.** The overpass.ch key is in the URL path, and anything sent to the browser is public. Baking also keeps the page fast and stable when Overpass is overloaded.

### Data pipeline (`scripts/osm_to_scene.py`)
Run `scripts/osm_to_scene.py` to fetch and bake, or `scripts/osm_to_scene.py --osm three/cache/osm.json` to re-bake from the cached extract with no network.
1. Fetch the focus bbox using `scripts/overpass.sh` with `out tags geom;`. That returns way geometry inline, so there's no node join. The query is the one used above:
   ```
   [out:json][timeout:90][bbox:34.0811,-118.2757,34.0847,-118.2714];
   (way["highway"];way["building"];node["highway"~"crossing|traffic_signals|bus_stop|street_lamp"];
    node["natural"="tree"];way["landuse"];way["leisure"];way["natural"];node["kerb"];way["barrier"];);
   out tags geom;
   ```
2. Terrain: an 8 m grid (51×51) **interpolated from the building `ele` values** (inverse-distance weighting over the 12 nearest of the 304 buildings).
   - Why not overpass.ch elevation? Outside Switzerland it serves Copernicus GLO-30, a 30 m *surface* model that includes roofs and trees, which would put bumps under every building. It would also use up the API quota.
   - The LA County `ele` is ground elevation at each building, which is denser and closer to the real ground.
   - Weak spots: the middle of wide streets and the park, where there are no buildings. A real DTM (USGS 3DEP 1 m lidar) would fix that later.
   - Geometry is clipped to the bbox (Liang–Barsky for lines, Sutherland–Hodgman for areas). Buildings are kept whole when their centroid is inside, which leaves 288.
3. Project to local metres: east, north and up, with the origin at the main signal node. At this scale an equirectangular tangent plane is fine:
   ```
   lat0 = 34.0829333, lon0 = -118.273334
   x =  (lon - lon0) * 111320 * cos(lat0)      # east, metres
   z = -(lat - lat0) * 110574                  # three.js: -z is north
   y =  elevation(x, z) - elevation(0, 0)      # up, relative to the intersection
   ```
4. Emit a compact `scene.json` with these keys: `terrain {x0, z0, cell, nx, nz, heights[]}`, `buildings[] {id, ring, h, kind}`, `roads[] {id, line, w, f, b, bike, park, kind, bridge?, y?}`, `sidewalks[] {line, w}`, `crossings[] {line, markings}`, `footways[]`, `areas[] {ring, kind}`, `kerbs[] {p, kind, tactile}`, `signals[]`, `poles[] {p, toward}`, `labels[]`, `pois[]`, and `meta` (origin, bake date, attribution and the guess table). Lines are densified to 4 m so they follow the terrain. Coordinates are rounded to 0.01 m, and OSM ids are kept.
5. Add a line to `meta/` noting the extract date, because OSM changes.

## Building the scene in three.js
- **Loading:** use an `<script type="importmap">` that points `three` and `three/addons/` at a **pinned** version on jsDelivr or unpkg, for example `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`. Don't use a bare `three@latest`. There is no bundler, so GitHub Pages can serve the repo files as they are.
- **Terrain:** a `PlaneGeometry(w, d, nx-1, nz-1)` with its vertex heights set from the grid.
  - It's drawn **25 cm below** the sampled ground. Mesh triangles don't match bilinear sampling, so on slopes the terrain would otherwise poke through the draped roads.
- **Buildings:** for each footprint, use `THREE.Shape` and `ExtrudeGeometry({depth: height, bevelEnabled: false})`, rotated so the extrusion points up.
  - On a slope, put the base at the **lowest** terrain sample under the footprint, so there's no floating front edge. Add the extra height on top so the roofline stays right.
  - Color by `building=*`: house/residential stucco, apartments slightly darker, retail/commercial with a ground-floor band.
  - Merge everything into one mesh with `BufferGeometryUtils.mergeGeometries`, and use vertex colors. 311 buildings is small.
- **Roads:** buffer each centerline into a ribbon of `width` (see the guessing rules), drape it on the terrain, and lift it 2 cm to avoid z-fighting. Draw the junction area as a polygon unioned from the overlapping ribbons. A simpler option is to draw ribbons in order with `polygonOffset`.
  - Lane lines: dashed white between lanes going the same way, and double yellow at the direction split. The split position comes from `lanes:forward` and `lanes:backward`.
  - Turn arrows come from `turn:lanes:*`, as decals near the stop line.
- **Bridge:** raise way 30528196 by its layer height (about 5 m clearance, guessed). Add a deck slab and simple parapets, and leave the ground under it open.
- **Sidewalks and curbs:** buffer the sidewalk lines (width guessed) and raise them **0.15 m** (6 in) above the road surface. Extrude a vertical curb face along the road-side edge.
  - At `kerb=lowered` nodes, ramp the sidewalk down to road level over about 1.5 m, and add yellow tactile paving where `tactile_paving=yes`.
  - Curbs are the "curb.here" subject, so they should look good up close.
- **Crosswalks:** use a canvas texture for each `crossing:markings` type (zebra, or ladder = zebra plus edge lines), UV-mapped along the `footway=crossing` line, about 3 m wide.
- **Signals:** a pole, mast arm and signal heads at each corner of the main intersection. They're placed by guesswork, so tag them `guessed` in the data.
- **Labels:** street names as sprites at road midpoints, with Cafe Tropical as a pin (node 4166608938) and an attribution overlay in the corner.
- **Lighting:** `HemisphereLight` plus one `DirectionalLight` placed at the LA afternoon sun angle (a nice touch for "sunset"), with soft shadows on a 512 m map. Optionally, set the sun from the current time.

## Mouse navigation
There are two modes, toggled by a button and the `V` key:
1. **Orbit (default):** `OrbitControls` targeting the intersection.
   - Left-drag rotates, right-drag pans, and the wheel zooms.
   - Clamp `maxPolarAngle` just below horizontal, `minDistance` to 5 m and `maxDistance` to 400 m, and turn on damping.
2. **Street view ("stand on the curb"):** the camera sits at eye height (1.6 m above terrain).
   - Drag to look around, using `PointerLockControls` or a simple yaw/pitch drag handler. Drag is friendlier than pointer lock on trackpads and phones.
   - Move with WASD or the arrow keys, keep the camera clamped to the terrain height, and double-click to jump to a point on the ground (raycast).
   - Preset spots: the four corners, the Cafe Tropical door and the bridge.
- Phones: one-finger drag to look and two-finger pinch to zoom. `OrbitControls` handles touch already, and street view needs a small touch handler.
- Put the camera state in the URL hash, for example `#v=street&x=12.3&z=-4.0&yaw=90`, so a view can be shared as a link.

## Guessing rules
Each guess lives in **one table in the pipeline**, and every guessed value is flagged (`"guessed": true`) in `scene.json` so the UI can show it later.

| What | Rule | Source of guess |
|---|---|---|
| Lane width | 3.4 m (11 ft); turn lanes 3.0 m | Typical for LA arterials |
| Bike lane (`cycleway=lane`) | 1.5 m each side, plus a 0.5 m buffer stripe | Typical |
| Parking lane | 2.4 m each side on Sunset where there's no turn lane; check against the curb-to-curb gap between the mapped sidewalks | Guess; fix it when `parking:*` tags appear |
| Road width | lanes × lane width + bike lanes + parking. Better: measure the distance between the two separate sidewalk lines, and take the smaller of the two | Derived |
| Residential street | 2 lanes, 10–11 m curb to curb | Typical for LA |
| Service road / alley | 4–6 m, with no curb | Guess |
| Sidewalk width | 3.0 m on Sunset, 2.4 m on Silver Lake, 1.5 m on residential streets | Guess |
| Curb height | 0.15 m; `kerb=lowered` 0.02 m; `kerb=raised` 0.18 m | US standard |
| Building with no `height` (7 of 311) | house 5 m; apartments 9 m; retail/commercial 5 m; other 4 m | Guess |
| Roof shape | Flat for everything (there are no `roof:*` tags) | Simplification |
| Bridge clearance | 5 m under the deck | Guess; check on site |
| Signal poles | One per corner, 0.5 m back from the curb | Guess |

## Hosting: GitHub Pages behind curb.here/sunset
### GitHub Pages
- The repo is public, and Pages deploys from **branch `main`, folder `/docs`** (set up 2026-11-27). Only `docs/` is published; notes and scripts are not.
  `docs/index.html` is the root page, owned by another session. The 3D view lives in `docs/sunset/`.
- The site is at https://here.github.io/curb.here/sunset/ and updates a minute or so after each push.
- **Use only relative URLs** in the page (`./main.js`, `./data/scene.json`), so the same files work from both the github.io path and `curb.here/sunset/`.
- Don't set a GitHub Pages custom domain. curb.here is served by the Worker, not by a Pages CNAME.

### Cloudflare Worker (`worker/`, deployed with wrangler)
Requirement: `curb.here` is a zone on the Cloudflare account, with DNS proxied (orange cloud).

The Worker is in [`worker/wrangler.toml`](../worker/wrangler.toml) and [`worker/src/index.js`](../worker/src/index.js). It:
- proxies `curb.here/sunset*` to `https://here.github.io/curb.here/sunset*`, for `GET`/`HEAD` only;
- redirects `/sunset` to `/sunset/`, because the page's relative URLs need the trailing slash;
- rewrites GitHub `Location` headers back onto curb.here;
- caches at the edge for 5 minutes and strips GitHub/Fastly headers.

Tested locally with Node against the real upstream: `/sunset` gives 301 → `/sunset/`, and the other paths pass through.

Deploy:
```bash
cd worker
export CLOUDFLARE_API_TOKEN=...   # token with Workers Scripts:Edit + Workers Routes:Edit (zone curb.here); keep it in .env, never commit
npx wrangler deploy
curl -I https://curb.here/sunset/
```

- GitHub Pages sends `Cache-Control: max-age=600`. After a deploy, wait up to 10 minutes, or purge the Cloudflare cache.
- Other paths on curb.here aren't touched by this route.
- No secrets are involved: the Worker only proxies public static files.

## Layout
```
three/three.md              this file
three/cache/osm.json        raw Overpass extract (gitignored)
scripts/osm_to_scene.py     Overpass → docs/sunset/data/scene.json
docs/sunset/index.html      import map, UI (mode toggle, presets, attribution)
docs/sunset/main.js         scene build + controls
docs/sunset/data/scene.json baked data (committed)
worker/wrangler.toml, worker/src/index.js
```
To view locally, run `python3 -m http.server -d docs 8000` and open http://localhost:8000/sunset/.

## Steps
- [x] `scripts/osm_to_scene.py`: extract, clip, project and terrain; first bake committed (2026-11-27).
- [x] `docs/sunset/`: terrain, buildings, roads with lane lines, sidewalks with curb faces, crosswalks, guessed signal poles, labels and shadows.
- [x] Orbit and street-view modes, presets (overview, four corners, Cafe Tropical, the bridge) and shareable URL-hash views.
- [x] Worker code tested locally.
- [ ] Deploy the Worker (waiting on a Cloudflare API token and curb.here as a Cloudflare zone). Then confirm `https://curb.here/sunset/` loads.
- [ ] Curb ramps at `kerb=lowered` nodes. Today only tactile pads are drawn, and the sidewalk slab is raised everywhere.
- [ ] Junction areas: lane lines stop 7 m short of each way's end, and the junction box isn't drawn as its own surface yet.
- [ ] Road widths from the gap between the mapped sidewalks, instead of lane counts.
- [ ] Turn arrows from `turn:lanes:*`.
- [ ] Touch movement in street view. Drag-to-look works on phones, but walking needs keys.
- [ ] Hide far labels. CSS labels show through buildings.
- [ ] Find out what passes under the Sunset bridge (way 30528196) and fix the bridge model.
- [ ] Better ground: USGS 3DEP 1 m DTM instead of building `ele`.

## Later (not now)
- Field photos: put Mapillary, KartaView and Panoramax images in the scene as clickable billboards at their capture points and headings, and use them to check the guesses (lane widths, signal positions, trees).
- Trees, street lamps and utility poles: map them in OSM from a survey, then they'll show up in the scene automatically.
- LA City or County curb and sidewalk datasets, if they're better than OSM.
