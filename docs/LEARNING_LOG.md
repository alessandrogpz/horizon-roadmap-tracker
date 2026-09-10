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

## Entries

1. [Keeping other websites off the local routes (0.14.4)](#1-keeping-other-websites-off-the-local-routes-0144)
2. [Checking the plan against the code (Step 0)](#2-checking-the-plan-against-the-code-step-0)
3. [The threat model (0.17.1)](#3-the-threat-model-0171)
4. [A local MongoDB replica set (0.17.1)](#4-a-local-mongodb-replica-set-0171)
5. [Sign in with Google (0.18.0)](#5-sign-in-with-google-0180)
6. [Upgrading Next.js for security (0.18.1)](#6-upgrading-nextjs-for-security-0181)

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
