# Wikimedia Commons

- Site: https://commons.wikimedia.org · Operator: Wikimedia Foundation.
- License: every file is free — mostly CC-BY, CC-BY-SA, CC0 or public domain. Each file's license is in `extmetadata.LicenseShortName`.
- Cost: free. The API is keyless; send a generic `User-Agent`.

## API
Keyless geosearch over files (namespace 6), returning license, capture date and URL:
```
curl -A "generic-client/0.1" "https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord=34.0829|-118.27355&ggsradius=300&ggslimit=500&ggsnamespace=6&prop=imageinfo|coordinates&iiprop=extmetadata|url&iiextmetadatafilter=LicenseShortName|DateTimeOriginal|Artist&format=json"
```
- `gsradius` max is 10,000 m, and `gslimit` max is 500.
- `prop=coordinates` returns only 10 pages per call unless you set `colimit=max`.

## Focus-area coverage (300 m around Cafe Tropical, 2026-11-27)
- **89 files.**
  - Licenses: CC BY 2.0 (85), CC BY-SA 3.0 (3), CC BY-SA 4.0 (1).
  - Years: 2009 (1), 2014 (25), 2015 (48), 2016 (2), 2018 (12), 2023 (1).
- About 79 of these are Flickr imports of portrait and headshot sessions (named like "Macedo 6 27 2014 -12", "Colleen D'Agostino 12 04 2015 -3").
  They're all pinned to one point about 11 m from the cafe, probably a studio address. They aren't useful for the street.
- The useful files are:
  - "Spoon & Pork exterior (Silver Lake, Los Angeles).jpg"
  - "The Music Box steps 2009.jpg"
  - Two shots of a 1978 Toyota pickup parked at the curb
  - A handful of others
- **Verdict:** clean licensing and an easy API, but very little street imagery here. It's worth checking for historical one-offs.
