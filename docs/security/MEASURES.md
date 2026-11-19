# Implemented security measures

Every security measure in Horizon: the threat it answers (IDs from
[THREAT_MODEL.md](THREAT_MODEL.md)), where it's implemented, and how it's verified. As of v0.119.6.

## Authentication and sessions

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| OpenID Connect sign-in with Google. The server verifies the ID token's RS256 signature against Google's published keys, plus `iss`, `aud` (Horizon's client ID), `exp` and `email_verified`. RS256 only, so no `alg: none` and no HS256 confusion | S1, S2 | `lib/server/auth/googleIdToken.ts` | `googleIdToken.test.ts` (forged, foreign, expired, unsigned and confused tokens); a live check against Google's keys |
| Users identified by Google's permanent `sub`, never by email; every user field taken from the verified token | S1, T2 | `lib/server/auth/handlers.ts` | `auth.db.test.ts` |
| Server-side sessions: a 256-bit random token; the database stores only its SHA-256; 30-day expiry with a TTL index; sign-out deletes the session | S3, S4 | `lib/server/auth/session.ts` | `auth.db.test.ts` (token never stored, expired session refused, copied cookie dead after sign-out) |
| Session cookie `__Host-horizon_session`: HttpOnly, Secure, SameSite=Lax, Path=/, no Domain | S3, I2 | `lib/server/auth/session.ts` | `auth.db.test.ts` |
| Google client ID accepted only from its listed origins | S5 | Google Cloud client settings | Configured 2026-09-10 |

## Authorization and data isolation

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| Every query, write and `$lookup` scoped by the session's user id; ownership never read from a request | I1, T2 | `lib/server/sync/store.ts`, `lib/server/insights/`, `lib/server/account/` | `sync.db.test.ts`, `insights.db.test.ts`, `account.db.test.ts` (two users sharing a track id) |
| Compound indexes starting with `userId`, including the text indexes: every search is a one-user search | I1 | `lib/server/collections.ts` | `insights.db.test.ts` (`explain` uses `user_track_text`) |
| Least-privilege database users: the app has `readWrite` on its own database only; tests and generated data have their own users and databases; the app process never sees the root password | E5 | `docker/mongo-init.js`, `scripts/dev-env.mjs` | Refusals tested by hand (0.17.1): another database, the user list, `dropDatabase`, `rs.status` |
| Account deletion: the user's documents removed from every collection in one transaction (right to erasure) | privacy, T10 | `lib/server/account/handlers.ts` | `account.db.test.ts` |

## Input handling

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| Strict zod schemas for every request body: unknown fields refused; types, sizes and array lengths capped; keys that become field names limited to `[A-Za-z0-9_-]` | T1, T2, D1 | `lib/server/sync/schema.ts`, `lib/server/http.ts` | `syncModel.test.ts`, `serverHttp.test.ts` |
| User input never used as a MongoDB field name: title-keyed maps stored as arrays of values | T1 | `lib/server/sync/model.ts` | `syncModel.test.ts` |
| Mongoose `sanitizeFilter` (operators in values neutralised) and `strictQuery: "throw"` | T1 | `lib/server/db.ts` | `auth.db.test.ts` (the same filter matches through the raw driver, and is refused through Mongoose) |
| `$jsonSchema` validators on every server-written collection | T1 | `lib/server/collections.ts` | `sync.db.test.ts` (error 121) |
| Request body size limits: 8 KB for sign-in, 2 MB for sync, checked against both the declared and the actual size | D1 | `lib/server/http.ts` | `serverHttp.test.ts`; live 413 |
| Future timestamps clamped to now + 5 minutes | T3 | `lib/server/sync/model.ts`, `handlers.ts` | `syncModel.test.ts`, `sync.db.test.ts` |
| Backup restore refuses notes that aren't strings or have unsafe ids | T7 | `lib/import.ts` | `import.test.ts` |
| Markdown renderer escapes HTML and allows only safe link schemes | I2 | `lib/markdown.ts` | `markdown.test.ts` |

## Cross-site protection and browser hardening

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| State-changing API routes require a same-origin `Origin` (and `Sec-Fetch-Site`, when present), plus JSON bodies | T11 | `lib/server/http.ts` | `serverHttp.test.ts`, `*.db.test.ts` (403s) |
| Local-only routes check `Host`, `Origin` and `Sec-Fetch-Site`; `/api/open` accepts JSON only | E1 | `lib/server/localRequest.ts`, `app/api/open/route.ts` | `localRequest.test.ts`; attack page before and after (0.14.4) |
| `/api/git` checks the path restriction before existence, and again after symlinks, with generic errors; `/api/open` validates the link (string, length, no leading `-`) | I4, I5, E4 | `app/api/git`, `app/api/open`, `app/api/notes` | `localRoutes.test.ts` |
| Content-Security-Policy: `connect-src` allowlist, `img-src 'self' data: blob:`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, `base-uri 'self'`; plus Referrer-Policy, `nosniff` and `X-Frame-Options: DENY` | I2, I3 | `next.config.ts` | Live headers checked with curl |
| HTTPS only, with HSTS (two years) | T5 | Vercel | Live check, 2026-09-10 |
| Google Drive sync removed entirely (0.32.0): no access token in the browser, no OAuth scope, no second copy of the data outside this project's control. The account sync it duplicated does the same job on infrastructure we operate | I12 | — | The code and its modal are deleted |

## Abuse, logging and accountability

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| Rate limits: sign-in 10/min and session 60/min per address; sync 30/min and search/stats 120/min per account. Atomic counters in MongoDB with a TTL; addresses stored only as hashes | D2 | `lib/server/rateLimit.ts` | `rateLimit.db.test.ts` (a burst of 20 lets exactly 10 through); live 429 |
| Audit log of every sync that changed something (who, when, how many), deleted after 90 days | R1 | `lib/server/sync/store.ts` | `sync.db.test.ts` |
| Logs record sign-in rejections by reason code, and the first rate-limit refusal per window by bucket; never tokens, cookies, addresses or connection strings | R2, I6 | auth and rate-limit code | Code review; live server log checked |
| Generic error messages to clients | I4 | every handler | Tests assert the generic bodies |

## Data at rest, availability and recovery

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| Local database listens on 127.0.0.1 only, with access control on and a key file for member authentication | I13 | `compose.yaml` | Sockets checked; logged-out access refused |
| Secrets generated per machine into git-ignored files with mode 600, never committed | I7, I13 | `scripts/dev-env.mjs`, `.gitignore` | gitleaks over the whole history: no leaks |
| Three-member replica set; sync commits with `writeConcern: majority`; retryable writes | D5, T4 | `compose.yaml`, `lib/server/sync/store.ts` | `npm run demo:failover` (graceful and crash; nothing lost) |
| Offline-first: every device keeps a full copy of its user's data | D3, D4 | the app's design | Sync tests |
| Backups with `mongodump` to a private folder, 14 kept, restore tested | D4 | `scripts/backup.ts` | Restore test: 587,578 documents, every count and index matching |
| The live database is backed up weekly by a scheduled workflow, encrypted to a public key whose private half never leaves the owner's machine — GitHub stores a file it cannot read | D4, I7 | `.github/workflows/backup.yml`, `scripts/backup.ts`, `ops/` | Dumped from Atlas, encrypted, decrypted and restored (70 documents), 2026-09-22 |

## Detection and response

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| Security counters: every rejected sign-in, rate limit reached, refused body and refused write raises a counter, bucketed per kind per hour so a flood costs one document an hour | S1, S2, D2, T1 | `lib/server/securityEvents.ts` | `securityEvents.db.test.ts` (25 events, one document; the rejecting code raises it) |
| The counters hold no address, account, email or value — a kind, an hour, a count — and a TTL index deletes them after 30 days | I6, privacy | `lib/server/collections.ts` | `securityEvents.db.test.ts` (exact key set; validator refuses anything else) |
| A daily scheduled check reads them and fails the run when one is out of character, which emails the owner: alerting with no paid log drain and no third-party service | S1, D2, T1 | `scripts/ops-check.ts`, `.github/workflows/ops.yml` | Run against the live database |
| `/api/health` reports whether the server can reach the database, watched every 30 minutes; it answers `{"ok":…}` and nothing else, so it can't be used to map the system | availability, I4 | `lib/server/health.ts`, `.github/workflows/uptime.yml` | Live: 200 when healthy |
| A refused write names the failing rule and property in the server log, values excluded | I4, I6 | `lib/server/sync/handlers.ts` | Reproduced live (0.21.6) |
| Runbook entries for each alert: what it means and the first move | — | `docs/security/RUNBOOK.md` §6–§8 | — |

## Development life cycle

| Measure | Threats | Where | Verified by |
|---|---|---|---|
| CI on every push: types, lint, unit tests, build, database tests on a real replica set | T9 | `.github/workflows/ci.yml` | The workflow itself |
| Dependency checks in CI: `npm audit --omit=dev --audit-level=high` blocks on shipped code, a second non-blocking run prints development advisories, and `npm audit signatures` verifies registry signatures and provenance | T8 | `.github/workflows/ci.yml` | 0 vulnerabilities in the production tree; all signatures verified |
| Lockfile with `npm ci`; framework pinned exactly; few runtime dependencies; npm blocks dependencies' install scripts | T8 | `package.json`, `package-lock.json` | — |
| Dependabot for npm, GitHub Actions and the mongo image, targeting `development` | T8 | `.github/dependabot.yml` | — |
| Secret scan of the whole history on every push (gitleaks) | I7 | `.github/workflows/ci.yml` | 387 commits, no leaks |
| Static analysis on every push (Semgrep: TypeScript, Node.js, React, secrets, OWASP Top 10) | I2, T1, E4 and others | `.github/workflows/ci.yml` | 113 rules on 147 files, 0 findings |
| CI hardening: a read-only job token, actions pinned to commit SHAs, scanner images pinned by digest, no persisted credentials | T8, T9 | `.github/workflows/ci.yml` | — |
| A threat model, kept current with each release | all | `docs/security/THREAT_MODEL.md` | — |
| Repository and account hardening. The ruleset `protect main` enforces four rules on `main`: changes through a pull request, all four CI checks green, no force pushes, no branch deletion. Dependabot alerts and automatic security updates. Two-factor authentication on GitHub and Vercel | T9, E7 | GitHub and Vercel account settings | Read back from the GitHub API on 2026-11-19, rule by rule. The repository role keeps a bypass, so the owner can still push documentation directly; everything that touches application code goes through the pull request. Setup in [RUNBOOK.md](RUNBOOK.md) §8 |
