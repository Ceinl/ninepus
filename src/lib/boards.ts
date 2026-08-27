import { createHash } from "node:crypto";
import { HttpError } from "./api-helpers";
import { isBlockType } from "./blocks";
import { DAY_MS, DEFAULT_EXPIRY_DAYS, LIMITS } from "./limits";
import type { BoardNode, NodeColor, NodeInput, PageType, SeoMeta, WireBlock } from "./types";

/* ------------------------------------------------------------------ ids ---- */

const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

function randomFrom(alphabet: string, len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function genBoardId(): string {
  return randomFrom(ID_ALPHABET, 10);
}

/** Secret shown once at creation; only its hash is stored. */
export function genManageKey(): string {
  return "nb_" + Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/* ------------------------------------------------------------ validation ---- */

const COLORS = new Set<NodeColor>(["slate", "blue", "green", "amber", "red", "violet", "teal", "pink"]);
const NODE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const PAGE_TYPES = new Set<PageType>(["page", "template", "redirect", "external"]);

function parseSlug(raw: unknown, where: string): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") throw new HttpError(400, `${where}: "slug" must be a string`);
  const slug = raw.trim().replace(/^\/+|\/+$/g, "").slice(0, LIMITS.slug);
  if (/\s/.test(slug)) throw new HttpError(400, `${where}: "slug" must not contain whitespace`);
  return slug || undefined;
}

function parsePageType(raw: unknown, where: string): PageType | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || !PAGE_TYPES.has(raw as PageType))
    throw new HttpError(400, `${where}: "pageType" must be one of page · template · redirect · external`);
  return raw as PageType;
}

function parseSeo(raw: unknown, where: string): SeoMeta | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw))
    throw new HttpError(400, `${where}: "seo" must be an object { title?, description? }`);
  const s = raw as { title?: unknown; description?: unknown };
  const title = typeof s.title === "string" && s.title.trim() ? s.title.trim().slice(0, LIMITS.seoTitle) : undefined;
  const description =
    typeof s.description === "string" && s.description.trim()
      ? s.description.trim().slice(0, LIMITS.seoDescription)
      : undefined;
  return title || description ? { ...(title ? { title } : {}), ...(description ? { description } : {}) } : undefined;
}

function parseTags(raw: unknown, where: string): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new HttpError(400, `${where}: "tags" must be an array of strings`);
  if (raw.length > LIMITS.tags) throw new HttpError(400, `${where}: more than ${LIMITS.tags} tags`);
  const tags = raw
    .filter((t) => typeof t === "string" && t.trim())
    .map((t) => (t as string).trim().slice(0, LIMITS.tag));
  return tags.length > 0 ? [...new Set(tags)] : undefined;
}

interface BlockInput {
  type?: unknown;
  label?: unknown;
}

function parseBlocks(raw: unknown, where: string): WireBlock[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, `${where}: "blocks" must be an array`);
  if (raw.length > LIMITS.blocksPerNode)
    throw new HttpError(400, `${where}: more than ${LIMITS.blocksPerNode} blocks`);

  return raw.map((item, i) => {
    let type: unknown = item;
    let label: string | undefined;
    if (typeof item === "object" && item !== null) {
      const b = item as BlockInput;
      type = b.type;
      if (typeof b.label === "string") label = b.label.trim().slice(0, LIMITS.blockLabel) || undefined;
    }
    if (typeof type !== "string" || !isBlockType(type))
      throw new HttpError(400, `${where}: blocks[${i}] has unknown type "${String(type).slice(0, 40)}"`);
    return { id: `b${i}`, type, label };
  });
}

/** Both spellings of "who is my parent": `parent` is what an agent writes by
 *  hand, `parentId` is what GET emits. Accepting both is what makes
 *  GET → modify → PUT lossless. */
function parentOf(n: NodeInput, where: string): string | null {
  const raw = n.parent !== undefined ? n.parent : n.parentId;
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string")
    throw new HttpError(400, `${where}: "parent" must be a node id or null`);
  return raw;
}

/** Same story for the block list: `blocks` on the way in, `wireframes` on the
 *  way out. A GET response fed straight back to PUT must keep its blocks. */
function blocksOf(n: NodeInput): unknown {
  return n.blocks !== undefined ? n.blocks : n.wireframes;
}

/**
 * Turn the pushed node list into canonical board nodes.
 * Accepts agent-friendly shapes: `parent` may be any node's id (declared later
 * in the array is fine), `blocks` entries may be plain type strings. Also
 * accepts a GET response verbatim — `parentId` and `wireframes` are honoured as
 * aliases, so the documented GET → modify → PUT loop round-trips exactly.
 */
