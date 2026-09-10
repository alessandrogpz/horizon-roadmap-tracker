# Horizon and MongoDB

Horizon is a roadmap and habit tracker: you plan a learning (or fitness, or work) track in phases, tick
off daily tasks, log what you've done, keep notes on your materials, and watch your streak. It works
offline in the browser. Signed in with Google, your data syncs through your own account to MongoDB, where
it can also be searched and analysed.

This folder documents the database side, for the SE_06 NoSQL module.

| Document | What's in it |
|---|---|
| [MODEL.md](MODEL.md) | The data model: diagram with attributes and types, collections, design decisions, indexes, validation, consistency, schema evolution, sharding, and why a document database |
| [DATA.md](DATA.md) | The generated dataset: how it's made, and its counts and sizes |
| [PERFORMANCE.md](PERFORMANCE.md) | `explain()` measurements of the app's queries, with and without their indexes |
| [RESILIENCE.md](RESILIENCE.md) | Replication and failover, measured; write concern, read concern, read preference |
| [`../LEARNING_LOG.md`](../LEARNING_LOG.md) | How it was built, step by step, with the concepts behind each step |

## Use cases

| # | Use case | Status | Where |
|---|---|---|---|
| 1 | Sign in with Google; stay signed in on this browser | **Implemented** (0.18.0) | `lib/server/auth/`, Settings → Account |
| 2 | Sync tracks, daily progress and notes between devices, merging concurrent changes | **Implemented** (0.19.0) | `lib/server/sync/`, the sync button |
| 3 | Search every track, material, phase, roadmap and note | **Implemented** (0.20.0) | `lib/server/insights/search.ts`, Search & insights |
| 4 | History: active days, weekday habits, months, per-track totals and longest streaks | **Implemented** (0.20.0) | `lib/server/insights/stats.ts`, Search & insights |
| 5 | Use the app without an account, offline | **Implemented** (IndexedDB, before this module) | `lib/localDb.ts` |
| 6 | Delete my account and all its data from the server | **Not yet implemented** | planned |
| 7 | Share a track with someone else | **Not planned** (the model keeps every user's data separate) | — |

Level 1 objectives, and where each is met:

| Objective | Where |
|---|---|
| Define and adapt a data model to the project's needs | [MODEL.md](MODEL.md) §1–4; schema evolution §8 |
| NoSQL vs relational, pros and cons | [MODEL.md](MODEL.md) §10 |
| NoSQL concepts, characteristics, limitations | [MODEL.md](MODEL.md) §4, §7, §10 |
| The NoSQL types and their trade-offs | [MODEL.md](MODEL.md) §10 |
| A query or full-text search function | Use cases 3 and 4 |
| Optimise for large data, performance, efficiency | [PERFORMANCE.md](PERFORMANCE.md), [DATA.md](DATA.md), indexes in [MODEL.md](MODEL.md) §5 |
| Access the database directly and through a framework | Native driver for sync writes, search and aggregation; Mongoose for users, sessions and notes ([MODEL.md](MODEL.md) §6, `lib/server/`) |
| Replication, distribution, sharding, resilience | [RESILIENCE.md](RESILIENCE.md); sharding design in [MODEL.md](MODEL.md) §9 |

## Setting up and connecting

**Locally**, with Docker:

```bash
npm run db:up
```

This starts a three-member replica set on `127.0.0.1:27017–27019`, creates its users, and writes the
connection strings into `.env.local`. The app connects with `MONGODB_URI`. The full walk-through,
including `mongosh` and MongoDB Compass, is in the main [README](../../README.md#local-database-mongodb).

| Command | What it does |
|---|---|
| `npm run db:up` / `db:down` / `db:reset` | Start / stop / wipe the local database |
| `npm run db:shell` | `mongosh` as the app's user |
| `npm run test:db` | Database tests: sync, search, stats, rate limits (against `horizon_test`) |
| `npm run db:seed` | Generate the large dataset into `horizon_perf` (2,000 users, a year each) |
| `npm run db:explain` | Measure the queries on it, and rewrite `PERFORMANCE.md` |
| `npm run demo:failover` | Stop the primary mid-writes, and show nothing is lost (`-- --crash` to kill it) |

**Deployed**: MongoDB Atlas (free tier, Frankfurt), connected through the `MONGODB_URI` environment
variable in Vercel. Each environment gets its own least-privilege database user. Setup steps: MODULES_PLAN.md, 4a.

## How much data, and how it was generated

Real use is small: about 28 KB for a year of one user's tracks. To test the model at scale,
`scripts/seed.ts` generates **2,000 users with 572,152 day documents (251 MB of data, 48 MB on disk)**
from the app's own templates, with realistic habits and a fixed random seed. The details and sizes are in
[DATA.md](DATA.md).
