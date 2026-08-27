import { HttpError } from "./api-helpers";
import { bumpWindow, sweepRateLimits } from "./db";
import { RATE_RULES, type RateRule } from "./limits";

/** How often a request also pays for garbage collection. */
const SWEEP_ODDS = 0.02;

/** Who to charge. On Vercel the platform sets `x-vercel-forwarded-for` and
 *  strips any client-supplied copy, so it is the one header worth trusting;
 *  the others are fallbacks for other hosts and local dev. Behind a proxy that
 *  does not rewrite these, a caller can forge them — put the WAF in front if
 *  that matters. */
function clientKey(req: Request): string {
  const h = req.headers;
  const chain = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for");
  const ip = chain?.split(",")[0].trim() || h.get("x-real-ip")?.trim();
  return ip || "local";
}

export interface RateVerdict {
  /** Advertise the tightest remaining budget, so a caller pacing itself off
   *  these headers respects whichever rule bites first. */
  headers: Record<string, string>;
}

/**
 * Charge one request against every rule in a group.
 *
 * Fails open: if the counter store is unreachable the request proceeds. A
 * whiteboard going down because its rate limiter did would be a worse outcome
 * than the abuse the limiter prevents.
 */
export async function rateLimit(req: Request, group: keyof typeof RATE_RULES): Promise<RateVerdict> {
  const rules = RATE_RULES[group];
  const key = clientKey(req);
  const now = Date.now();

  let tightest: { rule: RateRule; remaining: number; resetAt: number } | null = null;
  let exceeded: { rule: RateRule; resetAt: number } | null = null;

  try {
    for (const rule of rules) {
      const { count, resetAt } = await bumpWindow(`${rule.name}:${key}`, rule.windowMs, now);
      const remaining = Math.max(0, rule.limit - count);
      if (count > rule.limit && !exceeded) exceeded = { rule, resetAt };
      if (!tightest || remaining < tightest.remaining) tightest = { rule, remaining, resetAt };
    }
    if (Math.random() < SWEEP_ODDS) await sweepRateLimits(now);
  } catch {
    return { headers: {} };
  }

  const shown = exceeded
    ? { rule: exceeded.rule, remaining: 0, resetAt: exceeded.resetAt }
    : tightest!;
  const retryAfter = Math.max(1, Math.ceil((shown.resetAt - now) / 1000));
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(shown.rule.limit),
    "RateLimit-Remaining": String(shown.remaining),
    "RateLimit-Reset": String(retryAfter),
    "RateLimit-Policy": rules.map((r) => `${r.limit};w=${Math.round(r.windowMs / 1000)}`).join(", "),
  };

  if (exceeded) {
    const window = exceeded.rule.windowMs >= 3600_000 ? "hour" : "minute";
    throw new HttpError(
      429,
      `Rate limit exceeded — ${exceeded.rule.limit} requests per ${window}. Retry in ${retryAfter}s.`,
      { ...headers, "Retry-After": String(retryAfter) },
    );
  }

  return { headers };
}
