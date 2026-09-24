# Cyber Security: the oral

One-to-one, 15 to 30 minutes, laptop open: a **5-minute technical presentation on the security
methods you applied**, then questions.

The concepts behind each step, and more questions, are in [`../LEARNING_LOG.md`](../LEARNING_LOG.md) —
entries 1, 3, 5, 6, 8, 11, 12, 13 and 14 are the security ones.

Shared checklist for the day before all three exams: [`day-before.md`](day-before.md).

## Cyber Security: the 5-minute talk

Aim for about 45 seconds a part. Show the diagram and one or two files; don't read slides.

1. **What it is (0:00).** Horizon: an offline-first tracker. Signed in with Google, it syncs through a
   Next.js API to MongoDB. Show the diagram in [THREAT_MODEL.md §3](../security/THREAT_MODEL.md#3-the-system).
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
| OAuth 2.0 vs OpenID Connect? | OAuth 2.0 grants *access* — Horizon used it for Drive sync until 0.32.0, an access token for one scope and no identity. OpenID Connect answers *who*: an ID token the server verifies, granting access to nothing. Dropping Drive left only the second, which is why no sensitive scope remains | Learning log 5 |
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
