# OpenStreetMap (OSM) via Overpass

OSM is open map data (ODbL 1.0). Overpass is a read-only query API for OSM data.

## Endpoints (try in this order)
| Priority | Endpoint | Status from roady, 2026-11-27 |
|---|---|---|
| 1. Primary | https://overpass.private.coffee/api/interpreter | **Not responding.** The home page loads (HTTP 200), but `/api/interpreter` (GET and POST) and `/api/status` time out. Retry later. |
| 2. Fallback | https://overpass-api.de/api/interpreter | **Works.** Small queries take about 37 s. Without a `User-Agent` header it returns **406 Not Acceptable**. |
| 3. Last resort | https://nextgis.com/ | Site is up (HTTP 200). This isn't an Overpass interpreter URL: NextGIS offers OSM data extracts and a web GIS, so use it only if both Overpass servers fail. |

## Usage notes
- Always send a generic `User-Agent` (e.g. `curb.here-research`). Don't send personal details.
- Use `[timeout:N]` and a global `[bbox:S,W,N,E]` to keep queries small. Note that Overpass bbox order is **lat,lon** (south, west, north, east).
- Set a long client timeout (60–120 s), and on a timeout move down the endpoint list.
- Attribution: "© OpenStreetMap contributors, ODbL 1.0".

```bash
Q='[out:json][timeout:90][bbox:34.0811,-118.2757,34.0847,-118.2714];
(nwr["amenity"];nwr["shop"];nwr["highway"~"crossing|traffic_signals|bus_stop"];way["highway"];way["building"];);
out center tags;'
for h in https://overpass.private.coffee/api/interpreter https://overpass-api.de/api/interpreter; do
  curl -sf -m 120 -A "curb.here-research" "$h" --data-urlencode "data=$Q" -o osm.json && break
done
```

## Focus area: Cafe Tropical (tested 2026-11-27 via overpass-api.de)
Bbox `34.0811,-118.2757,34.0847,-118.2714` (Overpass order), about 200 m around the cafe. The query returned **514 elements**:

| Feature | Count |
|---|---|
| Buildings | 311 |
| Road ways (`highway=*`) | 137 |
| Crossings | 39 |
| Amenities | 18 (restaurant 7, cafe 4, fast food 2, bar 2, theatre, dentist, nightclub) |
| Shops | 6 |
| Traffic signals | 3 |
| Bus stops | 2 |

- **Cafe Tropical** is OSM node [4166608938](https://www.openstreetmap.org/node/4166608938):
  - Tags: `amenity=cafe`, `cuisine=coffee_shop;cuban`, address 2900 Sunset Blvd 90026.
  - Hours: Mo–Fr 06:00–22:00, Sa–Su 07:00–22:00.
  - Last checked by a mapper: `check_date=2026-05-03`.
- Named streets in the box: West Sunset Blvd, Silver Lake Blvd, Parkman Ave, Descanso Dr, Del Monte Dr, Dillon St,
  Elevado St, Ellett Pl, Fanita St, Garcia Walk, Jewel St, Joseph F Farivar Dr, Music Box Steps, N Occidental Blvd,
  N Reno St, N Vendome St, Reservoir St, Westerly Ter.

## TODO
- [ ] Retry the primary endpoint, and record whether it's reachable from other networks.
- [ ] Save focus-area extracts as GeoJSON in `map/data/` (crossings, signals, curbs and sidewalks for "curb.here").
- [ ] Look into curb-related tags: `kerb=*`, `sidewalk=*`, `parking:lane:*` / `parking:*`, `crossing=*`.
