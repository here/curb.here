# curb.here — project

## Goal
Explore open data maps, field photos, and GPS data available for the local neighborhood of
**Silver Lake, Los Angeles**.

## Focus area (start here)
Silver Lake Blvd & Sunset Blvd, centered on **Cafe Tropical**, 2900 W Sunset Blvd (OSM: 34.0829003, -118.2735534).
- Focus bbox (~200 m around the cafe): `-118.2757,34.0811,-118.2714,34.0847`
- Focus radius: 200 m from 34.0829, -118.27355

## Wider area (later)
Rough bounding box used for queries (lon/lat, WGS84):
`-118.285,34.075,-118.250,34.105` (Silver Lake reservoir, Sunset Junction, Hyperion/Glendale Blvd).

## Workstreams
The plan and deferred items are in [plan/plan.md](plan/plan.md).

- [photos/](photos/photos.md) — street-level / field photo services (Panoramax, KartaView, Mapillary)
- [map/](map/map-osm.md) — OSM via Overpass ([map-osm.md](map/map-osm.md)); later LA City GeoHub and LA County open data
- [three/](three/three.md) — three.js 3D model of the Sunset & Silver Lake intersection, served at curb.here/sunset
- gps: deferred (GPX traces, OSM public traces); see [plan/plan.md](plan/plan.md)
