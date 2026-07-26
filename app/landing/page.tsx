import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CalendarDays,
  CloudOff,
  Download,
  Flame,
  GitBranch,
  HardDrive,
  LayoutGrid,
  Repeat,
  Route,
  Smartphone,
  Timer,
  Check,
  X,
} from "lucide-react";
import HorizonMark from "@/components/HorizonMark";
import DashboardPreview from "@/components/landing/DashboardPreview";

export const metadata: Metadata = {
  title: "Horizon — a roadmap tracker for the goals you're actually chasing",
  description:
    "Horizon isn't a to-do list. Give every goal its own track — a deadline, phases, a weekly rhythm, materials and deliverables — and watch it move day by day. Local-first, offline-capable, free.",
  alternates: { canonical: "https://www.horizonroadmap.com/landing" },
  openGraph: {
    title: "Horizon — a roadmap tracker, not a to-do list",
    description:
      "Give every goal its own track: a deadline, phases, a weekly rhythm, materials and deliverables. Local-first and offline-capable.",
    url: "https://www.horizonroadmap.com/landing",
    siteName: "Horizon",
    type: "website",
  },
};

const MODULES = [
  {
    icon: CalendarDays,
    title: "Weekly plan",
    body: "A seven-day board built from the rhythm you set — focus types you name and colour yourself. Tick off today; tomorrow arrives already laid out.",
  },
  {
    icon: Route,
    title: "Roadmap timeline",
    body: "Your phases as a dated vertical timeline with editable deadlines. Horizon works out which phase today belongs to and flags it when you drift.",
  },
  {
    icon: Flame,
    title: "Consistency streak",
    body: "A contributions-style grid of every day you showed up, and the streak riding on it. The one number that beats motivation.",
  },
  {
    icon: BookMarked,
    title: "Materials",
    body: "Books, courses, papers and links grouped into collapsible categories — each with its own markdown notes and a live preview pane.",
  },
  {
    icon: GitBranch,
    title: "Portfolio deliverables",
    body: "The things a track has to actually produce. Repo-backed items pull live git stats: branch, uncommitted changes, last commit message.",
  },
  {
    icon: Timer,
    title: "Focus timer",
    body: "A Pomodoro clock sitting right next to the plan it belongs to, so a session starts where the work is.",
  },
];

const TRACKS = [
  {
    color: "#0ea5e9",
    name: "Graphics & engine dev",
    template: "Learning",
    horizon: "13 months",
    detail: "Phases from fundamentals to a shipped renderer, with a reading list and repo deliverables attached.",
  },
  {
    color: "#f97316",
    name: "Half marathon in October",
    template: "Fitness",
    horizon: "20 weeks",
    detail: "Strength, cardio and rest laid out across the week, building volume phase by phase.",
  },
  {
    color: "#a78bfa",
    name: "Land the senior role",
    template: "Work",
    horizon: "6 months",
    detail: "Skill up, get visible, apply in volume, then close — each stage with its own checklist.",
  },
];

const COMPARISON = [
  {
    todo: "A flat list that resets every morning",
    horizon: "A dated horizon, with phases between here and it",
  },
  {
    todo: "Every ambition competing in one inbox",
    horizon: "One track per ambition — switch between them, or run them side by side",
  },
  {
    todo: "“Done” is the only signal you get",
    horizon: "Streaks, phase progress, deliverables shipped, materials worked through",
  },
  {
    todo: "Tasks with no story behind them",
    horizon: "A full markdown roadmap living behind every track",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick a starting point",
    body: "Learning, Fitness, Work — or Custom for a clean slate. A template only seeds your first phases and weekly rhythm; everything stays editable afterwards and nothing locks you in.",
  },
  {
    n: "02",
    title: "Set the horizon",
    body: "A start date and a real deadline. That single decision is what turns a wish list into a roadmap: from then on every day counts against something.",
  },
  {
    n: "03",
    title: "Shape the phases",
    body: "Review the phases the template proposed, rewrite them, add your own, give each a deadline. Then write the full plan in markdown if you want one.",
  },
  {
    n: "04",
    title: "Show up on rhythm",
    body: "Say what each day of your week is for, seed the materials you'll work through, and start ticking. The dashboard takes it from there.",
  },
];

