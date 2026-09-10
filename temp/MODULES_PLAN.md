# Plan: MongoDB (SE_06) + Cyber Security, on Horizon

> **How to use this document.** Written 2026-09-10 against v0.14.3 (branch
> `feature/ai-roadmap-generator`). The user is making their own product changes
> first, so the code will have moved on by the time this is picked up. To start:
> *"Read `temp/MODULES_PLAN.md` and begin at Step 0."* Step 0 re-checks every
> assumption below before any code changes.

---

## 1. Goals

1. Pass **SE_06 NoSQL Databases** at Level 1, using Horizon with MongoDB.
2. Pass the **Cyber Security** module (target level is an open question, §7).
3. Keep Horizon a working product: offline mode keeps working with no account,
   and nothing here should feel like coursework bolted on.

The central idea: the MongoDB work (a server, Google sign-in, per-user data) *is*
the attack surface the security module examines. Build it once, with security
designed in, and it serves both modules.

---

## 2. Decisions already made

Don't re-litigate these without new information.

| Decision | Why |
|---|---|
| NoSQL module (SE_06), not Relational (SE_05) | Least change. Horizon's data is a tree (user → track → everything else), read and written a track at a time: the textbook document-database case. SE_05 would need ~10 tables, a nested↔rows mapper, and an invented many-to-many (Appendix A). |
| MongoDB | `TrackState` in `lib/types.ts` is already a document shape. Covers every Level 1 objective natively: flexible schema + `$jsonSchema`, indexes, aggregation, text search, native driver + Mongoose, replica sets, sharding. |
| Not Postgres | Relational, so graded under the wrong module. Kept as the comparison point (Appendix A). |
| Not Firestore / CouchDB | Firestore manages replication and sharding invisibly, leaving nothing to demonstrate. CouchDB/PouchDB would replace Dexie and `lib/merge.ts` rather than sit behind them. |
| Offline mode unchanged | IndexedDB via Dexie, no account, data never leaves the device. |
| Signed-in users sync to MongoDB instead of Google Drive | The module needs the app's data layer to use the database. What happens to the Drive code is an open question (§7). |
| Server-side merge reusing `lib/merge.ts` | It imports only `./types` and `./streak`, no browser APIs, so it runs in an API route unchanged. |
| Threat model before the server is built | Security by design, and "I did the threat model first" is a strong exam answer. |

---

## 3. Starting point (as of v0.14.3; re-verify in Step 0)

**Storage.** `lib/localDb.ts`: Dexie DB `ProductivityDb` with tables `workspace`
(one row, `id: "current"`, holding the whole `Workspace`), `notes`
(`{id: materialId, content, updatedAt}`), and legacy `appState` (rollback
snapshot, never written). `lib/workspaceRepo.ts` is the only reader/writer of the
workspace record (`fetchWorkspace`, `putWorkspace`, `updateWorkspace`,
`createTrack`, `applyTrackBookkeeping`). Shape upgrades live in `lib/migrations/`:
`schemaVersion` is an index into an append-only list of idempotent steps.

**Sync.** `lib/googleDrive.ts` uses the GIS token client with scope
`drive.appdata`. The user pastes their *own* OAuth client ID
(`components/DriveConnectModal.tsx`). It stores `database.json` and `note_<id>.md` in the hidden appDataFolder. Flow:
fetch local → download remote → `migrateWorkspace` → `mergeWorkspace(local, remote)`
(or overwrite local if `!isSynced`) → `putWorkspace` → upload. The access token
sits in `localStorage` with a 3500 s expiry. Called only from
`components/workspace/WorkspaceProvider.tsx` (`sync`).

**First run** (0.16.0: the setup wizard is gone). A fresh install gets a blank
starter track from `ensureStarterTrack` in `lib/workspaceRepo.ts`, with the
workspace's `isSynced` left unset, so connecting Drive before any edit replaces
the starter with the Drive copy. The first real edit sets `isSynced`
(`updateWorkspace`), after which syncs merge. The MongoDB sync in Step 4 needs
the same rule: never merge an untouched starter into a user's server data.

**Merge.** `lib/merge.ts`: per-item last-write-wins using `itemUpdatedAt`,
`historyUpdatedAt` and `Material.updatedAt`; "higher `configVersion` wins" for
structural config.

