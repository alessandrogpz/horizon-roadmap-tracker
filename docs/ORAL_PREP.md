# Preparing the two oral exams

Both exams are one-to-one, 15 to 30 minutes, with your laptop open.

- **SE_06 NoSQL**: an overview and a demo, then questions.
- **Cyber Security**: a **5-minute technical presentation on the security methods you applied**, then
  questions.

Everything below points into documents that already exist. The learning log
([LEARNING_LOG.md](LEARNING_LOG.md)) has the concepts and the likely questions for each step.

## The day before

- [ ] `npm run db:up`, and check `docker compose ps` shows three members running.
- [ ] `npm run db:seed` (about 90 seconds) if `horizon_perf` is empty, so `db:explain` has data.
- [ ] `npm run test:db`: all green.
- [ ] Your usual data synced to your account at least once (so search and insights have something).
- [ ] MongoDB Compass connected with `MONGODB_URI` from `.env.local`.
- [ ] Terminals open in the repo; the documents below open in tabs. [`README.md`](README.md) in this
      folder says what every document is, if you need to find one mid-answer.
- [ ] The live site signed in and synced: <https://horizonroadmap.com>, Settings → Account.
- [ ] `curl -s https://horizonroadmap.com/api/health` answers `{"ok":true}`.
- [ ] `npm run ops:check -- --uri-env ATLAS_URI` runs clean (and is worth showing).
- [ ] GitHub → Actions: the last runs of CI, Uptime, Operations and Backup, all green.
- [ ] The exam laptop: disk encryption on, screen lock on (threat I10). If it's a different machine,
      clone the repo, install Docker, run `npm install` and `npm run db:up` there first.
- [ ] Hand-in admin: repo access for `peterruppel` (see RUNBOOK §1 about write access), and the
      Learning Platform form.

## Cyber Security: the 5-minute talk

Aim for about 45 seconds a part. Show the diagram and one or two files; don't read slides.

