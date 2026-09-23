# What is where

Every document in this project, what it is for, and when to open it.

## Start here

| If you want | Read |
|---|---|
| To understand the app and run it | [`../README.md`](../README.md) |
| To understand *how it was built and why*, step by step | [`LEARNING_LOG.md`](LEARNING_LOG.md) — 14 entries, one per step |
| To sit the exams | [`ORAL_PREP.md`](ORAL_PREP.md) — one file per exam in [`exams/`](exams) |
| To know what changed and when | [`../CHANGELOG.md`](../CHANGELOG.md) |

## SE_06 NoSQL Databases

| Document | What's in it |
|---|---|
| [`nosql/README.md`](nosql/README.md) | The module's entry point: use cases, which Level 1 objective is met where, how to run the database locally and how the deployed one is set up |
| [`nosql/MODEL.md`](nosql/MODEL.md) | The data model: every collection with its fields and types, a diagram, why each design choice was made (embedding, the bucket pattern, counting instead of listing), indexes, validation, consistency, schema evolution, sharding, and NoSQL vs relational |
| [`nosql/DATA.md`](nosql/DATA.md) | The generated dataset: how `npm run db:seed` makes 2,000 users and 572,152 days, and what it weighs |
| [`nosql/PERFORMANCE.md`](nosql/PERFORMANCE.md) | `explain()` on the app's real queries, with and without their indexes, including the ESR rule measured |
| [`nosql/RESILIENCE.md`](nosql/RESILIENCE.md) | Replication and failover, measured: write concern, read concern, read preference, and what a stopped primary costs |
| [`nosql/explain/`](nosql/explain) | The raw `explain("executionStats")` output behind PERFORMANCE.md |

## Cyber Security

| Document | What's in it |
|---|---|
| [`security/THREAT_MODEL.md`](security/THREAT_MODEL.md) | The data-flow diagram, six trust boundaries, 43 STRIDE threats rated likelihood × impact, what each one's answer is, and the risks accepted on purpose with their reasons |
| [`security/MEASURES.md`](security/MEASURES.md) | Every implemented measure, the threats it answers, the file that implements it, and the test that proves it |
| [`security/RUNBOOK.md`](security/RUNBOOK.md) | What to do when something happens: a compromised session, a leaked password, a restore, a vulnerable dependency, an alert firing, and the one-time settings — §7 is the alert guide, §8 the setup |
| [`../SECURITY.md`](../SECURITY.md) | How to report a vulnerability in this project |

## Building, deploying, operating

| Document | What's in it |
|---|---|
| [`../DEVELOPMENT.md`](../DEVELOPMENT.md) | The workflow: branches, the checks that must pass before `main`, and the versioning rules |
| [`exams/security.md`](exams/security.md), [`exams/nosql.md`](exams/nosql.md), [`exams/mobile.md`](exams/mobile.md) | One per oral exam: what to show, in what order, and the questions with short answers. [`exams/day-before.md`](exams/day-before.md) is the shared set-up checklist |
| [`DEPLOY.md`](DEPLOY.md) | Putting it live: the Atlas user and network access, Vercel's variables and region, the release, and the checks afterwards |
| [`../mobile/README.md`](../mobile/README.md) | Working on the phone app day to day: the dev loop, when a rebuild is unavoidable, over-the-air updates, the two build variants, and the Google credentials each one needs |
| [`../MOBILE_PLAN.md`](../MOBILE_PLAN.md) | The mobile module's plan: the framework decision and what it cost, storage options, lifecycle, rollout, scope and schedule |
| [`../MODULES_PLAN.md`](../MODULES_PLAN.md) | The plan both modules follow, with its progress note, the decisions taken and why, and the exam question map |
| [`../AGENTS.md`](../AGENTS.md), [`../CLAUDE.md`](../CLAUDE.md) | Instructions for AI assistants working in this repository |

## The parts of the system, and where each is documented

| Feature | Code | Documented in |
|---|---|---|
| Offline-first tracker (tracks, days, notes, streaks) | `lib/`, `components/` | [`../README.md`](../README.md) |
| Sign in with Google (OpenID Connect) | `lib/server/auth/` | Learning log 5; MEASURES "Authentication and sessions" |
| Server-side sessions | `lib/server/auth/session.ts` | Learning log 5; threat model S3, S4 |
| Sync through the account, merged in a transaction | `lib/server/sync/` | Learning log 7; MODEL §3, §7 |
| Search and history, computed by MongoDB | `lib/server/insights/` | Learning log 9; MODEL §5; PERFORMANCE |
| Rate limiting | `lib/server/rateLimit.ts` | Learning log 8; threat model D2 |
| Delete your account and its data | `lib/server/account/` | Learning log 11; threat model T10 |
| Validation, two layers (zod, then `$jsonSchema`) | `lib/server/sync/schema.ts`, `lib/server/collections.ts` | Learning log 7 and 13; MODEL §6 |
| Security counters, health check, daily check | `lib/server/securityEvents.ts`, `lib/server/health.ts`, `scripts/ops-check.ts` | Learning log 14; MEASURES "Detection and response"; RUNBOOK §7 |
| Backups, encrypted and scheduled | `scripts/backup.ts`, `.github/workflows/backup.yml`, `ops/` | Learning log 14; RUNBOOK §4, §8 |
| CI, dependency audit, secret scan, static analysis | `.github/workflows/ci.yml`, `.github/dependabot.yml` | Learning log 12; MEASURES "Development life cycle" |
| The phone app: shared core, SQLite, sign-in, sync | `mobile/src/` | Learning log 15; [`../MOBILE_PLAN.md`](../MOBILE_PLAN.md) |
| The step counter, permissions, share sheet, deep links | `mobile/src/steps/`, `mobile/src/share/`, `mobile/src/app/track/` | Learning log 16; [`exams/mobile.md`](exams/mobile.md) |
| Replica set, failover, the generated dataset | `compose.yaml`, `scripts/{seed,explain,failover}.ts` | Learning log 4 and 10; RESILIENCE; DATA |

## The scripts

| Command | Does |
|---|---|
| `npm run dev` / `build` / `start` | The app |
| `npm test` / `npm run test:db` | Tests without a database / tests against the local replica set |
| `npm run db:up` / `db:down` / `db:reset` | Start / stop / wipe the local three-member replica set |
| `npm run db:shell` | `mongosh` as the app's user |
| `npm run db:seed` / `db:explain` | Generate the large dataset / measure the queries on it |
| `npm run demo:failover` | Stop the primary mid-writes and show nothing is lost |
| `npm run db:backup` | Back up, optionally encrypted (`--encrypt-to ops/backup-key.pub`) |
| `npm run ops:check` | What the last day held, and whether any counter is out of character |
