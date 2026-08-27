import { BLOCK_TYPES } from "./blocks";
import { DEFAULT_EXPIRY_DAYS, LIMITS, MAX_BODY_BYTES, RATE_RULES } from "./limits";

/** The agent skill, rendered from the same constants the API validates against.
 *  There is no second copy of the block vocabulary or the limits anywhere —
 *  retire a block type or move a cap and this document follows automatically. */
export function renderSkill(baseUrl: string): string {
  const blocks = BLOCK_TYPES.join(" ");
  const rule = (r: { limit: number; windowMs: number }) =>
    `${r.limit} per ${r.windowMs >= 3600_000 ? `${r.windowMs / 3600_000} h` : `${r.windowMs / 1000} s`}`;
  const createRules = RATE_RULES.create.map(rule).join(" and ");
  const mutateRules = RATE_RULES.mutate.map(rule).join(" and ");

  return `---
name: ninepus-boards
description: Publish website wireframe boards (page tree + lo-fi wireframe blocks) to Ninepus over its anonymous REST API. Use when you have crawled/analysed a website or designed a site structure and need to render it as a shareable visual board.
---

# Ninepus — push wireframe boards

Ninepus is a whiteboard service. You build the shape **locally** (crawl, analyse,
design), then push it as one JSON document. The human gets a public link; you get a
manage key for updates and deletion. No accounts.

## Setup

\`\`\`bash
B=${baseUrl}
\`\`\`

That is the host that served you this document — use it as-is. No API key is
needed to create boards. All requests send JSON with
\`Content-Type: application/json\`.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | \`/api/boards\` | none | Create board → \`{ id, manageKey, url, apiUrl, expiresAt }\` |
| GET | \`/api/boards/:id\` | none | Read board + nodes |
| PUT | \`/api/boards/:id\` | key | Replace the whole shape |
| PATCH | \`/api/boards/:id\` | key | \`{ name?, expiresInDays?, extendDays? }\` |
| DELETE | \`/api/boards/:id\` | key | Delete board |

The key comes back once from POST — surface it to the user immediately and store it.
Send it as \`X-Manage-Key: nb_…\` (or \`Authorization: Bearer nb_…\`) on PUT/PATCH/DELETE.
Only a SHA-256 hash of the key is stored, so a lost key cannot be recovered by
anyone, including the operator — the board just expires on its own.

**Boards are public.** Anyone with \`/b/:id\` reads the whole board, no key needed.
Do not push anything the user would not publish: unreleased pages, internal tools,
client work under NDA. The id is unguessable, not secret.

## Node format

\`\`\`json
{
  "id": "pricing",              // optional, [a-zA-Z0-9][a-zA-Z0-9_-]{0,${LIMITS.nodeId - 1}}, auto-assigned if omitted
  "parent": "home",             // another node's id in this push; omit/null = root
  "title": "Pricing",           // ≤${LIMITS.title} chars, defaults to "Untitled"
  "color": "violet",            // slate blue green amber red violet teal pink
  "notes": "3 tiers, annual discount",   // ≤${LIMITS.notes} chars
  "slug": "pricing",            // optional URL path, no leading/trailing "/", no whitespace, ≤${LIMITS.slug}
  "pageType": "page",           // optional: page (default) · template · redirect · external
  "seo": {                      // optional SEO meta for the real page
    "title": "Pricing — Acme",           // ≤${LIMITS.seoTitle} chars
    "description": "Simple, transparent plans."   // ≤${LIMITS.seoDescription} chars
  },
  "tags": ["conversion"],       // optional, max ${LIMITS.tags} labels of ≤${LIMITS.tag} chars
  "blocks": [                   // max ${LIMITS.blocksPerNode} per node
    "navbar",
    {"type": "heading", "label": "Simple pricing"},   // label ≤${LIMITS.blockLabel} chars
    "pricing"
  ]
}
\`\`\`

\`parent\` may name a node declared **later** in the array — forward references
resolve fine, so push nodes in whatever order you built them. No topological
sort needed.

Block types (anything else is a 400):

\`\`\`
${blocks}
\`\`\`

Limits: ${LIMITS.nodes} nodes/board · ${LIMITS.blocksPerNode} blocks/node · board \`name\` ≤${LIMITS.boardName} ·
\`expiresInDays\` ≤ ${LIMITS.expiryDays}. Over-long strings are truncated silently; wrong types,
unknown blocks, dangling parents and cycles are rejected.

## Expiry

\`expiresInDays\` **defaults to ${DEFAULT_EXPIRY_DAYS}** when omitted. Pass \`null\` or \`0\` for a board
that never expires — do that only when the user asked for a permanent board.
Expired boards are deleted and read back as a plain 404, indistinguishable from
an id that never existed.

There is no idempotency key. If a POST times out you cannot tell whether it
landed, and a board you never got the key for is unreachable — the default
expiry is what cleans it up. Prefer retrying with a short timeout and telling
the user a duplicate may exist over retrying blind.

## Rate limits

Per IP: **${createRules}** for creating boards, **${mutateRules}** for
PUT/PATCH/DELETE. Reads are not limited.

Every response carries the current budget:

\`\`\`
RateLimit-Limit: 5
RateLimit-Remaining: 3
RateLimit-Reset: 42          # seconds until the window rolls over
RateLimit-Policy: 5;w=60, 30;w=3600
\`\`\`

Read \`RateLimit-Remaining\` and pace yourself rather than pushing until you get a
429. On a 429, honour \`Retry-After\` — do not retry immediately, and never retry
in a tight loop. Bodies over ${(MAX_BODY_BYTES / 1024 / 1024).toFixed(0)} MB are refused with a 413.

## Errors

Every failure is JSON: \`{"error": "<human-readable message>"}\`.

| Status | Meaning | What to do |
|---|---|---|
| 400 | Malformed body, or a node/block/expiry the API rejects | **Fix and retry.** Never retry unchanged. |
| 401 | No manage key sent on PUT/PATCH/DELETE | Send \`X-Manage-Key\`. |
| 403 | Manage key does not match this board | Wrong key — stop, ask the user. |
| 404 | No such board, or it expired | Stop. Create a new board if that is what the user wants. |
| 413 | Body over ${(MAX_BODY_BYTES / 1024 / 1024).toFixed(0)} MB | Split the work or trim \`notes\`. Retrying is pointless. |
| 429 | Rate limit exceeded | **Wait \`Retry-After\` seconds**, then retry the same request once. |
| 500 | Server-side failure | Retry once with backoff, then stop. |

Validation errors name the offending index, e.g.
\`nodes[3]: blocks[1] has unknown type "carousel"\` or
\`nodes[7]: parent "about" is not a node in this push\`. Read the index, patch
that node, re-push the whole document.

Note that 404 is checked before the key, so a bad key against a missing board
reports 404, not 403.

## Reading a board back

\`GET /api/boards/:id\` returns:

\`\`\`json
{
  "id": "k4mxq2vn8p",
  "name": "Acme audit",
  "createdAt": 1730000000000,
  "updatedAt": 1730000000000,
  "expiresAt": 1732592000000,
  "nodes": [
    {
      "id": "home",
      "parentId": null,
      "title": "Home",
      "color": "slate",
      "notes": "",
      "sortOrder": 0,
      "wireframes": [{"id": "b0", "type": "navbar", "label": "…"}]
    }
  ]
}
\`\`\`

The read shape uses \`parentId\`/\`wireframes\` where the write shape uses
\`parent\`/\`blocks\`. **PUT accepts both**, so you can take the \`nodes\` array from a
GET, edit it, and PUT it straight back without translating. The round trip is
lossless: order, parents, blocks and labels all survive.

## Workflow

1. Crawl and analyse the target site locally (fetch pages, extract headings/sections).
2. Decide the page tree and each page's block skeleton from what you found.
3. Push:

\`\`\`bash
curl -s -X POST $B/api/boards -H 'Content-Type: application/json' -d '{
  "name": "Acme audit",
  "expiresInDays": 30,
  "nodes": [
    {"id":"home","title":"Home","blocks":["navbar","hero","cards","cta"]},
    {"id":"pricing","parent":"home","title":"Pricing","blocks":["navbar","pricing","accordion"]}
  ]
}'
\`\`\`

4. Report \`url\` (share), \`manageKey\` (control) and \`expiresAt\` to the user.
5. Iterating? \`GET /api/boards/:id\`, edit the \`nodes\` array, \`PUT\` it back —
   pushes are whole-shape replacements by design. Never PUT a partial list; the
   nodes you leave out are deleted.

## Good defaults

- Give every node at least a navbar/footer plus a sensible skeleton — bare cards read as unfinished.
- Put real headings into \`{"type":"heading"|"hero","label":"…"}\` so cards carry content.
- Fill \`slug\` and \`seo\` when the real site's URLs/metadata are known — the board doubles as an IA spec.
- Mark non-standard pages: \`"pageType":"template"\` for repeated layouts, \`"redirect"\` for hops,
  \`"external"\` for off-site links (docs, socials).
- Use \`tags\` for cross-cutting dimensions the tree can't express (auth required, phase 2, …).
- Keep the default expiry for audits and throwaway boards; only go permanent on request.
- Never commit or log manage keys.
`;
}
