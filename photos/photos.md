# Street-level photo services — comparison

Services compared for open street-level imagery of Silver Lake, LA. Details per service:
- [Panoramax](photos-panoramax.md)
- [KartaView](photos-kartaview.md)
- [Mapillary (Meta)](photos-meta-mapillary.md)

## Focus area: Cafe Tropical, Sunset & Silver Lake (tested 2026-11-27)
Bbox `-118.2757,34.0811,-118.2714,34.0847` (~200 m around 2900 W Sunset Blvd).

| | Images | Sequences | Years | Notes |
|---|---|---|---|---|
| **Mapillary** | **1,515** | 21 | 2016 (92), 2018 (852), 2019 (238), 2022 (66), 2023 (117), **2026 (150)** | 216 panoramas, 7 contributors; the only source with current imagery |
| **KartaView** | 4 | 4 | 2019 | radius 200 m |
| **Panoramax** | 0 | — | — | — |

Run it again with `scripts/mapillary_coverage.py -118.2757,34.0811,-118.2714,34.0847`.

## Summary table

| | **Panoramax** | **KartaView** | **Mapillary (Meta)** |
|---|---|---|---|
| Operator | Federated commons (started by OSM France + IGN), many independent instances | Grab Holdings (ex-Telenav OpenStreetCam) | Meta Platforms |
| Software | Open source (MIT), self-hostable | Partly open (apps/tools); backend proprietary | Proprietary (MapillaryJS viewer + SDKs are open source) |
| Image license | Set per instance — CC-BY-SA 4.0 / etalab-2.0 / mixed | CC-BY-SA 4.0 | CC-BY-SA 4.0 (plus an OSM-derivation permission) |
| API | STAC + OGC API, **no key**, CORS open; meta-catalog `api.panoramax.xyz` | REST API, keyless public endpoints | Graph API v4 + vector tiles, **needs a free access token** |
| US / LA coverage | **Very thin** — 1 photo in the Silver Lake bbox (Jan 2024) as of 2026-11-27 | **Moderate, dated** — ≥376 photos / 67 sequences in the bbox, 2016–2022 (mostly 2019) | **Best by far** — 1,515 images near Cafe Tropical, including 2026 captures |
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
- **Pro:** real Silver Lake coverage (≥376 photos, 67 sequences). Good for a historical (2016–2022) view.
- **Con:** nothing captured after 2022; low community momentum (app at ~3.2★, crash complaints); bbox and sequence endpoints are restricted.
- **Con:** owned by one company, which could change priorities.

### Mapillary
- **Pro:** best coverage in LA; mature tooling (Python SDK, `mapillary_tools`, MapillaryJS); rich ML detections.
- **Pro:** CC-BY-SA, plus explicit permission to derive OSM data.
- **Con:** API needs a token; rate limits; owned by Meta with proprietary infrastructure and terms that can change.
- **Con:** less control over our own uploads (Mapillary gets a perpetual, transferable license).

## Recommendation (initial)
1. **Read from Mapillary** for existing Silver Lake imagery (largest corpus).
2. **Contribute to Panoramax** (and optionally mirror to Mapillary) for any new field photos, so the data stays truly open and portable.
3. Use KartaView as a secondary, historical source (2016–2022). It is useful for before/after comparisons.

## Open questions / TODO
- [x] Mapillary token set up; focus area counted (2026-11-27).
- [ ] Run the wider Silver Lake count (tiled, slow) only if needed.
- [x] KartaView coverage measured (2026-11-27).
- [ ] Decide whether to self-host a Panoramax instance or upload to an existing one.

## Sources
- KartaView map, Silver Lake: https://kartaview.org/map/@34.07717906271594,-118.28228247976563,17z
- https://en.wikipedia.org/wiki/Panoramax · https://wiki.openstreetmap.org/wiki/Panoramax
- https://github.com/jonfroehlich/streetscape-tracker/issues/316 (Panoramax instance stats, Sep 2026)
- https://en.wikipedia.org/wiki/KartaView · https://play.google.com/store/apps/details?id=com.telenav.streetview
- https://en.wikipedia.org/wiki/Mapillary · https://www.mapillary.com/terms