1. **What it is (0:00).** Horizon: an offline-first tracker. Signed in with Google, it syncs through a
   Next.js API to MongoDB. Show the diagram in [THREAT_MODEL.md §3](security/THREAT_MODEL.md#3-the-system).
2. **Threat model first (0:45).** Data-flow diagram, six trust boundaries, STRIDE on each element and
   flow, likelihood × impact, 43 threats, each implemented, planned or *accepted with a reason*. Made
   before the server existed: security by design.
3. **Found, fixed, tested (1:30).** The CSRF hole in the local routes: any website could make the laptop
   open a file. Reproduced from a real attack page, fixed with `Origin` and `Sec-Fetch-Site` checks and
   JSON-only bodies, and covered by 16 tests (learning log entry 1).
4. **Authentication and authorization (2:15).** OpenID Connect: the server verifies Google's RS256
   signature, `iss`, `aud` and `exp`. Then its own session: 256 random bits in an HttpOnly, Secure,
   SameSite cookie, stored only as a hash, and revocable. Every query is scoped to the session's user; a
   test with two users sharing the same track id proves it.
5. **Input and abuse (3:00).** Strict zod schemas, user input never used as a field name,
   `sanitizeFilter`, `$jsonSchema` validators, size limits, rate limits with atomic counters, generic
   errors, no tokens in logs.
6. **The life cycle (3:30).** CI on every push, including on Dependabot's own pull requests: tests on a
   real replica set, `npm audit` and signature verification, gitleaks over the whole history, Semgrep.
   Actions pinned by hash, a read-only token, and `main` protected by a ruleset that binds me too.
7. **It is live, and it notices (4:00).** Deployed at horizonroadmap.com: Atlas and the functions both
   in Frankfurt, a database user with `readWrite` on one database, the connection string write-only in
   Vercel. Prevention isn't enough, so the server counts every rejection — by kind and hour, never who —
   a scheduled check reads the counters each morning, `/api/health` is watched every half hour, and the
   weekly backup is encrypted to a key only I can open. An alert is a failing workflow run, which emails
   me. Say the story: both of the bugs found on release day were caught because someone was looking, and
   that is not a control (learning log 13 and 14).
8. **Honest limits (4:30).** Accepted risks (§9 of the threat model): `'unsafe-inline'` scripts, Atlas
   reachable from any IP, account deletion without step-up authentication, each with its reason.

**Ready to demo** (if asked):
- `MODULES_PLAN.md` Appendix B: the CSRF attack page, before and after.
- The eleven-request `curl` loop from learning log entry 8: ten 401s, then a 429.
- Browser devtools: the session cookie's flags. `sha256` of its value equals `_id` in `sessions`
  (learning log entry 5).
- Against the live site, with no credentials: a forged cross-site `PUT /api/sync` → 403, the same
  request without a session → 401, `/api/git` → 403, and `curl -sI` showing the CSP and HSTS.
- `npm run ops:check` after sending the API something malformed: the `body-rejected` counter moves,
  and `db.securityEvents.find()` shows a count and an hour — and no trace of who did it.

## Cyber Security: the question map

| Question | Short answer from Horizon | More in |
|---|---|---|
| What are the goals of security? | Confidentiality, integrity, availability, authenticity, non-repudiation, authorization; every threat maps to one | Threat model §8 |
| Symmetric vs asymmetric encryption | Asymmetric (a key pair) to agree on keys and to sign; symmetric (one shared key) for the bulk data, because it's fast. TLS uses both | below |
| How does authentication work in your app? | OpenID Connect with Google → the server verifies the ID token → a hashed server-side session | Learning log 5 |
| How does authorization work? | Per-user query scoping; least-privilege database users; OAuth scopes (`drive.appdata`) | Learning log 4, 7 |
| OAuth 2.0 vs OpenID Connect? | Drive sync uses OAuth 2.0: permission for one scope, no identity. Sign-in uses OpenID Connect: an ID token that says who you are | Learning log 5 |
| How do you validate input? | zod strict schemas, `$jsonSchema`, the backup validator, markdown escaping | Learning log 7, 8 |
| What is CSRF, and your defence? | The 0.14.4 story; SameSite cookies plus `Origin` checks plus JSON-only on the API | Learning log 1, 5 |
| Database injection? | NoSQL operator injection (`{"$ne": null}`): strict types, `sanitizeFilter`, and the test that shows the raw driver matching and Mongoose refusing | Learning log 5 |
| Which threats are still open? | The accepted risks, and the owner's actions still to do (a ruleset on `main`, 2FA) | Threat model §9, §10 |
| TLS and its keys: how many? | See below | — |
| Where do you use digital signatures? | Google's ID tokens (RS256), TLS certificates, npm package signatures (`npm audit signatures`) | Learning log 5, 12 |
| Securing a machine at layer 3? | A host firewall (ufw is active here; matters because `dev:lan` binds to all interfaces); Atlas's IP access list | Threat model E2, I8 |
| How do you secure your development life cycle? | CI, dependency audit and signatures, Dependabot, secret scanning, SAST, pinned actions, a protected `main` | Learning log 12 |
| A secret leaked. What now? | Rotate first, then clean the history, then scan again | RUNBOOK §3 |
| How would you know if it broke? | `/api/health` every 30 minutes and a daily read of the security counters; both alert by failing a workflow run, which emails me | Learning log 14, RUNBOOK §7 |
| How do you detect an attack? | Counters per kind per hour — rejected sign-ins, rate limits, refused bodies and writes — readable the next morning without keeping anything about who | Learning log 14 |
| Why not log every rejection? | Failures are attacker-controlled: a row each would be a denial-of-service vector. Hourly buckets are bounded | MODEL §4 |
| Where are your backups, and who can read them? | A weekly workflow run, encrypted to a public key; the private half is on my machine and in my password manager. Tested: dumped, encrypted, decrypted, restored | RUNBOOK §4, §8 |
| Where does the data live, and does it matter? | Frankfurt: the cluster, and the functions beside it. Found the functions running in Washington by reading a response header, and pinned the region in `vercel.json` | Learning log 13 |
| What did deployment change about your security? | It turned a threat model into something testable from outside: the 403/401 checks in DEPLOY.md §4 are run against the real site | DEPLOY.md |
| Tell me about a bug you found in production | Two, on release day: a strict schema refusing a legacy field, and `undefined` becoming `null` in BSON so the validator refused the write. Both fixed, both covered by tests, both written up | Learning log 13 |

**TLS, the keys (TLS 1.3):**
- **The server's long-term key pair**, whose public half is in its certificate. It *signs* the handshake,
  proving the server is who the certificate says. The certificate itself is signed by a certificate
  authority, whose public key the browser already trusts.
- **One ephemeral key pair on each side** (ECDHE). The two sides combine them into a shared secret nobody
  else can compute. Because they're thrown away afterwards, recorded traffic can't be decrypted later,
  even if the server's long-term key leaks (*forward secrecy*).
- **Symmetric keys derived from that secret**: separate keys for each direction (and for the handshake
  and the data), used with AES-GCM or ChaCha20-Poly1305 for everything after the handshake.

So: asymmetric to prove identity and agree on a secret, symmetric for speed.

## SE_06 NoSQL: the demo (about 10 minutes)

1. **The app (1 min).** Tick something, sync. The header shows "Synced with account".
2. **The model (2 min).** [MODEL.md §2](nosql/MODEL.md#2-diagram), the diagram. In Compass, open a
   `tracks` document (everything embedded) and a few `completions` (one per day: the bucket pattern).
   Say why: small, owned, read together → embed; unbounded → buckets; no user input as field names.
3. **Two devices (2 min).** A normal window and a private window on `localhost:3000` are two "devices"
   (separate cookies and IndexedDB). Sign in in both: the fresh one *adopts* the account's data. Tick a
   different box in each, sync both, and both have both ticks. That's a per-item merge on the server,
   inside a transaction.
4. **Search and history (2 min).** Menu → Search & insights. Search a word from a book title, then its
   plural (stemming). The charts come from aggregation pipelines: open
   `lib/server/insights/stats.ts` and walk `byMonth`, then the gaps-and-islands `longestStreaks`.
5. **Performance (1.5 min).** [PERFORMANCE.md](nosql/PERFORMANCE.md): 572,152 documents examined without
   the index, 27 with it; the ESR rule (1,421 vs 336 keys). Or run `npm run db:explain` live (about
   30 s).
6. **Resilience (1.5 min).** `npm run demo:failover` live: the new primary in 0.3 s and no write lost.
   Then `-- --crash` if there's time (10.8 s, a retried write). Explain `w: majority`.

7. **If there's time (1 min).** `db.securityEvents.find()` and `db.rateLimits.find()`: two collections
   that exist for operational reasons, both counting rather than listing, both cleaned up by TTL
   indexes rather than a cron job. It's the clearest case of the access pattern deciding the shape.

**Queries to have ready in `mongosh`** (`npm run db:shell`, as the app's user):

```js
const me = db.users.findOne({ email: "<your email>" })._id
db.tracks.find({ userId: me }, { "meta.name": 1, "materials.title": 1 })
db.completions.find({ userId: me }).sort({ date: -1 }).limit(3)
db.completions.aggregate([
  { $match: { userId: me } },
  { $group: { _id: { $substrBytes: ["$date", 0, 7] }, days: { $sum: 1 } } },
  { $sort: { _id: 1 } },
])
db.tracks.find({ userId: me, $text: { $search: "algebra" } }).explain("executionStats").executionStats
```

## SE_06 NoSQL: the questions

The "Exam questions" sections of learning log entries 4, 7, 9, 10 and 11 cover the objectives. The ones
that come up most:
- *Why a document database here, and not relational?* MODEL.md §10.
- *Embedding or referencing?* MODEL.md §4.
- *Why not one document per user?* The 16 MB cap and write amplification.
- *How do you keep data consistent without joins?* Transactions, unique indexes, validators, and the
  application-level cascade in account deletion (MODEL.md §7).
- *How does your full-text search work?* Learning log 9.
- *What does an index cost?* Space (the text index is about 3× the tracks' size on disk) and a little on
  every write.
- *Replication, election, write concern?* RESILIENCE.md.
- *Sharding?* `{userId: "hashed"}`, and why not the date (MODEL.md §9).
- *How much data did you test with?* DATA.md.
- *Mongoose or the native driver?* Both, each where it fits (MODEL.md §6 and learning log 7).
- *How many collections, and why that many?* Seven: five for the data, two operational (`rateLimits`,
  `securityEvents`), both counting per time window so a flood costs one document (MODEL.md §1, §4).
- *What happens to old data?* TTL indexes: sessions at 30 days, audit entries at 90, security counters
  at 30, rate counters within minutes (MODEL.md §5).