**Ids.** Track ids are client-generated (`track_<uuid>` in
`lib/templates/index.ts`), and every migrated legacy workspace shares the fixed
id `track_legacy_engine_graphics`. Client ids are only unique *per user*; the
server model must never assume otherwise.

**Server.** None yet. `app/api/{git,notes,open}` are localhost-only dev
conveniences guarded by `lib/server/localRequest.ts`. Deployed on Vercel. Repo:
`github.com/alessandrogpz/horizon-roadmap-tracker`.

**Security already in place** (seed for the measures list):
- CSP with a strict `connect-src` allowlist, plus `Referrer-Policy`,
  `X-Content-Type-Options`, `X-Frame-Options`, `frame-ancestors 'none'` and
  `object-src 'none'` (`next.config.ts`).
- `/api/open` uses `spawn` without a shell. `/api/git` runs fixed commands with
  the path only as `cwd`, restricted to `~/Documents` after `realpath`.
  `/api/notes` sanitizes ids against path traversal.
- Narrowest Drive scope (`drive.appdata`).
- Retired secrets are cleaned up: the AI feature was removed in 0.16.0, and
  `getSettings` (`lib/settings.ts`) deletes any provider key an older version
  left in `localStorage`; the AI origins left the CSP allowlist too.
- Backups validated before restore (`lib/import.ts`).
- Markdown renderer HTML-escapes input and blocks `javascript:`/`data:` links
  (`lib/markdown.ts`).
- Local-only routes refuse other devices *and* other websites: `Host`, `Origin`
  and `Sec-Fetch-Site` checks in `lib/server/localRequest.ts`, JSON-only
  `/api/open` (0.14.4, Step 1).

**Data volume.** Real data is about 28 KB (`data/database.json` is a fixture of it).

**Repo rules to follow.**
- Version bump + `CHANGELOG.md` entry before every commit (`DEVELOPMENT.md` → Versioning).
- Read `node_modules/next/dist/docs/` before writing Next.js code (`AGENTS.md`:
  Next 16 differs from training data).
- Browser-test only on isolated ports, never against the port-3000 daily-use server.
- Work flows `development` → `main`.
- Commit attribution: follow the user's global `CLAUDE.md`.
- `.gitignore` ignores `.env*`, so committing `.env.example` needs a
  `!.env.example` exception.

---

## 4. Module requirements (condensed)

### SE_06 NoSQL, Level 1

Objectives:
- Define and adapt data models to project needs.
- NoSQL vs relational: advantages and disadvantages.
- NoSQL concepts, characteristics, significance, and limitations.
- Pros and cons of the NoSQL types (document, key-value, graph, wide-column).
- Use a query or full-text search function.
- Optimize the data structure for huge amounts of data, performance, efficiency.
- Access the database from code both directly (plain driver objects) and
  through a framework.
- Understand and apply replication, distribution, sharding, resilience.

Hand-ins:
- Repo link. If private, read access for GitHub user `peterruppel`. One project only.
- A real data layer serving the listed use cases in a working app, not a demo script.
- Docs: project description and implemented use cases (mark unimplemented
  ones); README with dev setup, above all how to set up or connect to the
  database; a clear diagram of the model with attributes and types; a
  non-trivial model; how much data, and how it was generated.

Oral: 1:1, 15–30 min. Overview and demo, then Q&A. Laptop open and ready.

### Cyber Security

Level 1 objectives:
- Dimensions of cyber security.
- Perform a threat model analysis.
- Threats and mitigations per layer (physical, network, transport, application).
- Understand and apply authentication, authorization, validation, encryption,
  signing, key management.
- Secure web applications.
- Secure the development life cycle and operations.

Level 2 adds: comprehensively secure a *live* app (outside local dev) and its
life cycle and operations.

Hand-ins: codebase (same access rule); project and code documentation; a
**threat model description**; a **list of implemented security measures**.

Oral: in person, 1:1, 15–30 min. A **5-minute technical presentation on the
security methods applied**, then Q&A. Example questions are mapped in §6.

---

## 5. Steps

The order assumes both exams are some weeks out. If the security exam comes
first, do Steps 3 and 6 before Step 5.

### Step 0: Kickoff check (do this first, every time)

