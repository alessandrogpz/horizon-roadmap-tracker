# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

## [0.27.1] - 2026-09-23

### Fixed
- **A build missing a native module no longer takes the whole app down.** Secure storage and Google
  sign-in are compiled into the app rather than downloaded, so a build made before they were added
  simply doesn't have them — and importing one at the top of a file crashed on startup. They are now
  loaded when first used, and a missing one reports "this build can't sign in" while everything else
  keeps working. Signing out finishes either way, since ending the server's session is the part that
  matters.

### Added
- The step counter logs each sensor event in development. Android's hardware counter batches — the
  first few steps often arrive as nothing, then a burst — and this is how that was observed rather
  than assumed. Verified on a Pixel 7 Pro: permission asked on tap, count climbing while walking.

## [0.27.0] - 2026-09-22

### Added
- **Sign in and sync on the phone.** The app asks Google for an identity token addressed to Horizon's
  existing web client, posts it to the same `/api/auth/session` the website uses, and receives a
  session token. Sync then runs against the same `/api/sync`, so the phone is simply a third device:
  the server merges it with the account's copy in a transaction, using the same `mergeWorkspace` the
  phone itself runs.
- An Account screen on the phone: sign in, sync, sign out, with plain messages for being offline,
  signed out or rate-limited.

### Changed
- **The server now accepts a session carried either way.** A browser keeps using the HttpOnly cookie
  no script can read. A native client asks for the token in the response body — by sending
  `X-Horizon-Client: native` — keeps it in the Android Keystore or iOS Keychain, and sends it as a
  `Bearer` header. Unlike a cookie, a bearer token is never attached automatically, so a request
  carrying one cannot be forged by pointing a browser at the API.
- Five database tests cover the phone's path: the token comes back in the body with no cookie set, it
  authenticates later requests, signing out kills it, an unissued token is refused, and a browser
  still gets a cookie rather than a token from the same endpoint.

## [0.26.1] - 2026-09-22

### Fixed
- The step-counter card now says what Android actually replied when a permission request goes
  nowhere, instead of looking like a dead button — including the case that matters, "refused, and
  Android won't ask again", with where to turn it on.
- The app re-checks the permission whenever it returns to the foreground, so granting it in Android's
  settings and switching back is enough. After a permanent denial an app can never prompt again, so
  noticing on resume is the only way back.

### Notes
- Expo Go does not declare Android's activity-recognition permission, so the pedometer cannot work
  inside it at all — confirmed on a Pixel 7 Pro, whose permission list for Expo Go has no "Physical
  activity" entry. It needs a development build carrying this app's own manifest, which is also what
  native Google sign-in needs. `eas.json` now defines development, preview and production build
  profiles, and `expo-dev-client` is installed.

## [0.26.0] - 2026-09-22

### Added
- **The step counter on the phone** (`mobile/src/steps/usePedometer.ts`), the one thing the app can
  do that the website cannot. It asks for the activity-recognition permission only when tapped,
  keeps working when refused, checks the hardware exists first, releases the sensor subscription when
  the screen goes away, and reloads the day when the app comes back from the background.
- Step counts live in their own SQLite table, deliberately outside the synced workspace: they are a
  reading from one phone's hardware, they would mean nothing merged with another device's, and the
  server's schema refuses fields it doesn't know (learning log 13).
- The app is now called Horizon rather than the template's name, with the `horizon://` deep-link
  scheme, the Android package `com.horizonroadmap.app`, and the activity-recognition permission
  declared.

### Notes
- Android has no "how many steps today" call — `getStepCountAsync` is iOS only — so the app keeps a
  running total from `watchStepCount`, which delivers only while Horizon is in the foreground. Steps
  taken while it's closed are therefore missed, and the screen says so rather than implying a full
  day's count. Closing that gap needs Health Connect and a development build.

## [0.25.0] - 2026-09-22

### Added
- **A phone app**, in `mobile/`: Expo (React Native), for the Mobile App Development module
  (`MOBILE_PLAN.md`). It reads and writes the same workspace the website does, through the same
  domain code — `lib/` is imported as `@shared/*` and runs unchanged, about 1,500 lines of types,
  dates, completion rules, streaks, selectors, merge and migrations.
- Storage behind one API with two implementations: SQLite on the phone, `localStorage` on web, the
  bundler choosing on the `.web.ts` extension. Every edit is written as it happens, because Android
  kills background processes without warning, and the app re-reads on resume so a phone left open
  overnight shows the new day.
- On screen: today's focus and revision items with working checkboxes, the streak, and a track
  switcher. Verified through `react-native-web`: ticking an item records it, the streak goes from 0
  to 1, and the change survives a restart.

### Changed
- The web app's `tsconfig.json` and ESLint config exclude `mobile/`, so the two toolchains can't
  trip over each other. The web app's own checks are unaffected.

## [0.24.1] - 2026-09-22

### Documentation
- `MOBILE_PLAN.md`: the plan for a third module, Mobile App Development, whose exam falls on the same
  day as the other two. It records why a PWA wrapper cannot pass it, why React Native through Expo is
  the choice over Kotlin, Flutter and Capacitor, what the phone reuses from this repository (the
  1,500-line domain core, imports nothing from React or the browser, and the whole server API), which
  storage each kind of data gets on a device and why, and a four-week schedule with rehearsal running
  alongside rather than after.

## [0.24.0] - 2026-09-22

### Added
- **A security page** at `/security`, written for the people using Horizon rather than for a reviewer:
  no password to lose, sessions that can be revoked, data that is only ever your own, encryption in
  transit and storage in the EU, backups nobody else can open, and deletion that really deletes. It
  also says what is checked on every change, what Horizon deliberately doesn't do (no analytics, no
  tracking, no sharing), and is honest that this is one person's project with a written list of risks
  knowingly accepted.
- Reachable from where people actually are: **Settings → This device** now has **Security**,
  **Privacy** and **About** buttons, the landing page links it from the accounts section and the
  footer, and both new pages link to each other.

## [0.23.2] - 2026-09-22

### Changed
- The public contact address is now `alessandroperez.developer@gmail.com`, on the privacy page and —
  newly — in `SECURITY.md`, which asked for private reports without saying where to send them.

## [0.23.1] - 2026-09-22

### Added
- **A privacy page** at `/privacy`, linked from the landing footer and listed in the sitemap. It says
  what Horizon stores and what it doesn't: nothing at all without an account; with one, the Google
  account id, email and name, the synced data, hashed session records and per-sync counts. Where it
  lives (Frankfurt, in the EU), who processes it (Google for sign-in, Vercel, Atlas — nobody else),
  how long each thing is kept and which index enforces that, how to delete it in one click, and how
  to export it. Every claim is checkable in the code.

## [0.23.0] - 2026-09-22

### Added
- **The landing page now describes the app as it is.** It was written before accounts existed and
  still promised "no account" and "no server holding your goals". A new **Accounts** section explains
  what signing in gets you — the same tracks on every device, merged item by item rather than
  last-one-wins; search and history computed by the database; queries scoped to your own account; and
  deletion in one click — while keeping the promise that none of it is required.
- **A questions section** answering what a stranger asks before trying something: whether an account
  is needed, what it costs, where the data is kept (Frankfurt, in the EU, if you sign in), whether it
  works on a phone, how to get the data out, and whether it's finished.
- `app/robots.ts` and `app/sitemap.ts`, so the landing page can be found and the API routes aren't
  crawled.

### Fixed
- **The canonical URL pointed at a hostname with no certificate.** The page told search engines and
  link previews that the authoritative copy lived at `www.horizonroadmap.com`, which doesn't serve.
  Both the canonical and the Open Graph URL now name the apex domain, and `metadataBase` in the root
  layout makes every relative metadata URL resolve there.
- The Google Drive card no longer implies Drive is the only way to sync.

## [0.22.2] - 2026-09-22

### Documentation
- `docs/README.md`: an index of every document — what it is, when to read it, which module it serves —
  plus a table mapping each feature to the code that implements it and the document that explains it.
- `docs/nosql/MODEL.md` now covers the `securityEvents` collection: its shape, its indexes, and why
  counting rejections per hour rather than listing them is the access pattern deciding the shape.
- `docs/nosql/README.md`: the deployed setup described as it actually is, and the new commands.
- `docs/ORAL_PREP.md`: the talk now ends on a live system that notices things (the Level 2 claim),
  with the day-before checklist covering the live site and the scheduled workflows, eight more
  questions answered, and the release-day bugs as the "tell me about a bug in production" story.
- Corrected what had gone stale: the MongoDB image in copy-paste commands (8.0 → 8.3), and three
  places still describing deployment, Atlas credentials and alerting as future work.

## [0.22.1] - 2026-09-22

### Added
- `ops/backup-key.pub`: the public half of the key the scheduled backup encrypts to, so
  `.github/workflows/backup.yml` can run. The private half never leaves the owner's machine, which is
  what makes it safe to keep encrypted backups of real accounts in a GitHub artifact. Verified by
  making one: 25 KB, encrypted to that key.

