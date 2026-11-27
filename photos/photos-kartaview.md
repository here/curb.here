# KartaView

- Site: https://kartaview.org · Owner: Grab Holdings (bought OpenStreetCam from Telenav in Dec 2019; renamed Nov 2020).
- Status: active. Android app v7.0.0 (2026-07-18), Play Store listing updated 2026-11-12; ~83k installs, 3.2★.
- License: community imagery under CC-BY-SA 4.0.
- Features: auto-detection of signs, lanes, and road curvature from uploaded sequences.

## API
- REST API for photos, sequences, and detected features. The public endpoints are keyless (third-party viewers such as
  gods-eye-view use them without credentials, Oct 2026).
- Legacy host: `api.openstreetcam.org` (`/2.0/photo/`, `/2.0/sequence/`).

## Silver Lake coverage — tested 2026-11-27
- `api.openstreetcam.org` timed out from our environment. `api.kartaview.org/2.0/photo/?lat=34.09&lng=-118.27&radius=1500`
  returned 0 results (the endpoint or parameters may be wrong). **Coverage is still unknown, so retry.**
- Fallback: check visually at https://kartaview.org/map/@34.09,-118.27,15z

## Pros / cons
See [photos.md](photos.md#kartaview).
