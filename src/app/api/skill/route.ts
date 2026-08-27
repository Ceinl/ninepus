import { renderSkill } from "@/lib/skill";
import { requestOrigin } from "@/lib/origin";

/** The skill is rendered per request so it always quotes the host the agent
 *  actually fetched it from — a skill downloaded from production must not tell
 *  the agent to POST to localhost. */
export async function GET() {
  const skill = renderSkill(await requestOrigin());
  return new Response(skill, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
