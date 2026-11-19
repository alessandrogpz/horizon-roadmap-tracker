# What is where

Every document in this project, what it is for, and when to open it.

## Start here

The [root README](../README.md) is the entry point and groups everything below by
[Diátaxis](https://diataxis.fr) mode — tutorial, how-to, reference, explanation. This file is the
flat index.

| If you want | Read |
|---|---|
| To understand the app and run it | [`../README.md`](../README.md) |
| To understand how it is put together | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| To set up the database from nothing | [`nosql/SETUP.md`](nosql/SETUP.md) |
| To put it on a phone | [`INSTALL.md`](INSTALL.md) |
| To understand the phone app | [`MOBILE.md`](MOBILE.md) |
| To know what the app actually does | [`FEATURES.md`](FEATURES.md) |
| To know what changed and when | [`../CHANGELOG.md`](../CHANGELOG.md) |
| The workflow: branches, checks, versioning | [`../DEVELOPMENT.md`](../DEVELOPMENT.md) |

## The database

| Document | What's in it |
|---|---|
| [`nosql/README.md`](nosql/README.md) | The entry point: the use cases the data layer serves, and where each objective is met |
| [`nosql/SETUP.md`](nosql/SETUP.md) | Development environment and database from nothing: what the machine needs, what each step prints, measured timings, every failure mode with its fix, and Atlas when Docker isn't available |
| [`nosql/DATA_LAYER.md`](nosql/DATA_LAYER.md) | Every use case traced from the control a person touches, through client, route and handler, to the MongoDB operation and the index that serves it |
| [`nosql/MODEL.md`](nosql/MODEL.md) | The data model: every collection with its fields and types, a diagram, why each design choice was made, indexes, validation, consistency, schema evolution, sharding, and document vs relational |
| [`nosql/DATA.md`](nosql/DATA.md) | The generated dataset: how `npm run db:seed` makes 2,000 users and 572,152 days, and what it weighs |
| [`nosql/PERFORMANCE.md`](nosql/PERFORMANCE.md) | `explain()` on the real queries, with and without their indexes, including the ESR rule measured |
| [`nosql/RESILIENCE.md`](nosql/RESILIENCE.md) | Replication and failover, measured: write concern, read concern, read preference, and what a stopped primary costs |
| [`nosql/explain/`](nosql/explain) | The raw `explain("executionStats")` output behind PERFORMANCE.md |

## Security

| Document | What's in it |
|---|---|
| [`security/THREAT_MODEL.md`](security/THREAT_MODEL.md) | The data-flow diagram, six trust boundaries, 44 STRIDE threats rated likelihood × impact, what each one's answer is, and the risks accepted on purpose with their reasons |
| [`security/MEASURES.md`](security/MEASURES.md) | Every implemented measure, the threats it answers, the file that implements it, and the test that proves it |
| [`security/RUNBOOK.md`](security/RUNBOOK.md) | What to do when something happens: a compromised session, a leaked password, a restore, a vulnerable dependency, an alert firing — §7 is the alert guide, §8 the one-time setup |
| [`../SECURITY.md`](../SECURITY.md) | How to report a vulnerability in this project |

## Building, deploying, operating

| Document | What's in it |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the three clients share one core, the layering inside the web app, the directory tree, the local-only endpoints, the GitHub rate-limit budget, and the logo |
| [`INSTALL.md`](INSTALL.md) | Installing it on a phone as a PWA or as the Android app, and what the Android app adds |
| [`MOBILE.md`](MOBILE.md) | The phone app: why not a wrapper, the framework decision and its cost, what is shared with the web app, the four device stores, lifecycle and state restoration, and rollout |
| [`DEPLOY.md`](DEPLOY.md) | Putting it live: the Atlas user and network access, Vercel's variables and region, the release, and the checks afterwards |
| [`../mobile/README.md`](../mobile/README.md) | The phone app day to day: the dev loop, when a rebuild is unavoidable, over-the-air updates, the two build variants, and the Google credentials each needs |

## The parts of the system, and where each is documented

| Feature | Code | Documented in |
|---|---|---|
| Offline-first tracker (tracks, days, notes, streaks) | `lib/`, `components/` | [`../README.md`](../README.md) |
| Sign in with Google (OpenID Connect) | `lib/server/auth/` | MEASURES "Authentication and sessions" |
| Server-side sessions | `lib/server/auth/session.ts` | threat model S3, S4 |
| Sync through the account, merged in a transaction | `lib/server/sync/` | DATA_LAYER use case 2; MODEL §3, §7 |
| Search and history, computed by MongoDB | `lib/server/insights/` | DATA_LAYER use cases 3–4; MODEL §5; PERFORMANCE |
| Rate limiting | `lib/server/rateLimit.ts` | threat model D2 |
| Delete your account and its data | `lib/server/account/` | DATA_LAYER use case 6; threat model T10 |
| Validation, two layers (zod, then `$jsonSchema`) | `lib/server/sync/schema.ts`, `lib/server/collections.ts` | MODEL §6; DATA_LAYER §4 |
| Security counters, health check, daily check | `lib/server/securityEvents.ts`, `lib/server/health.ts`, `scripts/ops-check.ts` | MEASURES "Detection and response"; RUNBOOK §7 |
| Backups, encrypted and scheduled | `scripts/backup.ts`, `.github/workflows/backup.yml`, `ops/` | RUNBOOK §4, §8 |
| CI, dependency audit, secret scan, static analysis | `.github/workflows/ci.yml`, `.github/dependabot.yml` | MEASURES "Development life cycle" |
| The phone app: shared core, SQLite, sign-in, sync | `mobile/src/` | [`MOBILE.md`](MOBILE.md), [`../mobile/README.md`](../mobile/README.md) |
| Replica set, failover, the generated dataset | `compose.yaml`, `scripts/{seed,explain,failover}.ts` | RESILIENCE; DATA |

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
