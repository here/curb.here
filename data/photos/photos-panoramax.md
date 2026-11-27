# Panoramax

- Site: https://panoramax.fr · Explorer: https://explore.panoramax.fr · Meta-catalog API: https://api.panoramax.xyz
- Federated, open-source (MIT) street-level imagery platform. Latest server release 2.15.1 (2026-07-15).
- Backend: Python/Flask + PostgreSQL/PostGIS; STAC + OGC API.
- Instance list: https://api.panoramax.xyz/api/instances

## Licensing
Each instance picks its own license: IGN uses etalab-2.0; OSM-FR, Belgium (panoramax.osm.be) and Wales use CC-BY-SA 4.0.
The meta-catalog is "mixed", so read each item's `license` property.

## Scale (2026)
- More than 100M images by Apr 2026; about 105M images from more than 2,100 contributors (May 2026).
- About 25 registered instances (Sep 2026); IGN (58M) and OSM-FR (54M) hold about 99% of images.
- First instance in the Americas: Argentina, launched 2026-05-18.

## API quick reference
```
# search pictures in a bbox (no key)
curl "https://api.panoramax.xyz/api/search?bbox=-118.285,34.075,-118.250,34.105&limit=1000"
# vector tiles
https://api.panoramax.xyz/api/map/{z}/{x}/{y}.mvt
```
Item properties include `datetime`, `license`, `geovisio:producer`, accuracy, field of view, and a link to the source instance.

## Silver Lake coverage — tested 2026-11-27
- bbox `-118.285,34.075,-118.250,34.105` → **1 picture** (2024-01-24, CC-BY-SA-4.0, at -118.2770, 34.0904).
- Coverage is effectively empty. This is an opportunity to contribute rather than consume.

## Notes
- Don't assume every instance has the same geography, license, auth, or API version.
- Self-hosting is documented (see the Argentina instance write-up: https://tzovar.as/setting-up-a-first-panoramax-instance-for-argentina/).
