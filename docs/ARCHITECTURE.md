# Architecture

How Horizon is put together. For what each collection or measure contains, see
the reference documents.

## Three parts, one set of rules

```
            lib/  —  shared core, plain TypeScript
            dates · phases · streaks · rhythm · merge
                   ╱                    ╲
         mobile/ (Expo)              web app (Next.js)
         SQLite · Keystore              IndexedDB
                   ╲                    ╱
                     Next.js API + MongoDB
```

**`lib/` decides, the clients render.** Every rule about what an edit *means* —
how phases are spaced, what counts as a streak, how a rest day differs from a
missed one, how two devices' changes are merged — lives in `lib/`, in plain
TypeScript that imports nothing from React, React Native or Next. Both clients
import it unchanged.

The result is one definition of each rule rather than one per client. About
1,500 lines moved to the phone without edits.

**The clients differ in presentation and storage only.** The web app is Next.js
with IndexedDB (Dexie); the phone app is Expo Router over React Native with
SQLite, AsyncStorage and the Android Keystore. Both are offline-first: signed
out, no data leaves the device, and the app is fully usable in that state.

**The server holds the shared copy.** Next.js route handlers over MongoDB:
accounts, sync, search and history. A sync is one multi-document transaction
that merges per item, so two devices cannot overwrite each other
([`nosql/DATA_LAYER.md`](nosql/DATA_LAYER.md) use case 2).

## Layering inside the web app

`lib/` holds the data model and every rule about what an edit means, and imports
nothing from React. `components/` renders it and contains no business logic. A
new mutation belongs in `lib/trackActions.ts` as a pure
`(track, args) => nextTrack` function with a test, not inline in a component.

## Directory structure

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
├── docs/nosql/                   # Data model, data layer, setup, dataset, performance, replication
├── docs/security/                # Threat model, implemented measures, operations runbook
├── .github/                      # CI, Dependabot, and the scheduled uptime, operations and backup jobs
├── docs/README.md                # What every document is, and when to read it
├── docs/DEPLOY.md                # Putting accounts and sync live (Atlas + Vercel)
└── university/                   # Coursework: assessment material only, not part of the app
```
## Local-only endpoints

Three routes serve a local checkout only: `/api/git`
(local filesystem repo status), `/api/open` (opening PDF and source links
locally) and `/api/notes` (a one-time import of notes from an older on-disk
format). Each accepts only requests addressed to `localhost` and sent by the
app's own pages — not from another device when the dev server is exposed on a
LAN, and not from another website open in the same browser. The checks are in
`lib/server/localRequest.ts`.

## Staying inside GitHub's rate limit

Deliverables show live git statistics. GitHub allows 60 unauthenticated
requests an hour **per IP**, and each repository costs two (metadata plus last
commit), so the app budgets them:

- results are cached in `localStorage` for an hour;
- a fetch happens only when the set of linked repositories changes, not on
  every workspace edit;
- one in-flight request is shared per repository, since Materials and
  Deliverables often link the same one;
- after a `403` all requests pause until GitHub's own reset time, and the
  expired cache is used so the statistics still render.

To raise the ceiling to 5,000 an hour, set a read-only personal access token
once from the browser console:

```js
localStorage.setItem("github_token", "<token>")
```

## The logo

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