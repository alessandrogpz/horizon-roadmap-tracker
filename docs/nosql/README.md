# Horizon and MongoDB

Horizon is a roadmap and habit tracker: you plan a learning (or fitness, or work) track in phases, tick
off daily tasks, log what you've done, keep notes on your materials, and watch your streak. It works
offline in the browser. Signed in with Google, your data syncs through your own account to MongoDB, where
it can also be searched and analysed.

This folder documents the database side, for the SE_06 NoSQL module.

| Document | What's in it |
|---|---|
| [MODEL.md](MODEL.md) | The data model: diagram with attributes and types, collections, design decisions, indexes, validation, consistency, schema evolution, sharding, and why a document database |
| [DATA_LAYER.md](DATA_LAYER.md) | Every use case traced from the UI through the route to the data-layer function, the MongoDB operation and the index that serves it |
| [SETUP.md](SETUP.md) | Setting up the development environment and the database from nothing, with timings, what each step should print, and what to do when it doesn't |
| [DATA.md](DATA.md) | The generated dataset: how it's made, and its counts and sizes |
| [PERFORMANCE.md](PERFORMANCE.md) | `explain()` measurements of the app's queries, with and without their indexes |
| [RESILIENCE.md](RESILIENCE.md) | Replication and failover, measured; write concern, read concern, read preference |
| [`../LEARNING_LOG.md`](../LEARNING_LOG.md) | How it was built, step by step, with the concepts behind each step |

## Use cases

Each one traced from the control a person touches down to the query and its index in
[DATA_LAYER.md](DATA_LAYER.md).

