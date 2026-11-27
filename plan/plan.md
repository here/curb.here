# Plan

## Active
- **Photos**: street-level imagery for the focus area. Mapillary data has been pulled ([notes](../photos/photos-meta-mapillary.md)).
- **Map**: OSM via Overpass ([map-osm.md](../map/map-osm.md)). Later: LA City GeoHub and LA County open data.
- **3D**: a three.js model of the intersection, built from OSM ([three.md](../three/three.md)).

## Deferred
- **GPS** (deferred 2026-11-27): GPX traces and OSM public GPS traces for the focus area.
  Revisit once the photo and map workstreams are further along.

## For consideration
- **3D viewer: flat photos jump when you jump** (reported 2026-11-27, not yet changed; details in [three.md](../three/three.md)).
  In street view, each flat photo is a fixed panel in the scene, 6 m in front of where it was taken.
  A jump moves the camera up about 3 m, so nearby panels sweep across the view (parallax) while the distant scene barely moves. The photos taken at the intersection are the most affected.
  Options:
  1. Anchor flat panels to the camera while jumping, so they stay put on screen like an overlay.
  2. Push the panels farther out to reduce parallax; the photos would then look smaller.
  3. Hide the flat panels while a jump is in progress.
  Open question: whether the mapped photos also jump, which would be a different problem.

