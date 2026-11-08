# Horizon and MongoDB

Horizon is a roadmap and habit tracker: you plan a learning (or fitness, or work) track in phases, tick
off daily tasks, log what you've done, keep notes on your materials, and watch your streak. It works
offline in the browser. Signed in with Google, your data syncs through your own account to MongoDB, where
it can also be searched and analysed.

This folder documents the database side of Horizon.

| Document | What's in it |
|---|---|
| [MODEL.md](MODEL.md) | The data model: diagram with attributes and types, collections, design decisions, indexes, validation, consistency, schema evolution, sharding, and why a document database |
| [DATA_LAYER.md](DATA_LAYER.md) | Every use case traced from the UI through the route to the data-layer function, the MongoDB operation and the index that serves it |
| [SETUP.md](SETUP.md) | Setting up the development environment and the database from nothing, with timings, what each step should print, and what to do when it doesn't |
| [DATA.md](DATA.md) | The generated dataset: how it's made, and its counts and sizes |
| [PERFORMANCE.md](PERFORMANCE.md) | `explain()` measurements of the app's queries, with and without their indexes |
| [RESILIENCE.md](RESILIENCE.md) | Replication and failover, measured; write concern, read concern, read preference |

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
