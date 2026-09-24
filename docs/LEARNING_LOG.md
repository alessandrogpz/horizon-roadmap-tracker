# Horizon learning log

A record of how Horizon's database and security work was built, written to
learn from and to prepare the two oral exams (SE_06 NoSQL, Cyber Security).
One entry per step, oldest first. Each entry has the same parts:

- **What changed**: the result, in a few lines.
- **Why**: the problem it solves.
- **Concepts**: the ideas behind it, in plain words. This is exam material.
- **See it yourself**: commands and clicks to watch it work.
- **Exam questions**: questions this step lets you answer, with the short answer.
- **Files**: where it lives.

The other documents, and what each one is for:

| Document | What it's for |
|---|---|
| `MODULES_PLAN.md` | The plan: every step, its status, and the decisions behind it |
| `docs/security/THREAT_MODEL.md` | Every threat, how likely and how bad, and how it's handled |
| `CHANGELOG.md` | What changed in each version, from a user's point of view |
| This file | What each step teaches |
| `docs/ORAL_PREP.md` | The exam day: checklist, the 5-minute security talk, the NoSQL demo, the question maps |
| `docs/DEPLOY.md` | Putting accounts and sync live on horizonroadmap.com |

## Entries

1. [Keeping other websites off the local routes (0.14.4)](#1-keeping-other-websites-off-the-local-routes-0144)
2. [Checking the plan against the code (Step 0)](#2-checking-the-plan-against-the-code-step-0)
3. [The threat model (0.17.1)](#3-the-threat-model-0171)
4. [A local MongoDB replica set (0.17.1)](#4-a-local-mongodb-replica-set-0171)
5. [Sign in with Google (0.18.0)](#5-sign-in-with-google-0180)
6. [Upgrading Next.js for security (0.18.1)](#6-upgrading-nextjs-for-security-0181)
7. [Syncing through the account (0.19.0)](#7-syncing-through-the-account-0190)
8. [Rate limiting, and closing the small holes (0.19.1)](#8-rate-limiting-and-closing-the-small-holes-0191)
9. [Search and statistics in the database (0.20.0)](#9-search-and-statistics-in-the-database-0200)
10. [Data at scale: seeding, explain() and failover (0.20.1)](#10-data-at-scale-seeding-explain-and-failover-0201)
11. [Deleting an account (0.21.0)](#11-deleting-an-account-0210)
12. [Securing the development life cycle (0.21.1)](#12-securing-the-development-life-cycle-0211)
13. [Going live: Atlas, Vercel and a protected `main` (0.21.4)](#13-going-live-atlas-vercel-and-a-protected-main-0214)
14. [Noticing: health checks, security counters and an encrypted backup (0.22.0)](#14-noticing-health-checks-security-counters-and-an-encrypted-backup-0220)
15. [A second platform, from the same core (0.25.0–0.27.0)](#15-a-second-platform-from-the-same-core-0250-0270)
16. [What a phone can do that a browser can't (0.26.0–0.29.0)](#16-what-a-phone-can-do-that-a-browser-cant-0260-0290)
17. [Files, and the standard library that isn't there (0.38.1–0.39.0)](#17-files-and-the-standard-library-that-isnt-there-0381-0390)

---

## 1. Keeping other websites off the local routes (0.14.4)

**What changed.** Three API routes only make sense on your own computer:
`/api/open` (opens a file or link on your desktop), `/api/git` (reads a local
repo's status) and `/api/notes`. They now refuse requests from any other
website you happen to have open.

**Why.** They used to check only the `Host` header. Any website could send a
request to `http://localhost:3000/api/open`, and the browser itself sets
`Host: localhost:3000`, so the check passed. While the dev server ran, any page
you visited could make your computer open a file or URL of its choosing.

**Concepts.**
- **Same-origin policy.** A page can *send* requests to any site, but it can
  only *read* responses from its own origin (scheme + host + port). Many
  attacks don't need to read anything; sending is enough.
- **CSRF (cross-site request forgery).** Tricking a browser into sending a
  request the user didn't intend, from another site.
- **Simple requests and preflights.** A `POST` with `Content-Type: text/plain`
  is a "simple request": the browser sends it straight away. Other content
  types, such as `application/json`, need a *CORS preflight* (an `OPTIONS`
  request asking permission), which our server never grants.
- **`Origin` and `Sec-Fetch-Site`.** Browsers add these headers themselves,
  and page scripts can't change them. `Origin` names the site that sent a POST;
  `Sec-Fetch-Site` says `same-origin`, `same-site`, `cross-site` or `none`.
- **The fix is defence in depth:** the Host check (stops other devices and DNS
  rebinding), the Origin check, the Sec-Fetch-Site check, and JSON only for
  `/api/open`.

**See it yourself.** `MODULES_PLAN.md` Appendix B has the `curl` commands, and
a page on another origin that tries the attack: 403 now, where it used to get
through.

**Exam questions.**
- *What is CSRF, and how did you defend against it?* Another site makes the
  browser send a request. The route checks `Origin` and `Sec-Fetch-Site`, and
  accepts only JSON, which forces a preflight the server never approves.
- *Why wasn't checking `Host` enough?* The browser sets `Host` from the URL
  it's sending to, so a request *to* localhost from any site carries
  `Host: localhost`.

**Files.** `lib/server/localRequest.ts`, `app/api/open/route.ts`,
`lib/__tests__/localRequest.test.ts`.

---

## 2. Checking the plan against the code (Step 0)

**What changed.** Before any new code, every assumption in the plan was
re-checked against the code as it stood (v0.17.0): which files changed since
the plan was written, which library versions are current, and whether the repo
is private.

**Why.** Plans go stale. Your Notepad and To-do List (0.17.0) had added a new
kind of note, which changed the planned database model.

**Concepts.** Verify before building. A decision recorded with its reason
("MongoDB, because the data is already document-shaped") can be re-checked
later; a bare decision can't.

**Files.** `MODULES_PLAN.md`, Step 0.

---

## 3. The threat model (0.17.1)

**What changed.** `docs/security/THREAT_MODEL.md`: a map of Horizon (today's,
plus the planned server and database), every way it could be attacked, how
likely and how bad each is, and what's done about it.

**Why.** Security by design: decide what to defend *before* building the
server, so the defences are part of the design rather than patches.

**Concepts.**
- **Data-flow diagram (DFD).** Who takes part, where data is stored, how it
  moves.
- **Trust boundary.** A line where data passes between different levels of
  trust: browser to server, server to database, your origin to other
  websites. Most attacks happen at a boundary.
- **STRIDE.** A checklist of six kinds of threat: Spoofing, Tampering,
  Repudiation, Information disclosure, Denial of service, Elevation of
  privilege. Each one breaks a security goal: authenticity, integrity,
  non-repudiation, confidentiality, availability, authorization.
- **Risk = likelihood × impact**, rated *before* the fix, so the rating shows
  how much the fix matters.
- **Accepted risk.** Leaving something as it is, on purpose, with a written
  reason. Also a valid decision, as long as it's explicit.

**See it yourself.** Open the threat model and start with "Highest risks" at
the top, then the diagram in §3.

**Exam questions.**
- *Walk me through your threat model.* The diagram and its six trust
  boundaries, then STRIDE per element, then the top risks and their fixes.
- *Which risks did you accept, and why?* §9: Atlas reachable from any IP (the
  free tier has no private networking), `'unsafe-inline'` scripts (needed by
  Next), and others, each with a reason.
- *What are the dimensions of security?* The six goals above; §8 maps every
  threat to one of them.

**Files.** `docs/security/THREAT_MODEL.md`.

---

## 4. A local MongoDB replica set (0.17.1)

**What changed.** `npm run db:up` starts MongoDB on your computer in Docker:
three servers holding the same data (a *replica set*), with logins required
and passwords generated for you.

**Why.** Sync needs transactions, and MongoDB only offers them on a replica
set. It's also the same shape Atlas runs in production, and it's how the
failover demo works.

**Concepts.**
- **Document database.** MongoDB stores JSON-like *documents* in
  *collections*, with no fixed table layout. Horizon's data is already shaped
  like that: one track holds its phases, which hold their tasks.
- **Replica set.** Several servers with the same data. One is the *primary*
  and accepts writes; the *secondaries* copy everything it does from its
  *oplog* (operation log).
- **Election.** When the primary disappears, the remaining members vote for a
  new one. A majority must agree: with three members, two are enough, so one
  can fail without stopping anything.
- **Why transactions need a replica set.** They're built on the replication
  machinery, so a single standalone server doesn't offer them.
- **Authentication vs authorization.** Authentication is proving who you are
  (the password). Authorization is what you're then allowed to do (the role).
- **Least privilege.** The app's user, `horizon_app`, has `readWrite` on the
  `horizon` database and nothing else. A bug or an injection in the app can
  only reach the app's own data. The tests prove the refusals.
- **Key file (internal authentication).** The three servers prove to each
  other that they belong to the set using a shared secret. It's generated
  randomly, readable only by the database's own user, and never committed.
- **Localhost exception.** A brand-new database with no users lets a client on
  the same machine create the *first* user, and nothing else. After that,
  everyone must log in.
- **Secrets handling.** Passwords live in git-ignored files (`.env.docker`,
  `.env.local`) readable only by you (mode 600). The app is only ever given
  its own password, never root's.
- **Bind address.** The servers listen on `127.0.0.1` only, so no other device
  on your network can connect.

**See it yourself.**
```bash
npm run db:up
```
- Which server is the primary right now (no login needed):
  `docker compose exec mongo1 mongosh --quiet --port 27017 --eval 'db.hello().primary'`
- Failover: stop whichever member is primary (`mongo1` is port 27017,
  `mongo2` 27018, `mongo3` 27019), e.g. `docker compose stop mongo2`, then ask
  again: a new primary within seconds. `docker compose start mongo2` brings it
  back as a secondary.
- Browse the data: MongoDB Compass, with `MONGODB_URI` from `.env.local`.

**Exam questions.**
- *What is a replica set, and what happens when the primary fails?* Three
  copies. The others elect a new primary by majority, and the driver follows
  it. Writes using retryable writes carry on.
- *Why three members and not two?* An election needs a majority. With two
  members, losing one leaves no majority, so no primary.
- *How is the database secured?* Login required, a least-privilege app user,
  a key file between members, listening on localhost only, and secrets kept
  out of git.

**Files.** `compose.yaml`, `docker/mongo-init.js`, `scripts/dev-env.mjs`.

---

## 5. Sign in with Google (0.18.0)

**What changed.** Settings → Account has Google's sign-in button. Signing in
creates your Horizon account on the server and keeps you signed in with a
session cookie. Syncing through the account comes next.

**Why.** Syncing to a server needs to know whose data is whose. Google proves
who you are, so Horizon never handles a password.

**Concepts.**
- **OAuth 2.0 vs OpenID Connect.** OAuth 2.0 gives an app *permission* to do
  something on your behalf: Drive sync's access token can touch Horizon's
  Drive folder, but says nothing about who you are. OpenID Connect adds
  *identity* on top: an **ID token** saying which Google account signed in.
- **JWT.** The ID token is a JSON Web Token: `header.payload.signature`, each
  part base64url-encoded. Anyone can *read* the payload; the signature is what
  makes it trustworthy.
- **Asymmetric signatures (RS256).** Google signs with a private key only it
  holds, and publishes the matching public keys (a **JWKS**, JSON Web Key
  Set). Our server checks the signature with the public key, so only Google
  could have made the token and nobody changed it since.
- **The claims we check:**
  - `iss`: Google issued it.
  - `aud`: it was issued *to Horizon*. Without this check, a genuine token
    from any other app using Google sign-in would log someone in here.
  - `exp`: not expired.
  - `email_verified`: Google has confirmed the address.
  - `sub`: Google's permanent id for the account. Users are identified by
    this, never by email, because email addresses can change hands.
- **Algorithm confusion.** Old attacks tricked servers into accepting
  `alg: none` (no signature) or HS256 keyed with the *public* key. We accept
  RS256 only, and there are tests for both attacks.
- **Sessions.** After checking the token once, the server creates a
  **session**: a random 256-bit value in a cookie. The database stores only
  its SHA-256 hash, so a leaked `sessions` collection holds nothing a browser
  could use.
- **Why SHA-256 is fine here, but not for passwords.** Passwords are short and
  guessable, so they need slow, salted hashes (bcrypt, argon2). A 256-bit
  random token can't be guessed, so a fast hash is enough.
- **Cookie flags.**
  - `HttpOnly`: scripts can't read it, even injected ones.
  - `Secure`: sent over HTTPS only.
  - `SameSite=Lax`: not sent with other sites' POSTs.
  - The `__Host-` name prefix: the browser refuses the cookie unless it's
    Secure, for the whole site, and tied to exactly this host.
- **Revocation.** Because the session lives on the server, signing out
  deletes it, and a copied cookie stops working. A self-contained token
  (like a JWT kept in the browser) can't be taken back like that.
- **TTL index.** MongoDB deletes each session document by itself once its
  `expiresAt` passes. The check runs about once a minute, so lookups also
  compare the date.
- **Input validation (zod).** The request body must be exactly
  `{"credential": "<string>"}`: extra keys, wrong types and oversized bodies
  are refused before anything touches the database. That's allowlisting:
  describe what's allowed, refuse everything else.
- **NoSQL operator injection.** If `{"$ne": null}` reached a query where a
  plain value belonged, "find this user" would become "find any user".
  Mongoose's `sanitizeFilter` neutralises that on every Mongoose query. It
  doesn't cover the native driver, so validation must always come first. One
  test shows both behaviours.
- **Generic errors, careful logs.** Clients get "Sign-in failed." and nothing
  more. Logs record only a reason code, never a token.
- **CSP and images.** The Content-Security-Policy no longer allows images from
  other sites. Otherwise injected script could leak data inside an image URL,
  getting around the rule that limits where the page may connect.
- **Testing in layers.** Fast unit tests with fake Google keys, then database
  tests (`npm run test:db`) against the real local replica set, as a separate
  user on a separate database.

**See it yourself.**
- Sign in: Settings → Account.
- The cookie: browser devtools → Application (Chrome) or Storage (Firefox) →
  Cookies → `__Host-horizon_session`. Note its flags.
- The hash: copy the cookie's value, then
  `node -e 'console.log(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' '<value>'`.
  The result is the session's `_id` in Compass (`horizon` → `sessions`).
- Sign out: the session document disappears.
- Hostile requests, with the app running on port 3007:
  `curl -X POST -H 'Origin: https://evil.example' -H 'Content-Type: application/json' --data '{}' http://localhost:3007/api/auth/session`
  gets 403.

**Exam questions.**
- *How does authentication work in your app?* OpenID Connect with Google. The
  server verifies the ID token's signature and claims, then issues its own
  session cookie, stored hashed server-side.
- *OAuth 2.0 or OpenID Connect?* Both. Drive sync uses OAuth 2.0 (an access
  token for one scope); sign-in uses OpenID Connect (an ID token that says who
  you are).
- *What is a digital signature, and where do you use one?* A value only the
  private key's holder can make and anyone can check with the public key.
  Google's ID tokens are one (RS256), as are the TLS certificates.
- *How do you prevent NoSQL injection?* Strict validation of every body, plus
  `sanitizeFilter` on Mongoose queries.
- *What happens if someone steals the session database?* They get SHA-256
  hashes of random tokens: useless for signing in.

**Files.** `lib/server/auth/` (token check, sessions, the API handlers),
`lib/server/http.ts` (request checks), `lib/server/db.ts`,
`lib/server/models.ts`, `components/AccountRow.tsx`,
`lib/__tests__/googleIdToken.test.ts`, `lib/__tests__/auth.db.test.ts`.

---

## 6. Upgrading Next.js for security (0.18.1)

**What changed.** Next.js went from 16.2.7 to 16.3.4, and `npm audit` went
from 10 known vulnerabilities (1 critical, 6 high) to 0.

**Why.** The critical one, a way around middleware/proxy checks, didn't
affect Horizon, which has neither middleware nor Server Actions. But "not
exploitable today" can change with the next feature, so it was fixed while it
was cheap.

**Concepts.**
- **Supply chain.** Most of the code Horizon runs is other people's: 414
  packages installed from npm. 50 of them run in the app itself; the rest are
  build and test tools, which run on your computer and on the build server. A
  flaw in any of them is a flaw in Horizon.
- **Advisories and exploitability.** `npm audit` compares installed versions
  with a database of known vulnerabilities. Each finding deserves the question
  "can it actually be reached here?"; the answer sets the urgency, not
  whether to fix it.
- **Version ranges and the lockfile.** `package.json` says which versions are
  acceptable (`^9.9.5` means 9.9.5 or any later 9.x). `package-lock.json`
  records exactly which versions were installed, so every machine and every
  build gets the same code. Next is pinned to an exact version, because
  framework upgrades should be deliberate.
- **Install scripts.** npm can run a package's own scripts during install, a
  common attack path. This npm blocks them unless allowed; it blocked two
  (`sharp`, `unrs-resolver`) and the app works without them.
- **Lint rules as guardrails.** 16.3.4's lint config flags
  `window.location.assign()` for internal pages, and suggests
  client-side navigation instead. Two calls do it on purpose: a full page load
  fires `pagehide`, which saves any pending edit, and "Delete local data" must
  restart the app from nothing. Each warning is suppressed with the reason
  written next to it. That's the rule: never silence a guardrail without
  saying why.

**See it yourself.**
```bash
npm audit
```
`npm ls next` shows which Next is installed.

**Exam questions.**
- *How do you keep your dependencies secure?* A lockfile, an audit before
  each release, exact pins for the framework, few runtime dependencies
  (`jose` was picked partly for having none), and install scripts blocked.
  Dependabot and an audit step in CI come in Step 6.
- *A scanner reports a critical vulnerability. What do you do?* Check whether
  it's reachable in this app, which sets the urgency, then upgrade anyway,
  test, and ship.

**Files.** `package.json`, `package-lock.json`.

---

## 7. Syncing through the account (0.19.0)

**What changed.** Signed in, the sync button at the top sends this device's
tracks and notes to the server, which merges them with the account's copy in
MongoDB and sends back the result. Two devices signed in to the same account
now stay in step. Signed out, Drive sync works as before.

**Why.** This is the heart of the NoSQL module: a real data layer, in a
working app, with a model you can defend.

**Concepts.**
- **Modelling for how the data is used.** In a document database you shape
  documents around the reads and writes, not around tables:
  - `tracks`: one document per track, with its phases, materials, rotations
    and schedule **embedded**. Those lists are small, always read and written
    together, and belong to the track.
  - `completions`: one small document per track per day (the **bucket
    pattern**). History grows forever, and a document can't exceed 16 MB.
    Ticking one box also shouldn't rewrite the whole track.
  - `notes`: one document per note, since notes can be long and change
    independently.
  - **Why not one document per user?** It would grow forever toward the
    16 MB cap, and every checkbox would rewrite everything.
- **Embedding vs referencing.** Embed what is owned, small and read together
  (a track's phases; the user's active track, kept in the `users` document).
  Reference what is large, unbounded or shared (a completion day refers to
  its track by `trackId`).
- **Never let user input become a field name.** On the device, a day's
  accomplishments are a map keyed by *title*. A title like `Read ch. 3`
  contains a `.`, which MongoDB reads as a path, and `$where` would look like
  an operator. The server turns those maps into arrays of values:
  `{title, done, updatedAt}`. Only fixed or strictly checked keys, such as
  weekday names, ever become field names.
- **Two layers of validation.** zod checks every request (strict: unknown
  fields are refused). MongoDB's own **`$jsonSchema` validators** check every
  stored document, so even a server bug can't store a malformed day. Error
  code 121 means a validator refused a document.
- **Indexes.** A compound unique index `{userId, trackId, date}` makes "one
  bucket per user, track and day" a rule the database enforces, and serves
  every query the sync makes.
- **Transactions (ACID).** The whole sync (read, merge, write tracks, days
  and notes, audit entry) is one transaction:
  - *Atomic*: all of it or none of it.
  - *Consistent*: validators and unique indexes hold after it.
  - *Isolated*: it reads a snapshot; if another transaction changed a
    document this one also writes, the commit fails and the driver reruns
    the whole thing on the newer data. That's how two devices syncing at the
    same moment both keep their changes; a test proves it.
  - *Durable*: `writeConcern: majority` means a commit is on at least two of
    the three servers, so a failover can't undo it.
- **Last-write-wins, per item.** Each tick carries the time it was made, so
  merging two devices keeps the newer state *of each box*, not of the whole
  day. An untick is kept as `done: false` with its time, otherwise a merge
  couldn't tell "unticked" from "never ticked".
- **Clocks lie.** A device whose clock runs fast would win every merge. The
  server pulls timestamps from the future back to now plus five minutes.
- **Merge on the server.** If each device merged and uploaded the result, two
  devices could overwrite each other (a *lost update*). With the merge inside
  the server's transaction, they can't.
- **Offline-first.** The device keeps its full copy and works without the
  server. An edit made while a sync is in flight isn't lost: the answer is
  merged into the newer local copy, and the next sync sends it.
- **Two access styles, each for a reason.** Mongoose, with schemas, casting
  and `sanitizeFilter`, for users, sessions and notes. The native driver for
  bulk writes of whole track and day documents in the transaction. Native
  queries don't get `sanitizeFilter`, so their only inputs are the session's
  user id and values zod already checked.
- **Authorization (IDOR).** Every query includes the signed-in user's id,
  taken from the session, never from the request. Track ids are only unique
  per user (every migrated old workspace has the same one), so without that
  filter two users' data would mix. A test with two users sharing a track id
  proves they don't.
- **Audit log with a TTL.** Each sync that changed something writes who,
  when and how many documents, and MongoDB deletes entries after 90 days.
  That's non-repudiation within limits: whoever runs the database could still
  edit the log.
- **Schema versioning.** Each track document records the schema version it
  was written at, and the app's migrations upgrade old shapes as they're
  read. That's MongoDB's *schema versioning pattern*.

**See it yourself.** With `npm run db:up` running and signed in (Settings →
Account):
- Click the sync button; it says "Synced with account".
- In Compass (`MONGODB_URI` from `.env.local`), database `horizon`:
  - `tracks`: your track, with everything embedded.
  - `completions`: one document per day you ticked something.
  - `notes`: material notes, notepads and to-do lists.
  - `auditLog`: one entry per sync that changed something.
- Tick a box, sync, and watch that day's document change.
- Failover during sync: stop the primary (see entry 4), then sync. The driver
  finds the new primary and the sync still succeeds.
- `npm run test:db` runs the two-device, two-user and simultaneous-sync
  tests.

**Exam questions.**
- *Walk me through your data model.* Four collections; embedded config;
  one bucket per day; notes separate; why each choice; which indexes.
- *Embedding or referencing: how did you decide?* By size, growth and access
  pattern. Owned, small, read together: embed. Unbounded or independent:
  separate documents.
- *Why not one document per user?* The 16 MB cap, and write amplification:
  one tick would rewrite everything.
- *How do you keep data consistent without joins and foreign keys?* One
  transaction per sync, unique indexes, and validators. Cross-collection
  consistency is the application's job, which the transaction makes safe.
- *What happens when two devices sync at once?* Snapshot isolation plus a
  write conflict makes one retry on the newer data. Both changes survive; a
  test does exactly this.
- *How do you validate data?* zod on every request, `$jsonSchema` in the
  database, and no user input ever used as a field name.
- *Mongoose or the native driver?* Both, each where it fits, as above.
- *Relational vs document for this app?* See `MODULES_PLAN.md` Appendix A:
  a relational version needs about ten tables and a mapper; the document
  version matches the app's shape.

**Files.** `lib/server/sync/` (`schema.ts`, `model.ts`, `collections.ts`,
`store.ts`, `handlers.ts`), `app/api/sync/route.ts`, `lib/serverSync.ts`,
`components/useAccount.ts`, `lib/__tests__/syncModel.test.ts`,
`lib/__tests__/sync.db.test.ts`.

---

## 8. Rate limiting, and closing the small holes (0.19.1)

**What changed.** Sign-in, the session check and sync now each allow only a
set number of requests per minute. Beyond that, the server answers
"429 Too Many Requests" and says when to try again. The four small issues the
threat model found in the local routes and in backup restore are fixed.

**Why.** Without a limit, anyone can hammer the sign-in endpoint or send
syncs in a loop: guessing, running up costs, or exhausting the free
database's 100 operations per second (threat D2). The small holes were each
low risk, but "found, rated, fixed and tested" is exactly what the security
exam wants to see.

**Concepts.**
- **Fixed-window rate limiting.** Time is cut into one-minute windows, and
  each client gets a counter per window. The counter is a MongoDB document
  whose `_id` names the route, the client and the window.
- **Atomic operations.** `$inc` with an upsert adds 1 and returns the new
  count in a single step on the server. Without that, two requests at once
  could both read "9", both write "10", and both get in. The test fires 20
  requests at once against a limit of 10: exactly 10 get through.
- **TTL indexes, again.** Old counters delete themselves, as sessions do.
- **Privacy by design.** The counter stores a SHA-256 of the IP address,
  never the address, and lives for two minutes.
- **Trusting headers.** The client's address comes from a header. On Vercel
  that header is set by Vercel's edge and can't be forged; behind a different
  proxy it could be. Knowing *why* a value can be trusted is part of the
  design.
- **Information leaks through differences.** `/api/git` used to answer 404
  for a missing path and 403 for a forbidden one, so its answer told you
  whether *any* path on the computer existed. Now the permission check runs
  first, so every forbidden path gets the same answer. This is the same idea
  as "invalid username or password" instead of saying which was wrong.
- **Argument injection.** `/api/open` passes the link to `xdg-open` without
  a shell, which stops shell injection, but a link starting with `-` would
  still be read as an *option*. Refusing those closes it.
- **Validate at every way in.** A backup file is input too: note contents
  must be text, and note ids must look like ids the app makes.
- **Log refusals, but not floods.** Only the first refusal per client per
  window is logged, and without the address, so an attack can be spotted
  without the logs becoming the next problem.

**See it yourself.** With the app running on port 3007 (`npx next start -p
3007`):
```bash
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code} " -X POST -H 'Origin: http://localhost:3007' -H 'Content-Type: application/json' --data '{"credential":"x"}' http://localhost:3007/api/auth/session; done; echo
```
Ten 401s, then a 429. Then look at `rateLimits` in Compass: one small
document, deleted within two minutes.

**Exam questions.**
- *How do you protect against brute force and denial of service?* Rate
  limits per address and per account, counted atomically in MongoDB, plus
  Vercel's platform protection in front.
- *Why is `$inc` important here?* It's atomic: concurrent requests can't
  lose counts. A read-then-write would.
- *Give an example of an information leak you fixed.* The 404-versus-403
  difference in `/api/git`.
- *What's argument injection, and how is it different from shell
  injection?* No shell is involved, but the called program still parses
  options, so a value starting with `-` changes what it does.

**Files.** `lib/server/rateLimit.ts`, `lib/server/collections.ts`,
`app/api/git/route.ts`, `app/api/open/route.ts`, `app/api/notes/route.ts`,
`lib/import.ts`, `lib/__tests__/rateLimit.db.test.ts`,
`lib/__tests__/localRoutes.test.ts`.

---

## 9. Search and statistics in the database (0.20.0)

**What changed.** Signed in, the menu has **Search & insights**. It offers
full-text search across your tracks, materials, phases, roadmaps and notes,
and your history: active days, how often each weekday is active, active days
per month, and each track's longest streak. MongoDB computes both on the
server.

**Why.** The NoSQL module asks for a query or full-text search function, and
for real use of the database's own processing power. These are the two use
cases the model was designed around.

**Concepts.**
- **Text indexes and `$text`.** A text index splits text into words, drops
  common ones ("the", "and"), and **stems** the rest ("books" becomes
  "book"), so a search finds the idea, not just the exact spelling. `$text`
  returns documents with a relevance score (`textScore`) to sort by.
- **Field weights.** The same word counts ten times more in a material's
  title than in the roadmap text, so results rank the way you'd expect.
- **Compound text index.** The index starts with `userId`, so every search
  must name the user, and only that user's entries are scanned. It's faster,
  and it's authorization built into the index. MongoDB allows one text index
  per collection, so choosing its fields is a real design decision.
- **The aggregation pipeline.** A query as a list of stages, each feeding the
  next, like an assembly line: `$match` (filter), `$project` (compute
  fields), `$group` (sum per weekday, per month, per track), `$sort`,
  `$limit`. The work happens in the database, next to the data; only the
  small result travels.
- **`$lookup` is a join, and needs the same care.** The per-track totals join
  in each track's name. Track ids are only unique per user, so the join
  matches on user *and* track, or it could fetch someone else's track name.
- **Gaps and islands.** The longest streak is a classic puzzle: find the
  longest run of consecutive dates. `$setWindowFields` numbers each active
  day within its track (1, 2, 3, …). On a run of consecutive days, *day
  number minus that rank* stays the same; any gap changes it. So grouping by
  that difference gives one group per run, and the biggest group is the
  streak. A test checks it against a plain loop over a year of random days.
- **Counting what you mean.** A date active on two tracks is still one active
  day. The first version double-counted; a stage that groups per date first
  fixed it, before anyone saw a wrong number.
- **Charts that say the same thing to everyone.** A single series in one
  colour, bars growing from a common baseline, and a tooltip on hover *and*
  keyboard focus. Every chart has a table view, so no number depends on a
  mouse.

**See it yourself.**
- Sign in, sync, then menu → **Search & insights**. Type a word from a book
  title; try its plural too.
- In `mongosh` (`npm run db:shell`), look at the plan for a search:
  `db.tracks.find({ userId: ObjectId("…"), $text: { $search: "rendering" } }).explain("queryPlanner")`.
  The winning plan uses the index `user_track_text`.
- The pipelines are in `lib/server/insights/stats.ts`, one stage per line.
  Paste one into Compass's Aggregations tab to watch each stage's output.

**Exam questions.**
- *How does full-text search work in MongoDB?* A text index (tokenised,
  stop words removed, stemmed), `$text` queries, `textScore` for ranking,
  and field weights.
- *Why does the text index start with `userId`?* The search only scans that
  user's entries, and it can't return anyone else's.
- *Walk me through an aggregation pipeline.* `byMonth`: match the user,
  compute per-day figures, group per date, then per month, sort, and limit to
  12.
- *How do you find the longest streak?* Gaps and islands with
  `$setWindowFields`, as above.
- *Is there a join in MongoDB?* `$lookup`. It's here, scoped by user as well
  as track.

**Files.** `lib/server/insights/search.ts`, `lib/server/insights/stats.ts`,
`lib/server/insights/handlers.ts`, `lib/server/collections.ts` (the text
indexes), `components/InsightsModal.tsx`, `lib/__tests__/insights.db.test.ts`.

---

## 10. Data at scale: seeding, explain() and failover (0.20.1)

**What changed.** Three scripts, and the documents they produce in `docs/nosql/`:
- `npm run db:seed` generates 2,000 users with a year of activity: 572,152 day documents.
- `npm run db:explain` measures the app's queries on that data, with and without their indexes.
- `npm run demo:failover` stops the primary server in the middle of a stream of writes, and proves
  nothing is lost.

Plus `MODEL.md` (the model, with its diagram) and `RESILIENCE.md`.

**Why.** A model is only as good as its behaviour on real volumes, and the exam asks for data size, how
it was generated, performance, and replication. Numbers beat claims.

**Concepts.**
- **Reproducible test data.** A seeded random generator produces the same "random" data every run, so
  anyone can regenerate the exact dataset behind the documented numbers. The data is shaped like real
  habits, not uniform noise, and built by the app's own code, so it has the real model's shape and passes
  the real validators.
- **Compression.** 231 MB of day documents take 43 MB on disk: the storage engine (WiredTiger) compresses
  data blocks. Many similar small documents compress well.
- **Indexes cost space.** On the generated data the tracks' text index is almost three times the size of
  the tracks on disk. Every index also slows writes a little, so an index must pay for itself in reads.
- **`explain()`** shows how MongoDB will run a query (`queryPlanner`) and how it went
  (`executionStats`). The key numbers are keys examined, documents examined, and documents returned. A
  good plan examines about as many as it returns. `COLLSCAN` means every document was read.
- **The results.** The app's per-user queries go from reading all 572,152 documents (about 200 ms) to
  reading only that user's (1 to 7 ms), 30 to 350 times faster. And it stays that fast however many users
  there are.
- **The ESR rule.** In a compound index, put **E**quality fields first, then **S**ort, then **R**ange.
  Measured: over a year, an index starting with `date` examined 1,421 keys to return 336; the app's
  `{userId, trackId, date}` examined exactly 336.
- **Failover, measured.** A graceful stop elected a new primary in 0.3 s; a crash took 10.8 s (the
  election timeout). Neither lost a single acknowledged write, because every write asked for `majority`,
  and the one write caught mid-crash was retried by the driver (a retryable write) and succeeded.
- **Write concern, read concern, read preference.** When a write counts as done, which data a read may
  see, and which server answers. Explained with the app's own choices in `RESILIENCE.md`.
- **Sharding.** Designed, not deployed: `{userId: "hashed"}`, so every query hits one shard and users
  spread evenly. Why not the date: every new write would land on the same "last" shard.

**See it yourself.**
```bash
npm run db:seed
npm run db:explain
npm run demo:failover
npm run demo:failover -- --crash
```
Then read `docs/nosql/PERFORMANCE.md` and open any file in `docs/nosql/explain/`. They're the raw
`explain()` output; look for `"stage"` and `"totalDocsExamined"`.

**Exam questions.**
- *How much data did you test with, and how was it generated?* 2,000 users and 572,152 day documents,
  from `scripts/seed.ts` with a fixed seed, built by the app's own templates and mapping.
- *Show me the effect of an index.* The tables in `PERFORMANCE.md`: 572,152 documents examined without
  it, 27 with it, for the same 27 results.
- *What is the ESR rule?* Equality, then sort, then range, with the measured example.
- *What happens when the primary fails?* Election by majority: 0.3 s graceful, 10.8 s crash. Retryable
  writes and `w: majority` mean nothing acknowledged is lost. Both measured.
- *What's the difference between `w: 1` and `w: "majority"`?* A `w: 1` write can be rolled back after
  a failover; a majority write can't.
- *How would you shard this?* Hashed `userId`, and why.

**Files.** `scripts/seed.ts`, `scripts/explain.ts`, `scripts/failover.ts`, `docs/nosql/`.

---

## 11. Deleting an account (0.21.0)

**What changed.** Settings → Account → **Delete account…** deletes the account and everything it stored
on the server: tracks, progress, notes, history and sessions, from every device. The data on the device
stays, and the app keeps working without an account.

**Why.** Under the GDPR, people have a right to have their personal data erased (article 17). It was also
the one missing use case in the NoSQL documentation.

**Concepts.**
- **No cascading deletes in MongoDB.** A relational database with foreign keys can delete a user's rows
  everywhere with `ON DELETE CASCADE`. MongoDB has no foreign keys, so deleting a user leaves every
  document that points at it behind, unless the application removes them itself. Here it does, collection
  by collection, for every one that holds a `userId`.
- **Atomicity, again.** That cascade is one transaction. If anything fails halfway, nothing is deleted,
  and the account is never left half-gone.
- **Destructive actions and CSRF.** Deletion is the most damaging request the API accepts. It gets the same
  protections as sync: same-origin only, a session, a rate limit.
- **Step-up authentication.** Banks ask for your PIN again before a transfer, even when you're logged in.
  Horizon could ask for a fresh Google sign-in before deleting. It doesn't yet, and the threat model
  records why that's acceptable for now (T10): a session is hard to steal, and devices keep full copies.
- **Erasure vs. the audit log.** Deleting the account also deletes its audit entries. Keeping them would
  keep personal data the user asked to erase. The server log keeps only *how many* documents were
  deleted, with no id or email.
- **Keep the user's own copy.** Offline-first design pays off: deleting the account doesn't delete the
  user's data from their device, so nothing is lost by accident.

**See it yourself.** Sign in, sync, then Settings → Account → Delete account… → Yes. In Compass, the
account's documents are gone from `users`, `sessions`, `tracks`, `completions`, `notes` and `auditLog`,
and the app still shows your tracks. `npm run test:db` includes the four deletion tests.

**Exam questions.**
- *How do you implement "delete my data" without foreign keys?* An application-level cascade over every
  collection with the user's id, inside one transaction.
- *What stops someone else from deleting my account?* The session cookie (HttpOnly, Secure, SameSite),
  the same-origin check, and the rate limit. A fresh sign-in first would be the next step (step-up
  authentication).
- *GDPR: which rights does the app support?* Erasure (this), and access/portability through the
  .json/.zip export.

**Files.** `lib/server/account/handlers.ts`, `app/api/account/route.ts`, `components/AccountRow.tsx`,
`lib/__tests__/account.db.test.ts`.

---

## 12. Securing the development life cycle (0.21.1)

**What changed.** Every push to GitHub now runs a CI pipeline with four jobs: type checks, lint, tests,
build and a dependency audit; the database tests on a real replica set; a secret scan of the whole git
history; and static analysis. Dependabot proposes dependency updates. `npm run db:backup` makes backups,
and a restore has been tested. The security documentation is complete: `SECURITY.md`,
`docs/security/MEASURES.md` (every measure, where it lives, how it's verified) and
`docs/security/RUNBOOK.md` (what to do when something goes wrong).

**Why.** Secure code isn't enough if the way it's built and shipped isn't: a leaked password in git, an
unreviewed dependency, a push that skips the tests, a database with no backup. The Cyber Security module
asks for a secured development life cycle and operations.

**Concepts.**
- **CI (continuous integration).** A server re-runs every check on every push, in a clean environment,
  so "it works on my machine" is replaced by evidence. A *ruleset* on `main` can then refuse any change
  whose checks fail.
- **Supply chain security.** Most of Horizon's code is other people's. The defences:
  - A lockfile (`npm ci` installs exactly those versions).
  - `npm audit` (known vulnerabilities).
  - `npm audit signatures`: each package is verified as signed by the npm registry, and 111 also carry
    *provenance*, proof of which source and build produced them.
  - Dependabot, which proposes updates.
  - In the pipeline itself: GitHub Actions pinned to a commit hash (a tag like `v7` can be moved to
    other code; a hash can't), scanner images pinned by digest, and a job token that can only read.
- **Secret scanning.** gitleaks searches every commit ever made for things that look like passwords,
  keys and tokens. Deleting a secret in a later commit doesn't remove it from history, so the scan covers
  all 149 commits. Result: none. The real protection against a leak is *rotation* (RUNBOOK §3).
- **SAST (static application security testing).** Semgrep reads the code, without running it, for known
  dangerous patterns: injection, unsafe `eval`, hard-coded secrets, OWASP Top 10 issues. 113 rules on 147
  files: 0 findings. GitHub's own CodeQL isn't available for private repositories on a personal account,
  so this is the open alternative.
- **Backups are only real once restored.** The first restore attempt "succeeded" and restored nothing: a
  database name in the connection string silently overrode the target. Found on test data, fixed, and
  written into the runbook, rather than discovered during an emergency. The second restore brought back
  all 587,578 documents.
- **A runbook** turns panic into steps: revoke sessions, rotate a password, restore a backup, handle a
  vulnerable dependency.
- **Least privilege, everywhere.** The CI token reads only; each database user reaches one database; the
  backup file is readable only by its owner.

**See it yourself.**
- GitHub → the repository → **Actions**: each push's four jobs.
- `npm audit`, then `npm audit signatures`.
- The same scans CI runs, locally: the two `docker run` commands in `.github/workflows/ci.yml`.
- `npm run db:backup`, then the restore command from RUNBOOK §4 into a scratch database.

**Exam questions.**
- *How do you secure your development life cycle?* CI on every push, dependency audit and signatures,
  Dependabot, secret scanning, SAST, pinned actions, a read-only CI token, and a protected `main`.
- *What would you do if a password leaked into git?* Rotate it first, then remove it from the history
  and re-scan (RUNBOOK §3).
- *How do you know your backups work?* A restore was tested, and the first attempt revealed a real
  pitfall.
- *What is a software supply chain attack, and what's your defence?* Malicious code arriving through a
  dependency or the build. The defences are the ones listed above.

**Files.** `.github/workflows/ci.yml`, `.github/dependabot.yml`, `scripts/backup.ts`, `SECURITY.md`,
`docs/security/MEASURES.md`, `docs/security/RUNBOOK.md`.

---

## 13. Going live: Atlas, Vercel and a protected `main` (0.21.4)

**What changed.** Accounts, sync, search and statistics went live at horizonroadmap.com on 2026-09-22.
The database is a MongoDB Atlas free cluster in Frankfurt; the server code runs in Vercel's Frankfurt
region; `main` went from 0.17.0 to 0.21.3 in one fast-forward, and is now protected by a GitHub ruleset.
Nothing in the application code changed: the same `MONGODB_URI` that pointed at three Docker containers
now points at three Atlas servers.

**Why.** The Cyber Security module's Level 2 wording is about securing a *live* application and its
operations, not a development one. A threat model that has never met the internet is a document; the same
model checked against a deployed site is evidence. It also completes the NoSQL hand-in, which asks how to
connect to Atlas.

**Concepts.**
- **`mongodb+srv://` is a DNS lookup.** One hostname resolves to the replica set's members, so the driver
  discovers all three servers, and which is currently primary, without being told. That is why moving from
  Docker to Atlas needed no code change: both are replica sets, and the driver treats them identically.
- **A database user is not an account.** The Atlas login is the landlord; `horizon_prod` is a key to one
  room, with `readWrite` on the `horizon` database only. If the connection string leaked, the holder could
  not read another database, create users, or drop the cluster (threat E5).
- **An open IP list is not an open database.** The access list is `0.0.0.0/0`, because Vercel's functions
  have no fixed addresses and a free cluster has no private networking. What protects the data is TLS on
  every connection and SCRAM authentication with a generated password. An allowlist never authenticated
  anyone; it only limited who could *attempt* to. The risk that remains is recorded as I8.
- **Write-only secrets.** `MONGODB_URI` is stored in Vercel as a Secret: after saving, nobody can read it
  back, not even its owner — only the running function receives it. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is the
  opposite, deliberately public and compiled into the browser bundle. Knowing which of your values is
  which is most of secrets management.
- **Data residency.** Cluster and functions both in Frankfurt: personal data stays in the EU, and the
  server's several round trips per sync stay in one city instead of crossing an ocean.
- **A ruleset binds its author.** `main` requires a pull request and four passing checks. Pushing to it
  printed "Bypassed rule violations", which is the rule working: the owner is on the bypass list, the
  assessor with write access is not (threat E7). Required checks name each CI job exactly; a name that
  matches no job never reports, and a never-reported required check blocks every push for ever.
- **Verify in production, not only in tests.** Passing tests say the code is right; a live check says the
  deployment is. Both were run here, and the live one is what an examiner can watch.
- **401 is not 403.** The live probes show the difference cleanly: no session gets 401 (who are you?),
  while a request from another site's origin gets 403 (I know who you are, and no).

**What went wrong on the day.** Sign-in worked; the first sync answered 400, "Malformed request." The
oldest track on the device still carried `lastUpdatedDates`, a field retired long before this changelog
began — and a strict schema refuses every key it doesn't list. The fixture the tests run on (a year of
real use) predates that field, so no test could have caught it. Diagnosis took one exported backup run
through the same schema the server uses. Three lessons worth repeating in an exam:
- **Strict validation fails closed.** That is right for security — a smuggled `userId` is refused rather
  than stored — and unforgiving for compatibility. Every retired field has to be listed as deliberately
  allowed, which is now what the schema's legacy section is for.
- **A generic error protects the server and blinds its operator.** The response still says only
  "Malformed request."; the *reason* (which rule failed, and the first three segments of its path, never
  a value) now goes to the server log, so the next one is readable in Vercel's logs without asking
  anyone to export their data (threats I4, I6).
- **Production data has a longer history than any fixture.** Real devices carry shapes no test data
  remembers.

**And then it went wrong again, differently.** The next edit failed too, with a 503 this time and
`MongoBulkWriteError` in the log. The cause sits one layer deeper. A material on the oldest track has no
`updatedAt` — it predates per-item timestamps. When the server merges two copies and neither has one,
`lib/merge.ts` still wrote the key: `updatedAt: rm.updatedAt || lm.updatedAt`, which is `undefined`.
**BSON has no `undefined`**: the driver stores an explicit undefined field as `null`, and the collection's
`$jsonSchema` says that field must be a number. The database refused the whole track, so every sync after
the first one failed. The first sync had worked because a first sync stores the device's data as it is —
only the second one merges.

Two fixes, at two depths: the merge no longer invents a key the data never had, and everything on its way
into the database now has its set-but-undefined fields dropped, because *absent* is what the schema means
by optional. Filters are deliberately left alone — dropping a key from a filter would widen it, and every
filter here scopes a query to one user. Diagnosis worked backwards from the live logs: restore the
backup into a local scratch database, replay the device's exported workspace against it, and read the
validator's own explanation (`schemaRulesNotSatisfied` names the property and the rule). The 503 now
carries that much into the log, so the next one needs no reconstruction.

**See it yourself.** Against the live site, with no credentials:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H 'Origin: https://evil.example' -H 'Content-Type: application/json' --data '{}' https://horizonroadmap.com/api/sync
```

403, and the same for `DELETE /api/account` and `POST /api/auth/session`. Without the forged origin and
without a session they answer 401, and `/api/git` — the localhost-only route — answers 403 in production.
`curl -sI https://horizonroadmap.com` shows the CSP, a two-year HSTS, and `x-vercel-id: fra1`.

**Exam questions.**
- *Your database accepts connections from any IP. Isn't that insecure?* The allowlist was never the
  control: TLS plus SCRAM authentication are, and the database user reaches one database. Vercel has no
  fixed egress addresses and the free tier has no private endpoint, so the alternative would be a false
  sense of security, not a real one. It is an accepted, documented risk (I8).
- *Where do your secrets live?* In Vercel as a write-only Secret, in Atlas as a generated password, in
  `.env.local` locally — never in git, which gitleaks checks over the whole history. Rotation: RUNBOOK §3.
- *How do you stop an unreviewed change reaching production?* `main` is protected: a pull request and four
  green CI jobs, force-pushes and deletions blocked.
- *Where is your data stored, and does that matter?* Frankfurt, `eu-central-1`, for GDPR and latency.
- *How would you know if the deployment were broken?* The live checklist in `docs/DEPLOY.md` §4, Vercel's
  logs for rejected sign-ins and rate limits, and a weekly backup that has been restored at least once.

**Files.** `docs/DEPLOY.md`, `docs/security/RUNBOOK.md`, `lib/server/db.ts`, `lib/server/http.ts`.

---

## 14. Noticing: health checks, security counters and an encrypted backup (0.22.0)

**What changed.** The server now counts what it refuses, two scheduled jobs watch the live system, and
the weekly backup runs by itself and is encrypted. Concretely: a `securityEvents` collection counting
rejected sign-ins, rate limits reached, bodies refused and writes refused; `/api/health`, asked every
half hour; `npm run ops:check`, run every morning against the live database; and a Monday backup
encrypted to a public key whose private half never leaves the laptop.

**Why.** Everything built before this *prevents* things. None of it *notices* anything. The morning's
two failures made the gap concrete: both were found because someone was looking, and both would have
been invisible if they had happened at 3am to somebody else. Security has three jobs — prevent, detect,
respond — and only the first one existed. Detection is also exactly what the Cyber Security module means
by Level 2: securing a live application *and its operations*.

**Concepts.**
- **Prevent, detect, respond.** Prevention fails silently; detection is what turns a silent failure into
  a known one. The runbook is the third part: each alert has an entry saying what it means and what to
  do first.
- **Counting, not logging.** A row per rejected sign-in would let anyone fill the database by failing on
  purpose — the denial-of-service threat again (D2). One document per kind per hour, raised with an
  atomic `$inc`, costs the same whether something happens twice or two million times. It is the bucket
  pattern from the progress data, used for a different reason.
- **Detection without personal data.** The counters hold a kind, an hour and a count. Not an address,
  not an account, not a value from the request. You can see that sign-ins are being refused without
  keeping a record of who was refused, and a TTL index removes each bucket after 30 days.
- **An alert needs a channel.** Vercel's free plan has no log drains, and a dashboard nobody opens is
  not monitoring. The channel here is a failing GitHub Actions run, because a failed run emails the
  owner: no third-party service, no extra credential, and it can be demonstrated in an exam.
- **Liveness is not the page loading.** The site is static and served by a CDN, so it loads perfectly
  while the database is unreachable and every sync fails. `/api/health` answers 200 only when the server
  can actually reach the database — and answers nothing else, since a health endpoint is a free map of
  the system to anyone who asks (I4).
- **Asymmetric encryption, doing real work.** The backup is encrypted with a public key committed to the
  repository; only the private key, which never leaves the owner's machine, can open it. So a workflow
  run can back up real accounts, and GitHub stores a file it cannot read. The public key is not a
  secret — that is the whole point of publishing it — and the dump is piped straight into gpg, so the
  plaintext never reaches a disk.
- **A backup you cannot open is not a backup.** The private key surviving matters as much as the
  archive. It goes in a password manager, and the decrypt-and-restore is tested once, before anything
  depends on it.
- **Thresholds are judgements.** "Fifty rejected sign-ins a day" is a guess about what is normal, not a
  measurement. One refused write, though, is zero-tolerance: the database refusing the server's own
  write is always a bug. That threshold would have caught the morning's 0.21.6 failure within a day.

**See it yourself.**

```bash
npm run ops:check
```

Locally that reads the development database; `-- --uri-env ATLAS_URI` reads the live one. Force an
alert by sending nonsense to the API and running it again: the `body-rejected` counter moves. The
health endpoint answers `{"ok":true}`:

```bash
curl -s https://horizonroadmap.com/api/health
```

**Exam questions.**
- *How would you know if your application broke?* A health check every 30 minutes and a daily read of
  the security counters; both alert by failing a scheduled run, which emails me. Before this, I would
  have found out from a user.
- *How do you detect an attack?* The server counts every rejection by kind. A steady stream of refused
  sign-ins or rate limits is visible the next morning, without keeping anything about who was refused.
- *Why not log every event?* Because failures are attacker-controlled: a row each would be a
  denial-of-service vector. Counters per hour are bounded.
- *Your backups sit on GitHub — isn't that a risk?* They are encrypted to a public key; the private key
  is on my machine and in my password manager. GitHub holds something it cannot read, and I have tested
  decrypting and restoring it.
- *What is the difference between prevention and detection?* Prevention stops what you anticipated;
  detection tells you about what you didn't. Both fail; only detection tells you so.

**Files.** `lib/server/securityEvents.ts`, `lib/server/health.ts`, `scripts/ops-check.ts`,
`scripts/backup.ts`, `.github/workflows/{uptime,ops,backup}.yml`, `docs/security/RUNBOOK.md` §7–§8,
`lib/__tests__/securityEvents.db.test.ts`.

---

## 15. A second platform, from the same core (0.25.0–0.27.0)

**What changed.** Horizon runs on Android, as a real app written with React Native and Expo, in
`mobile/`. It shows today's plan, ticks items, keeps a streak, switches tracks, signs in with Google
and syncs with the same account as the website.

**Why.** A third module, Mobile App Development, whose exam falls on the same day as the other two.
But the interesting part isn't the module: it's what building a second front end revealed about how
the first one was built.

**Concepts.**
- **The architecture got tested, not described.** `lib/` — types, dates, completion rules, streak
  calculation, selectors, the merge engine, the migrations — imports nothing from React and nothing
  from the browser. About 1,500 lines moved to the phone *unchanged*, tests included. Nobody planned
  that for mobile; it came from keeping business rules out of components, and this is the first time
  it was cashed in. "Reflect on your software architecture" has a concrete answer: the architecture is
  the reason this took weeks rather than months.
- **What doesn't travel.** Drawing and storing. There is no DOM, so every component is rewritten, and
  no IndexedDB, so storage is SQLite. Those were always going to be platform-specific; the point of
  the layering is that *only* they were.
- **The server didn't change at all** — well, almost (entry 16). The phone is a third device: it posts
  its workspace to `/api/sync` and the server merges it in a transaction, using the same
  `mergeWorkspace` the phone itself runs. Two devices ticking different boxes on the same day both
  keep their tick, and the phone got that for free.
- **A bundler that reads outside its own folder.** `mobile/` is a separate npm package, so Metro is
  told to watch the repository root (for `../lib`) and to resolve `node_modules` only from `mobile/` —
  two copies of React in one bundle is the classic monorepo crash.
- **Where a session lives, when there is no browser.** The web keeps it in an HttpOnly cookie no
  script can read. A phone has something better: the Android Keystore. So the app asks for the token
  explicitly and sends it as a `Bearer` header, which is also safer against forgery — nothing attaches
  a bearer token automatically, so no other app or page can make an authenticated request by accident.
- **Storage, and its options.** SQLite for structured data that must survive; a key-value store for
  small preferences; the keystore for the session; the server for the shared copy. The same question
  the web answered with IndexedDB and `localStorage`, answered again with different tools.

**See it yourself.** `cd mobile && npm start`, then open Horizon on the phone. Tick something, force
close the app, reopen: still ticked. Tick something else on the laptop, sync both, and both survive.

**Exam questions.**
- *Why React Native rather than Flutter or Kotlin?* The domain logic is TypeScript that imports
  nothing platform-specific, so it moves as it is. Dart or Kotlin would mean rewriting the merge
  engine and the migrations, then maintaining two copies that can disagree — the exact risk this
  project spent weeks removing. `MOBILE_PLAN.md` §3.
- *What did you give up?* Memory, and a bridge between JavaScript and native code that Flutter doesn't
  have. Both acceptable for an app whose heaviest operation is a merge over a few hundred documents.
- *What is shared, and what can't be?* Logic travels; drawing and storing do not.
- *How do two devices not overwrite each other?* They never merge locally. The server merges inside a
  transaction, per item, with device-side timestamps deciding — entry 7.

**Files.** `mobile/src/`, `mobile/metro.config.js`, `lib/` (unchanged), `MOBILE_PLAN.md`.

---

## 16. What a phone can do that a browser can't (0.26.0–0.29.0)

**What changed.** The step counter, the permission that guards it, and Android's two directions of
inter-app communication: a share sheet out, a deep link in.

**Why.** A phone that only shows a smaller copy of the website is not worth installing, and the module
asks for sensors, permissions and inter-app communication specifically — because they are what make
mobile development different from web development.

**Concepts.**
- **A sensor is not a data source you can just read.** Android has no "how many steps today". There is
  `watchStepCount`, which reports steps *since you subscribed* and only while the app is in the
  foreground. So the app keeps its own running total and writes it immediately, and it says on screen
  that steps taken while it's closed aren't counted. The alternative — Health Connect — is a second
  permission system and a bigger build. Stating the limit is better than implying a full day.
- **Permissions can be refused permanently.** Android's "don't ask again" means the app may never
  prompt again; only the user can change it in settings. A well-behaved app detects that state, says
  where to go, and notices the change when it returns to the foreground. Found by hitting it for real.
- **Native code and JavaScript ship differently, and this is the platform's central fact.** JavaScript
  can be replaced in an app already installed. Native code cannot: it needs a new build, downloaded
  and installed by the user. That is why Expo Go — one shared app, containing what Expo chose — could
  not run the pedometer, and why a build made before secure storage was added crashed on importing it.
  It is also the client-server versioning problem from entry 13 in different clothes: an old app in
  someone's pocket, talking to a server that has moved on.
- **Intents, both ways.** Out: the share sheet hands Android text and the system offers whatever can
  receive it, with no permission needed because the user picks the destination. In: `horizon://track/<id>`
  opens the app on that track — and because a link is outside input, the handler may only choose
  between tracks that already exist.
- **A CSRF check that was measuring the wrong thing.** The server refused every request without an
  `Origin` header, which a native app never sends, so sign-in from the phone was refused before the
  token was read. The fix went back to what the check is *for*: cross-site forgery depends on the
  browser attaching credentials by itself, so a request carrying no cookie has no authority to abuse.
  No cookie, no `Origin` needed; a cookie without one is still refused. Found because the security
  counters from entry 14 showed `sign-in-rejected` stuck at zero while the phone kept failing — the
  monitoring paid for itself in a day.

**See it yourself.** On the phone: tap "Count my steps", allow, walk. Then, from the laptop with the
phone attached over USB:

```bash
adb shell am start -a android.intent.action.VIEW -d "horizon://track/<a track id>" com.horizonroadmap.app
```

The app switches to that track. And tap "Share where this track stands" to send a summary to any other
app.

**Exam questions.**
- *Which sensor, and what did you have to consider?* The pedometer: the hardware may not exist, the
  permission may be refused or permanently refused, the subscription costs battery so it is released
  with the screen, and nothing arrives in the background.
- *How does Android's permission system work?* Declared in the manifest, asked at the moment of use,
  refusable, permanently refusable. An app that hasn't declared it is never even asked — which is
  exactly why Expo Go couldn't do this.
- *What is inter-app communication?* Intents. The share sheet and deep links here; also content
  providers and broadcast receivers, which this app doesn't need.
- *What's different about releasing a mobile app?* JavaScript can be updated over the air; native code
  cannot. Old versions live on phones for months, so the server has to keep accepting what they send.
- *How do you handle a missing native module?* Load it when first used, and report "this build can't
  do that" instead of crashing the whole app on startup.

**Files.** `mobile/src/steps/usePedometer.ts`, `mobile/src/share/shareTrack.ts`,
`mobile/src/app/track/[id].tsx`, `mobile/src/auth/session.ts`, `lib/server/http.ts`, `mobile/app.json`.


---

## 17. Files, and the standard library that isn't there (0.38.1–0.39.0)

**What changed.** Two things that both turned out to be about the same gap. The roadmap now *renders*
on the phone instead of showing its markdown source. And Settings can write a backup of everything
the device holds into a file, and read one back.

**Why.** The roadmap was shipped as raw text on the judgement that "a page of prose reads fine with
its headings intact". That judgement did not survive the first real roadmap on a real screen: a
roadmap is `##`, `- ` and `**` on nearly every line, which is not prose. The backup was the last
thing the website could do that the phone could not — and it matters more here than there. A
laptop's copy can be reached from the machine itself; a phone's cannot, so a reset, a loss or an
uninstall takes whatever was never synced with it.

**Concepts.**

- **React Native is not Node, and the difference shows up as a bundling failure.** Adding a markdown
  renderer failed the entire export with `Unable to resolve module punycode`. Not a bug in the
  library: `markdown-it` does `require("punycode")`, which on a server is the Node standard library,
  and on a phone is nothing at all. React Native ships a JavaScript engine, not Node — no `fs`, no
  `path`, no `crypto`, no `punycode`. The fix is to install the real implementation from npm and tell
  the bundler where to find it (`resolver.extraNodeModules` in `metro.config.js`). Worth knowing
  before choosing a dependency: a library written for the server can import something that does not
  exist here, and nothing warns you until the bundle breaks.

- **Android gives an app no access to the user's files.** Not "ask for permission and then you have
  it" — there is no permission to ask for. An app reaches the user's storage only through the
  *Storage Access Framework*: the system shows a picker, the user chooses one file or one folder, and
  the app is handed access to exactly that. So the export asks for a folder and the import opens a
  picker, and the whole feature involves no permission prompt at all. Contrast with the pedometer in
  entry 16, which does need one: the difference is that the user's own choice *is* the grant here.

- **A native dependency costs a release; a JavaScript one costs nothing.** Both changes could have
  taken the obvious route — `react-native-markdown-display` needs no native code, but a share-sheet
  module and a document picker both do, and a native dependency means a new build installed on every
  phone rather than an update that arrives on next launch. `expo-file-system` is already in every
  Expo app and carries both pickers, so the backup shipped over the air. Checking whether a
  dependency contains native code *before* designing around it is now a habit, not an afterthought.

- **Shared code has to be pulled apart along the right seam.** `lib/export.ts` and `lib/import.ts`
  were not reusable: one builds a `Blob` and clicks an invisible `<a>`, the other takes a browser
  `File` and writes to Dexie. But the *format* is the same file on both platforms, and a backup that
  only restores where it was written is not a backup. Splitting out `lib/backupFormat.ts` — the
  shape, the validation, the summary, importing nothing but types — left one parser instead of two
  that drift. This is the third time the same move has paid off (`lib/bookkeeping.ts`,
  `lib/apiTypes.ts` before it), and the test for it is mechanical: can React Native bundle this file?

- **Restoring replaces; it does not merge.** The same decision the website makes, for the same
  reason: a restore means "put it back the way it was", and a merge would need per-item timestamps
  the file may predate. Because it replaces everything, the file is parsed and described before
  anything happens — how many tracks, which ones, how many notes and recorded days, when it was
  taken. A backup from the wrong week looks exactly like the right one until it has already
  overwritten today.

- **A restore has to reach the screen, not just the disk.** Writing the restored workspace to SQLite
  and leaving the provider holding the old one would have been a silent data loss: what is on screen
  is what the next edit is written from, so the next tap would have saved the old workspace straight
  back over the new one. The same class of mistake as the bookkeeping bug in 0.30.1 — state in two
  places, updated in one.

**See it yourself.** Settings → *Save a backup…* → pick Downloads. Then open the file on the laptop:
it is the same JSON the website's export produces, down to the filename. Settings → *Restore from a
file…* → pick a backup the website wrote, and read what it says the file contains before confirming.

**Exam questions.**
- *How does a mobile app access files?* Through the Storage Access Framework on Android: the system
  picker hands the app one file or folder the user chose. An app has no general access to storage and
  no permission exists to grant it.
- *What is different about dependencies in React Native?* There is no Node standard library, so a
  package that imports `fs`, `crypto` or `punycode` will not bundle; and a package containing native
  code cannot be delivered over the air, only in a new build.
- *How do you decide what to share between platforms?* By what imports nothing platform-specific.
  Format, rules and validation are shared; anything touching the DOM, Dexie, SQLite or the file
  system is not.
- *Why replace rather than merge on restore?* Merging needs per-item timestamps the backup may not
  have. Replacing is predictable, which is why the user is shown what the file holds first.

**Files.** `lib/backupFormat.ts`, `lib/export.ts`, `lib/import.ts`,
`mobile/src/backup/backupFile.ts`, `mobile/src/app/settings.tsx`, `mobile/src/app/roadmap.tsx`,
`mobile/metro.config.js`, `mobile/src/storage/db.ts`.
