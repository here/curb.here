# Mapillary (Meta)

- Site: https://www.mapillary.com · Owner: Meta (services provided by Meta Platforms Technologies Ireland Ltd).
- License: user imagery under CC-BY-SA 4.0 (since Apr 2014; earlier CC-BY-NC), plus explicit permission to derive data for OpenStreetMap.
  Mapillary may offer some content under other terms (e.g. CC-BY-NC-SA). The API, vector tiles and MapillaryJS fall under the developer terms.
- Contributors grant Mapillary a worldwide, perpetual, transferable license, commercial use included.

## API
- Graph API v4: `https://graph.mapillary.com/images?bbox=...&fields=id,captured_at,geometry,thumb_1024_url`
- Vector tiles: `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=...`
- **Needs a free client access token** (create one at https://www.mapillary.com/dashboard/developers). Rate limits apply.
- Tooling: `mapillary` Python SDK, `mapillary_tools` (upload), MapillaryJS viewer, demo app https://github.com/mapillary/api-demo

## Silver Lake coverage
- Focus area around Cafe Tropical (2026-11-27): **1,515 images, 21 sequences, 216 panoramas, 7 contributors.**
  - By year: 2016: 92, 2018: 852, 2019: 238, 2022: 66, 2023: 117, 2026: 150.
- The Graph API rejects large bboxes ("reduce the amount of data"). `scripts/mapillary_coverage.py` handles this by tiling at 0.005° and splitting any tile that hits the cap.
- App ID `29636584962603158` is registered. Credentials live in `.env` (gitignored; the template is `.env.example`).
- Values in `.env` must be **quoted**: the token and secret contain `|`.
- Run `scripts/mapillary_coverage.py [bbox]`.

## Focus-area data pull (2026-11-27)
- `scripts/mapillary_pull.py [bbox] [--thumbs]` writes GeoJSON, which GitHub renders as a map:
  - [data/mapillary-focus-images.geojson](data/mapillary-focus-images.geojson): 1,499 points with id, capture time, heading, pano flag, sequence, creator and viewer link.
    That's 16 fewer than 1,515 because the script uses the corrected (`computed_geometry`) positions, and 16 of those fall outside the bbox.
  - [data/mapillary-focus-tracks.geojson](data/mapillary-focus-tracks.geojson): 21 lines, one per sequence, clipped to the bbox and ordered by capture time.
  - `--thumbs` saves 256px thumbnails to `photos/cache/mapillary/` (1,515 files, 15 MB, gitignored).
- Who captured what: 14 of 21 sequences (1,089 images) come from `lvl5` (2018-08 to 2019-03, dashcam-style); `gyllen` took 2016 and 2022 panoramas.
  The newest are from `nthp_gis` (2026-06-06, 149 panoramas) and `inlandurbanist` (2023-06-20, 114).

## Pros / cons
See [photos.md](photos.md#mapillary).
