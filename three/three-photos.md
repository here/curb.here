# three.js viewer: field photos

How field photos are shown in the Sunset & Silver Lake viewer ([three.md](three.md)), which photos are in it, and what a photo can and can't do.
Photos are Mapillary images, **CC BY-SA 4.0**, credited on the page.

## What the viewer does
- Two checkboxes, "Photos flat" and "Photos mapped", plus numbered checkboxes 1–10 for individual photos. All of them are behind **Show buttons**.
  - **Photos flat:** each photo alone, on a plane 6 m in front of where it was taken, with an orange frustum, a dot and a number tag at the vantage. Drawn on top of everything.
  - **Photos mapped:** photos are projected onto the model's surfaces (terrain, roads, sidewalks, curbs, buildings).
- **Precedence:** where photos overlap, the lowest-numbered enabled photo that sees a surface wins. There's no blending.
- **"Photos in view" pill:** the capture-time range (LA time) of the enabled photos whose coverage is on screen, found by probing points along each photo's frustum. The credits line lists the same photos.
- **Defaults:** buttons hidden, photos flat, not mapped, all 10 on. The **reset** button (circular arrow) returns to these and reloads from a fresh `?r=` URL, which also refreshes cached files.
- **Vantage views:** "Jump to… → Photo vantage" puts the camera **10 ft (3 m) behind** the photo's position, along its horizontal look direction and at the same height, with the photo's orientation (including roll) and vertical FOV, so the frame can see around the photo's edges. On touchscreens, which have no street view, it's the orbit camera looking where the photo looked.
- **URL hash:** `ph=f`, `ph=m`, `ph=fm` or `ph=` (both off); `poff=2,3` for photos switched off; `at=<id>` for a vantage; `ui=1` for buttons shown. A link without `ph` uses the default (`f`).

## The photos
All were picked by metadata (non-panoramic, near the intersection, spread by position, heading and date). Only photos 1 and 2 were looked at and checked in the viewer; **3–10 are unchecked**, per the rule in `AGENTS.md`. Camera height is guessed at 1.2 m (1.3 m for photo 2). Positions are metres east and south of the signal.

