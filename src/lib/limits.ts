/** Every size and count cap the API enforces, in one place.
 *  Validation, the OpenAPI spec, /api-docs and the generated agent skill all
 *  read from here, so a limit can never drift between what we reject and what
 *  we publish. */
export const LIMITS = {
  nodes: 500,
  blocksPerNode: 32,
  nodeId: 64,
  boardName: 80,
  title: 120,
  blockLabel: 120,
  notes: 4000,
  slug: 200,
  seoTitle: 120,
  seoDescription: 320,
  tags: 8,
  tag: 32,
  expiryDays: 365,
} as const;

/** Boards created without an explicit `expiresInDays` expire after this long.
 *  A finite default is what keeps a timed-out or abandoned POST from leaving a
 *  permanent board whose manage key nobody holds — pass `null` or `0` to opt
 *  out deliberately. */
export const DEFAULT_EXPIRY_DAYS = 30;

export const DAY_MS = 24 * 3600 * 1000;

/** Largest request body we will buffer. A maximally-full legal board (500 nodes
 *  of 4000-char notes and 32 labelled blocks) lands near 5 MB, so this leaves
 *  headroom while refusing the multi-hundred-megabyte bodies the platform would
 *  otherwise happily hand us. */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface RateRule {
  /** Namespace for the counter — distinct rules must not share a bucket. */
  name: string;
  limit: number;
  windowMs: number;
}

/** Per-IP budgets. Creation gets two windows: a burst rule that stops a tight
 *  retry loop, and an hourly rule that caps how much an anonymous caller can
 *  store in a day of steady drip. Mutations are keyed to a board someone
 *  already holds the key for, so they only need loose flood protection. */
export const RATE_RULES: Record<"create" | "mutate" | "mcp", RateRule[]> = {
  create: [
    { name: "create-burst", limit: 5, windowMs: 60 * 1000 },
    { name: "create-hour", limit: 30, windowMs: 60 * 60 * 1000 },
  ],
  mutate: [{ name: "mutate", limit: 60, windowMs: 60 * 1000 }],
  // Remote MCP calls arrive from Anthropic's cloud egress, not from the user's
  // machine, so the source IP is shared with every other Anthropic customer and
  // says nothing about who is calling. The `create` budget applied here would
  // 429 innocent people within seconds. This is deliberately loose: it exists
  // only to bound a runaway loop hammering a public unauthenticated endpoint,
  // not to portion out fairness between callers it cannot tell apart.
  mcp: [{ name: "mcp", limit: 120, windowMs: 60 * 1000 }],
};
