import { BLOCK_TYPES } from "@/lib/blocks";
import { DEFAULT_EXPIRY_DAYS, LIMITS, MAX_BODY_BYTES, RATE_RULES } from "@/lib/limits";

const blockTypeEnum = BLOCK_TYPES;

/** Every operation can fail this way, so declare it once. */
const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const badRequest = errorResponse("Validation failed — the message names the offending node/block index");
const unauthorized = errorResponse("No manage key supplied");
const forbidden = errorResponse("Manage key does not match this board");
const notFound = errorResponse("Unknown or expired board");
const serverError = errorResponse("Server-side failure");
const tooLarge = errorResponse(`Request body over ${MAX_BODY_BYTES} bytes`);

const rateLimited = {
  ...errorResponse("Rate limit exceeded — honour Retry-After before retrying"),
  headers: {
    "Retry-After": { schema: { type: "integer" }, description: "Seconds to wait before retrying" },
    "RateLimit-Limit": { schema: { type: "integer" } },
    "RateLimit-Remaining": { schema: { type: "integer" } },
    "RateLimit-Reset": { schema: { type: "integer" }, description: "Seconds until the window rolls over" },
  },
};

/** Attached to keyed operations: 404 resolves before the key is checked. */
const keyedErrors = {
  "400": badRequest,
  "401": unauthorized,
  "403": forbidden,
  "404": notFound,
  "413": tooLarge,
  "429": rateLimited,
  "500": serverError,
};

/** DELETE carries no body, so it has nothing to fail validation on. */
const keyedErrorsNoBody = {
  "401": unauthorized,
  "403": forbidden,
  "404": notFound,
  "429": rateLimited,
  "500": serverError,
};

const nodeSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,${LIMITS.nodeId - 1}}$`, description: "Stable id; auto-assigned when omitted" },
    parent: { type: ["string", "null"], description: "Id of the parent node in the same push; null/omitted = root. Forward references are allowed." },
    parentId: { type: ["string", "null"], description: "Alias of `parent`, accepted so a GET response can be PUT back unchanged" },
    title: { type: "string", maxLength: LIMITS.title },
    color: { type: "string", enum: ["slate", "blue", "green", "amber", "red", "violet", "teal", "pink"] },
    notes: { type: "string", maxLength: LIMITS.notes },
    slug: { type: "string", maxLength: LIMITS.slug, description: "URL path without leading/trailing slash or whitespace" },
    pageType: { type: "string", enum: ["page", "template", "redirect", "external"], default: "page" },
    seo: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: LIMITS.seoTitle },
        description: { type: "string", maxLength: LIMITS.seoDescription },
      },
    },
    tags: { type: "array", maxItems: LIMITS.tags, items: { type: "string", maxLength: LIMITS.tag } },
    blocks: {
      type: "array",
      maxItems: LIMITS.blocksPerNode,
      items: {
        oneOf: [
          { type: "string", enum: blockTypeEnum },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: blockTypeEnum },
              label: { type: "string", maxLength: LIMITS.blockLabel },
            },
            required: ["type"],
          },
        ],
      },
    },
    wireframes: {
      type: "array",
      description: "Alias of `blocks`, accepted so a GET response can be PUT back unchanged",
      maxItems: LIMITS.blocksPerNode,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: blockTypeEnum },
          label: { type: "string", maxLength: LIMITS.blockLabel },
        },
        required: ["type"],
      },
    },
  },
};

export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Ninepus Boards API",
      version: "2.0.0",
      description:
        "Anonymous whiteboard boards for coding agents: push a website shape (page tree + lo-fi wireframe blocks), get a public link and a manage key for updates/expiry/deletion.\n\n" +
        `Rate limits per IP — create: ${RATE_RULES.create.map((r) => `${r.limit}/${r.windowMs / 1000}s`).join(", ")}; ` +
        `mutate (PUT/PATCH/DELETE): ${RATE_RULES.mutate.map((r) => `${r.limit}/${r.windowMs / 1000}s`).join(", ")}. ` +
        "Reads are not limited. Every response carries RateLimit-* headers; a 429 carries Retry-After.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/boards": {
        post: {
          summary: "Create a board",
          description:
            "Anonymous. Returns the manage key exactly once — it is stored only as a SHA-256 hash and cannot be recovered. Requires at least one node.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nodes"],
                  properties: {
                    name: { type: "string", maxLength: LIMITS.boardName },
                    expiresInDays: {
                      type: "number",
                      maximum: LIMITS.expiryDays,
                      nullable: true,
                      default: DEFAULT_EXPIRY_DAYS,
                      description: `Days until the board is purged. Omitted = ${DEFAULT_EXPIRY_DAYS}; null or 0 = never expires.`,
                    },
                    nodes: { type: "array", minItems: 1, maxItems: LIMITS.nodes, items: nodeSchema },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Board created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      manageKey: { type: "string", description: "Shown only here" },
                      url: { type: "string" },
                      apiUrl: { type: "string" },
                      expiresAt: { type: "number", nullable: true },
                    },
                  },
                },
              },
            },
            "400": badRequest,
            "413": tooLarge,
            "429": rateLimited,
            "500": serverError,
          },
        },
      },
      "/api/boards/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: {
          summary: "Read a board (public)",
          responses: {
            "200": {
              description: "Board meta + nodes",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      createdAt: { type: "number" },
                      updatedAt: { type: "number" },
                      expiresAt: { type: "number", nullable: true },
                      nodes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            parentId: { type: "string", nullable: true },
                            title: { type: "string" },
                            color: { type: "string" },
                            notes: { type: "string" },
                            sortOrder: { type: "number" },
                            slug: { type: "string" },
                            pageType: { type: "string", enum: ["page", "template", "redirect", "external"] },
                            seo: {
                              type: "object",
                              properties: {
                                title: { type: "string" },
                                description: { type: "string" },
                              },
                            },
                            tags: { type: "array", items: { type: "string" } },
                            wireframes: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  id: { type: "string" },
                                  type: { type: "string", enum: blockTypeEnum },
                                  label: { type: "string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "404": notFound,
            "500": serverError,
          },
        },
        put: {
          summary: "Replace the shape",
          security: [{ ManageKey: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nodes: { type: "array", maxItems: LIMITS.nodes, items: nodeSchema },
                    name: { type: "string", maxLength: LIMITS.boardName },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { updated: { type: "boolean" }, nodeCount: { type: "number" } },
                  },
                },
              },
            },
            ...keyedErrors,
          },
        },
        patch: {
          summary: "Rename or set expiry",
          security: [{ ManageKey: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", maxLength: LIMITS.boardName },
                    expiresInDays: { type: "number", maximum: LIMITS.expiryDays, nullable: true },
                    extendDays: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      updated: { type: "boolean" },
                      name: { type: "string" },
                      expiresAt: { type: "number", nullable: true },
                    },
                  },
                },
              },
            },
            ...keyedErrors,
          },
        },
        delete: {
          summary: "Delete the board",
          security: [{ ManageKey: [] }],
          responses: {
            "200": {
              description: "Deleted",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { deleted: { type: "boolean" } } },
                },
              },
            },
            ...keyedErrorsNoBody,
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "string",
              description:
                "Human-readable failure. Validation messages name the offending index, e.g. `nodes[3]: blocks[1] has unknown type \"carousel\"`.",
            },
          },
        },
      },
      securitySchemes: {
        ManageKey: {
          type: "apiKey",
          in: "header",
          name: "X-Manage-Key",
          description: "Or Authorization: Bearer nb_… — returned once by POST /api/boards",
        },
      },
    },
  };

  return Response.json(spec);
}
