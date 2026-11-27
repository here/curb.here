# OpenStreetMap (OSM) via Overpass

OSM is open map data (ODbL 1.0). Overpass is a read-only query API for OSM data.

## Endpoints (try in this order)
| Priority | Endpoint | Status from roady, 2026-11-27 |
|---|---|---|
| 1. Primary | `https://api.overpass.ch/v1/$OVERPASS_CH_API_KEY/interpreter` | **Works, and fast.** A 100 m amenity query took 0.9 s on 2026-11-27 (overpass-api.de took ~37 s for the same query). The key is in `.env` (`OVERPASS_CH_API_KEY`). |
| 2. Fallback | https://overpass.private.coffee/api/interpreter | **Times out (looks overloaded).** The home page loads, but `/api/interpreter` and `/api/status` hang. |
| 3. Fallback | https://overpass-api.de/api/interpreter | **Often overloaded.** One query worked in about 37 s; others timed out. Without a `User-Agent` it returns **406 Not Acceptable**. |
| 4. Last resort | https://nextgis.com/ | Site is up (HTTP 200). This isn't an Overpass interpreter URL: NextGIS offers OSM data extracts and a web GIS, so use it only if both Overpass servers fail. |

## overpass.ch
- Site: https://overpass.ch. It covers Overpass, plus map tiles, geocoding and elevation.
- **The API key is part of the URL path.** Never commit, log or paste a full overpass.ch URL; build it from `OVERPASS_CH_API_KEY` at runtime.
  - Interpreter: `https://api.overpass.ch/v1/<key>/interpreter` (POST or GET with `data=<query>`)
  - MCP server: `https://api.overpass.ch/v1/<key>/mcp` (guide: https://overpass.ch/guides/overpass-mcp-server)
- Plans (as listed on the site, 2026-11):
  - Free: 10,000 Overpass queries a month, **non-commercial only**.
  - Overpass API plan: from $25/mo, 100,000 queries a month, 2 parallel queries.
- Claude Code MCP: register it in **local** scope so the key stays out of the repo (it's stored in `~/.claude.json`):
  ```bash
  set -a; . ./.env; set +a
  claude mcp add --transport http -s local overpass "https://api.overpass.ch/v1/${OVERPASS_CH_API_KEY}/mcp"
  ```
  Don't add it to a committed `.mcp.json`.

## Usage notes
- Use `scripts/overpass.sh 'QUERY'`. It tries the endpoints in priority order and never prints the key.
- Always send a generic `User-Agent` (e.g. `curb.here-research`). Don't send personal details.
- Use `[timeout:N]` and a global `[bbox:S,W,N,E]` to keep queries small. Note that Overpass bbox order is **lat,lon** (south, west, north, east).
- Set a long client timeout (60–120 s), and on a timeout move down the endpoint list.
- Attribution: "© OpenStreetMap contributors, ODbL 1.0".

```bash
Q='[out:json][timeout:90][bbox:34.0811,-118.2757,34.0847,-118.2714];
(nwr["amenity"];nwr["shop"];nwr["highway"~"crossing|traffic_signals|bus_stop"];way["highway"];way["building"];);
out center tags;'
scripts/overpass.sh "$Q" > osm.json
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
- [x] overpass.ch key in `.env`, interpreter tested, and MCP server `overpass` registered in local scope (connected) on roady, 2026-11-27.
- [ ] Save focus-area extracts as GeoJSON in `map/data/` (crossings, signals, curbs and sidewalks for "curb.here").
- [ ] Look into curb-related tags: `kerb=*`, `sidewalk=*`, `parking:lane:*` / `parking:*`, `crossing=*`.
