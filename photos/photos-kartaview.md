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

## Browser data source
- Example Silver Lake view: https://kartaview.org/map/@34.07717906271594,-118.28228247976563,17z

## Silver Lake coverage — tested 2026-11-27
Grid of 7×8 radius-400 m queries over the bbox `-118.285,34.075,-118.250,34.105`:
- **≥376 photos in 67 sequences.** This is a lower bound because of the 150-per-query cap.
- Capture years: 2016 (21), 2017 (7), 2018 (50), **2019 (238)**, 2020 (31), 2021 (17), 2022 (12).
- No captures after 2022, so the imagery is historical, not current.
- Script: a grid query over `/2.0/photo/`, de-duplicated by photo `id`.

## Pros / cons
See [photos.md](photos.md#kartaview).
