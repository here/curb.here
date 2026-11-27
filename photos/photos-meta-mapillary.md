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
- Not queried yet (no token). Expected to be the densest open source of imagery for LA.
- TODO: store the token in `.env` (gitignored), then count images and sequences in the bbox `-118.285,34.075,-118.250,34.105`.

## Pros / cons
See [photos.md](photos.md#mapillary).