## [0.22.0] - 2026-09-22

### Added
- **The server now notices things, and says so.** Every rejection it already logged — a sign-in whose
  token doesn't verify, a client past its rate limit, a body that fails validation, a write the
  database refuses — also raises a counter in a new `securityEvents` collection: one document per kind
  per hour, so a flood costs one document an hour rather than one per attempt. The counters hold a
  kind, an hour and a count, and nothing else; a TTL index removes them after 30 days.
- **A daily check** (`npm run ops:check`, and `.github/workflows/ops.yml` each morning) reads those
  counters against thresholds and fails the run when something is out of character — which emails the
  owner. That is the whole alerting chain: no paid log drain, no third-party service.
- **`/api/health`**, asked every 30 minutes by `.github/workflows/uptime.yml`. It answers 200 only when
  the server can reach the database, because the page itself keeps loading from the CDN even when
  nothing works. It answers `{"ok":true}` or `{"ok":false}` and nothing else.
- **A weekly encrypted backup** of the live database (`.github/workflows/backup.yml`), piped straight
  from `mongodump` into gpg and encrypted to the public key in `ops/`. The private half never leaves
  the owner's machine, so GitHub keeps a file it cannot read. Tested end to end: dumped from Atlas,
  encrypted, decrypted, restored.
- Runbook entries for each alert — what it means and the first move — and the one-time setup for the
  `ATLAS_URI` secret and the backup key (`docs/security/RUNBOOK.md` §7–§8).

### Changed
- `@types/node` back to the 24 line, matching the Node that Vercel and CI actually run, with
  `engines.node` recording it. Type definitions ahead of the runtime can let code compile that isn't
  there when it runs.

## [0.21.9] - 2026-09-22

### Changed
- **Dependencies brought current in one pass**, with the whole check suite run against the result:
  Next 16.3.5, React 19.3.0, Mongoose 9.10.1, Dexie 4.4.6, zod 4.6.5, Tailwind 4.3.3, tsx, Lucide,
  the React type definitions, and the local MongoDB image from 8.0 to 8.3 (the database tests pass
  against it).
- **Two major updates deliberately not taken**, and Dependabot told to stop proposing them:
  TypeScript 7 (typescript-eslint refuses to run against it) and ESLint 10 (it removed an API that
  the eslint-plugin-react inside eslint-config-next still calls, so linting fails on the first
  file). Both were tried and reverted; minor and patch updates to each still arrive. The comment in
  `.github/dependabot.yml` says what has to ship upstream before they can be revisited.

### Security
- **CI now runs on pull requests into `development`, not only `main`.** Dependabot aims its pull
  requests at `development`, so until now they arrived with no checks of their own — the green
  marks on them came from the preview deployment, not from the tests. Every proposed dependency
  change is now type-checked, linted, tested against a real replica set, scanned for secrets and
  statically analysed before it can be merged (threat T8).

## [0.21.8] - 2026-09-22

### Changed
- **vitest 4 → 5 and `@types/node` 20 → 26, together.** Dependabot proposed them as two pull
  requests and neither could pass alone: vitest 5 requires `@types/node` 22 or newer, so its own
  update failed to install against the pinned `^20`. Both dependencies are development-only; 288
  unit tests, 47 database tests, lint, types and the production build all pass on the new versions.

## [0.21.7] - 2026-09-22

### Changed
- **The server now runs in Frankfurt, beside the database.** `vercel.json` pins the function region
  to `fra1`; the dashboard setting alone wasn't reaching deployments, which left every request
  executing in Washington — each database round trip crossing the Atlantic, and personal data
  processed outside the EU. The header `x-vercel-id: fra1::fra1::…` confirms it.

## [0.21.6] - 2026-09-22

### Fixed
- **Sync worked once, then failed every time afterwards.** A material old enough to have no
  `updatedAt` of its own made the merge write that field as `undefined`, which the database stores
  as `null` — and the collection's validator requires a number, so it refused the whole track. The
  merge no longer invents a timestamp the data never had, and anything on its way into the database
  now has its undefined fields dropped, since "optional" in the schema means absent. Query filters
  are deliberately untouched: dropping a key there would widen the query instead of narrowing it.
  Covered by a merge test and a database test that writes a timestamp-less material through the
  real validator.

### Security
- When the database refuses a write, the server log now names the rule and the property that failed
  (field names only, never values), instead of just `MongoBulkWriteError` (threats I4, I6).

## [0.21.5] - 2026-09-22

### Documentation
- `MODULES_PLAN.md`: the progress note records the deployment — what is live, what the live checks
  proved, and that Cyber Security Level 2 is now in reach.

## [0.21.4] - 2026-09-22

### Fixed
- **Sync failed for a device holding a track made years ago.** The first sync after signing in
  answered "Malformed request.": the track carried `lastUpdatedDates`, a field the app retired long
  ago, and the sync schema refuses any key it doesn't list. It is now listed among the retired
  fields it accepts, so old tracks sync and keep what they carry. A regression test covers it, and
  both real backups the author holds now validate.

### Security
- A rejected request body now leaves a line in the **server** log saying which rule failed and where
  (the first three path segments, never a value, so free text used as a key can't reach the log).
  The client is still told only "Malformed request." (threats I4, I6).

### Documentation
- `docs/LEARNING_LOG.md` entry 13, "Going live": Atlas, Vercel, the protected `main`, what the live
  checks proved, and the sync failure above with what it teaches.
- `docs/security/RUNBOOK.md` §1: the four required status checks written out exactly as CI reports
  them (the old wording read as five), and the bypass-list step without which the release push to
  `main` is rejected.
- `docs/DEPLOY.md`: the real cluster name, the connection string's two easy mistakes (a doubled
  slash before the database name, and a missing database name), and a pre-flight check that proves
  the string works before it reaches Vercel.

## [0.21.3] - 2026-09-11

### Added
- `docs/ORAL_PREP.md`: preparing the two oral exams. A checklist for the day
  before, the 5-minute security talk part by part, a 10-minute NoSQL demo
  using the real app and scripts, and short answers to the likely questions.
- `docs/DEPLOY.md`: switching accounts and sync on at horizonroadmap.com, step
  by step (the Atlas user and network, Vercel's variables and region, the
  release, and the checks afterwards).

## [0.21.2] - 2026-09-11

### Fixed
- **The top bar now says "Unsynced" as soon as you change something.** It
  used to keep saying "Synced" until the page was reloaded: the save recorded
  that there were changes to sync, but the screen never heard about it. This
  affected Drive and account sync alike.

## [0.21.1] - 2026-09-10

### Security
- **Continuous integration.** Every push now runs, on GitHub: type checks,
  lint, the unit tests, a production build, the database tests on a real
  three-member replica set, a dependency audit that also verifies every
  package's registry signature, a scan of the whole git history for leaked
  secrets, and static analysis for security bugs. The pipeline's own token
  can only read, and every action and scanner is pinned to an exact version
  that can't be swapped underneath it.
- **Dependabot** proposes updates for npm packages, the CI actions and the
  database image.
- A scan of all 149 commits found no leaked secrets; static analysis found
  nothing either.

### Added
- `npm run db:backup`: a compressed backup of the database into `backups/`,
  readable only by you, keeping the latest 14. Restoring one has been
  tested end to end.
- `SECURITY.md`, and in `docs/security/`: every implemented security measure
  with where it lives and how it's verified, and a runbook for incidents
  (revoking sessions, rotating a password, restoring a backup, and more).

## [0.21.0] - 2026-09-10

### Added
- **Delete your account**, in Settings → Account. It removes the account and
  everything it stored on the server (tracks, progress, notes, history and
  sessions, from every device) in one go, after you confirm. The data on this
  device stays, and the app keeps working without an account. Signing in
  again later starts a new, empty account.

### Notes
- The `explain()` measurements in `docs/nosql/explain/` no longer record the
  name of the computer they ran on.

## [0.20.1] - 2026-09-10

### Added
- **A generated dataset** for testing at scale: `npm run db:seed` creates
  2,000 users with a year of realistic activity (572,152 days of progress) in
  a separate database, the same every time.
- **Measured query performance**: `npm run db:explain` runs the app's
  queries against that dataset with and without their indexes and writes
  `docs/nosql/PERFORMANCE.md`. Per-user queries read only that user's data:
  1 to 7 ms, instead of about 200 ms scanning everything.
- **A failover demo**: `npm run demo:failover` stops the database's primary
  server in the middle of a stream of writes. A new primary takes over (in
  0.3 s after a graceful stop, 10.8 s after a crash) and not one
  acknowledged write is lost.
- **`docs/nosql/`**: the data model with its diagram, the design decisions,
  the dataset, the measurements, and how replication keeps the data safe.

### Notes
- New development dependency: `tsx`, to run the TypeScript scripts.
- The generated data lives in its own `horizon_perf` database, with its own
  user, so it never mixes with development data.

## [0.20.0] - 2026-09-10

