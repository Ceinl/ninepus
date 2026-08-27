# Ninepus 🐙

**Whiteboard for agents — agents draw, you watch.**
A coding agent crawls a website, designs the page tree and wireframe blocks locally,
then pushes the whole shape here with one API call. Anonymous boards, shareable links,
manage keys, optional expiry. No accounts.

## Quickstart

```bash
npm install
npm run dev          # → http://localhost:3000
```

- Data lives in SQLite at `.data/ninepus.db` (auto-created).
- No auth, no env vars required.

## How it works

1. Your agent builds a shape: a tree of nodes, each with lo-fi wireframe blocks.
2. It pushes the shape:

```bash
curl -X POST $BASE/api/boards -H 'Content-Type: application/json' -d '{
  "name": "Acme redesign",
  "expiresInDays": 30,
  "nodes": [
    {"id":"home","title":"Home","blocks":["navbar","hero","cards","cta"]},
    {"id":"pricing","parent":"home","title":"Pricing","blocks":["navbar","pricing","accordion"]}
  ]
}'
# → { "url": "/b/k4mxq2vn8p", "manageKey": "nb_…" }
```

3. Anyone with `/b/<id>` views the board (pan/zoom canvas, elbow-linked tree,
   wireframe blocks per card). The key holder can `PUT` a new shape, rename,
   set/extend expiry, or `DELETE`.

The manage key is returned exactly once and stored only as a SHA-256 hash — lose
it and nobody can recover it. `expiresInDays` defaults to **30**; pass `null` or
`0` for a board that never expires. Expired boards are purged automatically and
read back as a plain 404.

Boards are public. Anyone holding `/b/<id>` reads the whole board — the id is
unguessable, not secret. Don't push anything you wouldn't publish.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/boards` | – | Create board (needs ≥1 node) → url + manage key |
| GET | `/api/boards/:id` | – | Public read |
| PUT | `/api/boards/:id` | key | Replace whole shape |
| PATCH | `/api/boards/:id` | key | Rename / expiry |
| DELETE | `/api/boards/:id` | key | Delete |

Errors are always `{"error": "…"}`: 400 malformed/invalid (fix, don't retry),
401 missing key, 403 wrong key, 404 unknown or expired board, 413 body over 8 MB,
429 rate limited, 500 server-side. Validation messages name the offending index,
e.g. `nodes[3]: blocks[1] has unknown type "carousel"`.

Rate limits are per IP: 5/min and 30/hour for creates, 60/min for
PUT/PATCH/DELETE. Reads are unlimited. Every response carries `RateLimit-*`
headers; a 429 carries `Retry-After`. Counters live in the same database as the
boards, so they hold across serverless instances — see `src/lib/rate-limit.ts`.

`GET` emits `parentId`/`wireframes` where a push writes `parent`/`blocks`, and
`PUT` accepts both — so GET → edit → PUT round-trips losslessly.

Full reference: [/api-docs](http://localhost:3000/api-docs) ·
spec at [`/api/openapi.json`](http://localhost:3000/api/openapi.json) ·
agent skill served live at [`/api/skill`](http://localhost:3000/api/skill)
(rendered per request with the calling host filled in — [SKILL.md](./SKILL.md)
is just a pointer to it).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · libSQL (local SQLite file, or Turso via `TURSO_DATABASE_URL`)

## Not in this prototype

Multi-user collaboration, PNG/PDF export, incremental node edits (`PUT` is
whole-shape by design — agents own the document), server-side crawling (agents do it
locally, where they can think).
