import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  const skill = await readFile(path.join(process.cwd(), "SKILL.md"), "utf8");
  return new Response(skill, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