### Added
- **Search & insights**, in the menu when you're signed in.
  - **Search** across every track, material, phase, roadmap and note your
    account has synced, from every device. Results show which materials and
    phases matched, and the passage of a note that did. "Books" finds "Book":
    words are matched by their stem, and a hit in a title ranks above one
    buried in a roadmap. Click a track to open it.
  - **Your history**: active days, total accomplishments, your longest streak
    and when it ran, how often each weekday is active, active days per month,
    and the same per track. Every chart has a table view.
- Both run in MongoDB on the server (a full-text index, and aggregation
  pipelines), over what has been synced; `docs/LEARNING_LOG.md` explains how.

### Security
- Search and history only ever read the signed-in account's data, including
  where the history joins in track names. They're rate-limited per account
  (120 requests a minute), and a search is 1 to 100 characters.

## [0.19.1] - 2026-09-10

### Security
- **Rate limits** on signing in (10 attempts a minute per address), checking
  the session (60) and syncing (30 a minute per account). Past the limit, the
  server answers "Too many requests" with the seconds to wait. The counters
  hold a hash of the address rather than the address, and disappear within
  minutes.
- `/api/git` no longer reveals whether a path exists outside `~/Documents`:
  every forbidden path now gets the same answer, and the answer no longer
  names your home folder. It and `/api/notes` return generic errors instead
  of internal messages.
- `/api/open` refuses a link that isn't plain text, is absurdly long, or
  starts with `-` (which `xdg-open` would read as an option).
- Restoring a backup checks that every note is text under a proper id.

## [0.19.0] - 2026-09-10

### Added
- **Sync through your Horizon account.** Signed in (Settings → Account), the
  sync button at the top sends this device's tracks, progress and notes to
  your account, and brings back whatever your other devices added. Signing in
  runs the first sync straight away. Signed out, sync goes through Google Drive
  exactly as before; a device never uses both at once.
  - The server merges, not the device: two devices ticking different boxes on
    the same day both keep their ticks, even if they sync at the same moment.
  - A new device with nothing of its own yet takes the account's data,
    instead of adding a stray "My Track" to it (the same rule as Drive).
  - Your data stays on the device too, and the app works offline as before.
    An edit made while a sync is in flight is kept and goes up next time.
  - Notes, including each track's Notepad and To-do List, sync one by one:
    the newest copy of each note wins.
- In the database, tracks keep their settings in one document each, and each
  day of progress gets a small document of its own. `docs/LEARNING_LOG.md`
  explains why.

### Security
- Every sync reads and writes only the signed-in account's data. The account
  comes from the session cookie, never from the request.
- Every sync request is checked against a strict schema, down to the last
  field, and refused if anything is unexpected, malformed or oversized (2 MB).
  MongoDB checks every stored document against a schema of its own as well.
- Timestamps from the future are pulled back to the present, so a device with
  a wrong clock can't win every merge.
- Each sync that changes something is recorded in an audit log, kept for 90
  days.

## [0.18.1] - 2026-09-10

### Security
- **Next.js 16.3.4** (from 16.2.7), and `npm audit fix` for the rest:
  `npm audit` now reports 0 known vulnerabilities, down from 10 (one
  critical). Neither of the serious Next.js advisories could be exploited in
  Horizon, which uses no middleware or proxy and no Server Actions, but they're
  closed before anything is built on top.

### Added
- `docs/LEARNING_LOG.md`: what each step of the database and security work
  built, why, and the ideas behind it, with ways to see it working and the
  exam questions it answers.

### Notes
- Next 16.3.4's lint rules flag two `window.location.assign()` calls. Both
  full page loads are deliberate (one makes sure pending edits are saved, the
  other restarts the app after "Delete local data"), so the warnings are
  suppressed with the reason next to each.
- The test configs are now `vitest.config.mts` and `vitest.db.config.mts`, as
  the updated Vite expects.

## [0.18.0] - 2026-09-10

### Added
- **Sign in with Google**, in Settings → Account. This is the first half of
  accounts: signing in creates your Horizon account on the server. Syncing
  your tracks through it comes next; until then Cloud sync (Drive) works
  exactly as before.
  - The server doesn't take the browser's word for who you are. It checks
    Google's signature on the ID token against Google's published keys, that
    the token was issued to Horizon and not some other app, that it hasn't
    expired, and that Google has verified the email.
  - Signing in starts a server-side session. The browser gets a random 256-bit
    token in a cookie that page scripts can't read, sent only over HTTPS and
    never with other sites' requests. The database stores only the token's
    hash. Signing out deletes the session on the server, so a copied cookie
    stops working. Sessions last 30 days.
  - Shown only where the deployment sets a Google client ID, so nothing
    changes on horizonroadmap.com until accounts are switched on there.
- `npm run test:db`: tests that run against the local MongoDB, as their own
  user on their own database. Sign-in and sessions are covered end to end.

### Security
- The Content-Security-Policy no longer lets the page load images from other
  sites. The app never did, and an open rule would have let injected script
  send data out inside an image URL.
- The account API refuses requests from other sites' pages, anything that
  isn't JSON, oversized bodies and unexpected fields. Its errors are generic,
  and its logs never contain tokens.
- MongoDB queries made through Mongoose neutralise operator injection: a
  `{"$ne": null}` smuggled in where a plain value belongs is refused rather
  than run.
- "Delete local data" also signs this browser out.

### Notes
- New dependencies: `mongoose`, `jose` (checks Google's tokens; no
  dependencies of its own) and `zod` (validates request bodies).
- `npm audit` reports advisories for Next.js 16.2.7 that predate this release.
  Neither applies to Horizon, which has no middleware or proxy and no Server
  Actions, but the upgrade to 16.3.4 is next.

## [0.17.1] - 2026-09-10

### Added
- **A local MongoDB for development**, groundwork for accounts and server
  sync. `npm run db:up` starts a three-member replica set in Docker
  (`compose.yaml`). Access control is on: the members share a generated key
  file, and there are two users, `root` and `horizon_app`. `horizon_app` can
  read and write the `horizon` database and nothing else. Passwords are
  generated per machine into git-ignored files, the app is only ever given
  `horizon_app`'s, and the database listens on `127.0.0.1` only. Stopping one
  member shows failover: the other two elect a new primary within seconds.
  Nothing in the app uses the database yet. Setup is in the README.
- **A threat model**, `docs/security/THREAT_MODEL.md`. It covers the system as
  it will be once sign-in with Google and MongoDB sync exist: a data-flow
  diagram with its trust boundaries, 41 threats rated by likelihood and impact
  and tracked to a fix or an accepted risk, and the same threats by network
  layer and by security goal.

### Notes
- The university modules plan moved from `temp/` to the repo root as
  `MODULES_PLAN.md`.

## [0.17.0] - 2026-09-10

### Added
- **A Notepad panel.** One plain text box per track for getting something down
  before it has a proper home. It saves as you type.
- **A To-do List panel.** One per track: add, tick, delete, and "Clear done" —
  nothing more.
- Both open by default on every track; close either from the Modules menu. They
  live with the material notes rather than in the track record, so typing in
  them never bumps the track's config. Each syncs to Drive as its own
  `note_notepad_<trackId>.md` / `note_todo_<trackId>.md` (newest edit wins),
  comes along in every backup, and shows up in the .zip export under
  `notepads/` and `todos/`, named after the track. The to-do list is stored as
  a markdown checklist, so those files stay readable.

### Notes
- An open panel re-reads its note after every Drive sync or restore, so it
  can't save a stale copy over something newer from another device — unless
  you're mid-edit, in which case your edit is the newest and wins.

## [0.16.0] - 2026-09-10

### Removed
- **The setup wizard**, and the `/onboarding` route with it. A first visit now
  opens straight onto the dashboard with a blank track — "My Track", four
  placeholder phases and a weekly rhythm, all editable. **New Track** adds
  another blank one, makes it active and opens its Track settings, which is
  where it gets its name, colour, start date and length.
- **AI roadmap generation** (0.14.0–0.14.3). It was only reachable through the
  wizard. The AI settings are gone, any provider key saved in this browser is
  deleted the first time the app loads, and the CSP no longer allows
  connections to Gemini or OpenRouter.

### Changed
- **Restoring from Drive on a new device still works without the wizard's "I
  already have an account" step.** The starter track counts as disposable until
  you change something: connect Drive before your first edit and the first sync
  replaces it with your real tracks, instead of merging a stray "My Track" into
  them. From your first edit on, syncing merges as usual, so nothing you wrote
  is ever overwritten.

### Notes
- The landing page no longer describes the wizard or pickable templates.
- The Learning, Fitness and Work templates are still in `lib/templates`, but
  nothing uses them now; the blank track comes from Custom.

## [0.15.0] - 2026-09-10

### Added
- **Archive a material instead of deleting it.** Finishing a book used to leave
  two options: let it clutter the list, or delete it and lose its progress and
  notes with it. Every material now has an **Archive** button. Archived
  materials move to a collapsed **Archived** group at the bottom of the panel,
  where their notes stay readable, and **Unarchive** puts them back exactly as
  they were. It's an ordinary per-item edit, so it syncs between devices like
  any other change.