export function normalizeNodes(input: unknown): BoardNode[] {
  if (!Array.isArray(input)) throw new HttpError(400, '"nodes" must be an array');
  if (input.length > LIMITS.nodes) throw new HttpError(400, `more than ${LIMITS.nodes} nodes`);

  const usedIds = new Set<string>();
  let auto = 0;
  const nextAutoId = (): string => {
    let candidate: string;
    do candidate = `n${++auto}`;
    while (usedIds.has(candidate));
    usedIds.add(candidate);
    return candidate;
  };

  interface Parsed {
    id: string;
    parent: string | null;
    title: string;
    color: NodeColor;
    notes: string;
    slug?: string;
    pageType?: PageType;
    seo?: SeoMeta;
    tags?: string[];
    wireframes: WireBlock[];
  }

  const parsed: Parsed[] = input.map((item, i) => {
    const where = `nodes[${i}]`;
    if (typeof item !== "object" || item === null || Array.isArray(item))
      throw new HttpError(400, `${where} must be an object`);
    const n = item as NodeInput;

    let id: string;
    if (n.id === undefined || n.id === null || n.id === "") id = nextAutoId();
    else {
      if (typeof n.id !== "string" || !NODE_ID_RE.test(n.id))
        throw new HttpError(400, `${where}: "id" must match ${NODE_ID_RE.source}`);
      if (usedIds.has(n.id)) throw new HttpError(400, `${where}: duplicate id "${n.id}"`);
      id = n.id;
      usedIds.add(id);
    }

    const parent = parentOf(n, where);

    const title =
      typeof n.title === "string" && n.title.trim()
        ? n.title.trim().slice(0, LIMITS.title)
        : "Untitled";
    const color =
      typeof n.color === "string" && COLORS.has(n.color as NodeColor) ? (n.color as NodeColor) : "slate";
    const notes = typeof n.notes === "string" ? n.notes.slice(0, LIMITS.notes) : "";
    const slug = parseSlug(n.slug, where);
    const pageType = parsePageType(n.pageType, where);
    const seo = parseSeo(n.seo, where);
    const tags = parseTags(n.tags, where);

    return {
      id,
      parent,
      title,
      color,
      notes,
      ...(slug ? { slug } : {}),
      ...(pageType ? { pageType } : {}),
      ...(seo ? { seo } : {}),
      ...(tags ? { tags } : {}),
      wireframes: parseBlocks(blocksOf(n), where),
    };
  });

  // resolve parents — forward references are allowed
  const byId = new Set(parsed.map((p) => p.id));
  for (const [i, p] of parsed.entries()) {
    if (p.parent !== null && !byId.has(p.parent))
      throw new HttpError(400, `nodes[${i}]: parent "${p.parent}" is not a node in this push`);
  }

  // reject cycles — reported against the pushed index, like every other error
  for (const [i, start] of parsed.entries()) {
    const seen = new Set<string>([start.id]);
    let cur = parsed.find((p) => p.id === start.parent);
    while (cur) {
      if (cur.id === start.id)
        throw new HttpError(400, `nodes[${i}]: "${start.id}" is its own ancestor`);
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      cur = parsed.find((p) => p.id === cur!.parent);
    }
  }

  // sibling order follows push order
  const counters = new Map<string | null, number>();
  return parsed.map((p) => {
    const sortOrder = counters.get(p.parent) ?? 0;
    counters.set(p.parent, sortOrder + 1);
    return {
      id: p.id,
      parentId: p.parent,
      title: p.title,
      color: p.color,
      notes: p.notes,
      sortOrder,
      ...(p.slug ? { slug: p.slug } : {}),
      ...(p.pageType ? { pageType: p.pageType } : {}),
      ...(p.seo ? { seo: p.seo } : {}),
      ...(p.tags ? { tags: p.tags } : {}),
      wireframes: p.wireframes,
    };
  });
}

/** Parse the stored doc defensively — corrupt JSON degrades to an empty board. */
export function loadDoc(doc: string): BoardNode[] {
  try {
    const nodes = JSON.parse(doc) as BoardNode[];
    return Array.isArray(nodes) ? nodes : [];
  } catch {
    return [];
  }
}

/** Clamp an expiresInDays value; returns epoch ms, or null for "never".
 *  Returns undefined when the field was absent (no change). */
export function expiryFrom(days: unknown): number | null | undefined {
  if (days === undefined) return undefined;
  if (days === null || days === 0) return null;
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0)
    throw new HttpError(400, `"expiresInDays" must be a positive number, 0 or null`);
  if (days > LIMITS.expiryDays) throw new HttpError(400, `"expiresInDays" is capped at ${LIMITS.expiryDays}`);
  return Date.now() + Math.round(days * DAY_MS);
}

/** Expiry for a board being created. Unlike PATCH, "field absent" is not "leave
 *  it alone" — there is nothing to leave alone yet, so it means the finite
 *  default. Explicit `null` or `0` still buys a board that never expires. */
export function initialExpiry(days: unknown): number | null {
  const explicit = expiryFrom(days);
  return explicit === undefined ? Date.now() + DEFAULT_EXPIRY_DAYS * DAY_MS : explicit;
}
