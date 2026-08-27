import { genBoardId, genManageKey, hashKey, initialExpiry, normalizeNodes } from "@/lib/boards";
import { err, handle, HttpError, ok, readJson } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { boardById, insertBoard, sweepExpired } from "@/lib/db";

interface CreateBody {
  name?: string;
  expiresInDays?: number | null;
  nodes?: unknown;
}

/** Create an anonymous board. The manage key is returned exactly once. */
export async function POST(req: Request) {
  return handle(async () => {
    // Charged before the body is read: a flood should cost us a counter bump,
    // not megabytes of parsing.
    const { headers } = await rateLimit(req, "create");
    await sweepExpired();
    const body = await readJson<CreateBody>(req);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, LIMITS.boardName) : "";

    // A board with no nodes is never something an agent meant to create, and it
    // would outlive the request that made it — so it is a 400, not a 201.
    if (body.nodes === undefined || body.nodes === null)
      throw new HttpError(400, '"nodes" is required — push at least one node');
    const nodes = normalizeNodes(body.nodes);
    if (nodes.length === 0) throw new HttpError(400, '"nodes" must contain at least one node');

    const key = genManageKey();
    const now = Date.now();
    const expiresAt = initialExpiry(body.expiresInDays);

    let id = genBoardId();
    for (let attempt = 0; (await boardById(id)) !== null; attempt++) {
      if (attempt > 4) return err(500, "Could not allocate a board id, try again");
      id = genBoardId();
    }

    await insertBoard({
      id,
      name,
      doc: JSON.stringify(nodes),
      manageHash: hashKey(key),
      now,
      expiresAt,
    });

    return ok(
      {
        id,
        manageKey: key,
        name,
        expiresAt,
        url: `/b/${id}`,
        apiUrl: `/api/boards/${id}`,
      },
      { status: 201, headers },
    );
  });
}
