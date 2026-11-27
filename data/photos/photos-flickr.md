# Flickr

- Site: https://www.flickr.com · Owner: SmugMug.
- License: **all rights reserved by default.** The uploader can choose CC (BY, BY-SA, BY-NC, …), CC0 or Public Domain Mark. Filter with `license=` (IDs come from `flickr.photos.licenses.getInfo`).
- Cost: the API is free for non-commercial use, but **you need a Flickr Pro account (~$8/mo, billed annually) to get a new API key.**
  - Commercial keys need Flickr staff approval and have no published price.
  - The API won't serve photos over 1024 px from free accounts.
  - The terms require attribution and removing content within 24 hours of a request.

## API
`flickr.photos.search` ([docs](https://www.flickr.com/services/api/flickr.photos.search.html)):
```
https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=KEY&bbox=-118.2757,34.0811,-118.2714,34.0847&min_taken_date=2005-01-01&has_geo=1&extras=geo,license,date_taken,url_l,owner_name&per_page=250&format=json&nojsoncallback=1
```
- Search by `bbox`, or by `lat`/`lon`/`radius` (radius under 32 km). `accuracy=16` limits results to street-level geotags.
- `geo_context=2` returns outdoor photos only.
- Geo queries **need a limiting filter** (such as `min_taken_date` or a tag). Without one, only photos from the last 12 hours come back.
- Geo results come 250 per page. A single query returns at most 4,000 results, so split by date range for dense areas.
- `media=videos` returns video only. Video is capped at 3 minutes (90 s on free accounts).

## Focus-area coverage
- **Not measured.** The project has no Flickr key yet (none in `.env`).
- For a rough idea: most of the 89 files on [Wikimedia Commons](photos-wikimedia-commons.md) in the focus area came from Flickr, so the full Flickr set is larger and includes all-rights-reserved photos.
- **Next step:** get a non-commercial key (needs Pro), then run the query above split by year.
