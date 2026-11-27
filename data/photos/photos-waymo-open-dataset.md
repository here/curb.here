# Waymo Open Dataset (WOD)

- Site: https://waymo.com/open · Code and data formats: https://github.com/waymo-research/waymo-open-dataset
- Operator: Waymo LLC (Alphabet). A research release from Waymo's fleet, which includes both manual and autonomous driving.
- Access: sign in with a Google account, accept the license, then download from Google Cloud Storage (`gsutil` or the web console).
- Cost: free.

## Datasets (checked 2026-11-27)

| | Perception | Motion | End-to-End (WOD-E2E) |
|---|---|---|---|
| Version / last update | v1.4.3 and v2.0.1, Mar 2024 | v1.3.1, Oct 2025 | Mar 2025 (CVPR 2026 paper) |
| Segments | 2,030 × 20 s at 10 Hz (~390k frames) | 103,354 × 20 s at 10 Hz (574 h) | 5,000 × 20 s per the site; the paper says 4,021 (~12 h) |
| Sensors | 5 cameras (front and sides) + 5 lidars, with 3D/2D labels | Object tracks + 3D HD map; lidar; camera **embeddings only**, no images | 8 cameras (360°) + routing instructions |
| Cities | Not listed ("diverse geographies"); per-segment city code | **SF, Phoenix, Mountain View, Los Angeles, Detroit, Seattle** | Not named; the paper only says "cities L, K, J…" |
| Useful as photos? | Yes, but not in LA as far as we can tell | No (no images) | Yes; LA possible but unconfirmed |

## License: Waymo Dataset License Agreement for Non-Commercial Use (Mar 2025)
- **Allowed:** research, teaching, scientific publication and personal experimentation. Nothing "primarily intended for … commercial advantage."
- **Not allowed:** use in operating a vehicle, in production systems, or to evaluate real-world vehicle performance.
- **Publishing images:** only "small extracts … for purposes of illustration in Your research publications." Publishing a gallery or viewer of WOD frames isn't covered.
- **Redistribution:** only to people who have registered and accepted the terms themselves.
- **Attribution:** "provided by Waymo LLC under the Waymo Dataset License Agreement for Non-Commercial Use."
- **Termination:** automatic on breach, after which you must delete the data.
- **Privacy:** Waymo blurs faces and license plates.

## Location: the main obstacle
- Segments have **no latitude/longitude.**
  - `Context.stats.location` is just a city code (e.g. `location_sf`, `location_phx`, `location_other`).
  - Vehicle poses are given in a "global" frame whose origin isn't disclosed. Motion maps use the same local coordinates.
- So there's no supported way to search for "Sunset & Silver Lake."
  - Finding a segment would mean matching its map lanes or road geometry to OSM by hand.
  - Even if that worked, publishing the result would conflict with the illustration-only image clause.
- Motion is the only dataset confirmed to include LA, and it has no camera images.

## Verdict for curb.here
**Low value.** It's free and very high quality, but there's no way to find the focus area, LA is confirmed only in the image-less Motion dataset, and the license doesn't allow publishing images in a public viewer.
It could be useful for non-commercial research on curb and lane geometry in general. It isn't a source of Silver Lake photos.
For real Waymo imagery of Silver Lake, see the private "Waymo fleet" entry in [photos-other-sources.md](photos-other-sources.md).

Sources: [About](https://waymo.com/open/about/) · [Terms](https://waymo.com/open/terms/) · [dataset.proto](https://github.com/waymo-research/waymo-open-dataset/blob/master/src/waymo_open_dataset/dataset.proto) · [WOD-E2E paper](https://arxiv.org/abs/2510.26125)
