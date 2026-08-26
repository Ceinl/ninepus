import { createHash } from "node:crypto";
import { HttpError } from "./api-helpers";
import { blockDef } from "./blocks";
import type { BlockType, BoardNode, NodeColor, NodeInput, WireBlock } from "./types";

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

/* --------------------------------------------------------------- limits ---- */

export const MAX_NODES = 500;
export const MAX_BLOCKS_PER_NODE = 32;
export const MAX_EXPIRY_DAYS = 365;
const MAX_TITLE = 120;
const MAX_LABEL = 120;
const MAX_NOTES = 4000;

/* ------------------------------------------------------------ validation ---- */

const COLORS = new Set<NodeColor>(["slate", "blue", "green", "amber", "red", "violet", "teal", "pink"]);
const NODE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

interface BlockInput {
  type?: unknown;
  label?: unknown;
}

function parseBlocks(raw: unknown, where: string): WireBlock[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, `${where}: "blocks" must be an array`);
  if (raw.length > MAX_BLOCKS_PER_NODE)
    throw new HttpError(400, `${where}: more than ${MAX_BLOCKS_PER_NODE} blocks`);

  return raw.map((item, i) => {
    let type: unknown = item;
    let label: string | undefined;
    if (typeof item === "object" && item !== null) {
      const b = item as BlockInput;
      type = b.type;
      if (typeof b.label === "string") label = b.label.trim().slice(0, MAX_LABEL) || undefined;
    }
    if (typeof type !== "string" || !blockDef(type as BlockType))
      throw new HttpError(400, `${where}: blocks[${i}] has unknown type "${String(type)}"`);
    return { id: `b${i}`, type: type as BlockType, label };
  });
}

/**
 * Turn the pushed node list into canonical board nodes.
 * Accepts agent-friendly shapes: `parent` may be any node's id (declared later
 * in the array is fine), `blocks` entries may be plain type strings.
 */
export function normalizeNodes(input: unknown): BoardNode[] {
  if (!Array.isArray(input)) throw new HttpError(400, '"nodes" must be an array');
  if (input.length > MAX_NODES) throw new HttpError(400, `more than ${MAX_NODES} nodes`);

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

    if (n.parent === undefined || n.parent === null || n.parent === "") {
      // resolved after the loop
    } else if (typeof n.parent !== "string")
      throw new HttpError(400, `${where}: "parent" must be a node id or null`);

    const title =
      typeof n.title === "string" && n.title.trim()
        ? n.title.trim().slice(0, MAX_TITLE)
        : "Untitled";
    const color =
      typeof n.color === "string" && COLORS.has(n.color as NodeColor) ? (n.color as NodeColor) : "slate";
    const notes = typeof n.notes === "string" ? n.notes.slice(0, MAX_NOTES) : "";

    return { id, parent: typeof n.parent === "string" && n.parent ? n.parent : null, title, color, notes, wireframes: parseBlocks(n.blocks, where) };
  });

  // resolve parents — forward references are allowed
  const byId = new Set(parsed.map((p) => p.id));
  for (const [i, p] of parsed.entries()) {
    if (p.parent !== null && !byId.has(p.parent))
      throw new HttpError(400, `nodes[${i}]: parent "${p.parent}" is not a node in this push`);
  }

  // reject cycles
  for (const start of parsed) {
    const seen = new Set<string>([start.id]);
    let cur = parsed.find((p) => p.id === start.parent);
    while (cur) {
      if (cur.id === start.id)
        throw new HttpError(400, `nodes: "${start.id}" is its own ancestor`);
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
  if (days > MAX_EXPIRY_DAYS) throw new HttpError(400, `"expiresInDays" is capped at ${MAX_EXPIRY_DAYS}`);
  return Date.now() + Math.round(days * 24 * 3600 * 1000);
}