1. `git log` and `CHANGELOG.md` since v0.14.3: list the user's product changes.
2. Re-read `lib/types.ts`, `lib/localDb.ts`, `lib/workspaceRepo.ts`,
   `lib/merge.ts`, `lib/googleDrive.ts`. Update §3 and the model in Step 4e for
   anything that moved.
3. Step 1 was done in 0.14.4 (2026-09-10). Confirm it's committed and merged.
4. Ask the user the open questions in §7.
5. Check current versions and compatibility before choosing libraries: MongoDB
   server and Node driver, Mongoose, `google-auth-library` (or `jose`), each
   against Next 16's docs.
6. Update this plan, then start.

### Step 1: Fix CSRF on the localhost-only routes (security): DONE in 0.14.4

**Finding.** `isLocalRequest` only checked the `Host` header. A page on any
website can send a request to `http://localhost:3000/api/open`, and the browser
sets `Host: localhost:3000` itself, so it passed. With `Content-Type: text/plain`
there's no CORS preflight, and `request.json()` parses the body regardless of
content type. The old comment claimed the check blocked cross-site requests; it
only blocked DNS rebinding.

Impact: while the dev server ran, any website the user visited could make the
machine `xdg-open` an arbitrary URL or file path. `/api/git` and `/api/notes`
(GET) could also be triggered cross-site, though their responses can't be read.

**What was done** (2026-09-10):
- `lib/server/localRequest.ts`: `Host` is parsed as a URL, which also fixes
  `[::1]` (it never matched before). `Origin`, when present, must equal the
  request's own origin. `Sec-Fetch-Site`, when present, must be `same-origin`
  or `none`. The comment says what each check blocks and the gap that remains
  (a raw client on the LAN can forge every header under `dev:lan`).
- `app/api/open/route.ts`: requires `Content-Type: application/json` (415 otherwise).
- `lib/__tests__/localRequest.test.ts`: 16 cases.
- README's "Local-only Endpoints" line and `CHANGELOG.md` 0.14.4.

**Verified.**
- Unit tests, and the full suite, `tsc` and lint.
- curl on an isolated port (Appendix B).
- A real browser: a no-CSP attacker page on `http://127.0.0.1:8123` sent a
  no-cors `text/plain` POST to `/api/open` and a GET to `/api/git`. Before the
  fix, the server log showed 400 and 404 (both reached the handlers). After it,
  403 and 403. The app's own same-origin requests still work.

**Deliberately not done:** `-c core.fsmonitor=false` for `/api/git`. It covers
only one of several ways a planted `.git/config` can run commands (clean
filters are another), and the same repo would run them anyway as soon as the
user opens it with a git-aware shell prompt. Recorded as an accepted risk in Step 3.

**For the exam.** This is the first item on the measures list, and the
found → reproduced → fixed → tested story opens the 5-minute presentation.
Appendix B has the demo.

### Step 2: Product changes (the user, before this plan starts)

Anything that changes what's stored must be reflected in Step 4e's model.
UI-only changes don't affect this plan.

### Step 3: Threat model (security)

Model the *planned* system (after Step 4), not just today's.

**Method.** A data-flow diagram with trust boundaries, then STRIDE for each
element and flow. OWASP Threat Dragon is optional (it saves a JSON model plus
the diagram). Each threat gets: description, affected asset, likelihood ×
impact, mitigation, and status (implemented / planned / accepted, with reason).

**Elements.**
- Browser: IndexedDB data; `localStorage` holding the Drive token and GitHub
  token.
- Next.js API on Vercel.
- MongoDB (Atlas when deployed, Docker locally).
- Google OIDC.
- GitHub API.
- The local dev server and host machine (`/api/open`, `/api/git`, `/api/notes`).

**Assets.** Users' progress and notes (personal data); Google tokens and
session cookies; the optional GitHub token; database credentials and server
secrets.

**Seed threats** (a starting list, not exhaustive):
- *Spoofing:* forged or replayed Google ID token; stolen session cookie.
- *Tampering:* altered sync payload; NoSQL operator injection
  (`{"$ne": null}`); mass assignment (a client-supplied `userId`).
- *Repudiation:* no record of who changed what. Mitigation: a minimal audit log
  of sync writes.
