# Location data

Data sources for mobile object locations and linestrings.

## Overland
- <https://overland.p3k.app/>: open source GPS tracker for iPhone ([source](https://github.com/aaronpk/Overland-iOS), Apache 2.0).
- Logs location in the background and POSTs it to a server you choose. With no server, it saves GeoJSON files to iCloud Drive, by day or by trip.
- The [API](https://overland.p3k.app/api) sends batches (200 by default) as `{"locations": [...]}`, an array of GeoJSON `Point` features with `timestamp`, `speed`, `course`, accuracies, `motion`, `device_id` and, during a trip, `trip_id`.
- The server replies `{"result": "ok"}`; otherwise the app keeps the batch and retries.
- It sends points, not lines: build a `LineString` by grouping on device and trip, in `timestamp` order.
- These are personal location traces, and this repo is public. Don't commit them.

## GeoJSON linestrings
- [RFC 7946](https://www.rfc-editor.org/rfc/rfc7946#section-3.1.4): a `LineString` is an array of two or more positions, each `[longitude, latitude]` with an optional altitude (WGS 84).
- Positions have no time field. Keep times in `properties`, for example an array parallel to the coordinates (a convention, not part of the spec).
- In this repo: [Mapillary tracks](photos/data/mapillary-focus-tracks.geojson), one `LineString` per photo sequence, from `scripts/mapillary_pull.py`.

## GTFS Realtime
- Transit feed format ([reference](https://gtfs.org/documentation/realtime/reference/)): Protocol Buffers fetched over HTTP, used with a static GTFS schedule.
- `VehiclePosition`: latitude and longitude, optional bearing and speed, trip, vehicle and timestamp. These are the mobile object locations.
- Other entities: `TripUpdate` (arrival and departure predictions) and `Alert`.
- Linestrings: route paths are in `shapes.txt` of the static GTFS. The realtime `Shape` entity (experimental) covers paths not in it, such as detours.
- **LA Metro** ([developer.metro.net](https://developer.metro.net/api/)): served through Swiftly, agency keys `lametro` (bus) and `lametro-rail` (rail). Needs a Swiftly API key ([request form](https://forms.gle/hXGY6kRGAChDqWwz5)). Vehicle positions refresh every 5 s, trip updates every 10 s. Not requested or tested yet.

## Waymo Open Dataset
- <https://waymo.com/open/>: Waymo's free research release (Google sign-in). Copied in brief from the [full notes](photos/photos-waymo-open-dataset.md).
- **Motion** dataset: 103,354 segments of 20 s at 10 Hz, with object tracks and a 3D HD map. Cities include Los Angeles. These tracks are mobile object linestrings.
- No latitude/longitude: positions are in a local frame with an undisclosed origin, so tracks can't be placed in Silver Lake.
- License: [non-commercial](https://waymo.com/open/terms/); redistribution only to people who have accepted the same terms. Don't commit the data.
