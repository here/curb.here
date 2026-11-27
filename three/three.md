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
        │  Cloudflare Worker (wrangler), route curb.here/*
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
- Keyboard (built 2026-11-27):
  - Street view: WASD or the arrow keys walk at 8 m/s, or 28 m/s with Shift. Space jumps (about 1 m up, then back to the ground).
  - Orbit: WASD or the arrow keys move over the ground (speed scales with zoom), Q/E rotate around the target, R/F tilt, and +/− or PgUp/PgDn zoom. Shift is 3× faster.
  - Walking away from a photo vantage keeps the photo's look direction.
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
- proxies `curb.here/*` to `https://here.github.io/curb.here/*`, for `GET`/`HEAD` only;
- redirects `/sunset` to `/sunset/`, because the page's relative URLs need the trailing slash;
- rewrites GitHub `Location` headers back onto curb.here;
- sets caching itself, which also replaces the zone's 4 h browser default (deployed 2026-11-27):
  - pages (`/`, `.html`): `no-cache` in the browser, 60 s at the edge;
  - `?v=` stamped files: `immutable`, cached for a year in the browser and a day at the edge;
  - other files: 5 minutes;
  - 404s are cached 30 s at the edge and `no-store` in the browser;
- strips GitHub/Fastly headers.

Tested locally with Node against the real upstream: `/sunset` gives 301 → `/sunset/`, and the other paths pass through.

Deploy:
```bash
cd worker
export CLOUDFLARE_API_TOKEN=...   # token with Workers Scripts:Edit + Workers Routes:Edit (zone curb.here); keep it in .env, never commit
npx wrangler deploy
curl -I https://curb.here/sunset/
```

- GitHub Pages sends `Cache-Control: max-age=600`. After a deploy, wait up to 10 minutes, or purge the Cloudflare cache.
- The route covers all of `curb.here`: `/` is `docs/index.html` and `/sunset/` is the viewer. Subdomains aren't covered.
- No secrets are involved: the Worker only proxies public static files.

## Layout
```
three/three.md              this file
three/cache/osm.json        raw Overpass extract (gitignored)
scripts/osm_to_scene.py     Overpass → docs/sunset/data/scene.json
docs/sunset/index.html      import map, UI (mode toggle, presets, attribution)
docs/sunset/main.js         scene build + controls
docs/sunset/data/scene.json baked data (committed)
docs/sunset/data/photos.json  field photo poses; images in docs/sunset/photos/ (scripts/photo_to_scene.py)
worker/wrangler.toml, worker/src/index.js
```
**Cache-busting:** after changing anything in `docs/sunset/`, run `scripts/stamp_sunset.py` and commit `index.html` along with the change. The two bakers run it automatically.
- It stamps `main.js?v=<content hash>` into `index.html`. `main.js` passes the same `?v=` on to `scene.json`, `photos.json` and the photo images, so a page load never mixes old and new files.
- Why it's needed: the curb.here zone sends `Cache-Control: max-age=14400` (Cloudflare's default 4-hour browser cache), overriding GitHub's 10 minutes.
- `index.html` gets `no-cache` from the Worker (see Hosting), so a new stamp is picked up on the next load.

To view locally, run `python3 -m http.server -d docs 8000` and open http://localhost:8000/sunset/.

## Steps
- [x] `scripts/osm_to_scene.py`: extract, clip, project and terrain; first bake committed (2026-11-27).
- [x] `docs/sunset/`: terrain, buildings, roads with lane lines, sidewalks with curb faces, crosswalks, guessed signal poles, labels and shadows.
- [x] Orbit and street-view modes, presets (overview, four corners, Cafe Tropical, the bridge) and shareable URL-hash views.
- [x] Worker code tested locally.
- [x] Deploy the Worker. `https://curb.here/sunset/` loads (2026-11-27).
- [ ] Curb ramps at `kerb=lowered` nodes. Today only tactile pads are drawn, and the sidewalk slab is raised everywhere.
- [ ] Junction areas: lane lines stop 7 m short of each way's end, and the junction box isn't drawn as its own surface yet.
- [ ] Road widths from the gap between the mapped sidewalks, instead of lane counts.
- [ ] Turn arrows from `turn:lanes:*`.
- [ ] Touch movement in street view. Drag-to-look works on phones, but walking needs keys.
- [ ] Hide far labels. CSS labels show through buildings.
- [ ] Find out what passes under the Sunset bridge (way 30528196) and fix the bridge model.
- [ ] Better ground: USGS 3DEP 1 m DTM instead of building `ele`.

## Field photos (first try, 2026-11-27)
The viewer has two checkboxes, shown when `docs/sunset/data/photos.json` has photos:
- **Field photos flat:** the photo alone, on a plane 6 m in front of where it was taken. An orange frustum and dot mark the vantage. The plane is drawn on top of everything.
- **Field photos mapped:** the photo is projected onto the model's surfaces: terrain, roads, sidewalks, curbs and buildings.

Where photos overlap, **the first photo in `photos.json` that sees a surface wins**. There's no blending, and order is sequential: photo 1, then photo 2. A pill under the toolbar shows **"Photos in view"**: the capture-time range (LA time) of the shown photos whose coverage is on screen, tested by probing points along each photo's frustum. The credits line lists the same photos.

Numbered checkboxes (**1**, **2**, …) turn individual photos on or off. The number is also the precedence order, and flat mode labels each vantage with its number.

The toggles are stored in the URL hash: `ph=f`, `ph=m` or `ph=fm`, plus `poff=2` for photos switched off. "Jump to… → Photo vantage" puts the camera at the photo's position, orientation (including roll) and vertical FOV. For example, `#v=street&ph=m&at=963797397764501`.

**Photo 1:** Mapillary [963797397764501](https://www.mapillary.com/app/?pKey=963797397764501), by gyllen, 2016-01-30, CC BY-SA 4.0.
- It's the oldest usable photo near the intersection; the area has photos from 2016, 2018, 2019, 2022, 2023 and 2026.
- It was taken eastbound on Sunset, in the rightmost lane, 45 m from the signal, looking at the intersection. The storefronts on the right include Silverlake Lounge, next door to Cafe Tropical.
- The camera is a Garmin VIRB XE: wide (about 98° horizontal) with barrel distortion. The sky is overcast, so there are no hard shadows.
- I viewed 1 of a 10-photo budget. I picked candidates by metadata first: non-panoramic, 15–70 m from the signal, heading within 35° of it, oldest first.

**Photo 2:** Mapillary [1029666137832944](https://www.mapillary.com/app/?pKey=1029666137832944), by mapkin, 2016-08-04 10:44 PDT, CC BY-SA 4.0.
- It was taken westbound on Sunset from the far (east) side of the intersection, about 50 m out, looking northwest. That's nearly opposite photo 1.
- The Cafe Tropical facade, sign and awning are on the left, the WOOD bar (2861 Sunset) is on the right, and the intersection overlaps with photo 1.
- The camera is an iPhone 5s, narrower than photo 1 (about ±31° horizontal), with pitch +8.4°. Camera height is guessed at 1.3 m.
- It's sunny, where photo 1 is overcast, so the seam between the two photos is visible.
- How it was chosen: the closest date with a different direction and the cafe in frame. The same-day frames from photo 1's sequence were rejected as too similar.
- Photos viewed so far: 3 (photo 1, the rejected same-day frame, and photo 2).

**How it works**
- `scripts/photo_to_scene.py ID…` fetches the pose and a 2048 px image into `docs/sunset/photos/` and `data/photos.json`.
- Pose comes from Mapillary SfM: `computed_rotation` (angle-axis, ENU → camera) and `computed_geometry`. Checks: the forward vector gives heading 144.2°, matching `computed_compass_angle`, with pitch +1.6° and roll −4.3°. The position lands in the rightmost eastbound lane of the model's Sunset, which matches what the photo shows.
- Camera height is **guessed at 1.2 m** from the lane-line perspective. Mapillary altitude isn't reliable.
- The Mapillary perspective model is applied in the shader: `st = 0.5 + f·(1 + k1·r² + k2·r⁴)·(x/z, y/z)·max(w,h)/(w,h)`. The flat plane uses the same projection, so it shows the photo undistorted.
- Occlusion uses a depth pass rendered from each photo camera (shadow-map style), so walls behind other buildings aren't painted. Up to 4 photos share one shader loop (`MAXP`). The guessed signal poles are excluded both as occluders and as receivers.
- Projected pixels are unlit: they replace the model colour, with a soft fade at the image edges.

**Can a photo cover the surfaces as presented?** From the vantage, yes, it looks right. Moving away shows what a single photo can and can't do:
- **Works:** surfaces the camera faced, close to the right distance. The road and lane lines, the curb and the storefront walls on the right line up. In the test shots, the Silverlake Lounge facade still reads correctly from well off to one side.
- **Missing:**
  - Anything that isn't in the model has nowhere to land: sky, utility poles, the billboard, trees, cars as objects.
  - Surfaces the photo didn't see stay plain: the backs and sides of buildings, the road behind the camera, and the far side of the street beyond the parked cars.
- **Smears:**
  - Surfaces seen at grazing angles stretch into streaks: walls running along the view direction, and the road right in front of the camera.
  - Cars, poles and palms get flattened onto the road and walls, so they look right only from the vantage.
  - Where the model's walls are set back from the real facades, or heights are off, content slides.
  - Things missing from the model (cars, poles) don't stop the rays, so their pixels land on whatever is behind, sometimes a far wall.
  - With two photos, the intersection road is hit at grazing angles from both sides, so from above it's mostly streaks.

Covering the intersection properly would take **many photos blended per surface**: for each fragment, use the photo that sees it most head-on and closest. Possible sources:
- The same 2016 sequence has 5 frames from 24 to 66 m out.
- There are 168 candidate perspective photos facing the intersection.
- There are 215 panoramas in the focus area. A panorama covers every direction from one point and would cover the most surface per photo, but it needs an equirectangular projection instead of the perspective one used here.

Better geometry (real facade lines, road widths from sidewalks) would reduce the sliding.

## Later (not now)
- Field photos, beyond the first try above: blend several photos, support panoramas, add KartaView and Panoramax, show vantage markers you can click, and use the photos to check the guesses (lane widths, signal positions, trees).
- Trees, street lamps and utility poles: map them in OSM from a survey, then they'll show up in the scene automatically.
- LA City or County curb and sidewalk datasets, if they're better than OSM.
