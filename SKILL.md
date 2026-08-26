---
name: ninepus-boards
description: Publish website wireframe boards (page tree + lo-fi wireframe blocks) to Ninepus over its anonymous REST API. Use when you have crawled/analysed a website or designed a site structure and need to render it as a shareable visual board.
---

# Ninepus — push wireframe boards

Ninepus is a whiteboard service. You build the shape **locally** (crawl, analyse,
design), then push it as one JSON document. The human gets a public link; you get a
manage key for updates and deletion. No accounts.

## Setup

- `NINEPUS_URL` — base URL of the running app (default `http://localhost:3000`).
  No API key is needed to create boards.

All requests: `$B = $NINEPUS_URL`, JSON bodies with `Content-Type: application/json`.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/boards` | none | Create board → `{ id, manageKey, url, apiUrl }` |
| GET | `/api/boards/:id` | none | Read board + nodes |
| PUT | `/api/boards/:id` | key | Replace the whole shape |
| PATCH | `/api/boards/:id` | key | `{ name?, expiresInDays?, extendDays? }` |
| DELETE | `/api/boards/:id` | key | Delete board |

The key comes back once from POST — surface it to the user immediately and store it.
Send it as `X-Manage-Key: nb_…` (or `Authorization: Bearer nb_…`) on PUT/PATCH/DELETE.

## Node format

```json
{
  "id": "pricing",              // optional, [a-zA-Z0-9_-]{1,64}, auto-assigned if omitted
  "parent": "home",             // another node's id in this push; omit/null = root
  "title": "Pricing",
  "color": "violet",            // slate blue green amber red violet teal pink
  "notes": "3 tiers, annual discount",
  "slug": "pricing",            // optional URL path without leading/trailing "/", no spaces
  "pageType": "page",           // optional: page (default) · template · redirect · external
  "seo": {                      // optional SEO meta for the real page
    "title": "Pricing — Acme",
    "description": "Simple, transparent plans."
  },
  "tags": ["conversion"],       // optional, max 8 free-form labels
  "blocks": [                   // max 32 per node
    "navbar",
    {"type": "heading", "label": "Simple pricing"},
    "pricing"
  ]
}
```

Block types: `navbar breadcrumb tabs accordion footer heading text quote list table code chips timeline
image gallery video map logos hero hero-split cards stats sidebar-split pricing cta form pricing divider spacer`

Limits: 500 nodes/board · 32 blocks/node · `expiresInDays` ≤ 365 (null = never).
Sibling order follows array order; cycles and unknown parents are rejected with the
offending index.

## Workflow

1. Crawl and analyse the target site locally (fetch pages, extract headings/sections).
2. Decide the page tree and each page's block skeleton from what you found.
3. Push:

```bash
curl -s -X POST $B/api/boards -H 'Content-Type: application/json' -d '{
  "name": "Acme audit",
  "expiresInDays": 30,
  "nodes": [
    {"id":"home","title":"Home","blocks":["navbar","hero","cards","cta"]},
    {"id":"pricing","parent":"home","title":"Pricing","blocks":["navbar","pricing","accordion"]}
  ]
}'
```

4. Report `url` (share) and `manageKey` (control) to the user.
5. Iterating? Rebuild the full node list and `PUT` it — pushes are whole-shape
   replacements by design. `GET /api/boards/:id` shows the current canonical nodes.

## Good defaults

- Give every node at least a navbar/footer plus a sensible skeleton — bare cards read as unfinished.
- Put real headings into `{"type":"heading"|"hero","label":"…"}` so cards carry content.
- Fill `slug` and `seo` when the real site's URLs/metadata are known — the board doubles as an IA spec.
- Mark non-standard pages: `"pageType":"template"` for repeated layouts, `"redirect"` for hops,
  `"external"` for off-site links (docs, socials).
- Use `tags` for cross-cutting dimensions the tree can't express (auth required, phase 2, …).
- Set an expiry (`expiresInDays: 30`) for audits and throwaway boards.
- Never commit or log manage keys.
