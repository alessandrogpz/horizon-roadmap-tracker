# Horizon: Roadmap Tracker

A sleek, premium desktop-and-mobile control panel for tracking custom learning roadmaps, daily revision habits, local project Git statistics, and study notes.

*Note: The current active roadmap in this workspace is configured for the 12-Month Graphics & Game Engine Developer track.*

---

## Tech Stack & Architecture

The project has been refactored into a modular, type-safe Next.js PWA:

*   **Framework:** Next.js (with Turbopack) & React 19
*   **Styling:** Tailwind CSS v4 & PostCSS (using CSS-native `@import` and custom theme extensions)
*   **Database (Local-first):** Dexie.js (IndexedDB wrapper) for offline persistence
*   **Server:** Next.js route handlers and MongoDB (Mongoose plus the native driver) for accounts: sign in with Google, server-side sessions, and sync through the account, merged on the server inside a transaction.
*   **Tests:** Vitest for testing date-helpers and state merge algorithms.

### Directory Structure

The app is layered: `lib/` holds the data model and every rule about what an
edit *means*, and knows nothing about React; `components/` renders it and owns
no business logic.

```
├── app/                          # Next.js routes & styles
│   ├── globals.css               # Tailwind CSS v4 & custom styles
│   ├── layout.tsx                # Global HTML wrapper (with JetBrains Mono font)
│   ├── page.tsx                  # Mounts the workspace provider + dashboard
│   ├── roadmap/page.tsx          # Per-track markdown roadmap editor
│   ├── api/auth/session/         # Sign in / out: Google ID token → session cookie
│   ├── api/sync/                 # Sync through the account (merge on the server)
│   ├── api/search/, api/stats/   # Full-text search and history, computed by MongoDB
│   ├── api/health/               # Can the server reach the database? (watched every 30 min)
│   └── manifest.ts               # PWA manifest configuration
├── components/
│   ├── Dashboard.tsx             # Layout, drag-and-drop, modal orchestration
│   ├── workspace/                # WorkspaceProvider — app state & persistence
│   ├── panels/                   # Panel registry, panel wiring, error boundary
│   ├── DashboardHeader.tsx       # Top status line & sync controls
│   ├── WeeklyPlan.tsx            # 7-day overview built from the track's rhythm
│   ├── MaterialsTracker.tsx      # Syllabus reference materials & notes
│   ├── PortfolioTracker.tsx      # Deliverables: checklist & live git stats
│   ├── PhaseTracker.tsx          # Roadmap phases list
│   └── PomodoroTimer.tsx         # Timer — work and rest, for anything
├── lib/                          # Framework-free logic
│   ├── server/                   # Server only: MongoDB, sign-in, sessions, sync, request checks
│   ├── serverSync.ts             # The device's side of account sync
│   ├── workspaceRepo.ts          # The only reader/writer of the stored workspace
│   ├── localDb.ts                # Dexie schema
│   ├── migrations/               # Versioned, append-only shape upgrades
│   ├── trackActions.ts           # Pure track mutations (materials, phases, ...)
│   ├── completions.ts            # Pure checkbox/streak rules
│   ├── selectors.ts              # Pure workspace queries
│   ├── merge.ts                  # Sync state merger (checkboxes & materials)
│   ├── gitStats.ts               # GitHub / local git stats, with caching
│   ├── modules.ts                # Which dashboard modules exist
│   ├── streak.ts                 # Streak calculation helpers
│   ├── restDays.ts               # Which days a track takes off, and how a streak crosses them
│   ├── dates.ts                  # Date and week utility functions
│   └── types.ts                  # TypeScript interfaces
├── public/                       # Static assets & service worker
│   ├── sw.js                     # Custom offline service worker
│   └── icon-*.png                # PWA icons, rendered from app/icon.svg
├── brand/                        # Logo sources & the script that renders them
│   └── build-icons.sh            # Regenerates every PNG/ICO from the SVGs
├── compose.yaml                  # Local MongoDB replica set (npm run db:up)
├── docker/mongo-init.js          # Sets up the replica set and its users
├── scripts/dev-env.mjs           # Generates the local database's secrets
├── scripts/ops-check.ts          # The daily look at the live database (npm run ops:check)
├── ops/                          # The public key the scheduled backup encrypts to
├── docs/nosql/                   # Data model, dataset, performance, replication (SE_06)
├── docs/security/                # Threat model, implemented measures, operations runbook
├── .github/                      # CI, Dependabot, and the scheduled uptime, operations and backup jobs
├── docs/README.md                # What every document is, and when to read it
├── docs/LEARNING_LOG.md          # What each step of the database & security work teaches
├── docs/ORAL_PREP.md             # Exam day: the security talk, the NoSQL demo, the questions
└── docs/DEPLOY.md                # Putting accounts and sync live (Atlas + Vercel)
```

