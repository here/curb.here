# KartaView

- Site: https://kartaview.org · Owner: Grab Holdings (bought OpenStreetCam from Telenav in Dec 2019; renamed Nov 2020).
- Status: active. Android app v7.0.0 (2026-07-18), Play Store listing updated 2026-11-12; ~83k installs, 3.2★.
- License: community imagery under CC-BY-SA 4.0.
- Features: auto-detection of signs, lanes, and road curvature from uploaded sequences.

## API
- REST API for photos, sequences, and detected features. The public photo endpoint is keyless.
- Working query (2026-11-27):
  ```
  curl "https://api.kartaview.org/2.0/photo/?lat=34.07718&lng=-118.28228&radius=400&itemsPerPage=150"
  ```
  - `itemsPerPage` max is **150**.
  - The bbox form (`tLeft`/`bRight`) and `/2.0/sequence/` return "Restricted access!".
  - The legacy host `api.openstreetcam.org` times out.
- Photo fields include `id`, `sequenceId`, `shotDate`, `dateAdded`, `lat`, `lng`, and `autoImgProcessingResult` (BLURRED).

## Authentication (OSM OAuth 2 → KartaView token)
- Docs: https://kartaview.org/doc/user-login-authorization · https://kartaview.org/doc/authentication
- Steps:
  1. Get an OSM OAuth 2 token (scope `read_prefs`).
  2. `POST https://api.kartaview.org/auth/openstreetmap/client_auth` with `request_token=<osm token>&secret_token=undefined`.
  3. This returns a long-lived KartaView `access_token`. The docs disagree on how to send it (`Access-Token` header, `X-Auth-Token` header, or an `access_token` parameter).
- OSM only supports the authorization code flow, so one browser approval is always required. A client secret alone can't skip it.
- Our setup: a **public** OSM app (no secret) using PKCE and the redirect URI `urn:ietf:wg:oauth:2.0:oob` (OSM shows the code; you paste it).
  No callback server or Cloudflare Worker is needed.
- Run `python3 -I scripts/kartaview_login.py` once; it saves `KARTAVIEW_ACCESS_TOKEN` to `.env`.
- **Login works (2026-11-27):** `/2.0/user/profile` returns 200 with either the `Access-Token` or the `X-Auth-Token` header.
- **The token isn't needed for reading.** Every read query below behaves the same with or without it.
  "Restricted access!" came from how the request was built (missing or unsupported parameters), not from a missing login.

### Read endpoints that work (no auth), tested 2026-11-27
| Query | Result |
|---|---|
| `GET /2.0/photo/?lat=&lng=&radius=&itemsPerPage<=150` | ok, but sparse (about one photo per sequence) |
| `GET /2.0/photo/?sequenceId=<id>&itemsPerPage=150` | ok, all photos in a sequence |
| `GET /2.0/sequence/?tLeft=<lat,lng>&bRight=<lat,lng>&itemsPerPage=100&page=N` | ok, sequences whose extent touches the bbox |
| `GET /2.0/sequence/<id>` | ok |
| `POST /1.0/list/nearby-photos/` with `lat, lng, radius` | ok, dense: every photo near the point |
| `POST /1.0/tracks/` with `bbTopLeft, bbBottomRight, zoom` | ok, track geometries |
| `GET /2.0/photo/?tLeft&bRight` | **Restricted access!** (photo search doesn't accept a bbox) |
| `GET /2.0/sequence/` without a location filter | **Restricted access!** |

## Browser data source
- Example Silver Lake view: https://kartaview.org/map/@34.07717906271594,-118.28228247976563,17z

## Focus area: Cafe Tropical (bbox `-118.2757,34.0811,-118.2714,34.0847`), tested 2026-11-27
- `1.0/list/nearby-photos` (radius 300 around the cafe) returned 429 photos. **355 fall inside the focus bbox, from 4 sequences.**
- `2.0/sequence` with a bbox returns **134 sequences whose extent touches the bbox**, uploaded 2016–2022.
  This is an upper bound: many are long drives that pass near the area.
- The earlier `2.0/photo` radius query found only 4 photos because it returns roughly one photo per sequence.

## Silver Lake coverage — tested 2026-11-27
Grid of 7×8 radius-400 m queries over the bbox `-118.285,34.075,-118.250,34.105`:
- **≥376 photos in 67 sequences.** This is a lower bound because of the 150-per-query cap.
- Capture years: 2016 (21), 2017 (7), 2018 (50), **2019 (238)**, 2020 (31), 2021 (17), 2022 (12).
- No captures after 2022, so the imagery is historical, not current.
- Script: a grid query over `/2.0/photo/`, de-duplicated by photo `id`.

## Pros / cons
See [photos.md](photos.md#kartaview).