- *Information disclosure:* IDOR (fetching another user's track by id); XSS
  reading `localStorage` keys; error messages leaking internals (`/api/git`
  returns `error.message`); tokens in logs.
- *Denial of service:* huge sync payloads; request floods.
- *Elevation of privilege:* cross-site calls to local routes (fixed, Step 1);
  `npm run dev:lan` binds `0.0.0.0`, and a LAN attacker can forge every header
  with a raw client (open; needs a firewall); a planted `.git/config` (e.g.
  `core.fsmonitor`) running commands via `/api/git` (accepted, reasoning in Step 1).
- *Per layer:* physical (a stolen laptop; IndexedDB is unencrypted unless the
  disk is); network (who can reach Atlas; Vercel's changing IPs vs an IP
  allowlist; a host firewall when using `dev:lan`); transport (TLS everywhere,
  HSTS); application (everything above).

**Output.** `docs/security/THREAT_MODEL.md` plus the diagram. Revisit it after Step 4.

### Step 4: Google sign-in + MongoDB sync (both modules; the big one)

**4a. Infrastructure.**
- Local: `docker-compose.yml` with a 3-node replica set (`rs0`) and an init
  script. `MONGODB_URI` in `.env.local`. Commit `.env.example` (see the
  `.gitignore` note in §3), never `.env.local`.
- Deployed: Atlas free tier. The app's database user gets `readWrite` on the
  app database only. The connection string lives only in Vercel env vars. Use
  separate databases and users for preview and production.
- The free tier caps storage (512 MB last checked; verify), so the large
  generated dataset from Step 5 stays local.

**4b. Authentication (OpenID Connect).**
- Ship one OAuth client ID via `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (client IDs aren't
  secrets). Users no longer paste a client ID to sign in.
- Browser: "Sign in with Google" (GIS) returns an ID token, which goes to
  `POST /api/auth/session`.
- Server: verify the token's signature against Google's published keys, plus
  `aud` (our client ID), `iss`, `exp` and `email_verified`. Use
  `google-auth-library`'s `verifyIdToken`, or `jose` with Google's JWKS. Upsert
  the user by `googleSub`.
- Server-side sessions: a random 256-bit token in an
  `HttpOnly; Secure; SameSite=Lax` cookie. The database stores only its
  SHA-256 hash, with a TTL index on `expiresAt`. Sign-out deletes the session
  document, so revocation is real.
- Google Cloud consent screen: testing mode allows up to 100 listed test users,
  which is enough for the exam. Going public needs Google's review.
- CSP: GIS needs extra entries (at least `https://accounts.google.com/gsi/style`
  in `style-src`). Check Google's current CSP guidance and update `next.config.ts`.
- Alternative: Auth.js. Not the default, because hand-rolling the verification
  is what the exam asks about. Reconsider if Next 16 compatibility makes the
  hand-rolled path painful.

**4c. Authorization.**
- One helper (e.g. `requireUser(request)`) turns the session into a `userId`.
  Every query filters by that `userId`. Ownership never comes from the request body.
- Tests: user A cannot read or write user B's tracks, completions or notes,
  even with the same client-side track id.

**4d. Validation.**
- Validate every request body against a schema before it reaches MongoDB.
  Reject unknown keys, keys starting with `$` or containing `.`, wrong types,
  and oversized bodies. Reuse the existing hand-written style (`lib/import.ts`)
  or adopt zod (§7).
- Add `$jsonSchema` validators on each collection as a second layer.

**4e. Data model.**

`users`
- `_id: ObjectId`, `googleSub: string` (unique index), `email: string`,
  `name: string`, `createdAt: Date`, `lastSeenAt: Date`

`sessions`
- `_id: string` (SHA-256 of the cookie token), `userId: ObjectId`,
  `createdAt: Date`, `expiresAt: Date` (TTL index)