const DATA_POINTS = [
  {
    icon: HardDrive,
    title: "It lives in your browser",
    body: "Everything is stored locally in IndexedDB. No sign-up, no server holding your goals, nothing to cancel.",
  },
  {
    icon: CloudOff,
    title: "Sync stays yours",
    body: "Connect your own Google Drive and Horizon syncs to a hidden app folder only it can read — with day-level conflict resolution across devices. Optional, always.",
  },
  {
    icon: Smartphone,
    title: "Installs like an app",
    body: "Add it to your phone's home screen and it opens full-screen, works offline, and keeps its own copy of your data on that device.",
  },
  {
    icon: Download,
    title: "Yours to take",
    body: "Export the whole workspace as one JSON file, or a zip with every roadmap, plan and note broken out as readable markdown.",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
      {children}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="app-glow" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-card-border bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/landing" className="flex items-center gap-2.5 text-foreground">
            <HorizonMark className="h-4 w-auto text-accent" />
            <span className="text-[0.95rem] font-semibold tracking-tight">Horizon</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="#features"
              className="hidden text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Features
            </a>
            <a
              href="#how"
              className="hidden text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              How it works
            </a>
            <Link href="/" className="btn btn-sm btn-solid flex items-center gap-1.5">
              Open the app
              <ArrowRight size={14} strokeWidth={2.2} />
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-1">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:pt-24 lg:pb-24">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-card-border bg-surface-muted px-3 py-1 text-[0.7rem] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Local-first · works offline · no account
            </span>

            <h1 className="text-[2.1rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.9rem] lg:text-[3.4rem]">
              Every goal you&apos;re chasing,{" "}
              <span className="text-accent">on one horizon.</span>
            </h1>

            <p className="max-w-xl text-[1rem] leading-relaxed text-muted-foreground sm:text-[1.08rem]">
              Horizon is a roadmap companion tracker — not a to-do list. Give each goal its
              own <strong className="font-semibold text-foreground">track</strong>: a start
              date, a real deadline, the phases in between, the rhythm you&apos;ll keep, and
              the materials and deliverables it takes. Then open it every morning and see
              exactly where you are.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/"
                className="btn btn-lg btn-solid flex items-center justify-center gap-2"
              >
                Open the app
                <ArrowRight size={16} strokeWidth={2.2} />
              </Link>
              <Link
                href="/onboarding"
                className="flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-6 py-3 text-[1rem] font-medium text-foreground transition-colors hover:border-card-border-hover hover:bg-surface-hover"
              >
                Build your first track
              </Link>
            </div>

            <p className="text-[0.8rem] text-subtle-foreground">
              Free, and it opens straight into the app — there&apos;s nothing to sign up for.
            </p>
          </div>

          <div className="lg:pl-4">
            <DashboardPreview />
          </div>
        </section>

        {/* ── Not a to-do list ──────────────────────────────────────────── */}
        <section className="border-t border-card-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex flex-col gap-3 max-w-2xl">
              <SectionLabel>The difference</SectionLabel>
              <h2 className="text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2.1rem]">
                A to-do list tells you what&apos;s left. A roadmap tells you where you are.
              </h2>
              <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
                Long goals don&apos;t fail because you forgot a task. They fail because the
                distance is invisible — nothing tells you that month three was supposed to
                look different from month one. Horizon makes that distance the whole point.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="glass-panel flex flex-col gap-4">
                <h3 className="flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-subtle-foreground">
                  <X size={14} strokeWidth={2.2} />
                  A to-do app
                </h3>
                <ul className="flex flex-col gap-3">
                  {COMPARISON.map((row) => (
                    <li
                      key={row.todo}
                      className="text-[0.9rem] leading-snug text-subtle-foreground"
                    >
                      {row.todo}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-panel landing-panel-accent flex flex-col gap-4">
                <h3 className="flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-accent">
                  <HorizonMark className="h-3 w-auto" />
                  Horizon
                </h3>
                <ul className="flex flex-col gap-3">
                  {COMPARISON.map((row) => (
                    <li key={row.horizon} className="flex gap-2.5 text-[0.9rem] leading-snug">
                      <Check size={15} className="mt-0.5 shrink-0 text-success" strokeWidth={2.4} />
                      <span>{row.horizon}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tracks ────────────────────────────────────────────────────── */}
        <section className="border-t border-card-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex flex-col gap-3 max-w-2xl">
              <SectionLabel>Tracks</SectionLabel>
              <h2 className="text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2.1rem]">
                Split your ambitions into as many tracks as you need.
              </h2>
              <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
                A track is one goal with everything it needs around it — its own horizon,
                phases, weekly rhythm, materials, deliverables, streak and dashboard layout.
                Nothing bleeds between them. Switch tracks from the header; each one remembers
                exactly how you left it.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TRACKS.map((track) => (
                <div key={track.name} className="glass-panel flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: track.color }}
                    />
                    <span className="font-semibold text-[0.95rem]">{track.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[0.65rem] text-muted-foreground">
                    <span className="rounded-full border border-card-border bg-surface-muted px-2 py-0.5">
                      {track.template}
                    </span>
                    <span className="rounded-full border border-card-border bg-surface-muted px-2 py-0.5">
                      {track.horizon}
                    </span>
                  </div>
                  <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                    {track.detail}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[0.85rem] text-subtle-foreground">
              Four templates ship with the app — Learning, Fitness, Work and Custom — and each
              is only a starting point you rewrite.
            </p>
          </div>
        </section>

        {/* ── Modules ───────────────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-16 border-t border-card-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex flex-col gap-3 max-w-2xl">
              <SectionLabel>The dashboard</SectionLabel>
              <h2 className="text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2.1rem]">
                Six modules. Arranged the way you think.
              </h2>
              <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
                Drag panels between columns, reorder them, close the ones a track doesn&apos;t
                need — closing only hides the panel, the data behind it stays untouched until
                you bring it back. Every track keeps its own layout.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="glass-panel flex flex-col gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-accent">
                    <Icon size={17} strokeWidth={1.9} />
                  </span>
                  <h3 className="text-[0.95rem] font-semibold">{title}</h3>
                  <p className="text-[0.85rem] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="glass-panel flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-warning">
                  <Repeat size={17} strokeWidth={1.9} />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[0.95rem] font-semibold">Rotations</h3>
                  <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                    For anything that cycles — a ten-week algorithm rotation on Mon/Wed/Fri, a
                    reading rotation on Tue/Thu. Define the cycle once; the right item lands in
                    the right day automatically, week after week.
                  </p>
                </div>
              </div>
              <div className="glass-panel flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-warning">
                  <LayoutGrid size={17} strokeWidth={1.9} />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[0.95rem] font-semibold">Built for both screens</h3>
                  <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                    A two-column control panel on the desktop, a single readable column on the
                    phone — same data, same dark and light themes, and the phone version installs
                    to your home screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section id="how" className="scroll-mt-16 border-t border-card-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex flex-col gap-3 max-w-2xl">
              <SectionLabel>How it works</SectionLabel>
              <h2 className="text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2.1rem]">
                From a vague ambition to a dated plan, in one sitting.
              </h2>
              <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
                The setup wizard walks the whole thing with you. Five minutes, and the track is
                real.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {STEPS.map((step) => (
                <div key={step.n} className="glass-panel flex gap-4">
                  <span className="font-mono text-[0.8rem] font-semibold text-accent">
                    {step.n}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[0.95rem] font-semibold">{step.title}</h3>
                    <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Your data ─────────────────────────────────────────────────── */}
        <section className="border-t border-card-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex flex-col gap-3 max-w-2xl">
              <SectionLabel>Your data</SectionLabel>
              <h2 className="text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2.1rem]">
                Nobody is holding your goals hostage.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {DATA_POINTS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="glass-panel flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-success">
                    <Icon size={17} strokeWidth={1.9} />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[0.95rem] font-semibold">{title}</h3>
                    <p className="text-[0.85rem] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="border-t border-card-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="glass-panel landing-cta flex flex-col items-center gap-6 text-center">
              <HorizonMark className="h-6 w-auto text-accent" />
              <h2 className="max-w-2xl text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2.2rem]">
                Pick the goal you keep postponing. Give it a horizon.
              </h2>
              <p className="max-w-lg text-[0.95rem] leading-relaxed text-muted-foreground">
                No account, no trial, nothing to install unless you want to. The app opens on
                the next click.
              </p>
              <Link
                href="/"
                className="btn btn-lg btn-solid flex items-center justify-center gap-2"
              >
                Open the app
                <ArrowRight size={17} strokeWidth={2.2} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-card-border">
        {/* Extra bottom padding keeps the last row clear of the app's fixed
            version badge in the corner. */}
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-8 pb-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <HorizonMark className="h-3.5 w-auto text-muted-foreground" />
            <span className="text-[0.85rem] text-muted-foreground">
              Horizon — Roadmap Tracker
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[0.8rem] text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/onboarding" className="transition-colors hover:text-foreground">
              New track
            </Link>
            <Link href="/roadmap" className="transition-colors hover:text-foreground">
              Roadmap
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
