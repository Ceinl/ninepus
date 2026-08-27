import { expiryFrom, loadDoc, normalizeNodes } from "@/lib/boards";
import { err, handle, HttpError, ok, readJson, requireManageKey } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import {
  boardById,
  deleteBoard as dbDeleteBoard,
  setName as dbSetName,
  setExpiry as dbSetExpiry,
  sweepExpired,
  updateDoc as dbUpdateDoc,
} from "@/lib/db";

import type { BoardRow } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

interface BoardView {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

function loadBoard(
  id: string,
  row: BoardRow,
): { board: BoardView; doc: ReturnType<typeof loadDoc> } {
  return {
    board: {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    },
    doc: loadDoc(row.doc),
  };
}

/** Public read — no key needed. */
export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    await sweepExpired();
    const row = await boardById(id);
    if (!row) throw new HttpError(404, "Board not found");
    const { board, doc } = loadBoard(id, row);
    return ok({ ...board, nodes: doc });
  });
}

/** Push a whole new shape. Replaces every node. */
export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { headers } = await rateLimit(req, "mutate");
    const { id } = await ctx.params;
    const row = await boardById(id);
    if (!row) return err(404, "Board not found");
    requireManageKey(req, row);

    const body = await readJson<{ nodes?: unknown; name?: unknown }>(req);
    if (body.nodes === undefined && body.name === undefined)
      throw new HttpError(400, 'Body must contain "nodes" and/or "name"');

    const now = Date.now();
    let nodes: ReturnType<typeof normalizeNodes> | undefined;
    if (body.nodes !== undefined) {
      nodes = normalizeNodes(body.nodes);
      await dbUpdateDoc(JSON.stringify(nodes), now, id);
    }
    if (typeof body.name === "string")
      await dbSetName(body.name.trim().slice(0, LIMITS.boardName), now, id);

    return ok({ updated: true, nodeCount: nodes?.length ?? loadDoc(row.doc).length }, { headers });
  });
}

/** Rename or change the expiry without touching the shape. */
export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { headers } = await rateLimit(req, "mutate");
    const { id } = await ctx.params;
    const row = await boardById(id);
    if (!row) return err(404, "Board not found");
    requireManageKey(req, row);

    const body = await readJson<{ name?: unknown; expiresInDays?: unknown; extendDays?: unknown }>(req);
    if (body.name === undefined && body.expiresInDays === undefined && body.extendDays === undefined)
      throw new HttpError(400, 'Nothing to update — send "name", "expiresInDays" or "extendDays"');

    const now = Date.now();
    let expiresAt: number | null | undefined;
    if (body.extendDays !== undefined) {
      if (typeof body.extendDays !== "number" || !Number.isFinite(body.extendDays) || body.extendDays <= 0)
        throw new HttpError(400, '"extendDays" must be a positive number of days');
      const base = row.expires_at && row.expires_at > now ? row.expires_at : now;
      expiresAt = Math.min(base + Math.round(body.extendDays * 24 * 3600 * 1000), now + 365 * 24 * 3600 * 1000);
    } else {
      expiresAt = expiryFrom(body.expiresInDays);
    }

    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, LIMITS.boardName) || null : null;
    if (name !== null) await dbSetName(name, now, id);
    if (expiresAt !== undefined) await dbSetExpiry(expiresAt, now, id);

    return ok(
      { updated: true, name: name ?? row.name, expiresAt: expiresAt === undefined ? row.expires_at : expiresAt },
      { headers },
    );
  });
}

/** Delete the board for good. */
export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { headers } = await rateLimit(req, "mutate");
    const { id } = await ctx.params;
    const row = await boardById(id);
    if (!row) return err(404, "Board not found");
    requireManageKey(req, row);
    await dbDeleteBoard(id);
    return ok({ deleted: true }, { headers });
  });
}