`tracks`: one document per track, with its configuration *embedded*
- `_id: ObjectId`, `userId: ObjectId`, `trackId: string` (the client's id),
  `schemaVersion: number`, `configVersion: number`, `updatedAt: Date`
- `meta: {name, color, templateId, createdAt, archived}`
- Embedded arrays: `phases[]` (each with `tasks[]` and `detailedInfo`),
  `materials[]`, `portfolio[]`, `rotations[]`, `weekSchedule[]`
- Embedded objects: `dailyTasks`, `dailyRevisionItems`, `focusTypes`,
  `panelColumns`, `hiddenPanels`, plus `roadmapContent: string`
- Indexes: unique `{userId: 1, trackId: 1}`; one text index across
  `materials.title`, `materials.author`, `phases.title` and `roadmapContent`,
  with weights (MongoDB allows one text index per collection).
- Why embedded: these lists are small (dozens of items), always read and
  written with the track, and already merged per item by `mergeAppState`.

`completions`: bucket pattern, one document per user, track and day
- `_id: ObjectId`, `userId: ObjectId`, `trackId: string`, `date: string` (`YYYY-MM-DD`)
- `tasks: [{id, done, updatedAt}]` and `revisions: [{id, done, updatedAt}]`
  replace `weeklyCompletions` + `itemUpdatedAt`
- `accomplishments: [{title, description?, updatedAt}]` replaces
  `completedItemsHistory` + `historyUpdatedAt`
- Indexes: unique `{userId: 1, trackId: 1, date: 1}`
- Why separate: history grows forever (16 MB document cap), a checkbox toggle
  shouldn't rewrite the whole track, and it's the hot path for stats.
- `streakHistory` isn't stored. Derive it with `rebuildStreakHistory` or in an
  aggregation.

`notes`
- `_id: ObjectId`, `userId: ObjectId`, `materialId: string`, `content: string`,
  `updatedAt: Date`
- Indexes: unique `{userId: 1, materialId: 1}`; text index on `content`

`auditLog` (optional; answers repudiation)
- `userId`, `at: Date`, `action`, counts of documents changed; TTL of about 90 days.

Shard key reasoning (for the docs): use `{userId: "hashed"}` on `tracks`,
`completions` and `notes`. It spreads users evenly, avoids the hot shard that a
range key on an ever-increasing `ObjectId` would create, and sends every query
that includes `userId` to a single shard. `users` and `sessions` are small:
leave them unsharded or shard on hashed `_id`.

**4f. Sync protocol.**
- `GET /api/sync` assembles the user's `Workspace` from `tracks` and
  `completions` (and notes).
- `PUT /api/sync` receives the device's workspace, then: validate →
  `migrateWorkspace` → load the stored copy → `mergeWorkspace` from
  `lib/merge.ts` → write back in **one transaction** (`bulkWrite` upserts on
  `tracks` and `completions`, write concern `majority`) → return the merged
  workspace, which the client saves with `putWorkspace`.
- Merge on the server, not the client. Two devices syncing at once then can't
  overwrite each other (a lost update), and it's a concrete example of ACID and
  consistency. Add optimistic concurrency (a version check) if transactions
  alone don't cover it.
- Before reusing `mergeWorkspace`, check its argument semantics (which side is
  "local") and the `!isSynced` overwrite path (`lib/googleDrive.ts` ~line 200).
- Notes: per-note last-write-wins on `updatedAt`, like the Drive note sync.
- Client: a `syncWithServer()` returning the same `SyncResult` shape, swapped in
  at the two call sites listed in §3.

**4g. Two access styles** (a module requirement, so give the split a reason):
- Mongoose models (schemas, validation, middleware) for `users`, `sessions`,
  `notes`, and simple track reads and writes.
- The native driver (`mongoose.connection.getClient()`, or one shared
  `MongoClient`) for sync transactions and `bulkWrite`, aggregations, and text search.
- Cache the connection across serverless invocations.

**4h. Security measures this step adds** (copy them into the measures list):
- OIDC token verification.
- Hashed server-side sessions with a TTL and real sign-out.
- Cookie flags.
- CSRF defence: SameSite cookies, an `Origin` check on state-changing routes,
  JSON-only bodies.
- Per-user query scoping.
- Input validation, including operator-key rejection.
- `$jsonSchema` validators.
- Least-privilege database user.
- Secrets only in env vars.
- TLS to Atlas.
- Rate limiting on `/api/auth/*` and `/api/sync` (mechanism: §7).
- Generic error responses; no tokens in logs.

**Ship.** Minor version bump + CHANGELOG.

### Step 5: Features that query the database (NoSQL)

- **Use case: search.** Full-text search across materials, phases, roadmap text
  and notes (`$text`, sorted by `textScore`, with field weights). A search box
  for signed-in users.
- **Use case: history and stats.** Aggregation pipelines over `completions`:
  activity per week and month, completion rate per weekday, per-track totals,
  and the longest streak (a gaps-and-islands query with `$setWindowFields`).
- **Generated data.** `scripts/seed.ts` creates thousands of users, each with
  1–3 tracks seeded from `lib/templates` and a year of daily completions with
  realistic patterns (weekday effects, streaks, lapses). Use a fixed random seed
  so it's reproducible. Record counts and sizes (`db.stats()`, `collStats`) for
  the docs.
- **Performance.** `explain("executionStats")` before and after each index, for
  completions by user/track/date range, text search, and the stats pipelines.
  Save the outputs in `docs/nosql/`.
- **Resilience demo.** With the app running on the local replica set,
  `docker stop` the primary. Show the election and the app carrying on
  (retryable writes). Explain write concern, read concern and read preference.
- **Sharding.** Document the shard key reasoning (Step 4e). Optional:
  `docker-compose.sharded.yml` (config server replica set, 2 shards, `mongos`),
  then `sh.shardCollection` and `sh.status()` on the seeded data.
- **Schema evolution.** Run `lib/migrations` on read. That's MongoDB's Schema
  Versioning Pattern, so document it as such.

### Step 6: Secure the development life cycle and operations (security)

- GitHub: Dependabot alerts and security updates, secret scanning with push
  protection, CodeQL default setup, and a ruleset on `main` (PR and passing CI
  required, no force pushes, which matches `DEVELOPMENT.md`).
- CI in `.github/workflows/ci.yml`: `npm ci`, `npx tsc --noEmit`,
  `npm run lint`, `npm test`, `npm run build`, `npm audit --audit-level=high`.
- Secrets: commit `.env.example`; scan git history for leaked secrets (e.g.
  gitleaks) and rotate anything found.
- Optional: signed commits (SSH signing), a digital-signature example in daily use.
- Operations:
  - Separate env vars and databases for preview and production.
  - Backups: the Atlas free tier may not include snapshots (verify); otherwise a
    scheduled `mongodump`.
  - Logging and alerts on auth failures.
  - A runbook for revoking sessions (delete them).
  - Check HSTS on the deployed domain.

### Step 7: Documentation and hand-ins

**NoSQL** (README plus `docs/nosql/`):
- Project description and use cases, each marked implemented or not yet.
- Dev setup: `docker compose up`, env vars, seed, `npm run dev`; how to connect to Atlas.
- Model diagram with attributes and types, making embedded vs referenced data
  obvious; indexes and shard key.
- Design decisions: embedding vs referencing; the bucket pattern; schema
  versioning; why not one document per user (16 MB cap, rewriting everything on
  each change); NoSQL vs relational (Appendix A); document vs
  key-value/graph/wide-column for this data.
- Data volume, and how it was generated.

**Security** (`docs/security/`):
- `THREAT_MODEL.md` (Step 3, updated after Step 4).
- `MEASURES.md`: every implemented measure, with the file that implements it
  and the threat it answers (§3 list, Step 1, Step 4h, Step 6).
- Code documentation: keep the existing habit of explaining security decisions
  in comments.

**Hand-in admin (the user does these):** give `peterruppel` read access if the
repo is private; submit through the Learning Platform form.

**Oral prep:**
- A 5-minute security talk: threat model → the CSRF story → sign-in and
  authorization → validation → development life cycle.
- A NoSQL demo script: search → stats → failover → `explain`.
- Rehearse §6.

---

## 6. Exam question map (security)

| Question | Answer from Horizon |
|---|---|
| Confidentiality, integrity, authenticity, availability, non-repudiation | Map each to threat-model entries. Non-repudiation: the audit log, and its limits. |
| Symmetric vs asymmetric encryption | TLS: an ECDHE key exchange (asymmetric) produces AES-GCM session keys (symmetric). Atlas encryption at rest. RS256 signatures on Google ID tokens. |
| Authentication: how it works in your app | OIDC with Google → server-verified ID token → hashed server-side session. |
| Authorization: how it works in your app | Per-user query scoping; least-privilege database user; OAuth scopes (`drive.appdata`) as delegated authorization. |
| OAuth 2.0 | The existing Drive connection: an access token for one scope, with no identity. |
| OpenID Connect | The new sign-in: an ID token, signed by Google, that says who the user is. |
| Input validation | Sync schema validation with operator-key rejection; the backup import validator; markdown escaping. |
| CSRF | The Step 1 finding, and the SameSite + `Origin` defence on the new routes. |
| Database injection | NoSQL operator injection and its mitigation; no shell in `/api/open`. |
| Which threats are still open | Threat-model entries marked "accepted", e.g. `'unsafe-inline'` in `script-src`, tokens in `localStorage`. |
| TLS and its keys | The server certificate's key pair, ephemeral ECDHE key pairs on both sides, and the derived symmetric session keys. Be ready to count them. |
| Digital signatures | Google ID tokens (RS256 + published keys), TLS certificates, signed commits. |
| Securing a machine at layer 3 | A host firewall (relevant because `dev:lan` binds `0.0.0.0`); Atlas's network access list. |

---

## 7. Open questions for kickoff

1. Exam dates and order: decides whether Steps 3 and 6 come before Step 5.
2. Security target level. Level 2 means comprehensively securing the live
   Vercel deployment.
3. Google Drive sync: remove it, or keep it as an optional "back up to Drive"?
4. Auth: hand-rolled OIDC verification with Mongo sessions (the default), or Auth.js?
5. Rate limiting on Vercel: which mechanism?
6. Is the GitHub repo public? Probably not: on 2026-09-10 GitHub's public API
   returned 404 for it, so the assessor needs read access (`peterruppel`). If
   it is public, don't push threat-model details for issues that aren't fixed yet.
7. Validation: zod, or the existing hand-written style?

---

## Appendix A: Relational counterpart (for the NoSQL vs relational comparison)

The Postgres schema from the 2026-09-10 discussion:

```
tracks          id, user_id, name, color, template_id, archived, settings jsonb
phases          id, track_id, position, title, description, recommended_by_day, detailed_info jsonb
phase_tasks     id, phase_id, position, title, completed
materials       id, track_id, title, author, category, status, current_page, total_pages, link, updated_at
phase_materials phase_id, material_id                                  -- the many-to-many
day_items       id, track_id, weekday, kind, position, title
completions     track_id, date, item_id, done, updated_at
accomplishments track_id, date, title, description, updated_at
```

Talking points:
- The relational version gets foreign keys and cascades for consistency, plus
  joins and SQL window functions for stats. But it needs a mapper between the
  nested `TrackState` and rows, and every schema change is a migration.
- The document version matches the app's shape and reuses `lib/merge.ts`. But
  consistency across collections (e.g. deleting a track's completions) becomes
  the application's job.

---

## Appendix B: Reproducing the Step 1 finding

Start a dev server on an isolated port (e.g. `npx next dev -p 3007`), then:

```bash
# Pretends to be a cross-site request. Before the fix: 400 "No link provided"
# (the guard passed and the body was parsed). After the fix: 403.
curl -s -i -X POST http://localhost:3007/api/open \
  -H 'Origin: https://evil.example' -H 'Sec-Fetch-Site: cross-site' \
  -H 'Content-Type: text/plain;charset=UTF-8' --data '{}'

# Addressed to a LAN IP. Expected: 403 both before and after the fix.
curl -s -i -X POST http://localhost:3007/api/open \
  -H 'Host: 192.168.0.253:3007' -H 'Content-Type: text/plain;charset=UTF-8' --data '{}'
```

Leave `link` out so nothing opens on the machine.

**Real-browser demo** (how the fix was confirmed; also good for the oral exam):

1. Serve a page with no CSP from another origin, e.g.
   `python3 -m http.server 8123 --bind 127.0.0.1` in a folder holding an HTML
   file whose script runs:
   ```js
   fetch("http://localhost:3007/api/open?probe=csrf", {
     method: "POST", mode: "no-cors",
     headers: { "Content-Type": "text/plain" }, body: "{}",
   });
   ```
2. Open it in the browser and watch the Next dev server's log. Before the fix
   it shows `POST /api/open?probe=csrf 400`; after, `403`. The page itself
   can't see the response (no-cors), which is why an attacker doesn't need to.

Don't use Horizon itself on another origin as the attacker page: its own CSP
(`connect-src 'self'`) blocks the request before it leaves the browser.
