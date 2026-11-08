# SE_06 — NoSQL Databases

Assessment material for SE_06, based on Horizon's MongoDB data layer.
**Target level: 1** (see *Level* below — the evidence overshoots it in places).

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

## Submission checklist

- [ ] **Repository link.** The repo is private, so grant **read access to the
      GitHub user `peterruppel`** before submitting. One project only.
- [ ] **Check what the repo exposes.** `MODULES_PLAN.md` names security issues
      on the assumption the repo stays private, and says so. Fine for a
      coordinator with granted access; **not** fine if you make it public.
- [ ] **Re-run the three commands** in the table above on the exam machine, not
      just this one.
- [ ] **Walk [`docs/exams/nosql.md`](../../docs/exams/nosql.md) once out loud**,
      with a timer. It is a 10-minute demo in a 15–30 minute slot.
- [ ] **`docs/exams/day-before.md`** — the shared set-up checklist for all three
      exams on the day.
- [ ] **Self-assessment essay**, if SE_06 asks for one — see
      [`self-assessment.md`](self-assessment.md) and the note at the top of it.
- [ ] Submit via the platform the module uses.

## Level

`MODULES_PLAN.md` set the target at **Level 1**, and every Level 1 objective is
mapped to a location in [`docs/nosql/README.md`](../../docs/nosql/README.md).

Three pieces of the work go beyond what Level 1 asks, and are worth having ready
rather than claiming in writing: the database is **deployed and operated**
(Atlas, a weekly encrypted backup, a daily operations check, an uptime check);
replication is **measured**, not described; and the sharding design is reasoned
down to why `{userId: "hashed"}` and not the date. If the examiner opens the
door to a higher level, those are the three to walk through — but read SE_06's
own Level 2 and 3 wording first and claim only what it actually asks for.

## The one thing that is not done yet

`docs/nosql/MODEL.md`'s ER diagram was refreshed on 2026-11-08 to match
`lib/types.ts` as it stands (`meta.order`, `restDaysFrom`, `panelColumns`,
`hiddenPanels`, task descriptions, rest days, and the rest). The prose around
it, §3's example documents especially, was written on 2026-09-22 and is still
accurate because `lib/server/collections.ts` has not changed since — but if you
touch the schema again before the exam, that is the pair of files to re-check.