### Notes
- Archived materials still count in the Materials figure of the progress
  stats — a finished book is still finished work. They no longer fetch repo
  stats, which saves GitHub API budget.

## [0.14.4] - 2026-09-10

### Security
- **Other websites can no longer reach the local-only routes.** `/api/open`,
  `/api/git` and `/api/notes` only checked the `Host` header. That stops other
  devices on the LAN and DNS rebinding, but not a page on any website you have
  open: the browser sends `Host: localhost` for it. A no-cors `POST` with a
  `text/plain` body skips the CORS preflight, and `/api/open` parsed it as JSON
  anyway — so while the dev server was running, any site you visited could make
  your machine `xdg-open` a URL or file of its choosing. Confirmed from a real
  browser, from a page on another origin. The guard now also refuses requests
  whose `Origin` isn't this exact origin or whose `Sec-Fetch-Site` says they came
  from another site, and `/api/open` only accepts `application/json`, which other
  sites can't send without a preflight that Next's automatic `OPTIONS` never
  approves.

### Fixed
- **`[::1]` was never recognised as localhost.** The guard split the `Host`
  header on `:`, so an IPv6 loopback request read as `[` and was refused. The
  header is parsed as a URL now.

### Notes
- Still open, and documented in `lib/server/localRequest.ts`: with
  `npm run dev:lan`, someone on the LAN with a raw HTTP client can forge every
  header. Only a firewall closes that.

## [0.14.3] - 2026-07-27

### Added
- **A Content-Security-Policy, with a strict `connect-src` allowlist.** Horizon
  asks you to paste an API key for your own AI provider, and "we don't send your
  key anywhere" is worth nothing as a promise — whoever ships the app controls
  the code your browser runs. A CSP is different: the *browser* enforces it, the
  header is visible in devtools in seconds, and no script on the page — ours, a
  dependency's, or one injected through a hole nobody has found yet — can open a
  connection to an origin that isn't on the list. The list is exactly the five
  the app already talks to: Gemini, OpenRouter, Google APIs, Google accounts,
  and the GitHub API. Also sets `Referrer-Policy`, `X-Content-Type-Options`,
  `X-Frame-Options`, `frame-ancestors 'none'` and `object-src 'none'`.
- Settings now says the policy exists and invites you to verify it rather than
  trust it, and suggests restricting the key and setting a spend limit at the
  provider — protection that is yours and can't be taken away by us.

## [0.14.2] - 2026-07-27

### Added
- **Materials have an author.** Shown under the title in smaller, muted text,
  editable everywhere a material is, and generated by AI alongside the title.
  Optional — plenty of references have no author worth recording, and existing
  materials simply don't have one.
- **A "find" search on materials without a link.** Built from the material's own
  title and author rather than generated, so it always resolves — and when a
  title was fabricated, the search visibly finds nothing, which is how you catch
  it.

### Notes
- **AI still never generates URLs**, deliberately. A model asked for a link
  produces one that looks right and resolves to nothing, or to something
  unrelated — and unlike a wrong title, a wrong link is clickable, so you find
  out by going there. Authors are different: a misattribution is visible at a
  glance and costs nothing to correct, so those are generated (with the prompt
  telling the model to omit the author rather than guess at it).

## [0.14.1] - 2026-07-27

### Added
- **"Try again" on AI errors that can actually succeed.** Every generation error
  already knew whether retrying was worth it; nothing used that. A rate limit or
  a truncated response now offers a retry that re-runs the same request. A
  rejected key does not — it would fail identically however many times you ask.

### Changed
- **Material categories are no longer locked to a graphics curriculum.** The
  list was `Mathematics / Computer Graphics / Programming Languages / DSA /
  Other`, which was right when Horizon held one personal track and wrong the
  moment a track could be about anything — a couch-to-5k plan filed every book
  under "Other". Added general categories (Fundamentals, Technique, Practice,
  Reference, Health & Fitness, Language, Business) and types (Podcast, Paper),
  kept every original so existing materials keep their grouping, and surfaced
  any category already in use so a value typed earlier never vanishes from the
  dropdown. The materials UI and AI generation now share one source of truth,
  so they cannot drift apart.

### Fixed
- **The roadmap step asked permission to overwrite text you never wrote.**
  Leaving the Phases step auto-fills the box with a generated outline, and
  "Draft this for me" then treated that as your own work and asked before
  replacing it.

## [0.14.0] - 2026-07-27

### Added
- **AI roadmap drafting, bring-your-own-key.** Describe a goal on the wizard's
  first step — *"Learn Vulkan, C++ memory management, and graphics rendering in
  3 months"* — and get a complete starting roadmap: phases, tasks, deliverables
  and a weekly rhythm, all editable before anything is saved. Also adds a
  "Draft this for me" button on the Roadmap step for the markdown document.
  - **Horizon operates no AI backend and never will.** There is no subscription,
    no key held by us, no inference bill, and no abuse surface. Requests go from
    your browser straight to the provider you configure. Gemini (free tier, no
    card) and OpenRouter are supported; the key lives in `localStorage` and is
    deliberately kept out of the workspace, so it is never written to
    `database.json`, never synced to Drive, and never included in a backup.
  - **Generation only ever creates a new track**, through the existing wizard
    and the existing `seedTrackFromTemplate` → `createTrack` path. It cannot
    modify or overwrite an existing track — a bad overwrite would propagate to
    every device through Drive sync.
  - **Every request is capped and timed out.** Model screening found ~23% of
    small-model generations never emit a stop token at all, two of them running
    to 40k and 81k tokens. On your own key that is your money, so a truncated
    response is treated as a failure with a retry rather than parsed, and
    cancelling actually aborts the request instead of hiding a spinner.
  - **Nothing the model returns is trusted.** A validator assigns all ids,
    reschedules phase deadlines that don't fit the horizon, drops phases with no
    tasks, replaces invalid colours, and strips unknown keys — then tells you
    what it adjusted rather than silently shipping a mangled plan.

### Notes
- **On-device generation was evaluated and deliberately cut.** Running Qwen2.5
  at 1.5B/3B/7B against the real schema, the small models that could plausibly
  ship in a browser produced roadmaps worth keeping in roughly 0% and 35% of
  cases respectively, against a 7B control at ~78%. That means no offline or
  fully-private generation path in this release; the goal text does leave your
  device. Reasoning and evidence are recorded in the branch's planning notes.

## [0.13.6] - 2026-07-26

### Fixed
- **Repo stats exhausted GitHub's rate limit and then hammered it.** Each repo
  costs two requests (metadata + last commit) against an unauthenticated budget
  of 60/hour per IP, so four linked repos burn eight per pass — and passes were
  firing far more often than the repo list changed. Four causes, all addressed:
  - **`MaterialsTracker` / `PortfolioTracker` keyed their fetch effect on the
    `materials` / `portfolio` arrays.** Those get a new identity on every
    unrelated workspace edit — a ticked checkbox, a sync, the daily reset — so
    the stats re-fetched constantly. They now key on `serializeGitSources()`, a
    string of the id→source pairs, which only changes when a repo is actually
    added, removed, or re-pointed. (Strict Mode's double-invoked effects in dev
    were doubling all of it.)
  - **A `403` was never recorded**, so every subsequent render retried and
    failed again, flooding the console. `lib/gitStats.ts` now parks all
    requests until GitHub's own `x-ratelimit-reset` time — persisted, so a
    reload during the lockout doesn't start a fresh round of doomed requests —
    and logs once, with the fix, instead of once per repo per render.
  - **No in-flight deduplication.** Materials and Portfolio routinely link the
    same repo and mount together, so each opened its own round trip for
    identical data. One shared promise per repo now.
  - **The cache TTL was 15 minutes**, which is far shorter than a last-commit
    message stays interesting. Raised to 1 hour. `404`s are cached too — a
    typo'd URL was re-asking forever.

### Changed
- **`README.md`** — the Git Stats section documented the old 15-minute TTL and
  said nothing about the `github_token` escape hatch, which only existed in a
  code comment. Both fixed; the token raises the ceiling to 5000/hour.

Covered by `lib/__tests__/gitStats.test.ts`, and verified in a browser: three
workspace updates with the cache wiped between each made zero requests, while
adding a new repo fetched immediately.

## [0.13.5] - 2026-07-26

### Removed
- **`public/feature_graphic.jpg`** — the Play Store feature graphic added in
  `5a973e0`. Nothing referenced it (it was never in the manifest or any icon
  set), so it was shipping to every visitor as dead weight in `public/`. Still
  in the history if a store listing needs it again.

## [0.13.4] - 2026-07-26

### Fixed
- **Dragging the Materials panel slid the notes drawer into view.** The drawer
  is `position: fixed` and stays mounted whether open or not — "closed" is
  `translateX(100%)`, parked one drawer-width off the right edge, which is what
  makes the slide animate. But it was rendered *inside* the Materials panel, and
  a transformed ancestor becomes the containing block for its fixed
  descendants. dnd-kit puts a transform on a panel for the whole duration of a
  drag, so mid-drag that 100% stopped meaning "off the viewport" and started
  meaning "one panel-width across" — comfortably on screen. Nothing had opened;
  the closed drawer had simply been re-anchored.
