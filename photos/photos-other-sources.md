# Photo & video sources — beyond street-level services

Other places to find photos and video of the focus area (Cafe Tropical, Sunset & Silver Lake; bbox `-118.2757,34.0811,-118.2714,34.0847`).
The street-level services are compared in more detail in [photos.md](photos.md).
Checked on 2026-11-27.

**Public** means anyone can get the data, even if they have to pay for it. **Private** means it's held by a company or agency and only available by agreement or a records request.

## Summary

| Source | Access | Media | License | Cost | Focus-area coverage |
|---|---|---|---|---|---|
| [Mapillary](photos-meta-mapillary.md) | Public | Street-level photos, 360° | CC-BY-SA 4.0 | Free (token) | **1,515 images**, 2016–2026 |
| [KartaView](photos-kartaview.md) | Public | Street-level photo sequences | CC-BY-SA 4.0 | Free, keyless | 355 images, 2016–2022 |
| [Panoramax](photos-panoramax.md) | Public | Street-level photos, 360° | Per instance (CC-BY-SA / etalab-2.0) | Free, keyless | 0 |
| [Wikimedia Commons](photos-wikimedia-commons.md) | Public | Photos, some video | Free licenses (CC-BY, CC-BY-SA, CC0, PD) | Free, keyless | 89 files within 300 m; about 10 useful street shots |
| [Flickr](photos-flickr.md) | Public | Photos, short video | All rights reserved by default; CC/PD if the uploader chose it | API key needs Flickr Pro (~$8/mo) | Not measured (no key yet) |
| OpenStreetMap | Public | Links to photos (`image`, `mapillary`, `panoramax`, `wikimedia_commons` tags) | ODbL (tags); each photo keeps its own license | Free | 13 tagged features |
| Mastodon / Bluesky | Public | Photos, video in posts | Copyright stays with the poster; no default license | Free API | Not explored — posts are rarely geotagged |
| Google Street View | Public, paid | Street-level 360° | Proprietary; display only, no storing or derived data | Pay-per-request after a monthly free credit | Not explored — coverage is dense |
| Waymo fleet | Private | Camera + lidar | Proprietary | Not for sale | Not explored |
| Waymo Open Dataset | Public | Camera + lidar segments | Non-commercial license | Free, registration required | Not explored — check whether LA is included |
| LADOT / StreetsLA | Private (Public Records Act request) | Traffic cameras (ATSAC), pavement-survey imagery | Government record | Free or copy fees | Not explored |

## Public

### Mapillary · KartaView · Panoramax
These are covered in detail elsewhere. See [photos.md](photos.md) for the comparison, and the per-service notes:
- [photos-meta-mapillary.md](photos-meta-mapillary.md)
- [photos-kartaview.md](photos-kartaview.md)
- [photos-panoramax.md](photos-panoramax.md)

### Wikimedia Commons
A keyless media archive where every file is under a free license. Many of its files were imported from Flickr.
Focus-area coverage is mostly portrait shoots pinned to one generic point; only about 10 files are useful street shots.
→ [photos-wikimedia-commons.md](photos-wikimedia-commons.md)

### Flickr
A large photo archive with geo search (`bbox`, `lat`/`lon`/`radius`) and a license filter.
New API keys now require Flickr Pro, so coverage wasn't measured.
→ [photos-flickr.md](photos-flickr.md)

### OpenStreetMap
OSM doesn't host photos, but features can link to them through `image=*`, `mapillary=*`, `panoramax=*` and `wikimedia_commons=*` tags.
In the focus bbox, 13 features have at least one of these tags (Overpass, 2026-11-27).
This is a useful way to find curated photos of specific businesses or curb features.
The tag data is ODbL; each linked photo keeps its source's license.

### Mastodon / Bluesky
Both have open APIs: Mastodon has per-instance REST and streaming; Bluesky has AT Protocol and the firehose.
Neither has location search, and posts very rarely carry coordinates. Finding photos would mean searching text and hashtags (for example `#SilverLake` or "Cafe Tropical") and placing them by hand.
Copyright stays with the poster, so reuse needs their permission. Not explored yet.

### Google Street View
Dense, regularly updated 360° coverage of Sunset Blvd, including historical imagery in the web viewer.
The Static and Metadata APIs are pay-per-request after a monthly free credit. The terms forbid storing images or deriving map data from them, so it's useful for viewing only. Not explored yet.

### Waymo Open Dataset
Waymo's research release of camera and lidar segments. It's free under a non-commercial license and requires registration.
Check whether any LA segments exist before relying on it. Not explored yet.

## Private

### Waymo fleet
Waymo runs a robotaxi service in LA, and its fleet records continuous camera and lidar data on Silver Lake streets.
That data isn't publicly available. Getting it would mean a research partnership or a direct request. Not explored yet.

### LADOT / StreetsLA (City of LA)
- **LADOT ATSAC** traffic-signal cameras watch major intersections, likely including Sunset & Silver Lake. Live feeds aren't published.
- **StreetsLA** pavement-condition surveys capture street-level imagery of city streets.
- Both are government records, so they can be requested under the California Public Records Act through the city's NextRequest portal. That is free apart from any copy fees. Not explored yet.
