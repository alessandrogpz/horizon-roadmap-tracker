import type { Metadata } from "next";
import { DocShell, type DocSection } from "@/components/landing/DocPage";

// The privacy notice. Google's OAuth consent screen requires one before an app
// can be published, but the real reason it exists is that other people now keep
// personal data on this server, and they are owed a plain account of what is
// held, where it lives and how to get rid of it (GDPR articles 13 and 14).
//
// Every claim here is checkable in the code, and the file to check is named
// where it isn't obvious. If the behaviour changes, this page changes with it.

export const metadata: Metadata = {
  title: "Privacy — Horizon",
  description:
    "What Horizon stores, where it lives, how long it's kept and how to delete it. Without an account, nothing leaves your device.",
  alternates: { canonical: "https://horizonroadmap.com/privacy" },
};

const UPDATED = "22 September 2026";

const SECTIONS: DocSection[] = [
  {
    id: "the-short-version",
    title: "The short version",
    body: (
      <>
        <p>
          Without an account, nothing leaves your device at all: Horizon keeps everything in your
          browser&apos;s own storage. If you sign in with Google, your tracks, daily progress and notes are also kept on
          a server in Frankfurt so they can follow you between devices. You can delete all of it from
          inside the app, in one click, and the copy on your device keeps working afterwards. There is no
          analytics, no advertising and no tracking of any kind.
        </p>
      </>
    ),
  },
  {
    id: "who-is-responsible",
    title: "Who is responsible",
    body: (
      <>
        <p>
          Alessandro Perez, the author of Horizon, acting as an individual. For anything about this
          page or your data: <a className="text-accent" href="mailto:alessandroperez.developer@gmail.com">alessandroperez.developer@gmail.com</a>.
        </p>
      </>
    ),
  },
  {
    id: "if-you-don-t-sign-in",
    title: "If you don't sign in",
    body: (
      <>
        <p>
          Nothing is collected. Your tracks, progress and notes live in IndexedDB in your browser, on
          your device. No account exists, no request carries your data anywhere, and there is nothing on
          any server to ask about or delete.
        </p>
        <p>
          The app also keeps a few small preferences in your browser&apos;s local storage — your light or
          dark theme, cached repository statistics if you link a Git repository, and any tokens you have
          chosen to paste in yourself. These never leave the device either.
        </p>
      </>
    ),
  },
  {
    id: "if-you-sign-in-with-google",
    title: "If you sign in with Google",
    body: (
      <>
        <p>Signing in is optional, and it is the only thing that creates a copy of your data on the server.</p>
        <p>
          <strong className="font-semibold text-foreground">From Google, Horizon receives</strong> your
          Google account identifier, your email address, your display name and whether Google has verified
          that email. Nothing else: Horizon does not ask for access to your Gmail, contacts, calendar or
          files, and could not read them if it wanted to.
        </p>
        <p>
          <strong className="font-semibold text-foreground">Horizon then stores</strong> that account
          record; your tracks, daily progress and notes as you sync them; a session record for each browser
          you are signed in on, kept as a hash so the cookie in your browser cannot be reconstructed from
          the database; and a short log line per sync recording only how many tracks, days and notes
          changed — never their contents.
        </p>
        <p>
          <strong className="font-semibold text-foreground">Two counters exist for security</strong>, and
          neither identifies you. Rate limiting counts requests per client per minute, using a SHA-256
          hash of the IP address rather than the address itself, and those counters are deleted within
          minutes. Separately, the server counts refused requests by kind and hour — a rejected sign-in, a
          request past its limit — with no address, account or content attached, so the counts show that
          something is happening without recording who it happened to.
        </p>
      </>
    ),
  },
  {
    id: "where-it-is-and-who-can-reach-it",
    title: "Where it is, and who can reach it",
    body: (
      <>
        <p>
          The database is MongoDB Atlas in <strong className="font-semibold text-foreground">Frankfurt,
          Germany</strong>, and the server code runs in the same region, so your data stays in the EU. The
          connection is encrypted, and the credentials the server uses can read and write that one
          database and nothing else.
        </p>
        <p>
          Three companies are involved as processors, and none of them is sent your data for their own
          purposes: <strong className="font-semibold text-foreground">Google</strong> (sign-in only),{" "}
          <strong className="font-semibold text-foreground">Vercel</strong> (hosting) and{" "}
          <strong className="font-semibold text-foreground">MongoDB Atlas</strong> (the database). Nothing
          is sold, shared or handed to anyone else.
        </p>
        <p>
          A weekly backup is taken and encrypted so that only the author can open it, using a key whose
          private half never leaves his machine. Encrypted backups are kept for 90 days.
        </p>
      </>
    ),
  },
  {
    id: "how-long-it-is-kept",
    title: "How long it is kept",
    body: (
      <>
        <p>
          Your account and its data stay until you delete them. Sessions expire after 30 days, after which
          you sign in again. The per-sync log lines are deleted after 90 days, the security counters after
          30, and the rate-limit counters within minutes. Each of those is enforced by the database itself,
          not by someone remembering to run a cleanup.
        </p>
      </>
    ),
  },
  {
    id: "deleting-it",
    title: "Deleting it",
    body: (
      <>
        <p>
          In the app: <strong className="font-semibold text-foreground">Settings → Account → Delete
          account</strong>. Everything the account holds on the server — the account record, your tracks,
          progress, notes, sessions and log lines — is removed in a single operation that either completes
          fully or changes nothing. Your device keeps its own copy, and the app carries on working offline.
        </p>
        <p>
          Signing out is not deletion: it ends that browser&apos;s session and leaves the data on the
          server for next time.
        </p>
      </>
    ),
  },
  {
    id: "getting-a-copy",
    title: "Getting a copy",
    body: (
      <>
        <p>
          <strong className="font-semibold text-foreground">Settings → Export</strong> gives you the whole
          workspace as one JSON file, or a zip with every roadmap, plan and note as readable markdown. No
          request to make, no waiting.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>
          One cookie, and only once you sign in: a random session token, marked HttpOnly and Secure so
          JavaScript cannot read it and it only travels over HTTPS, and SameSite so other websites cannot
          use it. There are no analytics or advertising cookies, so there is no consent banner to click
          away.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>
          Under the GDPR you may ask for a copy of your data, have it corrected or deleted, object to its
          processing, or complain to a data protection authority. Access and deletion are built into the
          app so you never have to ask; for anything else, write to the address above.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <>
        <p>
          If what Horizon stores changes, this page changes with it, and the date at the top moves. The
          history of every change to this project is public in its changelog.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <DocShell
      eyebrow="Your data"
      title="Privacy"
      lede={
        <>
          Horizon is a personal project, not a company, and it has no interest in your data beyond
          storing what you ask it to store. Without an account, none of it leaves your device.
        </>
      }
      updated={UPDATED}
      sections={SECTIONS}
    />
  );
}