- **`components/Portal.tsx`** (new) — renders into `<body>`, so a fixed overlay
  inside a panel can't be captured by an ancestor transform. Used by the notes
  drawer and by the streak's day-detail modal, which sits in a draggable panel
  with the same exposure. The hazard was already known here — `globals.css`
  warns about it for the panel entrance animation — but the drag transform is a
  second source of it, so this makes it structurally impossible rather than
  something each overlay has to remember.

## [0.13.3] - 2026-07-26

### Fixed
- **Panels squashed and stretched while being dragged.** `SortablePanel` styled
  the drag node with `CSS.Transform.toString(transform)`, which emits dnd-kit's
  `scaleX`/`scaleY` alongside the translation — factors it derives from the
  ratio between the dragged item and whatever it's currently over. For a list
  of same-sized rows that's invisible; for dashboard panels, where a Focus Timer
  can be a fifth the height of a Roadmap Timeline, it visibly distorted the
  panel's text mid-drag and snapped back on release (the transform is dropped
  once the panel lands, which is why only the moving panel ever looked wrong).
  Now `CSS.Translate.toString(transform)` — position without the scaling.

## [0.13.2] - 2026-07-26

### Fixed
- **Dropdown lists still unreadable in dark mode.** 0.13.1 set `color-scheme`,
  which is enough on browsers that apply it to the popup a `<select>` opens —
  but not on all of them: each `<option>` kept inheriting the control's light
  `color` while the list stayed on its default white backdrop, so the rows read
  as pale grey on white and only the one under the cursor was legible. Now the
  option colours are stated outright (`select option { background-color:
  var(--card-bg); color: var(--foreground) }`), which Chrome honours on Windows
  and Linux; `color-scheme` stays for macOS, which draws its own list and
  ignores per-option colours. Belt and braces, because there's no single
  property every platform respects. Disabled options get the subtle-foreground
  token so they stay visible-but-quiet against the dark backdrop.

## [0.13.1] - 2026-07-26

Three fixes on top of 0.13.0.

### Fixed
- **Unreadable dropdowns in dark mode** — an opened `<select>` drew its popup
  list in the browser's own light chrome: white text on white, legible only
  under the cursor. Fixed at the root with `color-scheme: dark` (and `light` on
  the light theme), which is the property that tells a browser to render *its*
  widgets — select popups, date/time pickers, form-control defaults, scrollbars
  — to match. Applies everywhere, not just to the settings dialog: the weekly
  rhythm editor's day dropdowns had the same problem.

### Changed
- **`components/PhaseTracker.tsx`** — a "Full Roadmap" button next to
  "[+ Add Phase]". The link moved into the header's ⋮ menu in 0.13.0, which is
  the right home for it but a long way from where you're reading the phases the
  document describes; the timeline is a summary of that roadmap, so it should
  open it. Locked with the same "connect Drive to unlock" state as the menu
  entry.
- **Removed the daily reminder** — the setting, the `reminder` field, and
  `components/DailyReminder.tsx`. It was the one addition that promised more
  than it could deliver (no server means no notification unless the app happens
  to be open), and it isn't wanted.

## [0.13.0] - 2026-07-26

Settings, restore-from-backup, and a top bar that fits on a phone.

The header had grown to seven items on one wrapping row, and every piece of
configuration lived behind a different unlabelled icon. Two changes: an overflow
menu holding everything you *do*, and a Settings dialog for the choices that
belong to the device rather than to a track. The bar keeps only what you *read*
— the mark, which track you're on, and whether it's saved.

