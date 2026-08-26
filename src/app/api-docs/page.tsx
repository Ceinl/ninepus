import Link from "next/link";

const ENDPOINTS: Array<{ m: string; p: string; d: string }> = [
  { m: "POST", p: "/api/boards", d: "Create a board — { name?, expiresInDays?, nodes? } → public url + manage key (shown once)" },
  { m: "GET", p: "/api/boards/:id", d: "Public read — board meta + all nodes" },
  { m: "PUT", p: "/api/boards/:id", d: "Replace the whole shape — { nodes, name? } (key)" },
  { m: "PATCH", p: "/api/boards/:id", d: "{ name?, expiresInDays?, extendDays? } (key)" },
  { m: "DELETE", p: "/api/boards/:id", d: "Delete board and every node (key)" },
];

const BLOCKS = [
  "navbar", "breadcrumb", "tabs", "accordion", "footer", "heading", "text", "quote",
  "list", "table", "image", "gallery", "video", "map", "logos", "hero", "hero-split",
  "cards", "stats", "cta", "form", "pricing", "divider", "spacer",
];

const METHOD_COLOR: Record<string, string> = {
  GET: "#199473",
  POST: "#2e6fe8",
  PATCH: "#d98e04",
  DELETE: "#d64545",
};

export default function ApiDocs() {
  return (
    <div className="flex-1">
      <header className="border-b border-line bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="font-display italic text-xl">ninepus</Link>
          <span className="microlabel">rest api</span>
          <Link href="/api/openapi.json" className="ml-auto microlabel border border-line rounded-full px-3 py-1 hover:border-accent hover:text-accent">openapi.json</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <section className="rise">
          <h1 className="font-display text-4xl mb-3">Push a board from any coding agent.</h1>
          <p className="text-[14px] leading-relaxed text-ink-soft max-w-2xl">
            No accounts, no sign-up. Your agent builds the shape locally, pushes it as JSON,
            and gets back a public link plus a manage key. The key authorises updates,
            expiry changes and deletion — keep it; it is never shown again.
            A ready-to-use skill lives at <code className="font-mono text-[12px] bg-paper-deep px-1.5 py-0.5 rounded">SKILL.md</code> in the repo root.
          </p>
        </section>

        <section className="rise" style={{ animationDelay: "60ms" }}>
          <h2 className="microlabel mb-3">quickstart</h2>
          <pre className="font-mono text-[11.5px] leading-relaxed bg-ink text-paper-deep rounded-xl p-4 overflow-x-auto">{`BASE=http://localhost:3000

# publish an anonymous board
curl -X POST $BASE/api/boards -H 'Content-Type: application/json' -d '{
  "name": "Acme redesign",
  "expiresInDays": 30,
  "nodes": [
    { "id": "home", "title": "Home",
      "blocks": ["navbar", {"type":"hero","label":"Ship faster"}, "cards"] },
    { "id": "pricing", "parent": "home", "title": "Pricing",
      "blocks": ["navbar", "pricing", "accordion", "footer"] }
  ]
}'
# → { "id":"k4mxq2vn8p", "url":"/b/k4mxq2vn8p",
#     "manageKey":"nb_…", "expiresAt":… }

# replace the whole shape later
curl -X PUT $BASE/api/boards/k4mxq2vn8p \\
  -H 'X-Manage-Key: nb_…' -H 'Content-Type: application/json' \\
  -d '{"nodes":[ … ]}'

# delete when done
curl -X DELETE $BASE/api/boards/k4mxq2vn8p -H 'X-Manage-Key: nb_…'`}</pre>
        </section>

        <section className="rise" style={{ animationDelay: "120ms" }}>
          <h2 className="microlabel mb-3">endpoints</h2>
          <div className="rounded-xl border border-line-strong overflow-hidden">
            {ENDPOINTS.map((e, i) => (
              <div key={e.m + e.p} className={`flex gap-3 items-baseline px-4 py-2.5 ${i % 2 ? "bg-card" : "bg-paper-deep/40"} flex-wrap`}>
                <span className="font-mono text-[10.5px] font-bold w-14 shrink-0" style={{ color: METHOD_COLOR[e.m] }}>{e.m}</span>
                <code className="font-mono text-[12px]">{e.p}</code>
                <span className="text-[12px] text-ink-soft ml-auto text-right">{e.d}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rise space-y-3">
          <h2 className="microlabel">node fields</h2>
          <ul className="text-[13px] leading-relaxed text-ink-soft list-disc pl-5 space-y-1.5 max-w-2xl">
            <li><code className="font-mono text-[12px]">id</code> — optional, <code>alphanum_-</code> up to 64 chars; auto-assigned when omitted.</li>
            <li><code className="font-mono text-[12px]">parent</code> — id of another node in the same push (forward references fine); omit for root.</li>
            <li><code className="font-mono text-[12px]">title</code>, <code className="font-mono text-[12px]">notes</code> — free text.</li>
            <li><code className="font-mono text-[12px]">color</code> — slate · blue · green · amber · red · violet · teal · pink.</li>
            <li><code className="font-mono text-[12px]">blocks</code> — array of block-type strings or <code>{"{ type, label }"}</code>; max 32 per node, 500 nodes per board.</li>
            <li>Sibling order follows array order; cycles and dangling parents are rejected with a precise error.</li>
          </ul>
        </section>

        <section className="rise">
          <h2 className="microlabel mb-3">wireframe block types · {BLOCKS.length}</h2>
          <div className="flex flex-wrap gap-1.5">
            {BLOCKS.map((b) => (
              <code key={b} className="font-mono text-[11px] border border-line rounded-full px-2.5 py-1 bg-card">{b}</code>
            ))}
          </div>
          <p className="text-[12px] text-ink-soft mt-3 max-w-xl">
            Blocks render as lo-fi placeholders inside each page card — just enough fidelity to
            discuss content, none of the polish that slows planning down.
          </p>
        </section>

        <section className="rise space-y-3">
          <h2 className="microlabel">notes</h2>
          <ul className="text-[13px] leading-relaxed text-ink-soft list-disc pl-5 space-y-1.5 max-w-2xl">
            <li>The manage key can travel as <code className="font-mono text-[12px]">X-Manage-Key</code> or <code className="font-mono text-[12px]">Authorization: Bearer nb_…</code>; only its hash is stored.</li>
            <li><code className="font-mono text-[12px]">expiresInDays</code> caps at 365; expired boards are purged and read back as plain 404.</li>
            <li><code className="font-mono text-[12px]">PUT</code> is a full replacement — there are no incremental node edits by design; agents own the shape.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
