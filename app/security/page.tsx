import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Lock, ShieldCheck, Trash2, UserCheck, Archive } from "lucide-react";
import { DocShell, type DocSection } from "@/components/landing/DocPage";
import Reveal from "@/components/landing/Reveal";

// How Horizon protects the data people trust it with, written for the people
// themselves rather than for an examiner. The engineering detail behind every
// claim lives in docs/security/ — this page says what it means for a user.
//
// Nothing here may promise more than the code does. If a measure changes, this
// page changes with it.

export const metadata: Metadata = {
  title: "Security — Horizon",
  description:
    "How Horizon protects your data: sign-in without a password to lose, data only ever your own, encryption in transit and at rest in the EU, backups only its author can open, and deletion in one click.",
  alternates: { canonical: "https://horizonroadmap.com/security" },
};

const UPDATED = "22 September 2026";

const MEASURES = [
  {
    icon: UserCheck,
    title: "No password to lose",
    body: "Horizon never sees or stores a password. Signing in goes through Google, which hands the server a signed statement of who you are — checked against Google's own published keys, and checked that it was issued to Horizon and not to some other app. Nothing else about your Google account is requested or reachable.",
  },
  {
    icon: KeyRound,
    title: "Sessions that can be taken away",
    body: "Staying signed in uses a random 256-bit token in a cookie your browser will not hand to another website and JavaScript cannot read. The server keeps only a fingerprint of it, so the database could not be used to impersonate you, and signing out destroys the session immediately rather than merely forgetting it.",
  },
  {
    icon: ShieldCheck,
    title: "Only ever your own data",
    body: "Every read, write and search is tied to the account that made the request, and ownership is never taken from anything a browser sends. Two people using the same names for their tracks cannot see each other's, and the database indexes are built so that a search can only ever run within one account.",
  },
  {
    icon: Lock,
    title: "Encrypted in transit, and kept in the EU",
    body: "Every connection is HTTPS, and the server reaches the database over an encrypted connection with credentials that can touch that one database and nothing else. Both the server and the database run in Frankfurt, so your data stays in the European Union.",
  },
  {
    icon: Archive,
    title: "Backups nobody else can open",
    body: "The database is backed up every week, encrypted with a key whose private half never leaves the author's own machine. The copy that gets stored is unreadable to anyone else — including the company hosting it — and the restore has been tested, because a backup nobody has restored is only a hope.",
  },
  {
    icon: Trash2,
    title: "Deleting means deleting",
    body: "Settings → Account → Delete account removes the account and everything it holds on the server in a single operation that either finishes completely or changes nothing at all. Your device keeps its own copy and the app carries on working offline.",
  },
];

const SECTIONS: DocSection[] = [
  {
    id: "you-can-use-it-with-no-account-at-all",
    title: "You can use it with no account at all",
    body: (
      <>
        <p>
          None of the above applies if you never sign in, because nothing leaves your device: Horizon
          keeps everything in your browser&apos;s own storage, and there is no copy anywhere else to
          protect. An account exists only so your tracks can follow you between devices, and you can add
          or remove one whenever you like without losing anything.
        </p>
      </>
    ),
  },
  {
    id: "what-is-checked-every-time-the-code-changes",
    title: "What is checked, every time the code changes",
    body: (
      <>
        <p>
          Every change runs the same checks before it can reach the live site: the full test suite,
          including tests against a real three-server database; a scan for known vulnerabilities in every
          dependency, with each package verified as genuinely published by its author; a search through
          the entire project history for anything resembling a leaked password or key; and an automated
          review of the code itself for common security mistakes.
        </p>
        <p>
          The live site is also watched. A check every half hour confirms the server can still reach the
          database, and the server counts anything it refuses — a sign-in that doesn&apos;t verify, a
          client asking too often — so that an unusual pattern is noticed the next morning rather than
          never. Those counts record what happened and never who it happened to.
        </p>
      </>
    ),
  },
  {
    id: "what-horizon-does-not-do",
    title: "What Horizon does not do",
    body: (
      <>
        <p>
          There is no analytics, no advertising, no tracking and no profiling. Nothing about your goals is
          sold, shared or looked at. The only companies involved are the ones that make the app run:
          Google for sign-in, Vercel for hosting, MongoDB Atlas for the database.
        </p>
      </>
    ),
  },
  {
    id: "being-honest-about-the-limits",
    title: "Being honest about the limits",
    body: (
      <>
        <p>
          Horizon is one person&apos;s project, not an audited product. It has a written threat model and
          a list of the risks knowingly accepted rather than fixed, and the people who accepted them are
          the same person writing this. If your data is sensitive enough that this matters, use Horizon
          without an account — then it never leaves your device, and none of these questions arise.
        </p>
      </>
    ),
  },
  {
    id: "found-a-problem",
    title: "Found a problem?",
    body: (
      <>
        <p>
          Please report it privately to{" "}
          <a className="text-accent" href="mailto:alessandroperez.developer@gmail.com">
            alessandroperez.developer@gmail.com
          </a>{" "}
          rather than posting it publicly: what you found, how to reproduce it, and what it would let
          someone do. Reports are acknowledged within a week, and genuine findings get fixed before
          anything else.
        </p>
        <p>
          What Horizon stores, where it lives and how long it is kept is on the{" "}
          <Link className="text-accent" href="/privacy">
            privacy page
          </Link>
          .
        </p>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <DocShell
      title="Security"
      lede={
        <>
          Six things Horizon does with the data you trust it with, in plain words. The engineering
          behind each one is in the repository, and nothing here promises more than the code does.
        </>
      }
      updated={UPDATED}
      sections={SECTIONS}
    >
      {/* The six measures, above the prose: they are the answer most people
          came for, and a wall of paragraphs buries them. */}
      <section className="border-b border-card-border">
        <Reveal className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {MEASURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass-panel flex flex-col gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-card-border bg-surface-muted text-accent">
                <Icon size={17} strokeWidth={1.9} />
              </span>
              <h3 className="type-subhead font-semibold">{title}</h3>
              <p className="type-body text-muted-foreground">{body}</p>
            </div>
          ))}
        </Reveal>
      </section>
    </DocShell>
  );
}