### The logo

`app/icon.svg` is the master: a sun clearing the horizon, where the horizon
line doubles as the track's progress bar. Everything else is derived from it —
`public/icon-192.png`, `public/icon-512.png`, `app/apple-icon.png` and
`app/favicon.ico`, plus two full-bleed variants in `brand/` for Android's
maskable crop and iOS's squircle mask. After editing any SVG, re-render with:

```bash
./brand/build-icons.sh    # needs rsvg-convert (librsvg) and magick (ImageMagick 7)
```

Inside the app the same mark is drawn plate-free in `currentColor` by
`components/HorizonMark.tsx`, so it picks up the theme.

---

## Getting Started

### Local Development
To run only on your local computer:
```bash
npm run dev
```
*   **URL:** [http://localhost:3000](http://localhost:3000)

### Local Database (MongoDB)

Accounts and server-side sync (in progress) keep their data in MongoDB. For
development it runs in Docker as a three-member **replica set**: three servers
holding the same data, so if one stops, the other two elect a new primary and
carry on. That's the same shape MongoDB Atlas runs in production.

**Needs:** Docker with Compose. On Linux, add yourself to the `docker` group
(`sudo usermod -aG docker $USER`, then log in again). On Docker Desktop (macOS,
Windows), turn on host networking in its settings first.

```bash
npm run db:up
```

The first run generates the database passwords into `.env.docker`, which only
the database containers read, and the app's connection string into
`.env.local`. Both files are git-ignored and readable only by you. It then
starts the set and creates two users: `root` for administration, and
`horizon_app`, which can read and write the `horizon` database and nothing
else. The app connects as `horizon_app`:

```
mongodb://horizon_app:<password>@localhost:27017,localhost:27018,localhost:27019/horizon?replicaSet=rs0&authSource=admin
```

| Command | What it does |
|---|---|
| `npm run db:up` | Start the database (and set it up, the first time) |
| `npm run db:down` | Stop it, keeping the data |
| `npm run db:reset` | Stop it and **delete all local data** |
| `npm run db:shell` | Open `mongosh` as `horizon_app`; paste `MONGO_APP_PASSWORD` from `.env.docker` when asked |
| `npm run test:db` | Run the database tests, as `horizon_test` on a database of their own (`npm test` doesn't need the database) |
| `npm run db:backup` | Back up the database to `backups/` (git-ignored, readable only by you); restoring: `docs/security/RUNBOOK.md` |
| `npm run ops:check` | What the last day held: accounts, and the security counters the server keeps. Run every morning against the live database by CI |

*   It listens on `127.0.0.1` only, so no other device can connect.
*   To browse the data in a GUI, paste `MONGODB_URI` from `.env.local` into
    [MongoDB Compass](https://www.mongodb.com/products/tools/compass).
*   Failover: `docker compose stop mongo1` stops the primary, and the other two
    elect a new one within seconds. `docker compose start mongo1` brings it back
    as a secondary.
*   How it's built: `compose.yaml` (the servers), `docker/mongo-init.js` (the
    replica set and users), `scripts/dev-env.mjs` (the passwords).
*   The data model, a generated test dataset (`npm run db:seed`), measured query
    performance (`npm run db:explain`) and a failover demo (`npm run demo:failover`):
    see [`docs/nosql/`](docs/nosql/README.md).

---

## Progressive Web App (PWA) on Mobile

The website installs as a standalone app on Android and iOS, and it is a
complete way to use Horizon rather than a preview of one — everything below is
there, including the consistency grid, the stacked all-tracks view, tracks in
their own colours and offline storage. Install it if you would rather not
download anything.

1. Open your live URL on your phone's browser (Chrome or Safari).
2. Tap the browser menu and select **Add to Home screen** or **Install app**.
3. Launch it from your home screen. It runs full-screen, with no address bar.

What the installed Android app adds over the PWA is the handful of things a
browser cannot reach: the step counter (Health Connect), the share sheet, deep
links and backups written through Android's Storage Access Framework.

---

## The Android app

`mobile/` is a real Android app, not a wrapper: React Native and Expo, sharing
this repository's `lib/` unchanged — the types, dates, completion rules, streak
maths, merge engine and migrations. About 1,500 lines moved across without
edits, which is what made a second platform weeks rather than a rewrite.

It has everything the website has, arranged for a phone rather than a desk:

- **My Space** is the home — the whole track as a column of panels you drag
  into the order you want. Which panels you have follows the account; the order
  is the phone's own, because one column and two columns are different
  questions.
- **Reading is the default.** Every screen that can change a plan opens
  read-only behind a pencil, because a touch screen has no hover and an
  editable field looks identical to a label until one of them moves.
- **Phone-only things the web cannot do:** a step counter (Health Connect for
  whole days, the sensor for live movement), the share sheet, deep links
  (`horizon://track/<id>`) and backups written through Android's Storage Access
  Framework.

JavaScript changes reach installed phones over the air; native ones need a new
build. `MOBILE_PLAN.md` covers the architecture and `mobile/README.md` the
build and release workflow.

---

## Core Features & Mechanics

*   **Weekly overview:** What each day of a track is for, and what that day actually holds — the rotation topics due that week, the day's own checklist, the gym plan for that kind of day. On the phone it is a calendar you can walk through, a week at a time or a month at a glance, so what a future week asks for is something you look up rather than work out.
*   **Phases:** Interactive vertical timeline of a track's phases, their deadlines and what each one asks for.
*   **Consistency:** A year of days, the shape everyone knows from a contributions graph, drawn in the track's own colour — four strengths of one hue, with the day the track began marked in white on a dark screen and black on a light one. With more than one track open, the same panel stacks every track's year on the same calendar columns, so "did I do *anything* yesterday" is one glance rather than three panels. On the phone the grid turns ninety degrees and runs down the screen, a week to a row, because that is the only way a day stays big enough to tap. Days your week has off — any focus type marked with the moon in the weekly rhythm editor — carry a small dot instead of reading as a gap, and they bridge a streak rather than breaking it: a plan with Sunday off can still hold a run of forty days. The week is dated, so reshaping it never rewrites what already happened — make Thursday a working day and every Thursday you already took off stays taken off.
*   **A colour per track:** Chosen when the track is created, and from then on the accent the whole app wears while that track is open — buttons, rings, links, and its own history. The track list is a list of years in those colours, which turns "which tracks do I have" into "which ones am I actually keeping up". The list can be put in an order, and the order follows you: hold a track on the phone and the whole list folds down so it fits under one thumb, or drag a row by its handle on the website. It is kept on the track rather than on the device, because "which of my tracks comes first" is the same question on a laptop as it is in a hand.
*   **Deliverables:** Repository checklists, with live git statistics (branch, modified status, last commit message) pulled from local git repos or GitHub.
*   **Gym plan:** The exercises a training day asks for, with sets and reps against each and a tick as you work through them. Which days it applies to comes from the track's weekly rhythm, so the plan and the week are never two answers to one question.
*   **Materials & Notes:** Track references, edit study notes in a Markdown editor with a live Preview pane, and query repo statistics.
*   **Search & insights (signed in):** Full-text search across your tracks, materials, phases, roadmaps and notes, and your history (active days, weekday habits, months, per-track streaks), both computed by MongoDB on the server.
*   **All tracks (read-only):** A seventh view for the question a per-track dashboard cannot answer — what am I doing, across all of it. The same board you already know, built from every track you have not switched off: the week shows what each one asks of each day, the consistency grid puts every track's days in one square (divided into bands, not blended — a blend of blue and amber is a muddy grey that tells you nothing), the phases of every track run on one chronological timeline, and the deliverables, materials and numbers run across all of them. Progress is averaged by how long each goal is, so a three-year track is not outvoted by a three-week one. Strictly read-only, and structurally so: there is no master track stored anywhere, so there is nothing an edit could land in. Switching a track off leaves it out of the view only. On the phone it is a mode rather than a screen: the same four tabs you already know — My Space, Today, Plan, Progress — read-only, with every track folded into each of them. Consistency comes two ways in either place: a strip per track on the same calendar columns, or every day in one square divided between the tracks that did something on it.
*   **Community:** A Discord, linked from the landing page, the footer and Settings on both platforms — for asking something, reporting what is broken, or seeing what other people are tracking. The invite lives in `lib/community.ts` and can be overridden per build with `NEXT_PUBLIC_DISCORD_INVITE` (web) or `EXPO_PUBLIC_DISCORD_INVITE` (phone); set it to an empty string and every link to it disappears rather than pointing at nothing.
*   **Demo data:** Settings will add `test1`, `test2` and `test3` — three tracks in three colours with a year or more of days already ticked, generated from a fixed seed so they are the same three tracks tomorrow. They exist so the views that show several tracks at once have something to show on a new account, and so there is something to break in without touching a real track. The same button takes them away.
*   **Cloud Sync:** All data lives in your browser (IndexedDB). Signed in, the same data syncs through your Horizon account (MongoDB on the server), merged per item on the server so two devices never overwrite each other. Signed out, nothing leaves the device — which is a complete way to use it, not a degraded one.

---

## Notes & Security

*   **Universal Change Tracking:** Sync comparison logic monitors all data arrays (materials, portfolio, configurations). Changes to any item trigger an auto-save and raise `configVersion` for the next sync.
*   **Git Stats Caching:** GitHub API calls are subject to a 60 requests/hour unauthenticated limit, **per IP**, and each repo costs two requests (metadata + last commit). The app stays inside that budget by:
    *   Caching results in browser `localStorage` for **1 hour**.
    *   Fetching only when the set of linked repos actually changes — not on every workspace edit.
    *   Sharing one in-flight request per repo, since Materials and Portfolio often link the same one.
    *   Pausing all requests until GitHub's own reset time after a `403`, and falling back to the expired cache so the stats still show in the UI.
    *   To lift the ceiling to 5000/hour, set a read-only personal access token once from the browser console:
        ```js
        localStorage.setItem("github_token", "<token>")
        ```
*   **Local-only Endpoints:** `/api/git` (local filesystem repo status), `/api/open` (opening PDF/source links locally) and `/api/notes` (one-time import of notes from an older on-disk format) only accept requests addressed to `localhost` and sent by the app's own pages — not from other devices when the dev server is exposed on a LAN, and not from other websites open in your browser (see `lib/server/localRequest.ts`).
*   **Accounts:** "Sign in with Google" lives in Settings → Account, shown only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set. The server checks Google's signature on the ID token, and that it was issued to Horizon, then keeps a server-side session: the browser holds a random token in an HttpOnly cookie, and the database stores only its hash. You can delete the account from the same row: everything it stored on the server goes, in one transaction; the device keeps its own copy. Every threat and how it's handled: [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md).
*   **Noticing things:** the server counts what it refuses — rejected sign-ins, rate limits reached, bodies and writes refused — as one document per kind per hour, with no address, account or value in them. A scheduled check reads those counters each morning, `/api/health` is asked every half hour, and either failing emails the owner. The weekly backup of the live database runs by itself, encrypted to a public key whose private half never leaves the owner's machine. What each alert means: [`docs/security/RUNBOOK.md`](docs/security/RUNBOOK.md) §7.
*   **Automated Tests:** Run `npm test` to execute the Vitest test suite (dates, merge logic, sign-in token checks, request validation). `npm run test:db` runs the tests that need the local MongoDB.
