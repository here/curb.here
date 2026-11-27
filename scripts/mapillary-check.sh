#!/usr/bin/env bash
# Verify the Mapillary token in .env and count images in the Silver Lake bbox.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
: "${MAPILLARY_ACCESS_TOKEN:?set MAPILLARY_ACCESS_TOKEN in .env}"
BBOX="${1:--118.285,34.075,-118.250,34.105}"
curl -sG "https://graph.mapillary.com/images" \
  -H "Authorization: OAuth ${MAPILLARY_ACCESS_TOKEN}" \
  --data-urlencode "bbox=${BBOX}" \
  --data-urlencode "fields=id,captured_at,sequence" \
  --data-urlencode "limit=2000" \
| python3 -I -c '
import sys, json, collections, datetime
d = json.load(sys.stdin)
if "error" in d: sys.exit("API error: " + d["error"].get("message", str(d)))
imgs = d.get("data", [])
yrs = collections.Counter(datetime.datetime.utcfromtimestamp(i["captured_at"]/1000).year for i in imgs if i.get("captured_at"))
print("images (max 2000/request):", len(imgs))
print("sequences:", len({i.get("sequence") for i in imgs}))
print("years:", sorted(yrs.items()))
'
