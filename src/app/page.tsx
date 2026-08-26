import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-4 px-6 py-4 max-w-6xl w-full mx-auto">
        <span className="font-display italic text-2xl">ninepus</span>
        <nav className="ml-auto flex items-center gap-5">
          <Link href="/api-docs" className="microlabel hover:text-accent">api</Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* hero */}
        <section className="dotgrid grain relative border-y border-line overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-[1.1fr_1fr] gap-14 items-center relative z-10">
            <div className="rise">
              <p className="microlabel mb-4">whiteboard for agents · anonymous · api-first</p>
              <h1 className="font-display text-5xl md:text-7xl leading-[0.98] tracking-tight">
                Agents draw<span className="text-signal">.</span>
                <br />
                You watch<span className="text-signal">.</span>
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-soft max-w-md">
                Your coding agent crawls a site, designs the structure and wireframes locally — then
                pushes the whole shape here with one API call. You get a shareable board link.
                No accounts. The key deletes it when you&apos;re done.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/api-docs" className="ticks rounded-xl bg-accent text-white px-7 py-3.5 font-semibold shadow-[5px_6px_0_rgba(33,37,44,0.15)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_3px_0_rgba(33,37,44,0.15)] transition-all">
                  Push your first board →
                </Link>
              </div>
            </div>

            {/* animated mini sitemap */}
            <svg viewBox="0 0 420 340" className="w-full rise" style={{ animationDelay: "150ms" }} aria-hidden>
              {[
                { x: 160, y: 16, w: 100, label: "Home", c: "#2e6fe8", blocks: 3 },
                { x: 40, y: 120, w: 92, label: "Shop", c: "#db5a9b", blocks: 2 },
                { x: 164, y: 120, w: 92, label: "About", c: "#199473", blocks: 3 },
                { x: 292, y: 120, w: 88, label: "Blog", c: "#d98e04", blocks: 2 },
                { x: 24, y: 232, w: 84, label: "Product", c: "#7a55e6", blocks: 2 },
                { x: 130, y: 232, w: 84, label: "Cart", c: "#d64545", blocks: 2 },
                { x: 250, y: 232, w: 84, label: "Post", c: "#0fa3a3", blocks: 3 },
              ].map((n, i) => (
                <g key={n.label} style={{ animation: `rise .6s ${200 + i * 90}ms cubic-bezier(.22,1,.36,1) both` }}>
                  <rect x={n.x} y={n.y} width={n.w} height={64} rx={6} fill="#fffdf8" stroke="#c9c2b0" />
                  <path d={`M ${n.x} ${n.y + 18} h ${n.w}`} stroke="#e4dfd2" />
                  <rect x={n.x} y={n.y} width={n.w} height={17} rx={6} fill={`${n.c}22`} stroke="none" />
                  <circle cx={n.x + 10} cy={n.y + 8.5} r={3} fill={n.c} />
                  <rect x={n.x + 18} y={n.y + 5} width={40} height={7} rx={2} fill="#21252c" opacity=".75" />
                  {Array.from({ length: n.blocks }).map((_, k) => (
                    <rect key={k} x={n.x + 10} y={n.y + 26 + k * 11} width={(n.w - 20) * (k === 0 ? 0.85 : 0.6)} height={6} rx={2} fill="#e7e2d5" />
                  ))}
                </g>
              ))}
              <path d="M210 80 C 210 100, 86 96, 86 120 M210 80 C 210 100, 210 96, 210 120 M210 80 C 210 100, 336 96, 336 120 M66 184 C 66 208, 66 208, 66 232 M172 184 C 172 208, 172 208, 172 232 M294 184 C 294 208, 292 208, 292 232" fill="none" stroke="#c2bbaa" strokeWidth="1.5" />
            </svg>
          </div>
        </section>

        {/* how it works */}
        <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
          {[
            {
              n: "01",
              t: "Agent builds the shape",
              d: "Crawl the site, analyse pages, decide the tree and each page's wireframe blocks — all on the agent's side, in plain JSON.",
            },
            {
              n: "02",
              t: "One call to publish",
              d: "POST the nodes to /api/boards. Back comes a public /b/ link plus a manage key that is shown exactly once.",
            },
            {
              n: "03",
              t: "Share or burn it",
              d: "Anyone with the link views the board. The key holder updates, renames, sets an expiry — or deletes it for good.",
            },
          ].map((s) => (
            <div key={s.n}>
              <div className="font-display italic text-4xl text-accent">{s.n}</div>
              <h3 className="mt-2 font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.d}</p>
            </div>
          ))}
        </section>

        {/* terminal example */}
        <section className="border-t border-line bg-paper-deep/40">
          <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-10 items-start">
            <div>
              <p className="microlabel mb-3">the entire contract</p>
              <h2 className="font-display text-3xl md:text-4xl leading-tight">
                Five endpoints. No sign-up.
              </h2>
              <ul className="mt-5 space-y-2.5 text-[13.5px] text-ink-soft leading-relaxed">
                <li><code className="text-ink font-semibold">POST /api/boards</code> — push nodes, get link + manage key</li>
                <li><code className="text-ink font-semibold">GET /api/boards/:id</code> — public read</li>
                <li><code className="text-ink font-semibold">PUT /api/boards/:id</code> — replace the shape (key)</li>
                <li><code className="text-ink font-semibold">PATCH /api/boards/:id</code> — rename, expire (key)</li>
                <li><code className="text-ink font-semibold">DELETE /api/boards/:id</code> — gone for good (key)</li>
              </ul>
            </div>
            <pre className="rounded-xl border border-line-strong bg-card p-5 text-[12px] leading-relaxed overflow-x-auto shadow-[5px_6px_0_rgba(33,37,44,0.08)]"><code>{`curl -X POST $BASE/api/boards \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Acme redesign",
    "expiresInDays": 30,
    "nodes": [
      { "id": "home", "title": "Home",
        "blocks": ["navbar", "hero", "cards", "cta"] },
      { "id": "pricing", "parent": "home",
        "title": "Pricing",
        "blocks": [{"type":"heading","label":"Simple pricing"},
                   "pricing", "accordion"] }
    ]
  }'

# → { "url": "/b/k4mxq2vn8p",
#     "manageKey": "nb_…shown once…" }`}</code></pre>
          </div>
        </section>
        {/* agent skill */}
        {/* TODO: replace TODO host in curl snippet with the real deployment URL once on Vercel */}
        <section className="border-t border-line bg-paper-deep/40">
          <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-10 items-start">
            <div>
              <p className="microlabel mb-3">teach your agent</p>
              <h2 className="font-display text-3xl md:text-4xl leading-tight">
                One curl. Agent knows everything.
              </h2>
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft max-w-md">
                The whole skill — endpoints, node format, limits, workflow — is a single markdown
                document served straight from this app. Fetch it into your agent&apos;s context and
                it can push boards immediately.
              </p>
            </div>
            <pre className="rounded-xl border border-line-strong bg-card p-5 text-[12px] leading-relaxed overflow-x-auto shadow-[5px_6px_0_rgba(33,37,44,0.08)]"><code>{`# install the ninepus skill into your agent

curl -s https://TODO/api/skill > .agents/skills/ninepus/SKILL.md

# then your agent can do:

curl -s -X POST $B/api/boards \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"demo","nodes":[{"id":"home","title":"Home","blocks":["navbar","hero"]}]}'`}</code></pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="microlabel">ninepus · boards live in sqlite · expired ones vanish</span>
          <Link href="/api-docs" className="microlabel hover:text-accent">full api reference →</Link>
        </div>
      </footer>
    </div>
  );
}
