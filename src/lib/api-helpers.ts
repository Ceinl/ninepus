import { timingSafeEqual } from "node:crypto";
import { hashKey } from "./boards";
import type { BoardRow } from "./db";

export function ok(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function err(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wrap a handler so HttpError becomes a clean JSON response. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e: unknown) {
    if (e instanceof HttpError) return err(e.status, e.message);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(500, msg);
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function extractKey(req: Request): string | null {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7).trim();
  const header = req.headers.get("x-manage-key");
  return header?.trim() || null;
}

const safeEq = (a: string, b: string): boolean => {
  const ha = Buffer.from(hashKey(a));
  const hb = Buffer.from(b);
  return ha.length === hb.length && timingSafeEqual(ha, hb);
};

/** Throws 401/403 unless the request carries this board's manage key. */
export function requireManageKey(req: Request, board: BoardRow): void {
  const key = extractKey(req);
  if (!key)
    throw new HttpError(
      401,
      "Missing manage key — send it once at board creation as the X-Manage-Key header",
    );
  if (!safeEq(key, board.manage_hash)) throw new HttpError(403, "Wrong manage key for this board");
}
