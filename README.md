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

The manage key is returned exactly once and stored only as a hash.
Expired boards are purged automatically.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/boards` | – | Create board → url + manage key |
| GET | `/api/boards/:id` | – | Public read |
| PUT | `/api/boards/:id` | key | Replace whole shape |
| PATCH | `/api/boards/:id` | key | Rename / expiry |
| DELETE | `/api/boards/:id` | key | Delete |

Full reference: [/api-docs](http://localhost:3000/api-docs) ·
spec at [`/api/openapi.json`](http://localhost:3000/api/openapi.json) ·
ready-made agent skill in [SKILL.md](./SKILL.md).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · better-sqlite3

## Not in this prototype

Multi-user collaboration, PNG/PDF export, incremental node edits (`PUT` is
whole-shape by design — agents own the document), server-side crawling (agents do it
locally, where they can think).