| # | Use case | Status | Where |
|---|---|---|---|
| 1 | Sign in with Google; stay signed in on this browser | **Implemented** (0.18.0) | `lib/server/auth/`, Settings → Account |
| 2 | Sync tracks, daily progress and notes between devices, merging concurrent changes | **Implemented** (0.19.0) | `lib/server/sync/`, the sync button |
| 3 | Search every track, material, phase, roadmap and note | **Implemented** (0.20.0) | `lib/server/insights/search.ts`, Search & insights |
| 4 | History: active days, weekday habits, months, per-track totals and longest streaks | **Implemented** (0.20.0) | `lib/server/insights/stats.ts`, Search & insights |
| 5 | Use the app without an account, offline | **Implemented** (IndexedDB, before this module) | `lib/localDb.ts` |
| 6 | Delete my account and all its data from the server | **Implemented** (0.21.0) | `lib/server/account/`, Settings → Account |
| 7 | Share a track with someone else | **Not planned** (the model keeps every user's data separate) | — |
| 8 | See what the server has been refusing, without keeping anything personal | **Implemented** (0.22.0) | `lib/server/securityEvents.ts`, `npm run ops:check` |

## The module's objectives, and where each is met

### Level 1

| Objective | Where |
|---|---|
| Define and adapt data models to meet business/project needs | [MODEL.md](MODEL.md) §1–4; schema evolution §8 |
| Advantages and disadvantages of NoSQL compared to relational | [MODEL.md](MODEL.md) §10 |
| Concepts, characteristics and significance of NoSQL | [MODEL.md](MODEL.md) §4, §7 |
| Limitations of NoSQL | [MODEL.md](MODEL.md) §7 (no foreign keys, so the cascade is the application's) and §10 |
| Advantages and disadvantages of the different types of NoSQL database | [MODEL.md](MODEL.md) §10 |
| Use a query or full-text search function | Use cases 3 and 4; traced in [DATA_LAYER.md](DATA_LAYER.md) §2 |
| Optimise the data structure for huge amounts of data, performance, efficiency | [PERFORMANCE.md](PERFORMANCE.md), [DATA.md](DATA.md), indexes in [MODEL.md](MODEL.md) §5 |
| Interact through source code: direct access through plain database objects **and** indirect access through a framework | Native driver for sync writes, search and aggregation; Mongoose for users, sessions and notes — [DATA_LAYER.md](DATA_LAYER.md) §3, [MODEL.md](MODEL.md) §6 |
| Understand and apply replication, distribution, sharding and resilience | [RESILIENCE.md](RESILIENCE.md) (measured failover, write/read concern, read preference); sharding design in [MODEL.md](MODEL.md) §9 |

### Level 2

| Objective | Where |
|---|---|
| Design and implement an **advanced use case** with a NoSQL database | Four of them, each traced in [DATA_LAYER.md](DATA_LAYER.md) §2: a **sync merged per item inside one multi-document transaction** across five collections (use case 2); **longest streaks by gaps and islands** with `$setWindowFields` and `$documentNumber` (use case 4); **weighted compound text search** over two collections, scoped to one user (use case 3); and **counting rejections instead of listing them**, where the access pattern rather than the data chose the shape (use case 8) |
| Advantages and disadvantages of the different types of NoSQL database **for advanced use cases** | [MODEL.md](MODEL.md) §10, *The same comparison, use case by use case* — each of those four against document, key-value, wide-column and graph, including the two places where MongoDB is **not** the best tool and why it is still used |

### Level 3

| Objective | Where |
|---|---|
| Independently design, **operate and maintain** the database in a production or production-like environment | Live on MongoDB Atlas since 2026-09-22 ([`../DEPLOY.md`](../DEPLOY.md)): a least-privilege `horizon_prod` user, a network access list, a **weekly encrypted backup** with a restore that was tested and found broken the first time ([`../security/RUNBOOK.md`](../security/RUNBOOK.md) §4, §8), a **daily operations check** (`npm run ops:check`, `.github/workflows/ops.yml`), an **uptime check every 30 minutes** against `/api/health`, retention enforced by TTL indexes rather than a cron job, and a documented response for each failure ([`../security/RUNBOOK.md`](../security/RUNBOOK.md) §2–§7). CI stands up its own three-member replica set and runs the database tests on every push |
| Reason about own design decisions in great depth and comprehensibility | [MODEL.md](MODEL.md) §4 (every embed/reference/bucket decision with its reason), §9 (why `{userId: "hashed"}` and not the date or `_id`), §10; [PERFORMANCE.md](PERFORMANCE.md) measures the index decisions instead of asserting them; [`../LEARNING_LOG.md`](../LEARNING_LOG.md) records each decision as it was made, with what it cost |
| **Maintenance in practice** (not a listed objective, but the evidence for the one above) | `0.21.4`: on the day it went live, the first sync of a device holding an old track answered *"Malformed request."* — the track carried `lastUpdatedDates`, a field the app had retired, and the zod request schema refuses any key it does not list. A real production incident in the data layer, diagnosed, fixed, covered by a regression test, and the sharpest argument for why the schema-versioning pattern (§8) is there |

## Setting up and connecting

**Locally**, with Docker:

```bash
npm run db:up
```

This starts a three-member replica set on `127.0.0.1:27017–27019`, creates its users, and writes the
connection strings into `.env.local`. The app connects with `MONGODB_URI`. Measured from cold on
2026-11-08: 13 s for the database, then `npm run test:db` green in 2.9 s (59 tests).

**[SETUP.md](SETUP.md) is the full walk-through**: what the machine needs, what each step should
print, every failure mode seen so far with its fix, and how to point the app at MongoDB Atlas instead
when Docker isn't available. The shorter version is in the main
[README](../../README.md#local-database-mongodb).

| Command | What it does |
|---|---|
| `npm run db:up` / `db:down` / `db:reset` | Start / stop / wipe the local database |
| `npm run db:shell` | `mongosh` as the app's user |
| `npm run test:db` | Database tests: sign-in, sync, search, stats, rate limits, account deletion (against `horizon_test`) |
| `npm run db:seed` | Generate the large dataset into `horizon_perf` (2,000 users, a year each) |
| `npm run db:explain` | Measure the queries on it, and rewrite `PERFORMANCE.md` |
| `npm run demo:failover` | Stop the primary mid-writes, and show nothing is lost (`-- --crash` to kill it) |
| `npm run ops:check` | What the last day held: accounts, and the counters the server keeps when it refuses something |
| `npm run db:backup` | Back it up (`-- --uri-env ATLAS_URI` for the deployed one, `--encrypt-to ops/backup-key.pub` to encrypt) |

**Deployed** since 2026-09-22 at [horizonroadmap.com](https://horizonroadmap.com): MongoDB Atlas (free
tier, AWS Frankfurt `eu-central-1`), reached through the `MONGODB_URI` environment variable in Vercel,
whose functions run in the same region. The database user `horizon_prod` has `readWrite` on the
`horizon` database and nothing else. Step by step, including the network access list and what the
connection string must contain: [`../DEPLOY.md`](../DEPLOY.md). The cluster is backed up weekly by a
scheduled workflow, encrypted so that only the owner can read it ([`../security/RUNBOOK.md`](../security/RUNBOOK.md) §8).

## How much data, and how it was generated

Real use is small: about 28 KB for a year of one user's tracks. To test the model at scale,
`scripts/seed.ts` generates **2,000 users with 572,152 day documents (251 MB of data, 48 MB on disk)**
from the app's own templates, with realistic habits and a fixed random seed. The details and sizes are in
[DATA.md](DATA.md).
