# SE_09 — Cyber Security

Based on Horizon's security work. **Claim Level 3.**

| File | What it is |
|---|---|
| [exam.md](exam.md) | The drill: how to practise, the 5-minute talk, commands that prove each claim, 25 cold-call questions |
| [cheat-sheet.md](cheat-sheet.md) | The theory the repo can't answer for you — goals, crypto, signatures, TLS, layer 3 |
| [self-assessment.md](self-assessment.md) | Scaffold for the reflection essay. **Your own words** |

Reference material stays in the repo, because it documents the software:
[THREAT_MODEL.md](../../docs/security/THREAT_MODEL.md) ·
[MEASURES.md](../../docs/security/MEASURES.md) ·
[RUNBOOK.md](../../docs/security/RUNBOOK.md) ·
[SECURITY.md](../../SECURITY.md) ·
[DEPLOY.md](../../docs/DEPLOY.md)

## Hand-ins → where they are

| Required | Where |
|---|---|
| Code base, read access for `peterruppel` | the repository |
| Project and code documentation | [`README.md`](../../README.md), [`docs/README.md`](../../docs/README.md) |
| **A threat model description** | [`docs/security/THREAT_MODEL.md`](../../docs/security/THREAT_MODEL.md) — DFD, 6 trust boundaries, STRIDE, 44 threats rated L×I, accepted risks with reasons |
| **A list of implemented measures** | [`docs/security/MEASURES.md`](../../docs/security/MEASURES.md) — every measure, the threat IDs it answers, the file, and the test that proves it |

## Level mapping

### Level 1 — all six objectives

| Objective | Where |
|---|---|
| Dimensions of cyber security | THREAT_MODEL §8 (by goal), §7 (by layer) |
| Perform a threat model analysis | THREAT_MODEL §1–§6, written before the server existed |
| Threats and mitigations per layer | THREAT_MODEL §7: physical, network, transport, application, dev & ops |
| AuthN, authZ, validation, encryption, signing, key management | MEASURES §1–§3; [cheat-sheet.md](cheat-sheet.md) for the theory |
| Securing web applications | MEASURES §4 — CSP, HSTS, `__Host-` cookie, CSRF checks, markdown escaping |
| Securing the life cycle and operation | MEASURES §7 and §6 |

### Level 2 — *comprehensively secure a live application, and its life cycle and operations*

| | Evidence |
|---|---|
| Live, outside local dev | horizonroadmap.com since 2026-09-22 — Vercel + Atlas, both `eu-central-1`, HTTPS + HSTS, CSP, least-privilege DB user, secrets write-only in Vercel |
| Comprehensively secured | 44 threats, each implemented, planned or accepted **with a stated reason**; every measure cites the test that proves it |
| Life cycle | CI on every push (types, lint, tests, build, DB tests on a real replica set), `npm audit --audit-level=high` + `npm audit signatures`, gitleaks over the whole history, Semgrep, Dependabot, actions pinned by SHA, read-only job token, `main` behind a ruleset |
| Operations | daily `ops:check` with email alerting, `/api/health` every 30 min, weekly GPG-encrypted backup, TTL retention, a runbook entry per failure mode |

### Level 3 — *independently design, operate and maintain; reason in depth*

| | Evidence |
|---|---|
| Design | A threat model made **first**, driving the implementation plan; every control traced back to a threat ID in both directions |
| Operate | The four scheduled workflows above; alerting is a failing workflow run, so there is no paid log drain and no third party holding the data |
| **Maintain** | Three real incidents, found and fixed: the CSRF hole in the local routes (0.14.4, reproduced from an attack page); a strict schema refusing real data on release day (0.21.4); `undefined` becoming `null` in BSON so a validator refused a write. All three tested afterwards |
| Reason in depth | §9 Accepted risks — ten risks, each with the trade-off written out, including the ones that are inconvenient to admit |

## Submission checklist

- [ ] Read access for **`peterruppel`** (or `peter.ruppel@code.berlin`). One project only.
- [ ] **Before granting it:** [`MODULES_PLAN.md`](../MODULES_PLAN.md) and THREAT_MODEL §9/§10 name open issues on the assumption the repo stays private. Fine for a coordinator; **not** fine public.
- [ ] Work through [exam.md](exam.md)'s four passes.
- [ ] [`../exam-day.md`](../exam-day.md) the day before.
- [ ] Self-assessment essay, in your own words.
- [ ] Submit via the hand-in form on the Learning Platform.

## Two things to fix before you hand in

1. **THREAT_MODEL §10 still has `4a, Atlas` unticked** — "least-privilege users per environment, TLS,
   secrets in Vercel only". MEASURES and DEPLOY say this *is* done (`horizon_prod`, `readWrite` on one
   database). Either tick it or write down what is still missing; an examiner reading §10 will ask.
2. **Two owner actions are still open**: check the `ufw` rules before using `dev:lan` (E2), and
   full-disk encryption plus a screen lock on the **exam laptop** (I10). The second one is visible in
   the room.
