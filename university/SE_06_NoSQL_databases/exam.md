# SE_06 NoSQL — exam drill

1:1, 15–30 min, laptop open: an overview and a **demo**, then questions.
Reference material stays in the repo: [MODEL.md](../../docs/nosql/MODEL.md) ·
[DATA_LAYER.md](../../docs/nosql/DATA_LAYER.md) · [PERFORMANCE.md](../../docs/nosql/PERFORMANCE.md) ·
[RESILIENCE.md](../../docs/nosql/RESILIENCE.md) · [SETUP.md](../../docs/nosql/SETUP.md) ·
[DATA.md](../../docs/nosql/DATA.md)

## How to practise

| Pass | Do this | Done when |
|---|---|---|
| 1 | Read MODEL.md and DATA_LAYER.md once, with this sheet open | You know which document answers which question |
| 2 | Run every command in **Show it works** | All outputs match |
| 3 | Deliver the demo out loud, timed, twice | 10 min, no notes |
| 4 | Cold-call yourself with **Questions**, 60 s each | 20 of 25 |

## The claim

> *"I designed this model from the app's access patterns, I run it in production on Atlas with
> backups, monitoring and a runbook, and I have maintained it through a real incident. Level 3."*

Why Level 3 and not 2: **Level 2 is building an advanced use case; Level 3 is operating it.**

## The demo — 10 minutes, operations first

Lead with operations. It is the part most candidates don't have, and the first thing you lose if
they cut you short.

