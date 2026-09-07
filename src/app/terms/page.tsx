import Link from "next/link";

export const metadata = {
  title: "Terms — ninepus",
  description: "Rules for using ninepus boards and API.",
};

export default function TermsPage() {
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
            <p className="microlabel mb-3">terms of use</p>
            <h1 className="font-display text-4xl leading-tight">Simple rules for a public board.</h1>
            <p className="mt-3 text-[13px] text-ink-soft">Last updated: 7 September 2026.</p>
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold">The service</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Ninepus hosts anonymous wireframe boards through a public API. No account needed.
              POST creates a board and returns a public link plus a manage key. PUT, PATCH, and
              DELETE need that key.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Public by design</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Anyone with a /b/ link reads the whole board. The id is unguessable, not secret. The
              manage key is shown once and stored only as a hash, so a lost key cannot be
              recovered. Keep it somewhere safe if you plan to edit or delete later.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Acceptable use</h2>
            <ul className="text-[13.5px] leading-relaxed text-ink-soft list-disc pl-5 space-y-1">
              <li>No illegal content, no harassment, no spam or phishing.</li>
              <li>No personal data of other people without their consent.</li>
              <li>No copyrighted material you have no right to share.</li>
              <li>No abuse of the API, no evading rate limits, no probing other boards.</li>
            </ul>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              We may remove boards or block IPs that break these rules, and we comply with lawful
              takedown requests sent to Slyva.dima@gmail.com.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Expiry and deletion</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Boards expire after the days you set, 30 by default, or never when you pass null or
              0. Expired boards are purged and return 404. The key holder can delete at any time
              with DELETE. Deletion is immediate and permanent.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">No warranty</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              The service is provided as is, without uptime or durability promises. This is a
              prototype whiteboard, not an archive. Keep your own copy of anything important. To
              the extent the law allows, liability is limited to what is unavoidable by statute.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Changes and contact</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              We can update these terms by posting a new version here. Continued use counts as
              acceptance. Questions or abuse reports: Slyva.dima@gmail.com. Operator: Dmytro Slyva,
              in Ukraine, see the contact page.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="microlabel hover:text-accent">privacy</Link>
          <Link href="/imprint" className="microlabel hover:text-accent">contact</Link>
          <Link href="/" className="microlabel hover:text-accent ml-auto">home</Link>
        </div>
      </footer>
    </div>
  );
}
