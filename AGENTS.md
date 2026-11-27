# AGENTS.md

Project context: [project.md](project.md)

## Working rules
- Commit often and push (`git push origin main`).
- Record daily status summaries in `meta/` as `meta/YYYY-MM-DD.md`.
- Spelling: **Silver Lake** is two words (not "Silverlake") — in docs, filenames, and commit messages.
- Focus: start with the **Silver Lake Blvd & Sunset Blvd** area around **Cafe Tropical** (2900 W Sunset Blvd, 34.08290, -118.27355).
  Use the focus bbox in [project.md](project.md) by default; widen to all of Silver Lake only when asked.
- Overpass API: use https://overpass.private.coffee/api/interpreter first. The fallback order is in [map/map-osm.md](map/map-osm.md).
  Always send a generic `User-Agent`.
- Persistent memory lives in markdown files in this repo (project notes, findings, decisions) — update them rather than relying on chat history.
