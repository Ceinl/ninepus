import Link from "next/link";

export const metadata = {
  title: "Contact — ninepus",
  description: "Who runs ninepus and how to reach them.",
};

export default function ImprintPage() {
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
            <p className="microlabel mb-3">contact</p>
            <h1 className="font-display text-4xl leading-tight">Who runs ninepus.</h1>
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold">Operator</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Private individual, based in Ukraine. No company, no VAT ID.
              <br />
              Name: Dmytro Slyva
              <br />
              Email: Slyva.dima@gmail.com
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">What this address is for</h2>
            <ul className="text-[13.5px] leading-relaxed text-ink-soft list-disc pl-5 space-y-1">
              <li>Takedown requests for illegal or infringing board content.</li>
              <li>Privacy requests: access, correction, deletion.</li>
              <li>Abuse reports and security issues.</li>
            </ul>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Include the board link and a short description. We review reports manually.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Hosting</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              Frontend and API hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723,
              USA. Database is local SQLite or Turso when configured.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="microlabel hover:text-accent">privacy</Link>
          <Link href="/terms" className="microlabel hover:text-accent">terms</Link>
          <Link href="/" className="microlabel hover:text-accent ml-auto">home</Link>
        </div>
      </footer>
    </div>
  );
}
