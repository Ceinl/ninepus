---
name: ninepus-boards
description: Publish website wireframe boards (page tree + lo-fi wireframe blocks) to Ninepus over its anonymous REST API. Use when you have crawled/analysed a website or designed a site structure and need to render it as a shareable visual board.
---

# Ninepus — push wireframe boards

The full skill is served by the app itself, rendered from the same constants the
API validates against:

```bash
curl -s "$NINEPUS_URL/api/skill" > SKILL.md
```

Fetch it from the deployment you intend to push to — the document comes back
with that host already filled in. Running locally, `$NINEPUS_URL` is
`http://localhost:3000`.

This file is deliberately a pointer and not a copy. The block vocabulary, the
size limits and the error table all live in `src/lib/` and are rendered on
demand by `src/lib/skill.ts`; a checked-in duplicate would go stale the first
time a block type changed.
