#!/usr/bin/env bash
# Run an Overpass QL query, trying endpoints in priority order (see map/map-osm.md).
# Usage: scripts/overpass.sh 'QUERY' > out.json     or     scripts/overpass.sh < query.overpassql
# Reads OVERPASS_CH_API_KEY and NEXTGIS_OVERPASS_KEY from .env. Never prints the keys.
set -uo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }
Q="${1:-$(cat)}"
UA="curb.here-research"
endpoints=()
[ -n "${OVERPASS_CH_API_KEY:-}" ] && endpoints+=("https://api.overpass.ch/v1/${OVERPASS_CH_API_KEY}/interpreter|overpass.ch")
[ -n "${NEXTGIS_OVERPASS_KEY:-}" ] && endpoints+=("${NEXTGIS_OVERPASS_URL:-https://overpass.nextgis.com/${NEXTGIS_OVERPASS_KEY}/api/interpreter}|nextgis")
endpoints+=("https://overpass.private.coffee/api/interpreter|private.coffee" "https://overpass-api.de/api/interpreter|overpass-api.de")
for e in "${endpoints[@]}"; do
  url="${e%%|*}"; name="${e##*|}"
  echo "overpass: trying $name" >&2
  if out=$(curl -sf -m "${OVERPASS_TIMEOUT:-120}" -A "$UA" "$url" --data-urlencode "data=$Q"); then
    echo "overpass: ok via $name" >&2; printf '%s\n' "$out"; exit 0
  fi
  echo "overpass: $name failed or timed out" >&2
done
echo "overpass: all endpoints failed" >&2
exit 1
