# SE_06 — NoSQL Databases

Based on Horizon's MongoDB data layer. **Claim Level 3.**

| File | What it is |
|---|---|
| [exam.md](exam.md) | The drill: how to practise, the demo, the commands, 25 cold-call questions |
| [self-assessment.md](self-assessment.md) | Scaffold for the reflection essay. **Your own words** |

Reference material stays in the repo, because it documents the software:
[README](../../docs/nosql/README.md) · [MODEL.md](../../docs/nosql/MODEL.md) ·
[DATA_LAYER.md](../../docs/nosql/DATA_LAYER.md) · [SETUP.md](../../docs/nosql/SETUP.md) ·
[PERFORMANCE.md](../../docs/nosql/PERFORMANCE.md) · [RESILIENCE.md](../../docs/nosql/RESILIENCE.md) ·
[DATA.md](../../docs/nosql/DATA.md)

## Hand-ins → where they are

| Required | Where |
|---|---|
| Repository link, read access for `peterruppel`. One project only | the repository |
| Project description and implemented use cases, unimplemented ones marked | [`docs/nosql/README.md`](../../docs/nosql/README.md) |
| **A real data layer serving those use cases in a working app, not a demo script** | [`DATA_LAYER.md`](../../docs/nosql/DATA_LAYER.md) · the code in `lib/server/` |
| **README with dev setup, above all how to set up or connect to the database** | [`SETUP.md`](../../docs/nosql/SETUP.md) · short version in the [root README](../../README.md#local-database-mongodb) |
| A clear diagram of the model, with attributes and types | [`MODEL.md` §2](../../docs/nosql/MODEL.md#2-diagram) |
| A non-trivial model | [`MODEL.md`](../../docs/nosql/MODEL.md) §3–§9 |
| How much data, and how it was generated | [`DATA.md`](../../docs/nosql/DATA.md) |

## Your two worries, answered

**"The data layer can't be a demo script."** [`DATA_LAYER.md`](../../docs/nosql/DATA_LAYER.md) traces
all eight use cases UI → client → route → handler → MongoDB operation → index, and opens with five
facts each checkable in a minute: no query runs except because someone pressed something; **two
independent clients** (website and phone app) drive the same five endpoints; it is deployed and
health-checked every 30 minutes; 59 tests run against a real replica set; it survives a primary
failure mid-write.

**"I might have to set it up on the spot."** [`SETUP.md`](../../docs/nosql/SETUP.md) is written for an
unfamiliar machine with someone watching: four commands, what each prints, timings, every failure
mode with its fix, and Atlas when Docker isn't available.

Verified on 2026-11-08: `db:up` from cold **13 s** · `test:db` **59 tests, 2.9 s** ·
`demo:failover` **28 s, new primary 0.3 s, 0 of 130 writes lost** · `/api/health` → `{"ok":true}` ·
`/api/sync` and `/api/stats` signed out → `401`.

## Level mapping, objective by objective

### Level 1

| Objective | Where |
|---|---|
| Define and adapt data models to meet business/project needs | [MODEL.md](../../docs/nosql/MODEL.md) §1–4; schema evolution §8 |
| Advantages and disadvantages of NoSQL compared to relational | [MODEL.md](../../docs/nosql/MODEL.md) §10 |
| Concepts, characteristics and significance of NoSQL | [MODEL.md](../../docs/nosql/MODEL.md) §4, §7 |
| Limitations of NoSQL | [MODEL.md](../../docs/nosql/MODEL.md) §7 (no foreign keys, so the cascade is the application's) and §10 |
| Advantages and disadvantages of the different types of NoSQL database | [MODEL.md](../../docs/nosql/MODEL.md) §10 |
| Use a query or full-text search function | Use cases 3 and 4; traced in [DATA_LAYER.md](../../docs/nosql/DATA_LAYER.md) §2 |
| Optimise the data structure for huge amounts of data, performance, efficiency | [PERFORMANCE.md](../../docs/nosql/PERFORMANCE.md), [DATA.md](../../docs/nosql/DATA.md), indexes in [MODEL.md](../../docs/nosql/MODEL.md) §5 |
| Interact through source code: direct access through plain database objects **and** indirect access through a framework | Native driver for sync writes, search and aggregation; Mongoose for users, sessions and notes — [DATA_LAYER.md](../../docs/nosql/DATA_LAYER.md) §3, [MODEL.md](../../docs/nosql/MODEL.md) §6 |
| Understand and apply replication, distribution, sharding and resilience | [RESILIENCE.md](../../docs/nosql/RESILIENCE.md) (measured failover, write/read concern, read preference); sharding design in [MODEL.md](../../docs/nosql/MODEL.md) §9 |

### Level 2

| Objective | Where |
|---|---|
| Design and implement an **advanced use case** with a NoSQL database | Four of them, each traced in [DATA_LAYER.md](../../docs/nosql/DATA_LAYER.md) §2: a **sync merged per item inside one multi-document transaction** across five collections (use case 2); **longest streaks by gaps and islands** with `$setWindowFields` and `$documentNumber` (use case 4); **weighted compound text search** over two collections, scoped to one user (use case 3); and **counting rejections instead of listing them**, where the access pattern rather than the data chose the shape (use case 8) |
| Advantages and disadvantages of the different types of NoSQL database **for advanced use cases** | [MODEL.md](../../docs/nosql/MODEL.md) §10, *The same comparison, use case by use case* — each of those four against document, key-value, wide-column and graph, including the two places where MongoDB is **not** the best tool and why it is still used |

### Level 3

| Objective | Where |
|---|---|
| Independently design, **operate and maintain** the database in a production or production-like environment | Live on MongoDB Atlas since 2026-09-22 ([`../DEPLOY.md`](../../docs/DEPLOY.md)): a least-privilege `horizon_prod` user, a network access list, a **weekly encrypted backup** with a restore that was tested and found broken the first time ([`../security/RUNBOOK.md`](../../docs/security/RUNBOOK.md) §4, §8), a **daily operations check** (`npm run ops:check`, `.github/workflows/ops.yml`), an **uptime check every 30 minutes** against `/api/health`, retention enforced by TTL indexes rather than a cron job, and a documented response for each failure ([`../security/RUNBOOK.md`](../../docs/security/RUNBOOK.md) §2–§7). CI stands up its own three-member replica set and runs the database tests on every push |
| Reason about own design decisions in great depth and comprehensibility | [MODEL.md](../../docs/nosql/MODEL.md) §4 (every embed/reference/bucket decision with its reason), §9 (why `{userId: "hashed"}` and not the date or `_id`), §10; [PERFORMANCE.md](../../docs/nosql/PERFORMANCE.md) measures the index decisions instead of asserting them; [`../LEARNING_LOG.md`](../LEARNING_LOG.md) records each decision as it was made, with what it cost |
| **Maintenance in practice** (not a listed objective, but the evidence for the one above) | `0.21.4`: on the day it went live, the first sync of a device holding an old track answered *"Malformed request."* — the track carried `lastUpdatedDates`, a field the app had retired, and the zod request schema refuses any key it does not list. A real production incident in the data layer, diagnosed, fixed, covered by a regression test, and the sharpest argument for why the schema-versioning pattern (§8) is there |

**Soft spots, named in [exam.md](exam.md):** sharding is reasoned but never run; "production"
here means live with real data, backups and monitoring — not scale.

## Submission checklist

- [ ] Read access for **`peterruppel`**, after checking what the repo exposes ([`../README.md`](../README.md))
- [ ] Work through [exam.md](exam.md)'s four passes
- [ ] Re-run the three verification commands **on the exam laptop**, not just this one
- [ ] [`../exam-day.md`](../exam-day.md) the day before
- [ ] Self-assessment essay, in your own words
- [ ] Submit via the hand-in form on the Learning Platform
