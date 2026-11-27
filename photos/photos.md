# Street-level photo services — comparison

Services compared for open street-level imagery of Silver Lake, LA. Details per service:
- [Panoramax](photos-panoramax.md)
- [KartaView](photos-kartaview.md)
- [Mapillary (Meta)](photos-meta-mapillary.md)

## Summary table

| | **Panoramax** | **KartaView** | **Mapillary (Meta)** |
|---|---|---|---|
| Operator | Federated commons (started by OSM France + IGN), many independent instances | Grab Holdings (ex-Telenav OpenStreetCam) | Meta Platforms |
| Software | Open source (MIT), self-hostable | Partly open (apps/tools); backend proprietary | Proprietary (MapillaryJS viewer + SDKs are open source) |
| Image license | Set per instance — CC-BY-SA 4.0 / etalab-2.0 / mixed | CC-BY-SA 4.0 | CC-BY-SA 4.0 (plus an OSM-derivation permission) |
| API | STAC + OGC API, **no key**, CORS open; meta-catalog `api.panoramax.xyz` | REST API, keyless public endpoints | Graph API v4 + vector tiles, **needs a free access token** |
| US / LA coverage | **Very thin** — 1 photo in the Silver Lake bbox (Jan 2024) as of 2026-11-27 | Thin and patchy; not yet measured (API unreachable during the 2026-11-27 test) | **Best by far** — the de facto open source of US street imagery |
| Data ownership risk | Low — data can be mirrored, or we run our own instance | Medium — one company, little activity | Medium — one big company, terms can change |
| Upload / capture | Web upload, CLI, mobile apps; any geotagged JPEG / 360° | KartaView mobile app, dashcam/CLI upload tools | Mapillary app, desktop uploader, `mapillary_tools` CLI, GoPro/360° support |
| Derived data | Some auto-blurring; little feature detection | Detects signs, lanes and road geometry | Extensive ML detections (signs, objects, segmentation) available as vector tiles |
| Privacy | Auto face/plate blur on most instances | Auto blur | Auto blur |

## Pros / cons

### Panoramax
- **Pro:** truly open (software + data), no API key, standards-based (STAC), we could run a Silver Lake / LA instance and own the data.
- **Pro:** ~100M+ images in the federation, growing fast (first instance in the Americas, Argentina, in May 2026).
- **Con:** almost no LA imagery; ~99% of photos sit on French instances (IGN, OSM-FR).
- **Con:** licenses differ by instance, so check each photo's `license` field.

### KartaView
- **Pro:** CC-BY-SA, keyless API, road-feature detection, good for dashcam-style sequences.
- **Con:** low community momentum (app at ~3.2★, crash complaints); the API can be flaky (failed for us).
- **Con:** owned by one company, which could change priorities.

### Mapillary
- **Pro:** best coverage in LA; mature tooling (Python SDK, `mapillary_tools`, MapillaryJS); rich ML detections.
- **Pro:** CC-BY-SA, plus explicit permission to derive OSM data.
- **Con:** API needs a token; rate limits; owned by Meta with proprietary infrastructure and terms that can change.
- **Con:** less control over our own uploads (Mapillary gets a perpetual, transferable license).

## Recommendation (initial)
1. **Read from Mapillary** for existing Silver Lake imagery (largest corpus).
2. **Contribute to Panoramax** (and optionally mirror to Mapillary) for any new field photos, so the data stays truly open and portable.
3. Treat KartaView as a secondary source; re-test coverage once the API is reachable.

## Open questions / TODO
- [ ] Get a Mapillary token and count images and sequences in the bbox.
- [ ] Retry the KartaView coverage query.
- [ ] Decide whether to self-host a Panoramax instance or upload to an existing one.

## Sources
- https://en.wikipedia.org/wiki/Panoramax · https://wiki.openstreetmap.org/wiki/Panoramax
- https://github.com/jonfroehlich/streetscape-tracker/issues/316 (Panoramax instance stats, Sep 2026)
- https://en.wikipedia.org/wiki/KartaView · https://play.google.com/store/apps/details?id=com.telenav.streetview
- https://en.wikipedia.org/wiki/Mapillary · https://www.mapillary.com/terms
