import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { nodesSchema } from "@/lib/mcp-schema";
import { handle, HttpError, manageKeyMatches } from "@/lib/api-helpers";
import {
  genBoardId,
  genManageKey,
  hashKey,
  initialExpiry,
  loadDoc,
  normalizeNodes,
} from "@/lib/boards";
import { DEFAULT_EXPIRY_DAYS, LIMITS } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { boardById, insertBoard, setName, sweepExpired, updateDoc } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";

/* The MCP face of the same two operations the REST API exposes. It exists
 * because agent sandboxes (Cowork, sandboxed Claude Code) filter outbound
 * domains, so `curl https://ninepus…` is a 403 from the sandbox proxy before it
 * ever reaches us — while remote MCP servers are called from Anthropic's cloud
 * and are not subject to that allowlist at all.
 *
 * Every tool delegates to the same helpers the route handlers use. The schemas
 * below are rendered from BLOCK_TYPES, COLOR_HEX and LIMITS for the same reason
 * `renderSkill()` is: a second copy of the block vocabulary would go stale the
 * first time a type moved. */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (s: string): ToolResult => ({ content: [{ type: "text", text: s }] });

/** Surface a validation failure as tool output rather than a transport error —
 *  the messages from `normalizeNodes` name the offending index and field, which
 *  is exactly what the caller needs to fix its own push and retry. */
async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (e: unknown) {
    const msg = e instanceof HttpError || e instanceof Error ? e.message : "Internal error";
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "create_board",
      {
        title: "Publish a wireframe board",
        description:
          "Publish a site structure to Ninepus as a shareable visual board and get back a public link to hand to the user. Build the page tree locally first (crawl, analyse, design), then push it in one call. " +
          "Boards are PUBLIC — anyone with the link reads the whole board, so do not push unreleased pages, internal tools or client work under NDA. " +
          "The manage key comes back exactly once and is stored only as a hash: show it to the user immediately and keep it for this session, or the board can never be edited again.",
        inputSchema: z.object({
          name: z.string().max(LIMITS.boardName).optional().describe("Board title, e.g. the site's domain."),
          nodes: nodesSchema,
          expiresInDays: z
            .number()
            .max(LIMITS.expiryDays)
            .nullable()
            .optional()
            .describe(
              `How long the board lives. Defaults to ${DEFAULT_EXPIRY_DAYS} days; null or 0 means it never expires.`,
            ),
        }),
      },
      async ({ name, nodes, expiresInDays }) =>
        guard(async () => {
          await sweepExpired();
          const parsed = normalizeNodes(nodes);
          const key = genManageKey();
          const now = Date.now();
          const expiresAt = initialExpiry(expiresInDays);

          let id = genBoardId();
          for (let attempt = 0; (await boardById(id)) !== null; attempt++) {
            if (attempt > 4) throw new HttpError(500, "Could not allocate a board id, try again");
            id = genBoardId();
          }

          await insertBoard({
            id,
            name: name?.trim().slice(0, LIMITS.boardName) ?? "",
            doc: JSON.stringify(parsed),
            manageHash: hashKey(key),
            now,
            expiresAt,
          });

          const url = `${await requestOrigin()}/b/${id}`;
          return text(
            `Board published with ${parsed.length} page${parsed.length === 1 ? "" : "s"}.\n\n` +
              `Link to share: ${url}\n` +
              `Board id: ${id}\n` +
              `Manage key: ${key}\n\n` +
              `Give the user both the link and the manage key. The key is shown only this once — ` +
              `it is needed for update_board and cannot be recovered by anyone, including the operator.` +
              (expiresAt ? `\nExpires: ${new Date(expiresAt).toISOString().slice(0, 10)}` : ""),
          );
        }),
    );

    server.registerTool(
      "update_board",
      {
        title: "Update a published board",
        description:
          "Replace the pages of an existing board, rename it, or both. Requires the manage key handed out when the board was created — ask the user for it if it is not in this conversation. " +
          "`nodes` replaces the whole page tree, so send the complete site, not a diff.",
        inputSchema: z.object({
          id: z.string().describe("Board id from create_board, or the last path segment of /b/<id>."),
          manageKey: z.string().describe("The nb_… key issued when the board was created."),
          nodes: nodesSchema.optional(),
          name: z.string().max(LIMITS.boardName).optional(),
        }),
      },
      async ({ id, manageKey, nodes, name }) =>
        guard(async () => {
          if (nodes === undefined && name === undefined)
            throw new HttpError(400, 'Nothing to update — send "nodes" and/or "name"');

          await sweepExpired();
          const row = await boardById(id);
          if (!row) throw new HttpError(404, `No board "${id}" — it may have expired`);
          if (!manageKeyMatches(manageKey, row))
            throw new HttpError(403, "Wrong manage key for this board");

          const now = Date.now();
          let count = loadDoc(row.doc).length;
          if (nodes !== undefined) {
            const parsed = normalizeNodes(nodes);
            await updateDoc(JSON.stringify(parsed), now, id);
            count = parsed.length;
          }
          if (name !== undefined) await setName(name.trim().slice(0, LIMITS.boardName), now, id);

          return text(
            `Board updated — now ${count} page${count === 1 ? "" : "s"}.\n` +
              `${await requestOrigin()}/b/${id}`,
          );
        }),
    );
  },
  {
    serverInfo: { name: "ninepus", version: "1.0.0" },
  },
);

/** Charged per HTTP request rather than per tool call, so the budget is spent
 *  before the body is parsed into an MCP frame. See RATE_RULES.mcp for why this
 *  is a separate, much looser bucket than the REST one. */
async function limited(req: Request): Promise<Response> {
  return handle(async () => {
    await rateLimit(req, "mcp");
    return handler(req);
  });
}

export { limited as GET, limited as POST };
