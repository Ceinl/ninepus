import { expiryFrom, loadDoc, normalizeNodes } from "@/lib/boards";
import { err, handle, HttpError, ok, readJson, requireManageKey } from "@/lib/api-helpers";
import { stmts, sweepExpired } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

interface BoardView {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

function loadBoard(id: string): { board: BoardView; doc: ReturnType<typeof loadDoc> } {
  sweepExpired();
  const row = stmts.boardById.get(id);
  if (!row) throw new HttpError(404, "Board not found");
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
    const { board, doc } = loadBoard(id);
    return ok({ ...board, nodes: doc });
  });
}

/** Push a whole new shape. Replaces every node. */
export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = stmts.boardById.get(id);
    if (!row) return err(404, "Board not found");
    requireManageKey(req, row);

    const body = await readJson<{ nodes?: unknown; name?: unknown }>(req);
    if (body.nodes === undefined && body.name === undefined)
      throw new HttpError(400, 'Body must contain "nodes" and/or "name"');

    const now = Date.now();
    let nodes: ReturnType<typeof normalizeNodes> | undefined;
    if (body.nodes !== undefined) {
      nodes = normalizeNodes(body.nodes);
      stmts.updateDoc.run(JSON.stringify(nodes), now, id);
    }
    if (typeof body.name === "string")
      stmts.setName.run(body.name.trim().slice(0, 80), now, id);

    return ok({ updated: true, nodeCount: nodes?.length ?? loadDoc(row.doc).length });
  });
}

/** Rename or change the expiry without touching the shape. */
export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = stmts.boardById.get(id);
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
      typeof body.name === "string" ? body.name.trim().slice(0, 80) || null : null;
    if (name !== null) stmts.setName.run(name, now, id);
    if (expiresAt !== undefined) stmts.setExpiry.run(expiresAt, now, id);

    return ok({ updated: true, name: name ?? row.name, expiresAt: expiresAt === undefined ? row.expires_at : expiresAt });
  });
}

/** Delete the board for good. */
export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = stmts.boardById.get(id);
    if (!row) return err(404, "Board not found");
    requireManageKey(req, row);
    stmts.deleteBoard.run(id);
    return ok({ deleted: true });
  });
}