| # | Mapillary id | Taken | By | Camera | East, south (m) | Heading / pitch | Where and what |
|---|---|---|---|---|---|---|---|
| 1 | [963797397764501](https://www.mapillary.com/app/?pKey=963797397764501) | 2016-01-30 | gyllen | Garmin VIRB XE | −35, −29 | 144° / +1.6° | Eastbound on Sunset, right lane, 45 m out, looking at the intersection. Overcast. Silverlake Lounge on the right. Wide lens (about 98°) with barrel distortion. |
| 2 | [1029666137832944](https://www.mapillary.com/app/?pKey=1029666137832944) | 2016-08-04 | mapkin | iPhone 5s | 42, 30 | 312° / +8.4° | Westbound from the east side, 50 m out. Cafe Tropical facade on the left, WOOD bar on the right. Sunny. Nearly opposite photo 1. |
| 3 | [3898074213645371](https://www.mapillary.com/app/?pKey=3898074213645371) | 2016-03-25 | sarawabreus | iPhone 6s | −101, 195 | 56° / +8.1° | On Parkman Avenue, 225 m southwest, looking up Parkman at the intersection. At the edge of the model. |
| 4 | [1644797915731122](https://www.mapillary.com/app/?pKey=1644797915731122) | 2016-08-04 | mapkin | iPhone 5s | −57, −88 | 336° / +9.3° | 105 m northwest, looking north-northwest, away from the intersection. |
| 5 | [1191635439743321](https://www.mapillary.com/app/?pKey=1191635439743321) | 2023-06-20 | inlandurbanist | GoPro Hero 7 | 3, −1 | 310° / +2.2° | In the middle of the intersection, looking northwest. The newest photo. |
| 6 | [213480793558423](https://www.mapillary.com/app/?pKey=213480793558423) | 2016-01-30 | gyllen | Garmin VIRB XE | −93, −141 | 158° / +2.2° | Far northwest (about 170 m), looking southeast toward the intersection. |
| 7 | [2966239396929564](https://www.mapillary.com/app/?pKey=2966239396929564) | 2016-01-30 | gyllen | Garmin VIRB XE | 119, 113 | 130° / +2.1° | Southeast (about 165 m), looking southeast, away from the intersection. |
| 8 | [298764735081568](https://www.mapillary.com/app/?pKey=298764735081568) | 2016-08-04 | mapkin | iPhone 5s | 129, 103 | 313° / +8.4° | Far southeast, looking northwest up Sunset. |
| 9 | [2325730507557302](https://www.mapillary.com/app/?pKey=2325730507557302) | 2016-08-04 | mapkin | iPhone 5s | −77, −134 | 341° / +9.7° | Far northwest, looking north-northwest. |
| 10 | [316723689810082](https://www.mapillary.com/app/?pKey=316723689810082) | 2016-11-04 | voschix | Sony Xperia | 10, −2 | 317° / 0.0° | At the intersection, looking northwest. Near photo 5's spot, different camera and date. |

- The area has photos from 2016, 2018, 2019, 2022, 2023 and 2026; photo 1 is the oldest usable one.
- Within about 170 m of the signal, photos only face along Sunset (about 140° and 310°), apart from photo 3 on Parkman, so the set differs mostly in position and date.
- Photos viewed while choosing: photo 1, one same-day frame rejected as too similar to photo 1, and photo 2. The two checked photos were the only ones loaded in the viewer at the time.

## Adding a photo
1. Pick one by metadata from `data/photos/data/mapillary-focus-images.geojson` (perspective camera, not a panorama).
2. Run `scripts/photo_to_scene.py ID… [--height M]`. It writes the 2048 px image to `docs/sunset/photos/` and the pose to `docs/sunset/data/photos.json`, then re-stamps `index.html` (see Cache-busting in [three.md](three.md)).
3. Add a row above, commit, push. Don't render or verify it unless asked.
4. The limit is `MAXP = 10` in `main.js` (see below).

## How it works
- **Pose:** Mapillary SfM `computed_rotation` (angle-axis, ENU → camera) and `computed_geometry`. For photo 1 the forward vector gives heading 144.2°, matching `computed_compass_angle`, with pitch +1.6° and roll −4.3°, and the position lands in the right eastbound lane of the model's Sunset, as in the photo. Mapillary altitude isn't reliable, so camera height is a guess.
- **Lens:** the Mapillary perspective model, in the shader: `st = 0.5 + f·(1 + k1·r² + k2·r⁴)·(x/z, y/z)·max(w,h)/(w,h)`. The flat plane uses the same projection, so it shows the photo undistorted.
- **Occlusion:** a depth pass from each photo camera (shadow-map style) keeps walls behind other buildings from being painted. The guessed signal poles are excluded as occluders and receivers.
- **Shading:** projected pixels are unlit and replace the model colour, with a soft fade at the image edges.
- **Limit of 10:** one shader loop handles up to `MAXP = 10` photos. The depth passes share one 4×4 atlas of 1024 px tiles, so the shader needs 11 samplers, under the 16 GPUs guarantee. About 12 is the most; beyond that it would need texture arrays.
- **Cache-busting:** the photo images and `photos.json` carry the same `?v=` as `main.js`.

## What a photo can and can't cover
From the vantage, a photo looks right. Moving away shows the limits of single photos:
- **Works:** surfaces the camera faced, at about the right distance: the road, lane lines, curb and the storefront walls line up. The Silverlake Lounge facade still reads correctly from well off to one side.
- **Missing:** anything not in the model has nowhere to land (sky, poles, billboards, trees, cars as objects), and surfaces the photo didn't see stay plain (backs and sides of buildings, the road behind the camera, the far side of the street).
- **Smears:**
  - Surfaces seen at grazing angles stretch into streaks, such as walls along the view direction and the road right in front of the camera.
  - Cars, poles and palms get flattened onto what's behind them.
  - Where the model's walls are set back from the real facades, or heights are off, content slides.
  - From above, the intersection road is mostly streaks, because photos hit it at grazing angles from opposite sides.
  - Photos from different times and weather (overcast January, sunny August) show visible seams.

## Ideas
- Blend several photos per surface, using the one that sees each fragment most head-on and closest, instead of first-wins. Candidates: 168 perspective photos face the intersection, and the 2016-01-30 sequence has 5 frames 24–66 m out.
- Use panoramas (215 in the area): they cover every direction from one point but need an equirectangular projection.
- Better geometry (real facade lines, road widths from the sidewalks) would reduce sliding.
- Flat photos appear to jump when you jump in street view. They're fixed panels 6 m ahead, so a 3 m jump gives them strong parallax. Options (anchor to the camera, push them out, or hide during a jump) are in [plan/plan.md](../plan/plan.md), "For consideration".
- Add KartaView and Panoramax photos, clickable vantage markers, and use photos to check the guesses (lane widths, signal positions, trees).
