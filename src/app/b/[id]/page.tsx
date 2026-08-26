import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDoc } from "@/lib/boards";
import { stmts, sweepExpired } from "@/lib/db";
import { BoardView } from "./BoardView";

export const dynamic = "force-dynamic";

function expiryLabel(expiresAt: number | null): string | null {
  if (expiresAt === null) return null;
  const days = Math.ceil((expiresAt - Date.now()) / 24 / 3600 / 1000);
  if (days <= 0) return "expires today";
  return `expires in ${days} day${days === 1 ? "" : "s"}`;
}

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  sweepExpired();
  const row = stmts.boardById.get(id);
  if (!row) notFound();

  const nodes = loadDoc(row.doc);
  const expiry = expiryLabel(row.expires_at);

  return (
    <div className="flex-1 flex flex-col h-screen">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-line bg-card shrink-0">
        <Link href="/" className="font-display italic text-xl hover:text-accent transition-colors">
          ninepus
        </Link>
        <span className="text-line-strong">/</span>
        <span className="text-[13px] font-semibold truncate max-w-[30vw]">
          {row.name || "Untitled board"}
        </span>
        <span className="microlabel hidden sm:inline">anonymous board</span>
        {expiry && <span className="microlabel text-amber-700">{expiry}</span>}
        <nav className="ml-auto flex items-center gap-4 shrink-0">
          <Link href="/api-docs" className="microlabel hover:text-accent">api</Link>
          <a
            href={`/api/boards/${id}`}
            className="microlabel rounded-full border border-line px-2.5 py-1 hover:border-ink transition-colors"
          >
            json
          </a>
        </nav>
      </header>
      <BoardView id={id} nodes={nodes} />
    </div>
  );
}
