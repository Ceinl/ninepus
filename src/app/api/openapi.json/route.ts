import { BLOCK_DEFS } from "@/lib/blocks";

const blockTypeEnum = BLOCK_DEFS.map((b) => b.type);

const nodeSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$", description: "Stable id; auto-assigned when omitted" },
    parent: { type: ["string", "null"], description: "Id of the parent node in the same push; null/omitted = root" },
    title: { type: "string", maxLength: 120 },
    color: { type: "string", enum: ["slate", "blue", "green", "amber", "red", "violet", "teal", "pink"] },
    notes: { type: "string", maxLength: 4000 },
    blocks: {
      type: "array",
      maxItems: 32,
      items: {
        oneOf: [
          { type: "string", enum: blockTypeEnum },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: blockTypeEnum },
              label: { type: "string", maxLength: 120 },
            },
            required: ["type"],
          },
        ],
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
        "Anonymous whiteboard boards for coding agents: push a website shape (page tree + lo-fi wireframe blocks), get a public link and a manage key for updates/expiry/deletion.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/boards": {
        post: {
          summary: "Create a board",
          description: "Anonymous. Returns the manage key exactly once.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", maxLength: 80 },
                    expiresInDays: { type: "number", maximum: 365, nullable: true },
                    nodes: { type: "array", maxItems: 500, items: nodeSchema },
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
            "404": { description: "Unknown or expired board" },
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
                    nodes: { type: "array", maxItems: 500, items: nodeSchema },
                    name: { type: "string", maxLength: 80 },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Updated" }, "403": { description: "Wrong key" } },
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
                    name: { type: "string", maxLength: 80 },
                    expiresInDays: { type: "number", maximum: 365, nullable: true },
                    extendDays: { type: "number" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          summary: "Delete the board",
          security: [{ ManageKey: [] }],
          responses: { "200": { description: "Deleted" }, "403": { description: "Wrong key" } },
        },
      },
    },
    components: {
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
