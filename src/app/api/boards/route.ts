import { genBoardId, genManageKey, hashKey, normalizeNodes } from "@/lib/boards";
import { err, handle, ok, readJson } from "@/lib/api-helpers";
import { boardById, insertBoard, sweepExpired } from "@/lib/db";

interface CreateBody {
  name?: string;
  expiresInDays?: number | null;
  nodes?: unknown;
}

/** Create an anonymous board. The manage key is returned exactly once. */
export async function POST(req: Request) {
  return handle(async () => {
    sweepExpired();
    const body = await readJson<CreateBody>(req);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const nodes = normalizeNodes(body.nodes ?? []);
    const key = genManageKey();
    const now = Date.now();
    const expiresAt =
      typeof body.expiresInDays === "number" && body.expiresInDays > 0
        ? now + Math.min(body.expiresInDays, 365) * 24 * 3600 * 1000
        : null;

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
      { status: 201 },
    );
  });
}
