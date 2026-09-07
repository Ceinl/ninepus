import Link from "next/link";

export const metadata = {
  title: "Privacy — ninepus",
  description: "What ninepus stores, why, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center gap-4 px-6 py-4 max-w-3xl w-full mx-auto">
        <Link href="/" className="font-display italic text-2xl">
          ninepus
        </Link>
        <nav className="ml-auto">
          <Link href="/" className="microlabel hover:text-accent">
            back home
          </Link>
        </nav>
      </header>

      <main className="flex-1 border-t border-line">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
          <div>
            <p className="microlabel mb-3">privacy notice</p>
            <h1 className="font-display text-4xl leading-tight">What we store, and why.</h1>
            <p className="mt-3 text-[13px] text-ink-soft">Last updated: 7 September 2026.</p>
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold">Who runs this</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Ninepus is run by Dmytro Slyva, a private individual in Ukraine. Contact:
              Slyva.dima@gmail.com. Takedown and deletion requests go there.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Boards you publish</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              When you push a board we store its name, its nodes and wireframe blocks, creation
              and update times, expiry time, and a SHA-256 hash of the manage key. We never store
              the key itself. Boards are public to anyone with the link. Do not push personal data,
              passwords, or anything you would not publish.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Rate limiting</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              To stop abuse we count API writes per IP address. We read the IP from
              x-vercel-forwarded-for, x-forwarded-for, or x-real-ip, then store a counter bucket
              with the IP, a hit count, and a reset time. Buckets are deleted after the window
              passes. Reads are not limited and not counted.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">What we do not do</h2>
            <ul className="text-[13.5px] leading-relaxed text-ink-soft list-disc pl-5 space-y-1">
              <li>No accounts, no names, no emails unless you write to us.</li>
              <li>No analytics, no tracking cookies, no ad pixels.</li>
              <li>Fonts are bundled with the app, no request to Google Fonts.</li>
              <li>Theme choice and saved manage keys live in your own browser localStorage only.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Hosting and retention</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Hosting is Vercel, database is SQLite locally or Turso when configured. Vercel keeps
              standard server logs for security. Boards expire after the days you set, 30 by
              default, or never when you pass null or 0. Expired boards are purged and read back
              as 404. Deleting a board with DELETE removes it immediately.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Your rights</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              If EU rules apply to you, legal basis is contract to deliver the board you asked for
              and legitimate interest in keeping the API alive. You can view, update, or delete a
              board with its manage key at any time. Lost the key and need personal data removed,
              write to Slyva.dima@gmail.com with the board link and we will review it. Same address works
              for access or objection requests under Ukrainian data protection law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Changes</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              If this notice changes, the new version goes on this page. Continued use counts as
              acceptance.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/terms" className="microlabel hover:text-accent">terms</Link>
          <Link href="/imprint" className="microlabel hover:text-accent">contact</Link>
          <Link href="/" className="microlabel hover:text-accent ml-auto">home</Link>
        </div>
      </footer>
    </div>
  );
}
