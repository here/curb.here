# AGENTS.md

Project context: [project.md](project.md)

## Working rules
- Commit often and push (`git push origin main`). See [Multiple agents](#multiple-agents) for the rules that make that safe.
- Record daily status summaries in `meta/` as `meta/YYYY-MM-DD.md`.
- Spelling: **Silver Lake** is two words (not "Silverlake") — in docs, filenames, and commit messages.
- Focus: start with the **Silver Lake Blvd & Sunset Blvd** area around **Cafe Tropical** (2900 W Sunset Blvd, 34.08290, -118.27355).
  Use the focus bbox in [project.md](project.md) by default; widen to all of Silver Lake only when asked.
- Overpass API: primary is **overpass.ch** (`OVERPASS_CH_API_KEY` in `.env`), then **NextGIS** (`NEXTGIS_OVERPASS_KEY`). Both keys are in the URL path, so never commit, log or echo those full URLs.
  Use `scripts/overpass.sh`, which then falls back to private.coffee and overpass-api.de (both are often overloaded).
  The full order is in [data/map/map-osm.md](data/map/map-osm.md). Always send a generic `User-Agent`.
- Adding field photos to the sunset viewer: pick by metadata, run `scripts/photo_to_scene.py`, document, commit. **Don't render, screenshot or otherwise verify** the new photo unless asked.
- Persistent memory lives in markdown files in this repo (project notes, findings, decisions) — update them rather than relying on chat history.

## Multiple agents
Assume **more than one agent is working in this repo at the same time**, sometimes in the same checkout and sometimes in other clones.
Another agent may change the working tree, the index or `main` while you work.
- **Commit only your own changes.** Stage paths explicitly (`git add <file>…`). Never use `git add -A`, `git add .` or `git commit -a`.
  - Leave changes you didn't make alone: don't stage, revert, stash, reformat or delete them.
  - If someone else's change blocks you, say so instead of working around it.
- **Re-read files before editing them.** Content you read earlier in a session may be stale.
  - Use small, targeted edits rather than rewriting whole files.
  - Shared index files (`README.md`, `project.md`, `AGENTS.md`, `plan/`, `meta/`) are the ones most likely to collide.
- **Sync around every commit:**
  1. Before you start: `git pull --rebase origin main`.
  2. Commit, then run `git pull --rebase origin main` again.
  3. Push.
  - On a rebase conflict, keep both sides' intent. Never resolve a conflict by dropping another agent's work.
- **No history rewriting on `main`.** That means no `git push --force`, no `reset --hard` and no amending or rebasing commits that are already pushed.
- **Keep commits small and focused,** one topic each, with a message that names the files or workstream touched.
- **Daily `meta/YYYY-MM-DD.md` is shared.** Append a new `##` section for your work rather than editing other agents' sections, and keep a single `## Next` section at the end of the file.
- **Claim larger work before starting it:** add a line to the relevant notes file (for example `- [ ] (in progress, <session name>) …`), commit it and push it first. Check for an existing claim before starting.
- **Scratch and generated files** go in your session scratchpad or in a gitignored path, never in shared tracked locations.
- **Avoid long-running exclusive resources** (fixed local ports, shared caches being rewritten). If you must use one, say so in your notes.