### Added
- **Restore from a backup** (`lib/import.ts`) — the way back in for what
  `lib/export.ts` writes out, and the gap that mattered most: you could export a
  full backup but nothing could read one, so a cleared browser with a lapsed
  Drive connection meant the file was unreadable by its own app. Accepts either
  export format (the `.json`, or the `.zip`'s `database.json`), validates before
  touching anything, shows what's inside — tracks, notes, active days, export
  date — and only then replaces. Replace rather than merge: a restore means "put
  it back", and merging would need per-item timestamps a file may predate. The
  workspace goes through the migration pipeline on the way in, so an old backup
  lands at the current schema exactly as Drive data does.
- **`components/SettingsModal.tsx`** — theme, day rollover, week start, daily
  reminder, cloud connection, export, restore, storage used, and a two-step
  "delete local data". Explicitly *app*-level: a user hunting for "start date"
  should never find it next to "Client ID", so track identity, rhythm and
  rotations stay in their own dialogs.
- **`lib/settings.ts`** — device preferences in localStorage, deliberately not
  in the synced workspace: they describe how *this* device behaves, and syncing
  them would let one device silently reconfigure another. Malformed or missing
  fields fall back to defaults rather than breaking the app.
- **Day rollover hour** — `todayYMD()` now honours it, so work logged at 01:00
  can count for the previous day. It's the one setting that changes what the
  data *means*, and it lands in one place: every existing caller (the daily
  reset, which card the weekly plan highlights, which date a checkbox records
  against, the streak anchor) picks it up without threading a parameter.
- **Week start** — the consistency grid can open its columns on Monday.
- **Daily reminder** (`components/DailyReminder.tsx`) — fires once a day if
  nothing has been recorded by the chosen time. Only while the app is open:
  scheduled push needs a server holding a subscription, and this app doesn't
  have one (having one would mean your goals leaving your device). Settings says
  so plainly rather than implying otherwise.
- **Three-state theme** (`lib/theme.ts`) — Light, Dark, or System. "System" is
  encoded as *no stored value*, which is what the pre-paint script already
  treats as "follow the OS"; it now also re-applies when the OS flips while the
  app is open. Previously, once you clicked the toggle, "follow my system" was
  unrecoverable.

### Changed
- **`components/TopBarMenu.tsx`** (replaces `ModulesMenu.tsx`) — one `⋮` holding
  track settings, weekly rhythm, new rotation, full roadmap, new track, panel
  visibility, cloud & backup and settings. Module toggles are a section rather
  than their own popover: a menu that opens a menu is the worse trade.
- **`components/DashboardHeader.tsx`** — sync status stays in the bar on
  purpose; a status indicator hidden inside a menu stops being one. The theme
  toggle stays too (one click, and it's 28px).
- **`components/StreakGraph.tsx`** — builds its grid from `streakCalendar`
  instead of its own copy of the same week-walking logic, which is also what
  makes week-start work everywhere at once.
- **`WorkspaceProvider`** exposes `reload`, for changes made underneath the
  provider rather than through it — a restored backup, a wiped database.

Tests: `lib/__tests__/settings.test.ts` (settings normalisation and clamping,
rollover arithmetic) and `lib/__tests__/import.test.ts` (both file formats,
every rejection path, the summary) — 192 passing overall.

## [0.12.1] - 2026-07-26

Landing page trims and a theme toggle.

### Changed
- **`app/landing/page.tsx`** — one call to action instead of two: the hero's
  secondary "Build your first track" link is gone, since `/` already forwards
  to `/onboarding` when there are no tracks, so both buttons led to the same
  place for the visitors the page is written for. The footer's Dashboard /
  New track / Roadmap links are gone too — they pointed into an app the
  visitor hasn't set up yet.

### Added
- **Theme toggle in the landing nav** — the app's own `ThemeToggle`, not a
  copy. It writes the same `horizon-theme` localStorage key that the pre-paint
  script in `layout.tsx` reads on every route, so a choice made on either side
  carries to the other in both directions, with no flash on the way.

## [0.12.0] - 2026-07-26

The four hero metrics under the header — Current Streak, Timeline, Phase Day,
Progress — are now buttons, and each opens a detail panel for the number it
shows. Until now they were the only numbers in the app you couldn't ask a
follow-up question about: the streak said "1 day" without saying what the
longest run was, and Progress was a bar with no legend at all.

### Added
- **`lib/stats.ts`** (new) — pure, read-only summaries behind the panels:
  `streakStats` (current run, longest run anywhere in the history, active days,
  last 30, consistency, recent accomplishments), `streakCalendar` (day cells
  from the track's start, aligned back to the preceding Sunday), `timelineStats`
  (days passed/remaining, and each phase's day window, derived by opening each
  phase the day after the previous one's `recommendedByDay`), `phaseStats` (day
  within the phase, deadline, days left, task progress, and how many phases
  behind the schedule says you are) and `progressStats`. Covered by
  `lib/__tests__/stats.test.ts` (17 cases, clock pinned).
- **`components/StatDetailModal.tsx`** (new) — the panel itself, one body per
  metric, closing on Escape, backdrop click or the X. The streak body renders
  the same `StreakGrid` the dashboard panel and the landing page use.

### Changed
- **`components/DashboardHeader.tsx`** — `StatTile` is a `<button>` (keyboard
  focusable, with a focus ring) and takes an `onClick`; the Progress tile,
  which was a bare `<div>`, got the same treatment. The header owns which
  metric is open, the way it already owned the track-settings modal.

Progress deliberately reports two numbers rather than one: the share of the
work done, and the share of the time spent, with the gap between them stated in
words. Only the dimensions that actually hold items (phases, phase tasks,
deliverables, materials) count toward the work figure, so a track with no
portfolio isn't permanently capped below 100%.

## [0.11.0] - 2026-07-26

The consistency streak now renders as one grid that fills its panel instead of
a sideways-scrolling strip of fixed 10px cells, and the dashboard and the
landing page share the same component so the two can't drift.

### Changed
- **`components/StreakGrid.tsx`** (new) — the grid itself: seven rows, one
  column per week, columns sharing the available width evenly. Holds no state
  and no hooks, which is what lets the landing page (a server component) render
  it too; `onCellClick` is what makes it interactive for the dashboard.
  Cell width is capped at 16px, because a track that's only two weeks old would
  otherwise stretch its handful of columns into huge tiles — past the cap the
  grid stays left-aligned at its natural size rather than filling the panel.
- **`components/StreakGraph.tsx`** — builds cells for the grid rather than
  laying out the squares itself. Dropped the horizontal scroll container and
  the effect that pinned it to the right edge; there's nothing left to scroll.
  Tooltips, the click-through day detail modal and the shade thresholds are
  unchanged.
- **`components/landing/DashboardPreview.tsx`** — renders through the same
  grid, and lost the weekly-rhythm strip that used to sit under it. The
  hero miniature now ends on the streak, matching the dashboard panel.

### Added
- **`components/landing/WeeklyPlanPreview.tsx`** + a new "A real week" section
  on `/landing` — a static replica of the Weekly Study Plan panel showing week
  12 of the engine track (its focus types and colours, both rotations, and the
  real per-day work), as a concrete example of what a configured track looks
  like. It mirrors `WeeklyPlan.tsx`'s DayCard and reuses the app's own
  `.week-grid` / `.week-grid-scroll` classes, so it scrolls sideways on a phone
  exactly like the real panel. Checkboxes are drawn rather than real inputs —
  it's a picture, and a disabled `<input>` would still take tab focus.

## [0.10.0] - 2026-07-26

Added a public landing page at `/landing`, so the domain has somewhere to send
people who haven't used the app yet. `/` still opens straight into the
dashboard (and still forwards to `/onboarding` when there are no tracks) —
nothing about the app's entry path changed; the landing page is purely
additive, and both its calls to action lead back into it.

The page is a static server component: no workspace, no IndexedDB, no client
state, so it prerenders at build time and renders identically for a first-time
visitor with an empty browser. It states the thing that's easiest to get wrong
about this app — it is a roadmap tracker, not a to-do list — and explains
tracks, the six dashboard modules, the setup wizard, and where the data lives.

### Added
- **`app/landing/page.tsx`** — the page itself: nav, hero, a to-do-list
  comparison, tracks, the module grid, a four-step "how it works", the
  local-first/data section, closing call to action, and a footer. Page-level
  `metadata` (title, description, canonical, Open Graph) points at
  `https://www.horizonroadmap.com/landing`.
- **`components/landing/DashboardPreview.tsx`** — a decorative miniature of the
  dashboard for the hero (horizon bar, phase timeline, streak grid, weekly
  rhythm). Deliberately not the real panels: it has to render without a
  workspace. Its streak cells come from a fixed-seed generator rather than
  `Math.random` so server and client markup always match.
- **`app/globals.css`** — `.btn-sm` / `.btn-lg` / `.btn-solid` size and
  emphasis variants of `.btn`, plus `.landing-cta`, `.landing-panel-accent` and
  `.landing-preview`. These exist because the app's component classes live
  outside Tailwind's layers and so can't be overridden by utilities like
  `px-5`; the landing page otherwise reuses the app's own tokens and surfaces,
  so the two can't drift apart, and it inherits both themes for free.

## [0.9.1] - 2026-07-26

Corrected the PPP chapter numbers in the engine track's roadmap fixtures. The
curriculum was drafted against *Programming: Principles and Practice Using C++*
**2nd edition**, but the copy actually being read is the **3rd**, which dropped
the old chapter 1, merged the two I/O chapters, added a new chapter 17, split
the old chapter 21, and cut chapters 22-27. Under 3rd-edition numbering the old
groups pointed at the wrong material: Phase 1's "ch 1-10 core" ended five
chapters short of any pointer or free-store content while walking into the
book's GUI-library block, and the roadmap's "prioritise ch 8-10 — the ray
tracer depends on them" named functions, classes and I/O rather than the
memory-management chapters it meant.

### Changed
- **`lib/legacyPersonalData.ts`** (`LEGACY_ROADMAP_CONTENT`) — Phase 1 §1 now
  reads ch 1-6, 7-8, 9, 12, 15-17 with the reason each group is there, and
  Phase 2 §1 reads ch 18, 19, 20, 21 one bullet apiece. Added an explicit
  edition warning, a "deliberately skipped: ch 10, 11 past 11.2, 13, 14"
  paragraph so the GUI chapters don't read as an oversight, and a carry-over
  rule ordering the phase 1-9 → 12 → 15-17 (15-17 may slip into Phase 2, but
  never behind 18-21 — pointers gate the ray tracer, templates don't). The
  Phase 1 overview row and both resource lines now say "3rd ed".
- **`data/database.json`** — the four Roadmap Timeline strings holding chapter
  numbers, kept in step with the document above per the "the timeline is a
  summary of this document, never a second plan" rule.

Both files are migration/test fixtures — `LEGACY_ROADMAP_CONTENT` is read once
by the Dexie v1→v2 upgrade and `data/database.json` only by
`lib/__tests__/mergeWorkspace.test.ts` — so neither reaches an installation
that has already migrated. The live roadmap and timeline are edited in the app.

## [0.9.0] - 2026-07-26

Collapsible category groups in Materials. A long reading list pushed every
other panel down the page; now each category heading is a disclosure control,
so groups you're not actively working through can be folded out of the way.

### Added
- **Fold/unfold per category** in `components/MaterialsTracker.tsx` — the
  category heading became a button with a rotating chevron and an item count
  (e.g. `Mathematics (2)`), carrying `aria-expanded`/`aria-controls` for
  screen readers. The count stays visible when folded, so a closed group still
  says how much is inside.
- **Fold state persists** under the `horizon-materials-collapsed` localStorage
  key. It's a per-device view preference, not track data, so it deliberately
  stays out of the workspace record and off Drive sync — the same reasoning as
  `horizon-theme`. A device with no stored value starts fully expanded.

### Notes
- Folded groups are hidden with a display utility rather than unmounted, so an
  in-progress edit form inside a group survives folding it shut and back open.

## [0.8.0] - 2026-07-26

A real logo. The app had three different marks in the three places you
actually see it: a `>_` terminal glyph in the header, a stock rainbow torus on
the phone home screen, and the untouched Next.js default in the browser tab.
All three are now one mark, drawn from the app's own design tokens — a sun
clearing the horizon, where the horizon line doubles as the track's progress
bar.

### Added
- **`app/icon.svg`** — the master artwork, and also what modern browsers get
  as their favicon (`sizes="any"`, so it stays crisp at any tab size).
- **`components/HorizonMark.tsx`** — the same mark drawn plate-free in
  `currentColor` for use inside the app, so it follows the theme. Replaces the
  `>_` glyph in the dashboard header and on all three onboarding screens.
- **`app/apple-icon.png`** (180×180) and **`public/icon-maskable-512.png`** —
  purpose-built variants. Both are full-bleed with no corner radius of their
  own, because iOS and Android each apply their own mask; the maskable one
  keeps the mark inside the 80% safe zone so the ends of the horizon bar
  survive the circular crop.
- **`brand/build-icons.sh`** — regenerates every PNG and the `.ico` from the
  SVG sources, so the set can't drift apart by hand-editing one of them.

### Changed
- `app/favicon.ico` is now the Horizon mark at 16/32/48 px, replacing the
  Next.js starter default.
- `public/icon-192.png` and `public/icon-512.png` re-rendered from the new
  master.
- The manifest points `purpose: 'maskable'` at the dedicated maskable art
  instead of reusing the standard 512 icon, and its `background_color` now
  matches the app's actual `--background` (`#0a0a0c`, was `#09090b`).
- `app/layout.tsx` no longer declares `metadata.icons`. The app-directory file
  conventions (`favicon.ico`, `icon.svg`, `apple-icon.png`) emit better
  `rel`/`type`/`sizes` tags per file, and a manual `icons` block would have
  overridden them.
- Service worker cache bumped to `v3` and the maskable icon added to the
  precache list — without the bump, installed PWAs would have kept serving the
  old icons out of cache.

### Removed
- `public/icon.png` and `public/icon.jpg` — 1024 px source art for the old
  rainbow torus, referenced by nothing but the README. Recoverable from git
  history if ever wanted.

## [0.7.0] - 2026-07-26

Internal restructuring. No feature was added or removed and the UI is
unchanged — this release is about making the next feature cheaper to build.

### Added
- **Workspace state provider** (`components/workspace/WorkspaceProvider.tsx`).
  One place owns the loaded workspace, the debounced write, the flush-on-hide
  safety net, the daily reset and the Drive sync. Consumers use two hooks:
  `useWorkspace()` for data and `useWorkspaceActions()` for the three write
  verbs (`updateTrack` debounced, `commitTrack` immediate, `commitWorkspace`).
  The dashboard and the roadmap page each used to re-implement all of that
  independently, and modals took up to four separate mutation callbacks as
  props.
  - Writers take an updater function (`updateTrack(prev => next)`), which
    removes the "read the newest track through a ref" workaround that
    `RotationModal` needed to stop a debounced autosave clobbering a
    concurrent edit.
- **Versioned migration pipeline** (`lib/migrations/`). The three shape
  upgrades that ran inline — and unconditionally, on every single load —
  inside `fetchWorkspace` are now an ordered, append-only `MIGRATIONS` list
  behind a `schemaVersion` stamp on the workspace record, so each one runs
  once per device. Adding a migration is one function plus one list entry.
- **Migrations now also run on data pulled down from Drive**, before it is
  merged. A backup written by a device on an older version could previously
  win a merge in its old shape and land back in local storage un-upgraded.
- **`lib/completions.ts`** — the completion rules (day id set, accomplishment
  history, derived streak, stored item flag) as pure, tested functions.
- **`lib/trackActions.ts`** — the fifteen material/portfolio/phase/identity
  mutation handlers that lived inside `app/page.tsx`, as pure functions.
- **Per-panel error boundary.** A module that throws is now isolated to its own
  panel instead of taking the whole dashboard down to the app-level error page
  — including the sync button needed to recover.
- **Panel registry** (`components/panels/registry.tsx`) typed against
  `ModuleId`, so a module added to `lib/modules.ts` without a matching panel is
  a compile error. Module id, label, home column, icon and panel were
  previously spread across three files with no link between them.
- 38 new tests (117 → 155) covering the migration pipeline, the completion
  rules and the track actions.

### Fixed
- **A focus-type edit no longer risks being lost in a sync.** `configVersion`
  change detection ran against a hand-maintained list of track fields that
  omitted `focusTypes` entirely, so recolouring or renaming a focus type
  didn't mark the track as structurally changed. The check is now an
  *exclusion* list — progress and bookkeeping fields are named, everything
  else counts as config — which also makes the documented "remember to add
  your new field to `CONFIG_COMPARE_FIELDS`" footgun impossible.
- **Switching tracks now applies that track's daily reset.** A track left
  untouched since yesterday showed yesterday's ticked checkboxes until the
  page was reloaded.
- Completion state is no longer mutated in place inside the `weeklyCompletions`
  map — the previous code copied the outer map but wrote through to the day
  objects held by the current React state.
- `/api/notes` now carries the same localhost-only guard as `/api/git` and
  `/api/open`.
- Opening a material's notes no longer writes an empty note row, which would
  then be uploaded to Drive as an empty `note_<id>.md`.

### Changed
- `lib/api.ts` split by responsibility into `workspaceRepo.ts` (the only module
  that reads/writes the stored workspace), `gitStats.ts`, `notes.ts`,
  `systemLinks.ts` and `selectors.ts`. `lib/localDb.ts` is now just the Dexie
  schema.
- `app/page.tsx` went from 831 lines to 11 — it mounts the provider and renders
  `components/Dashboard.tsx`, which is layout and modal orchestration only.
- `ScheduleDayModal` (607 → ~390 lines) and `WeeklyPlan` use the shared
  completion functions instead of six hand-rolled copies of the same logic.
- `ScheduleDayModal`'s add-item forms and `FocusTypeEditor`'s new-type form use
  controlled React state instead of reading values back out of the DOM by
  `document.getElementById`, which also removes their duplicate global ids.
- The Modules menu draws each icon from the panel registry rather than its own
  parallel map.
- Retired `AppState` fields (`dailyFocus`, `dailyStudyPoints`, `studyStreak`,
  `lastDailyRoutineCheck`) are marked deprecated and optional, and are no
  longer seeded into new tracks. Existing records keep them untouched.
- Removed the unused `fetchTrackState` and `setActiveTrack` exports.

## [0.6.0] - 2026-07-25

### Added
- **Phase deadlines are now editable.** The phase detail modal's edit view gains
  a **Phase Ends** section: a date picker, the resulting curriculum day number
  shown beside it, and a *Clear* action that removes the deadline entirely.
  `Phase.recommendedByDay` has existed in the model since multi-track landed but
  was only ever settable by editing stored data by hand — there was no way to
  change a phase's end date from the UI at all.
  - Stored as a day offset from the track start rather than an absolute date, so
    re-dating a whole track later doesn't require rewriting every phase.
  - Clearing the field is how a phase opts out of the deadline and the
    phase-recommendation banner.
- **Deadlines shown in the Roadmap Timeline.** Each phase now renders its end
  date in faint monospace beneath its description (`Ends 31 Aug 2026 · day 88`),
  so the whole schedule is legible from the collapsed timeline without opening
  anything. Mirrored in the phase modal's header. Only rendered for phases that
  actually carry a threshold.
- `dateForDay`, `dayForDate` and `formatDayMonthYear` in `lib/dates.ts`.
  `dateForDay`/`dayForDate` are mutual inverses and share `daysSince`'s 1-based
  convention (day 1 *is* the track start date). `dateForDay` uses `setDate`
  rather than millisecond arithmetic, and `dayForDate` rounds rather than
  floors, so neither can drop a day across a daylight-saving boundary.

### Changed
- **Phase 1 of the Engine & Graphics track now ends 31 Aug 2026** (day 88)
  instead of running into September, so Phase 2 begins exactly on 1 September.
  Phases 2-4 keep their durations unchanged and shift accordingly: day 182
  (3 Dec 2026), day 330 (30 Apr 2027), day 392 (1 Jul 2027).
- **End dates removed from phase titles.** Titles return to `Phase 1: Months 1-3`
  — the date is derived from `recommendedByDay` and rendered by the timeline, so
  it can no longer drift out of sync with the stored threshold.

### Fixed
- **Phase end dates were off by one day.** `daysSince` counts inclusively from
  the track start (day 1 is the start date itself), but 0.5.0's phase boundaries
  were labelled as if day 0 were the start — so every date shown in the roadmap
  was a day late (day 92 is 4 Sep 2026, not 5 Sep). All day numbers and dates in
  the roadmap document and the timeline now use the same 1-based convention the
  rest of the app does.

## [0.5.0] - 2026-07-25

### Changed
- **Engine & Graphics curriculum rebalanced from 12 to 13 months.** The old
  plan gave Phase 2 roughly 2.5× Phase 1's load in 33% more time (four books,
  three tools, an asset database and the scene viewer) while Phase 3 carried
  three tasks across three months — the load curve was inverted, and the
  hardest phase had the least slack. Rebalanced across both the full roadmap
  (`LEGACY_ROADMAP_CONTENT`) and the Roadmap Timeline (`phases[]`):
  - **Phase 2** (now months 4–6) slimmed to one job: get a real-time renderer
    working end to end. LearnOpenGL, Calculus 1, ImGui, RenderDoc, the debug
    drawer and the scene graph, and nothing else.
  - **Phase 3** (now months 7–11, the long phase) absorbs everything
    architectural: *Game Engine Architecture* (Gregory), the Lengyel Vol 2
    deepening pass, the asset pipeline, plus the optimization half — deferred
    rendering, BVH/frustum culling, post-processing, Tracy.
  - **Phase 4** (months 12–13) reduced to Vulkan alone. PBR, image-based
    lighting and multi-threaded command buffer recording moved to a new
    **Beyond the Horizon** section rather than pretending a two-month phase
    could absorb them alongside learning Vulkan from zero.
  - **Phase 1 is unchanged** in content, but now states explicitly that PPP
    and LearnOpenGL are expected to carry into Phase 2.
- **Sequencing over parallelism.** LearnOpenGL (tutorial) and Lengyel Vol 2
  (derivation reference) no longer share a phase — the reference is now a
  second pass over code that already exists.
- **The SQLite thread is now an offline asset pipeline.** The database is
  editor-side, with a bake step emitting a flat binary that the runtime loads;
  the engine never opens the database. Previously the scene viewer deliverable
  loaded directly from SQLite, which coupled a schema bug to the graphics
  milestone and misrepresented how asset pipelines actually work. Phase 3's
  frame-timing database is kept as-is; Phase 4's half-edge relational-vs-
  document comparison is dropped (half-edge is an index structure whose point
  is cache-coherent traversal).

### Added
- **`recommendedByDay` on every phase** (92 / 186 / 334 / 396, from the
  2026-06-05 track start). This field existed in the model but was set on no
  phase, so the "time to switch phase" banner never fired and
  `DashboardHeader` fell back to its hardcoded 365-day horizon. Both now
  reflect the real 396-day plan.
- **A consolidation week closing every phase** — no new material, used to
  finish the in-flight chapter, polish the deliverable and write the README.
  This is the plan's explicit shock absorber; previously there was no slack
  anywhere across the twelve months.
- **A portfolio artifact in every phase.** Only Phase 1 had one (the visual
  README). Phase 2 now ends with a demo video, Phase 3 with a written
  performance case study drawn straight from the frame-timing database, and
  Phase 4 with an OpenGL-vs-Vulkan writeup plus a full portfolio pass.
- **Probability and Monte Carlo basics in Phase 4**, and multivariable
  calculus started early in Phase 3. Probability was absent from the entire
  curriculum despite Phase 4 requiring Monte Carlo integration and the
  rendering equation.
- **A required measurement artifact for Gregory's memory chapter** (arena +
  pool allocator with before/after load-time and allocation counts), so the
  book produces something instead of being passive reading.
- Phase task lists expanded from 18 to 37 entries so the timeline names
  everything the roadmap document does — deferred rendering, the allocator
  pass, the asset pipeline and the portfolio milestones were all previously
  described in the roadmap but invisible in the timeline.

### Notes
- The full roadmap and the Roadmap Timeline are now kept deliberately in step:
  phase names, deliverables, day thresholds and end dates agree across the
  document's overview table, its per-phase sections, and `phases[]`.
- `lib/legacyPersonalData.ts` and `data/database.json` are migration/test
  fixtures — they seed the Dexie v1→v2 upgrade and the merge tests, and do not
  retroactively update an already-migrated local workspace.

## [0.4.3] - 2026-07-25

### Changed
- **Roadmap curriculum now includes a data-management thread.** Added a
  "Data Management" topic to Phase 2 (modeling the scene graph as a
  relational adjacency table vs. nested documents, plus a SQLite-backed
  asset/material database feeding the OpenGL Scene Viewer deliverable) and
  Phase 3 (piping profiler frame captures into SQLite and querying them),
  with a callback from Phase 4's half-edge mesh topic. Master curriculum
  table's Phase 2/3 deliverables updated to match.

## [0.4.2] - 2026-07-25

### Fixed
- **Modules menu now stays fully on-screen.** After 0.4.1 the popover always
  opened rightward from its trigger, so when the *Modules* button sat near the
  right edge of the window the menu ran off-screen and clipped the module
  labels. It now measures the trigger on open and aligns to whichever edge
  keeps the whole menu inside the viewport (right-aligned when the trigger is
  near the right edge, left-aligned otherwise), and is capped at the viewport
  width for very narrow screens. Still overlaps content without shifting the
  layout.

## [0.4.1] - 2026-07-25

### Fixed
- **Modules menu no longer shifts the dashboard.** The header's *Modules*
  popover carried both the `absolute` utility and `glass-surface` (whose
  `position: relative` won the cascade), so it opened *in the layout flow* and
  pushed the hero metrics and every panel below it downward — by a varying
  amount depending on how the header wrapped at each screen width. It now
  forces `position: absolute` and overlaps the content instead. Also anchored
  it to the left of its trigger so the menu stays fully on-screen.

## [0.4.0] - 2026-07-25

### Added
- **Per-track modules.** Each track now controls which dashboard modules
  (Weekly Study Plan, Roadmap Timeline, Consistency Streak, Focus Timer,
  Portfolio Deliverables, Materials) are open, and in what order/column.
  - A **Modules** menu in the header toggles any module on/off for the active
    track, and each panel gets a hover **close (eye-off)** button. Reopen a
    closed module from the menu — it returns to its home column.
  - **Closing a module never deletes data.** It's a pure view change: the
    module is removed from the track's layout only; its data (streak history,
    materials, portfolio, …) stays untouched and reappears intact on reopen.
  - Different tracks keep independent layouts. An empty-state prompt shows when
    every module is closed.

### Changed
- Dashboard layout moved from a single shared workspace-level setting to
  **per-track** (`TrackState.panelColumns` + `hiddenPanels`). Existing layouts
  are migrated on load (each track seeded from the old shared value), and the
  per-track layout now syncs/merges via the track's own configVersion. New
  tracks are seeded with the default layout.

## [0.3.0] - 2026-07-25

### Added
- **Light theme.** A Sun/Moon toggle in the header switches between light and
  dark; the choice persists (localStorage) and first-time visitors get their
  OS `prefers-color-scheme`. An inline pre-paint script applies the theme
  before first render, so there's no light/dark flash on load.

### Changed
- Migrated the component tree off hardcoded dark-only colors (~430 usages of
  `text-white`, `text-zinc-*`, `bg-black/*`, `bg-white/*`, `border-white/*`,
  etc.) to semantic design tokens (`text-foreground`, `text-muted-foreground`,
  `text-subtle-foreground`, `bg-card`, `bg-input-bg`, `bg-surface-muted/hover`,
  `border-card-border[-hover]`), so both themes derive from one token set.
  Dark mode is visually unchanged. On-color text (`text-black` on accent/
  success chips) and modal scrims were intentionally left as-is.
- Added `--subtle-foreground` and exposed `--input-bg` as Tailwind utilities.

## [0.2.1] - 2026-07-25

### Changed
- Completed the lucide line-icon sweep across the modals and onboarding
  wizard: every remaining unicode close (`✕`) and check (`✓`) glyph is now a
  lucide icon, matching the dashboard. Covers the phase/schedule/rotation/
  track-settings/drive/rhythm modals, the onboarding steps, the wizard
  stepper's completed-step check, and the roadmap/rotation "Saved" labels.
  Close/remove buttons also gained `aria-label`s. (The checkbox tick remains a
  styled CSS pseudo-element by design.)

## [0.2.0] - 2026-07-25

### Changed
- Premium-minimal UI pass (shadcn/Vercel-flavored), dark mode. No information
  was moved behind menus — the dashboard stays as dense as before.
  - **Depth & elevation:** panels now sit on a proper surface ladder
    (page → card → inner rows) with a faint top-edge highlight and soft
    shadows, instead of a single flat plane of hairline-outlined boxes.
    Modals/notes drawer use a real translucent backdrop-blur surface.
  - **Hero metrics:** the header leads with an at-a-glance stat band —
    current streak (animated count-up), a Day X / Y timeline progress ring,
    phase day, and overall progress — all previously smaller inline text.
  - **Faint light source:** a low-opacity accent glow anchors the top of the
    page; base tone warmed slightly off pure black.
  - **Softer borders + motion:** relies more on elevation than outlines;
    checkbox check spring, staggered panel entrance, streak-cell hover, and
    progress-ring/count-up transitions (all respect `prefers-reduced-motion`).
  - **Icons:** dashboard chrome now uses lucide line-icons (edit, drag, more,
    cloud, roadmap, per-panel section icons, close/check) in place of unicode
    glyphs. Modal/onboarding-internal glyphs are a tracked follow-up.
- Section titles restyled as compact uppercase eyebrow labels.

### Added
- `currentStreakLength()` streak helper (consecutive-day count, anchored on
  today or yesterday) powering the hero streak metric, with unit tests.
- Light-theme design tokens staged in CSS (`:root[data-theme="light"]`),
  ready for a future toggle once the component color-token migration lands.

## [0.1.2] - 2026-07-25

### Fixed
- A track created through the onboarding wizard is no longer discarded on its
  first sync. `createTrack` now marks the workspace synced, so the first Sync
  against a Drive account that already holds data takes the merge path instead
  of the "unsynced: overwrite local with remote" branch that would wipe the
  new local track. (Connecting an existing account still overwrites correctly,
  since that path syncs before any local track exists.)
- The local `/api/git` route's home-directory guard now matches on a path
  boundary instead of a bare string prefix, so sibling directories such as
  `~/Documents-private` are no longer treated as inside `~/Documents`.

### Performance
- The "last synced" relative-time label now refreshes via its own interval
  inside the header instead of a dashboard-wide 15-second ticker, so the whole
  panel tree (streak grid, materials, weekly plan) no longer re-renders every
  15 seconds.
- The consistency-streak grid computation (a per-day walk across ~53 weeks) is
  now memoized on its inputs rather than rebuilt on every parent re-render.

## [0.1.1] - 2026-07-23

### Fixed
- Weekly-plan checkbox completions now merge per-item (per task/revision id)
  across devices instead of per-day. Previously, whichever device had the
  higher edit count for a day won the *entire* day's completions on sync, so
  two devices checking different items on the same day before syncing would
  silently lose one side's changes.
- The daily rollover now unions a day's snapshot into any completions already
  recorded for it instead of overwriting them, so a completion synced from
  another device can no longer be erased by a stale local snapshot.
- Pending (debounced) saves are now flushed before a manual sync and when the
  tab is backgrounded or closed, so a checkbox toggled just before either no
  longer risks being silently dropped.
