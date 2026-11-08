# SE_06 — NoSQL Databases

Assessment material for SE_06, based on Horizon's MongoDB data layer.
**Claim Level 3** — the evidence is there, and Level 1 was only ever the floor
the plan set in week one. See *Level* below for the objective-by-objective
argument and the two soft spots.

## Your two worries, answered

> *"your data layer should demonstrate the use cases you listed for your project
> in a working application"* — how do I achieve this?

You already have. It is now written down in one place:
**[`docs/nosql/DATA_LAYER.md`](../../docs/nosql/DATA_LAYER.md)**, which traces
each of the eight listed use cases from the control a person touches, through
the client, the route and the handler, down to the MongoDB operation and the
index that serves it — and opens with five checkable facts for why it is not a
demo script:

- there is no script that queries MongoDB for show; every query runs because
  someone pressed something;
- **two independent clients** drive the same five endpoints: the website and the
  Expo phone app;
- it is **deployed and in daily use** (Atlas, Frankfurt, since 2026-09-22), with
  a health check every 30 minutes;
- it is tested against a **real replica set**, transactions included —
  `npm run test:db`, 59 tests in 6 files;
- it survives a primary failure mid-write — `npm run demo:failover`.

> *"instructions for how to set up a development environment … Most importantly,
> how to set up or connect to your database. I might have to do those on the
> spot."*

**[`docs/nosql/SETUP.md`](../../docs/nosql/SETUP.md)** is written for exactly
that: an unfamiliar machine, someone watching. Four commands, what each one
should print, measured timings, every failure seen so far with its fix, and —
if Docker is unavailable on the day — how to point the app at a free Atlas
cluster instead, which needs no manual schema setup because the app creates its
own collections, validators and indexes.

Verified end to end on **2026-11-08**:

| | |
|---|---|
| `npm run db:up` from cold | 13 s, three members `Up`, `init` exits 0 |
| `npm run test:db` | 59 tests, 6 files, all pass, 2.9 s |
| `npm run demo:failover` | 28 s: new primary in 0.3 s, 130 writes acknowledged, **0 lost** |
| app on `localhost` → `GET /api/health` | `{"ok":true}` |
| `GET /api/sync`, `/api/stats` without a session | `401` with a plain message |

## Where everything is

Nothing of substance lives in this folder. The hand-in is the repository, so the
material lives where an examiner browsing it will find it:

