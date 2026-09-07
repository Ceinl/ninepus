import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BLOCK_TYPES } from "@/lib/blocks";
import { DEFAULT_EXPIRY_DAYS, LIMITS, MAX_BODY_BYTES, RATE_RULES } from "@/lib/limits";
import { requestOrigin } from "@/lib/origin";

const ENDPOINTS: Array<{ m: string; p: string; d: string }> = [
  { m: "POST", p: "/api/boards", d: "Create a board — { nodes, name?, expiresInDays? } → public url + manage key (shown once)" },
  { m: "GET", p: "/api/boards/:id", d: "Public read — board meta + all nodes" },
  { m: "PUT", p: "/api/boards/:id", d: "Replace the whole shape — { nodes, name? } (key)" },
  { m: "PATCH", p: "/api/boards/:id", d: "{ name?, expiresInDays?, extendDays? } (key)" },
  { m: "DELETE", p: "/api/boards/:id", d: "Delete board and every node (key)" },
];


const ERRORS: Array<{ code: string; when: string; act: string }> = [
  { code: "400", when: "Malformed body, or a node/block/expiry the API rejects", act: "fix, never retry unchanged" },
  { code: "401", when: "No manage key on PUT / PATCH / DELETE", act: "send X-Manage-Key" },
  { code: "403", when: "Manage key does not match this board", act: "stop, ask the user" },
  { code: "404", when: "No such board, or it expired", act: "stop" },
  { code: "413", when: `Body over ${MAX_BODY_BYTES / 1024 / 1024} MB`, act: "split or trim" },
  { code: "429", when: "Rate limit exceeded", act: "wait Retry-After, then retry" },
  { code: "500", when: "Server-side failure", act: "retry once with backoff" },
];

const describeRule = (r: { limit: number; windowMs: number }) =>
  `${r.limit} per ${r.windowMs >= 3600_000 ? `${r.windowMs / 3600_000} h` : `${r.windowMs / 1000} s`}`;

const METHOD_COLOR: Record<string, string> = {
  GET: "#199473",
  POST: "#2e6fe8",
  PATCH: "#d98e04",
  DELETE: "#d64545",
};

