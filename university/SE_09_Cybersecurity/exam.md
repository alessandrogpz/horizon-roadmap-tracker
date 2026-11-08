# Cyber Security — exam drill

1:1, 15–30 min. **5-minute talk on the security methods applied**, then questions.
Reference material stays in the repo: [THREAT_MODEL.md](../../docs/security/THREAT_MODEL.md),
[MEASURES.md](../../docs/security/MEASURES.md), [RUNBOOK.md](../../docs/security/RUNBOOK.md).

## How to practise

| Pass | Do this | Done when |
|---|---|---|
| 1 | Read the three reference documents once, with this sheet open | You know which document answers which question |
| 2 | Run every command in **Show it works**, in order | All outputs match |
| 3 | Deliver the 5-minute talk out loud, timed, twice | Under 5:30 without notes |
| 4 | Cold-call yourself with **Questions**, 60 s each, no notes | 20 of 25 |

## The claim

> *"I threat-modelled this before the server existed, I implemented the mitigations and tested them,
> and I run it live with monitoring, alerting and an encrypted backup. Level 3."*

## The 5-minute talk — 8 beats, ~40 s each

| # | Beat | Show |
|---|---|---|
| 1 | Offline-first tracker; Google sign-in; Next.js API; MongoDB Atlas | [THREAT_MODEL §3](../../docs/security/THREAT_MODEL.md#3-the-system) diagram |
| 2 | **Threat model first** — DFD, 6 trust boundaries, STRIDE, likelihood × impact, 44 threats, each implemented / planned / *accepted with a reason*. Written before the server existed | §6 table |
| 3 | **Found, fixed, tested** — CSRF in the local routes (0.14.4): any website could make the laptop open a file. Reproduced from a real attack page, fixed with `Origin` + `Sec-Fetch-Site` + JSON-only, 16 tests | T11 row |
| 4 | **AuthN / AuthZ** — OIDC: RS256 signature, `iss`, `aud`, `exp`, `email_verified`. Own session: 256 random bits, stored as SHA-256, `__Host-` cookie, revocable. Every query scoped to the session's user | `lib/server/auth/` |
| 5 | **Input and abuse** — strict zod, user input never a field name, `sanitizeFilter`, `$jsonSchema`, body size caps, rate limits, generic errors | MEASURES "Input handling" |
| 6 | **Life cycle** — CI every push: tests on a real replica set, `npm audit` + signatures, gitleaks over the whole history, Semgrep. Actions pinned by SHA, read-only token, `main` behind a ruleset that binds me too | `.github/workflows/ci.yml` |
| 7 | **Live, and it notices** — Atlas + functions both in Frankfurt; counters per kind per hour (never who); daily check emails on anything odd; `/api/health` every 30 min; weekly backup encrypted to a key only I hold | `.github/workflows/` |
| 8 | **Honest limits** — `'unsafe-inline'` scripts, Atlas open to any IP, deletion without step-up auth. Each with its reason | §9 Accepted risks |

**Do not** read slides. Show the diagram, two files, and one terminal.

## Show it works

Against the live site, no credentials needed. Each should print exactly what's in the last column.

| What it proves | Command | Expect |
|---|---|---|
| CSRF refused | `curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{}' https://horizonroadmap.com/api/sync` | `403` |
| Auth required | same, with `-H 'Origin: https://horizonroadmap.com'` | `401` |
| Local-only route closed | `curl -s -o /dev/null -w '%{http_code}\n' https://horizonroadmap.com/api/git` | `403` |
| Transport + browser hardening | `curl -sI https://horizonroadmap.com/ \| grep -iE 'strict-transport\|content-security\|x-frame\|referrer\|x-content'` | HSTS `max-age=63072000`, CSP, `X-Frame-Options: DENY`, `nosniff` |
| It's actually up | `curl -s https://horizonroadmap.com/api/health` | `{"ok":true}` |

Locally, with `npm run db:up` and `npm run dev`:

| What it proves | Command | Expect |
|---|---|---|
| Rate limiting | `for i in $(seq 11); do curl -s -o /dev/null -w '%{http_code} ' -X POST -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/auth/session; done; echo` | ten `4xx`, then `429` |
| Detection without surveillance | `npm run ops:check`, then `npm run db:shell` → `db.securityEvents.find()` | a kind, an hour, a count — no address, no account |
| Every mitigation is tested | `npm run test:db` | 59 pass |
| Whole suite | `npm test` | 464 pass |

In the browser (devtools → Application → Cookies): `__Host-horizon_session` is HttpOnly, Secure,
SameSite=Lax. Its SHA-256 equals the `_id` in `sessions` — that's the point.

## Questions — cold call, 60 s each

**Fundamentals**
1. Confidentiality, integrity, authenticity, availability, non-repudiation — define each, and name where your app provides it.
2. Symmetric vs asymmetric: give a contemporary example of each, and say which you'd use for what.
3. What is a digital signature? Name three places your project relies on one.
4. TLS 1.3: how many keys are involved, and what is each for?
5. What is forward secrecy, and which key gives you it?
6. How do you secure a machine at layer 3?

**Your application**
7. How does authentication work here, start to finish?
8. How does authorization work? Name two layers of it.
9. OAuth 2.0 vs OpenID Connect — what does each actually grant?
10. Why identify users by `sub` and not by email?
11. Why does the database store only a hash of the session token?
12. What does `__Host-` mean on a cookie, and what does it buy you?
13. What is CSRF? Walk through the 0.14.4 bug and your fix.
14. What is NoSQL operator injection? Show the defence.
15. Why is input validation in two layers, and what can the app's DB user *not* do?
16. Which threats are still open, and why did you accept each?

**Life cycle and operations**
17. What does CI check on every push, and what does it block?
18. A secret leaked. First three moves?
19. Where are your backups, who can read them, and when did you last restore one?
20. How would you know if the site broke at 3am?
21. How do you detect an attack without storing anything about who?
22. Why not log every rejection?
23. What did going live change about your security posture?
24. Tell me about a security bug you found in production.
25. If you had one more week, what would you secure next?

Answers: 1–6 → [cheat-sheet.md](cheat-sheet.md). 7–16 → MEASURES.md + THREAT_MODEL §6/§9.
17–25 → MEASURES "Development life cycle" / "Detection and response", RUNBOOK §3, §4, §7.

## Traps

| They ask | Say this first |
|---|---|
| "`unsafe-inline` in your CSP?" | Accepted, with a reason: Next's runtime and the pre-paint theme script need it; nonces force per-request server rendering. XSS is prevented at the source instead. |
| "Atlas is open to the internet?" | Yes — the free tier has no private networking and Vercel's egress IPs change. A strong password, TLS and a `readWrite`-on-one-database user carry it instead. |
| "Anyone with a session can delete the account." | True, and accepted: it needs a stolen session first, and every device keeps a full copy. Step-up auth stays an option. |
| "Is this really a *live* application?" | Public, real data, HTTPS+HSTS, monitored every 30 min, backed up weekly with a tested restore, and a runbook per failure. Not scale — operations. |