| Hand-in requirement | Where it is |
|---|---|
| Project description and the implemented use cases, unimplemented ones marked | [`docs/nosql/README.md`](../../docs/nosql/README.md) |
| **A real data layer serving those use cases in a working app** | [`docs/nosql/DATA_LAYER.md`](../../docs/nosql/DATA_LAYER.md) · the code in `lib/server/` |
| **README with dev setup, above all how to set up or connect to the database** | [`docs/nosql/SETUP.md`](../../docs/nosql/SETUP.md) · the short version in [`README.md`](../../README.md#local-database-mongodb) |
| A clear diagram of the model, with attributes and types | [`docs/nosql/MODEL.md` §2](../../docs/nosql/MODEL.md#2-diagram) |
| A non-trivial model | [`docs/nosql/MODEL.md`](../../docs/nosql/MODEL.md) §3–§9 |
| How much data, and how it was generated | [`docs/nosql/DATA.md`](../../docs/nosql/DATA.md) |
| Performance and optimisation | [`docs/nosql/PERFORMANCE.md`](../../docs/nosql/PERFORMANCE.md) |
| Replication, distribution, sharding, resilience | [`docs/nosql/RESILIENCE.md`](../../docs/nosql/RESILIENCE.md) · sharding design in MODEL §9 |
| The reasoning, step by step | [`docs/LEARNING_LOG.md`](../../docs/LEARNING_LOG.md), entries 4, 7, 9, 10, 11, 13 |
| The oral: what to show, in what order, and the questions | [`docs/exams/nosql.md`](../../docs/exams/nosql.md) · [`docs/exams/day-before.md`](../../docs/exams/day-before.md) |
| **Practising the Level 3 claim** | [`docs/exams/nosql-level3.md`](../../docs/exams/nosql-level3.md) — every objective as a drill, with a 25-question cold call |

## Submission checklist

- [ ] **Repository link.** The repo is private, so grant **read access to the
      GitHub user `peterruppel`** before submitting. One project only.
- [ ] **Check what the repo exposes.** `MODULES_PLAN.md` names security issues
      on the assumption the repo stays private, and says so. Fine for a
      coordinator with granted access; **not** fine if you make it public.
- [ ] **Re-run the three commands** in the table above on the exam machine, not
      just this one.
- [ ] **Work through [`docs/exams/nosql-level3.md`](../../docs/exams/nosql-level3.md)**
      in its three passes: read with the documents open, say Parts A–E out loud
      with a timer, then cold-call yourself with Part G. 20 of 25 without notes
      and you are ready.
- [ ] **`docs/exams/day-before.md`** — the shared set-up checklist for all three
      exams on the day.
- [ ] **Self-assessment essay**, if SE_06 asks for one — see
      [`self-assessment.md`](self-assessment.md) and the note at the top of it.
- [ ] Submit via the platform the module uses.

## Level

`MODULES_PLAN.md` set the target at **Level 1** in week one, before any of this
existed. Read against the module's actual wording, the work reaches **Level 3**.
The full mapping, objective by objective with links, is in
[`docs/nosql/README.md`](../../docs/nosql/README.md#the-modules-objectives-and-where-each-is-met).
The short version:

**Level 1** — all nine objectives met, each mapped to a document.

**Level 2** asks for two things:

- *"design and implement an advanced use case"* — there are four, and each is
  traced end to end in `DATA_LAYER.md`: a **sync merged per item inside one
  multi-document transaction** across five collections; **longest streaks by
  gaps and islands** (`$setWindowFields` + `$documentNumber`); **weighted
  compound text search** over two collections, scoped to one user; and
  **counting rejections instead of listing them**, where the write pattern
  rather than the data chose the shape.
- *"advantages and disadvantages of different types for advanced use cases"* —
  this was the one real gap, and it is now `MODEL.md` §10's second half: those
  four use cases against document, key-value, wide-column and graph, including
  the two places where MongoDB is **not** the right tool (the rate and security
  counters belong in Redis; text search tops out below fuzzy and phrase
  matching) and why it is still used for them.

**Level 3** asks for two more:

- *"independently design, operate and maintain in a production or
  production-like environment"* — live on Atlas since 2026-09-22 with a
  least-privilege user and a network access list; a **weekly encrypted backup**
  whose restore was tested and **found broken the first time**; a **daily
  operations check** and an **uptime check every 30 minutes**, both scheduled in
  CI; retention by TTL index rather than cron; a documented response per failure
  mode; and CI that stands up its own three-member replica set on every push.
  Operating it also produced a real incident — `0.21.4`, where the live sync
  refused a device's own old track — found, diagnosed, fixed and regression-tested.
- *"reason about own design decisions in great depth and comprehensibility"* —
  `MODEL.md` §4, §9 and §10, `PERFORMANCE.md` measuring the index decisions
  instead of asserting them, and `LEARNING_LOG.md` recording each decision as it
  was made.

### The two soft spots, so you hear them from me first

1. **Sharding is designed, never run.** `{userId: "hashed"}` is reasoned down to
   why not the date and why not `trackId`, but the free tier cannot shard, so it
   has never been executed. Say so before you are asked. Level 3 does not require
   it — it asks you to operate *your* database, which you do — but an examiner
   may well probe there.
2. **The deployment is a free tier, and it is yours alone.** "Production" here
   means a live, publicly reachable app with real data, backups, monitoring and a
   runbook — not scale. Frame it that way and it holds; frame it as a large
   system and it will not.

Claim Level 3, lead with the operations evidence, and name both of these
yourself.

## The one thing that is not done yet

`docs/nosql/MODEL.md`'s ER diagram was refreshed on 2026-11-08 to match
`lib/types.ts` as it stands (`meta.order`, `restDaysFrom`, `panelColumns`,
`hiddenPanels`, task descriptions, rest days, and the rest). The prose around
it, §3's example documents especially, was written on 2026-09-22 and is still
accurate because `lib/server/collections.ts` has not changed since — but if you
touch the schema again before the exam, that is the pair of files to re-check.