| # | Min | Show | Say |
|---|---|---|---|
| 1 | 1.0 | live site signed in; `curl .../api/health` | In production since 22 Sept. Atlas, Frankfurt. |
| 2 | 2.0 | GitHub → Actions: Uptime, Operations, Backup, CI | Four schedules. Open the newest Backup run; the artifact is encrypted. |
| 3 | 2.0 | [MODEL §2](../../docs/nosql/MODEL.md#2-diagram), then a `tracks` and a `completions` doc in Compass | Embed what is small, owned and read together. Bucket what grows forever. |
| 4 | 2.0 | `lib/server/insights/stats.ts` → `longestStreaks` | Gaps and islands: rank the days, subtract the rank, consecutive days share a constant. |
| 5 | 1.5 | [PERFORMANCE.md](../../docs/nosql/PERFORMANCE.md) | 572,152 examined without the index, 27 with it. ESR: 1,421 keys vs 336. |
| 6 | 1.5 | `npm run demo:failover` | New primary in 0.3 s, 130 writes, 0 lost, counted back with `readConcern: majority`. |

## Show it works

```bash
npm run db:up
```

```bash
npm run test:db
```

```bash
npm run demo:failover
```

Expect: 13 s and three members `Up`; 59 tests in 6 files, 2.9 s; new primary in 0.3 s with 130
acknowledged writes and 0 lost, in about 28 s.

```bash
curl -s https://horizonroadmap.com/api/health
```

**Two devices, live.** A normal window and a private window on `localhost:3000` are two devices.
Sign in to both — the fresh one adopts the account's data. Tick a *different* box in each, sync
both, **both ticks survive**. That is the per-item merge in a transaction, and it is the headline.

**In `mongosh`** (`npm run db:shell`):

```js
const me = db.users.findOne({ email: "<your email>" })._id
db.tracks.getIndexes()
db.completions.find({ userId: me }).sort({ date: -1 }).limit(3)
db.tracks.find({ userId: me, $text: { $search: "algebra" } }).explain("executionStats").executionStats
db.securityEvents.find()   // a kind, an hour, a count — never who
```

## The four advanced use cases (Level 2)

| | What | Why advanced | The trap, and your answer |
|---|---|---|---|
| **Sync** | 5 collections merged per item in one transaction, snapshot reads, `w: majority`, driver retries on conflict | atomic across collections, with a conflict policy | *"Isn't last-write-wins lossy?"* Per **item**, not per record — different items both survive. Same item, later timestamp wins: a decision, not an accident. |
| **Streaks** | `$setWindowFields` + `$documentNumber`, gaps and islands | no "longest run" operator exists | *"Why not in the app?"* It would pull every day over the wire. The pipeline returns one row per track. |
| **Search** | compound text index, weights, `$meta: "textScore"`, two collections | the `userId` prefix is a security boundary as much as a performance one | *"What can't it do?"* Fuzzy and phrase. One text index per collection, about 3× the tracks' size on disk. |
| **Counters** | one doc per kind per hour, `$inc`, TTL | the **access pattern**, not the data, chose the shape | *"Wrong database for a counter?"* **Yes — say it first.** See below. |

## Types, for those use cases (Level 2, bullet 2)

Full table: [MODEL §10](../../docs/nosql/MODEL.md#10-why-a-document-database).

| Use case | Best fit | Why not the others |
|---|---|---|
| Sync | **Document** | KV: no multi-key transaction of this shape. Wide-column: a 5-collection sync could half-commit. Graph: a tree, no traversal to pay for. |
| Streaks | **Document** | KV: impossible in the store. Wide-column: only with a table designed for this query in advance. Graph: needs day-to-day edges materialised. |
| Search | adequate, not best | A dedicated engine does phrase and fuzzy. KV: no search inside values. |
| Counters | **Key-value** | `INCR` + `EXPIRE`, in memory, no disk write per request. |

**Volunteer both of these before being asked** — admitting a wrong tool shows judgement:

1. *"The counters belong in Redis. They're here because a second datastore is a second thing to
   deploy, secure, back up and explain, and at this volume it costs a few documents a day."*
2. *"Text search is my ceiling — it will never do fuzzy or phrase matching."*

## Operate and maintain (Level 3)

| | Evidence |
|---|---|
| Deployed | Atlas free tier, AWS Frankfurt; `horizon_prod` has `readWrite` on one database and nothing else |
| Uptime | `/api/health` every 30 min; the run fails, and emails, when it stops answering 200 |
| Daily check | `ops:check` at 06:15 UTC |
| Backup | Mondays 03:45 UTC, `mongodump` piped into `gpg`; a step proves it is encrypted before upload |
| CI | every push stands up its own three-member replica set and runs the 59 database tests |
| Retention | TTL indexes, not cron |
| Runbook | a documented response per failure mode |

**The two maintenance stories — tell them as failures you found, not features you built:**

1. **The restore that silently restored nothing.** `mongorestore` reads a database name in the URI as
   the restore target, so with the name in the string it writes nowhere. Now written out in RUNBOOK §4.
   *"An untested backup is not a backup."*
2. **`0.21.4`, in production.** Day one live, the first sync of a device holding an old track answered
   *"Malformed request."* — it carried `lastUpdatedDates`, a retired field, and the zod schema refuses
   any key it doesn't list. Strictness that looked right in review was wrong against data that already
   existed. Fixed, regression-tested, and the reason the schema-versioning pattern exists.

## Twelve decisions — one line of reason each

| Decision | Reason |
|---|---|
| Document, not relational | A tree, read and written per owner; `TrackState` was already a document. Relational needs ~10 tables and a mapper. |
| Embed phases, materials, rotations | Small, owned by one track, always read and written with it. |
| One document per track **per day** | History is unbounded (16 MB cap); ticking one box must not rewrite a year. |
| A bucket per *day* | A day's ticks are what change together. |
| Not one document per user | The same two reasons, times every track. |
| `{userId, trackId, date}` in that order | ESR. With `date` first, one track's days scatter through the index. |
| No separate `{userId}` index | A compound index serves any **prefix** of its fields. |
| Accomplishments as an array, not a title-keyed map | A `.` in a title is a path to MongoDB. **User input never becomes a field name.** |
| Counters, not rows, for rejections | A row each is a denial-of-service vector; `$inc` is concurrency-safe with no read first. |
| `streakHistory` not stored | Derivable, and rebuilt on every change anyway. |
| A note's `updatedAt` is the **device's** clock | Only ever compared with other devices'; future values clamped on the way in. |
| `{userId: "hashed"}` shard key | Every query names `userId`, so each is targeted. Not the date or `_id` (hot shard), not `trackId` (not unique across users). |

## Questions — cold call, 60 s each

1. How many collections, and why that many?
2. Why is progress one document per track per day?
3. What is in a `tracks` document that is not in a `completions` document?
4. Every index on `completions`, and what each serves.
5. What is ESR, and what did getting it wrong cost?
6. Why no separate `{userId}` index?
7. `longestStreaks` — the five stages.
8. Why is `$match: { userId }` first in every pipeline?
9. What does `$meta: "textScore"` do, and where does it appear twice?
10. Why does the text index start with `userId`?
11. The text index weights — what, and why?
12. What is `language_override` protecting against?
13. Why are accomplishments an array, not a map?
14. What does `done: false` with a timestamp mean? And `updatedAt: 0`?
15. Native driver versus Mongoose — which parts, and why each?
16. The two validation layers — and what can the app's database user *not* do?
17. Two devices sync at the same moment. What happens?
18. Write concern, read concern, read preference — what does the sync ask for, and why?
19. Failover: how long gracefully, how long on a crash, and why the difference?
20. What does replication **not** protect against?
21. Shard key, and why not the date?
22. Why is `securityEvents` not one row per event?
23. Which TTL expires what, after how long — and **where is the number stored**?
24. How much data did you test with, and how was it generated?
25. Tell me about a time this broke in production.

> **23 is a trap you set yourself.** Only the audit log puts its retention *in the index*. Sessions,
> rate limits and security counters put an `expiresAt` in the **document** with `expireAfterSeconds: 0`,
> because each needs its own lifetime and an index holds one number.

## Soft spots — say them before they do

1. **Sharding is designed, never run.** The free tier cannot shard. The design is ready in the sense
   that matters: no query depends on two users' data.
2. **"Production" here means live, public, real data, backups, monitoring and a runbook — not scale.**

## Before you walk in

- [ ] `npm run db:up` → three members `Up`
- [ ] `npm run test:db` → 59 green
- [ ] `horizon_perf` seeded (`npm run db:seed`, 90 s) so `db:explain` has data
- [ ] Compass connected with `MONGODB_URI` from `.env.local`
- [ ] Live site signed in; a private window ready for the two-device demo
- [ ] GitHub → Actions open: CI, Uptime, Operations, Backup, all green

Shared checklist: [`../exam-day.md`](../exam-day.md).
