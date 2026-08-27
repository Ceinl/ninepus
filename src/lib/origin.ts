import { headers } from "next/headers";

export const LOCAL_ORIGIN = "http://localhost:3000";

/** The origin the caller actually reached us on, so docs and the agent skill
 *  quote the deployed host instead of whatever the author had running locally.
 *  `NINEPUS_PUBLIC_URL` pins it when the app sits behind a proxy that rewrites
 *  the host. */
export async function requestOrigin(): Promise<string> {
  const pinned = process.env.NINEPUS_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (pinned) return pinned;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return LOCAL_ORIGIN;

  const proto =
    h.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