export default async function ApiDocs() {
  const origin = await requestOrigin();

  return (
    <div className="flex-1">
      <header className="border-b border-line bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="font-display italic text-xl">ninepus</Link>
          <span className="microlabel">rest api</span>
          <Link href="/api/openapi.json" className="ml-auto microlabel border border-line rounded-full px-3 py-1 hover:border-accent hover:text-accent">openapi.json</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <section className="rise">
          <h1 className="font-display text-4xl mb-3">Push a board from any coding agent.</h1>
          <p className="text-[14px] leading-relaxed text-ink-soft max-w-2xl">
            No accounts, no sign-up. Your agent builds the shape locally, pushes it as JSON,
            and gets back a public link plus a manage key. The key authorises updates,
            expiry changes and deletion — keep it; it is never shown again.
          </p>
          <p className="text-[14px] leading-relaxed text-ink-soft max-w-2xl mt-3">
            A ready-to-use agent skill is served live at{" "}
            <a href="/api/skill" className="font-mono text-[12px] bg-paper-deep px-1.5 py-0.5 rounded hover:text-accent">/api/skill</a>{" "}
            — <code className="font-mono text-[12px]">curl -s {origin}/api/skill</code>. It comes back with this
            host already filled in.
          </p>
        </section>

        <section className="rise" style={{ animationDelay: "60ms" }}>
          <h2 className="microlabel mb-3">quickstart</h2>
          <pre className="font-mono text-[11.5px] leading-relaxed bg-ink text-paper-deep rounded-xl p-4 overflow-x-auto">{`BASE=${origin}

# publish an anonymous board
curl -X POST $BASE/api/boards -H 'Content-Type: application/json' -d '{
  "name": "Acme redesign",
  "expiresInDays": 30,
  "nodes": [
    { "id": "home", "title": "Home",
      "blocks": ["navbar", {"type":"hero","label":"Ship faster"}, "cards"] },
    { "id": "pricing", "parent": "home", "title": "Pricing",
      "slug": "pricing", "pageType": "page",
      "seo": { "title": "Pricing — Acme" },
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
            <li><code className="font-mono text-[12px]">id</code> — optional, <code>alphanum_-</code> up to {LIMITS.nodeId} chars; auto-assigned when omitted.</li>
            <li><code className="font-mono text-[12px]">parent</code> — id of another node in the same push (forward references fine); omit for root.</li>
            <li><code className="font-mono text-[12px]">title</code> (≤{LIMITS.title}), <code className="font-mono text-[12px]">notes</code> (≤{LIMITS.notes}) — free text.</li>
            <li><code className="font-mono text-[12px]">color</code> — slate · blue · green · amber · red · violet · teal · pink.</li>
            <li><code className="font-mono text-[12px]">slug</code> — optional URL path, no leading/trailing slash or whitespace, ≤{LIMITS.slug}.</li>
            <li><code className="font-mono text-[12px]">pageType</code> — optional: <code>page</code> (default) · <code>template</code> · <code>redirect</code> · <code>external</code>.</li>
            <li><code className="font-mono text-[12px]">seo</code> — optional object <code>{"{ title?, description? }"}</code> (≤{LIMITS.seoTitle} / ≤{LIMITS.seoDescription} chars).</li>
            <li><code className="font-mono text-[12px]">tags</code> — optional array of ≤{LIMITS.tags} labels, ≤{LIMITS.tag} chars each.</li>
            <li><code className="font-mono text-[12px]">blocks</code> — array of block-type strings or <code>{"{ type, label }"}</code>; max {LIMITS.blocksPerNode} per node, {LIMITS.nodes} nodes per board.</li>
            <li>Sibling order follows array order; cycles and dangling parents are rejected with the offending index.</li>
          </ul>
        </section>

        <section className="rise space-y-3">
          <h2 className="microlabel">read shape · round trip</h2>
          <p className="text-[13px] leading-relaxed text-ink-soft max-w-2xl">
            <code className="font-mono text-[12px]">GET</code> returns board meta plus a{" "}
            <code className="font-mono text-[12px]">nodes</code> array. The read shape names things
            differently from the write shape — <code className="font-mono text-[12px]">parentId</code> and{" "}
            <code className="font-mono text-[12px]">wireframes</code> where a push writes{" "}
            <code className="font-mono text-[12px]">parent</code> and <code className="font-mono text-[12px]">blocks</code> —
            and adds a computed <code className="font-mono text-[12px]">sortOrder</code>.
          </p>
          <p className="text-[13px] leading-relaxed text-ink-soft max-w-2xl">
            <code className="font-mono text-[12px]">PUT</code> accepts <em>both</em> spellings, so the{" "}
            <code className="font-mono text-[12px]">nodes</code> array from a GET can be edited and pushed
            straight back with no translation. Order, parents, blocks and labels all survive the trip.
          </p>
        </section>

        <section className="rise space-y-3">
          <h2 className="microlabel">rate limits</h2>
          <p className="text-[13px] leading-relaxed text-ink-soft max-w-2xl">
            Per IP: <strong>{RATE_RULES.create.map(describeRule).join(" and ")}</strong> for creating
            boards, <strong>{RATE_RULES.mutate.map(describeRule).join(" and ")}</strong> for{" "}
            <code className="font-mono text-[12px]">PUT</code>/<code className="font-mono text-[12px]">PATCH</code>/
            <code className="font-mono text-[12px]">DELETE</code>. Reads are not limited.
          </p>
          <p className="text-[13px] leading-relaxed text-ink-soft max-w-2xl">
            Every response carries <code className="font-mono text-[12px]">RateLimit-Limit</code>,{" "}
            <code className="font-mono text-[12px]">RateLimit-Remaining</code>,{" "}
            <code className="font-mono text-[12px]">RateLimit-Reset</code> (seconds) and{" "}
            <code className="font-mono text-[12px]">RateLimit-Policy</code> — pace off those rather than
            pushing until you get a 429. A 429 carries{" "}
            <code className="font-mono text-[12px]">Retry-After</code>. Bodies over{" "}
            {MAX_BODY_BYTES / 1024 / 1024} MB are refused with a 413.
          </p>
        </section>

        <section className="rise space-y-3">
          <h2 className="microlabel">errors</h2>
          <p className="text-[13px] leading-relaxed text-ink-soft max-w-2xl">
            Every failure is JSON: <code className="font-mono text-[12px]">{'{"error": "…"}'}</code>. Validation
            messages name the offending index, e.g.{" "}
            <code className="font-mono text-[12px]">nodes[3]: blocks[1] has unknown type &quot;carousel&quot;</code>.
          </p>
          <div className="rounded-xl border border-line-strong overflow-hidden max-w-2xl">
            {ERRORS.map((e, i) => (
              <div key={e.code} className={`flex gap-3 items-baseline px-4 py-2.5 ${i % 2 ? "bg-card" : "bg-paper-deep/40"}`}>
                <span className="font-mono text-[11px] font-bold w-9 shrink-0">{e.code}</span>
                <span className="text-[12.5px]">{e.when}</span>
                <span className="text-[12px] text-ink-soft ml-auto text-right shrink-0">{e.act}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-ink-soft max-w-2xl">
            404 is resolved before the key is checked, so a bad key against a board that does not exist
            reports 404 rather than 403.
          </p>
        </section>

        <section className="rise">
          <h2 className="microlabel mb-3">wireframe block types · {BLOCK_TYPES.length}</h2>
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_TYPES.map((b) => (
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
            <li>The manage key can travel as <code className="font-mono text-[12px]">X-Manage-Key</code> or <code className="font-mono text-[12px]">Authorization: Bearer nb_…</code>; only its SHA-256 hash is stored, so a lost key cannot be recovered by anyone.</li>
            <li><code className="font-mono text-[12px]">expiresInDays</code> defaults to <strong>{DEFAULT_EXPIRY_DAYS}</strong> and caps at {LIMITS.expiryDays}; pass <code className="font-mono text-[12px]">null</code> or <code className="font-mono text-[12px]">0</code> for a board that never expires. Expired boards are purged and read back as plain 404.</li>
            <li><code className="font-mono text-[12px]">POST</code> requires at least one node — an empty board is a 400, not a silently created orphan. There is no idempotency key, so treat a timed-out create as “may have landed”.</li>
            <li><code className="font-mono text-[12px]">PUT</code> is a full replacement — there are no incremental node edits by design; agents own the shape.</li>
            <li>Boards are public: anyone with <code className="font-mono text-[12px]">/b/:id</code> reads the whole board. The id is unguessable, not secret.</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/" className="microlabel hover:text-accent">ninepus</Link>
          <span className="ml-auto flex items-center gap-5">
            <Link href="/privacy" className="microlabel hover:text-accent">privacy</Link>
            <Link href="/terms" className="microlabel hover:text-accent">terms</Link>
            <Link href="/imprint" className="microlabel hover:text-accent">contact</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
