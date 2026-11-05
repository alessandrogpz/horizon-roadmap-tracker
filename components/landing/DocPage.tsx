import Link from "next/link";
import { ArrowRight } from "lucide-react";
import HorizonMark from "@/components/HorizonMark";
import ThemeToggle from "@/components/ThemeToggle";
import Reveal from "@/components/landing/Reveal";
import SmoothAnchors from "@/components/landing/SmoothAnchors";

/**
 * The shell the privacy and security pages share: the bar, the glow, a title
 * band, a contents column that follows you down, and the footer.
 *
 * Both pages had the same chrome written out twice and a single column of
 * prose under it. The content was already the strongest thing about them —
 * every claim checkable in the code — and it read like a document someone had
 * been made to publish. This is the same words given the room and the
 * furniture to be read.
 */

export interface DocSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export function DocShell({
  title,
  lede,
  updated,
  sections,
  children,
}: {
  title: string;
  lede: React.ReactNode;
  updated: string;
  sections: DocSection[];
  /** Anything that belongs between the title band and the prose — the
   *  security page puts its six measures there. */
  children?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Every in-page link rolls to where it points rather than snapping. */}
      <SmoothAnchors />

      <header className="sticky top-0 z-50 border-b border-card-border bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/landing" className="flex items-center gap-2.5 text-foreground">
            <HorizonMark className="h-4 w-auto text-accent" />
            <span className="text-[0.95rem] font-semibold tracking-tight">Horizon</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href={title === "Privacy" ? "/security" : "/privacy"}
              className="hidden text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              {title === "Privacy" ? "Security" : "Privacy"}
            </Link>
            <Link href="/" className="btn btn-sm btn-solid flex items-center gap-1.5">
              Open the app
              <ArrowRight size={14} strokeWidth={2.2} />
            </Link>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="relative z-1">
        {/* The title band. A page of small print still deserves a first
            screen that says what it is. */}
        <section className="border-b border-card-border">
          <Reveal className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6 sm:py-20">
            <h1 className="text-[2.2rem] font-semibold leading-[1.08] tracking-tight sm:text-[3rem]">{title}</h1>
            <p className="max-w-2xl text-[1rem] leading-relaxed text-muted-foreground">{lede}</p>
            <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-card-border bg-surface-muted px-3 py-1 text-[0.72rem] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Last updated {updated}
            </span>
          </Reveal>
        </section>

        {children}

        <div className="mx-auto flex max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-20">
          {/* Follows you down the page on a wide screen, where there is a
              column of margin doing nothing anyway. */}
          <nav className="hidden w-[200px] shrink-0 lg:block" aria-label="On this page">
            <div className="sticky top-24 flex flex-col gap-2">
              <span className="text-[0.75rem] font-semibold text-muted-foreground">
                On this page
              </span>
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-[0.82rem] leading-snug text-muted-foreground transition-colors hover:text-foreground"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-12">
            {sections.map((section) => (
              <Reveal as="section" key={section.id} className="scroll-mt-24">
                <div id={section.id} className="flex flex-col gap-3 border-l-2 border-card-border pl-5">
                  <h2 className="text-[1.2rem] font-semibold tracking-tight">{section.title}</h2>
                  <div className="flex max-w-2xl flex-col gap-3 text-[0.92rem] leading-relaxed text-muted-foreground">
                    {section.body}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-card-border">
        {/* Extra bottom padding keeps the row clear of the app's fixed version
            badge in the corner. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-8 pb-14 sm:px-6">
          <span className="flex items-center gap-2.5">
            <HorizonMark className="h-3.5 w-auto text-muted-foreground" />
            <span className="text-[0.85rem] text-muted-foreground">Horizon — Roadmap Tracker</span>
          </span>
          <Link href="/landing" className="text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground">
            About
          </Link>
          <Link
            href={title === "Privacy" ? "/security" : "/privacy"}
            className="text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            {title === "Privacy" ? "Security" : "Privacy"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
