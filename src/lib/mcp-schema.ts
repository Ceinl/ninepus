import { z } from "zod";
import { BLOCK_TYPES, COLOR_HEX } from "./blocks";
import { LIMITS } from "./limits";

/** The MCP input schema for a pushed board, rendered from the same constants the
 *  API validates against. It lives here rather than in the route so it can be
 *  exercised on its own — the round-trip it has to survive is easy to break and
 *  impossible to notice from the outside, since a stripped field just makes a
 *  board quietly come back smaller. */

const blockTypes = BLOCK_TYPES as [string, ...string[]];
const colors = Object.keys(COLOR_HEX) as [string, ...string[]];

export const blockSchema = z.union([
  z.enum(blockTypes),
  z.object({
    type: z.enum(blockTypes),
    label: z
      .string()
      .max(LIMITS.blockLabel)
      .optional()
      .describe("Real copy from the page — the headline, the CTA wording, the form's purpose."),
  }),
]);

export const nodeSchema = z.object({
  id: z
    .string()
    .max(LIMITS.nodeId)
    .optional()
    .describe("Stable id used by other nodes' `parent`. Auto-assigned when omitted."),
  parent: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The id of another node in this same push; omit or null for a root page. Nodes may be listed in any order — a parent declared later still resolves.",
    ),
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe("Alias for `parent`, the spelling a board read back from the API uses. Prefer `parent`."),
  title: z.string().max(LIMITS.title).optional().describe('Page name. Defaults to "Untitled".'),
  slug: z.string().max(LIMITS.slug).optional().describe('URL path, e.g. "about/team".'),
  pageType: z.enum(["page", "template", "redirect", "external"]).optional(),
  color: z.enum(colors).optional().describe("Card accent. Group a section under one colour."),
  notes: z.string().max(LIMITS.notes).optional().describe("Free-form notes shown on the card."),
  tags: z.array(z.string().max(LIMITS.tag)).max(LIMITS.tags).optional(),
  seo: z
    .object({
      title: z.string().max(LIMITS.seoTitle).optional(),
      description: z.string().max(LIMITS.seoDescription).optional(),
    })
    .optional(),
  blocks: z
    .array(blockSchema)
    .max(LIMITS.blocksPerNode)
    .optional()
    .describe(
      "The page's lo-fi wireframe, top to bottom. Either a bare type string or { type, label }; labels are what make the board readable, so use them.",
    ),
  wireframes: z
    .array(blockSchema)
    .max(LIMITS.blocksPerNode)
    .optional()
    .describe("Alias for `blocks`, the spelling a board read back from the API uses. Prefer `blocks`."),
});

/* `parentId` and `wireframes` are declared purely so they survive validation:
 * zod strips keys it does not know, and `normalizeNodes` accepts both spellings
 * precisely so a board read back from the API can be edited and pushed again
 * unchanged. Omit them here and that round-trip silently flattens the tree and
 * drops every block — the schema, not the normalizer, would be eating them. */

export const nodesSchema = z
  .array(nodeSchema)
  .min(1)
  .max(LIMITS.nodes)
  .describe("Every page of the site, as one flat array linked by `parent`.");
