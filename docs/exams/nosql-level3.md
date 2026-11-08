# SE_06 at Level 3: the practice sheet

Everything the module asks for at Level 3, turned into something you can
rehearse against. [`nosql.md`](nosql.md) is the running order for the exam;
**this file is the drill**.

> **Level 3 = Level 1 + Level 2 + two more things**
>
> - *Independently design, **operate and maintain** your database in a
>   production or production-like environment.*
> - *Reason about **your own** design decisions in great depth and
>   comprehensibility.*
>
> Level 2 underneath it: *design and implement an **advanced use case***, and
> *understand the types' advantages and disadvantages **for advanced use
> cases***.

## How to use this

Three passes, over three sittings, not one.

1. **Read it with the documents open.** Follow every link once. You are checking
   that the evidence is where this says it is.
2. **Say Parts A–E out loud, with a timer**, laptop open, running the commands.
   Out loud is the whole point: an answer you can think is not an answer you can
   give.
3. **Cold-call yourself with Part G.** Shuffle it, no notes, 60 seconds each. The
   ones you stumble on are your revision list; everything else is done.

Two rules while you practise:

- **Never claim what you have not run.** If you have not executed it, say
  "designed, not deployed". Sharding is the case that matters.
- **Lead with evidence, then the reason.** "Here is the backup workflow, and the
  restore that failed the first time" beats "I take backups".

---

## The claim, in one sentence

Say this, then stop talking:

> *"I designed this model from the app's access patterns, I run it in production
> on Atlas with backups, monitoring and a runbook, and I have maintained it
> through a real incident — so I'm claiming Level 3."*

If they ask for the short version of why Level 3 and not Level 2: **"Level 2 is
building an advanced use case. Level 3 is operating it. The difference in this
project is the backup whose restore I tested and found broken, the daily check,
and the production bug in the data layer I fixed."**

---

## Part A — The 10 minutes, re-ordered for Level 3

[`nosql.md`](nosql.md) opens with the app and the model. For a Level 3 claim,
**open with operations instead** and let the model come second: it is the part
most candidates do not have, so spend your freshest minutes there.

| | Minutes | Show | Say |
|---|---|---|---|
| 1 | 1.0 | The live site, signed in, `curl https://horizonroadmap.com/api/health` | "This is in production, not a local demo. Atlas, Frankfurt, since 22 September." |
| 2 | 2.0 | GitHub → Actions: **Uptime**, **Operations**, **Backup**, **CI** | The four schedules. Open the newest Backup run and show the encrypted artifact. |
| 3 | 2.0 | `docs/nosql/MODEL.md` §2 diagram, then a `tracks` and a `completions` document in Compass | Embed what is small, owned and read together; bucket what grows forever. |
| 4 | 2.0 | `lib/server/insights/stats.ts` → `longestStreaks` | The advanced use case. Walk the gaps-and-islands trick line by line. |
| 5 | 1.5 | `docs/nosql/PERFORMANCE.md`, or `npm run db:explain` live | 572,152 examined without the index, 27 with it. Then ESR: 1,421 keys vs 336. |
| 6 | 1.5 | `npm run demo:failover` live | New primary in 0.3 s, 130 writes acknowledged, 0 lost, counted back with `readConcern: majority`. |

**If they stop you early, you have already said the Level 3 part.** That is the
reason for this order.

---

## Part B — Level 2, bullet 1: the four advanced use cases

Drill each one as: *what it is → why it is advanced → what I show → the trap*.

### 1. Sync, merged per item, in one multi-document transaction

- **What.** `PUT /api/sync` reads the user's documents across `tracks`,
  `completions`, `notes` and `users`, merges the device's version in, writes
  back only what changed, and appends to `auditLog` — all inside
  `inTransaction` (`lib/server/sync/store.ts:47`), snapshot reads,
  `writeConcern: majority`.
- **Why advanced.** It is five collections, atomically, with a conflict policy.
  Two devices syncing at once cannot overwrite each other: MongoDB detects the
  write conflict, fails one commit, and the driver retries that transaction
  against the newer data. The retry is only safe because the merge is
  **last-write-wins per item** — every tick box, accomplishment and material
  carries its own `updatedAt`.
- **Show.** A normal window and a private window on `localhost:3000` are two
  devices. Tick a different box in each, sync both, both ticks survive.
- **The trap.** *"Isn't last-write-wins just losing data?"* — Per **record** it
  would be. Per **item** it is not: the two devices changed different items, so
  both changes are kept. Where they changed the *same* item, the later timestamp
  wins, and that is a decision, not an accident.

### 2. Longest streaks, by gaps and islands

- **What.** `pipelines.longestStreaks` in `lib/server/insights/stats.ts`.
- **Why advanced.** There is no "longest consecutive run" operator. The trick:
  rank each active day within its track with `$setWindowFields` +
  `$documentNumber`, then subtract the rank from the day number. Consecutive
  days produce a **constant**; a gap changes it. `$group` on that constant, and
  each group is one unbroken run. Take the longest per track.
- **Show.** Open the file and walk the five stages aloud.
- **The trap.** *"Why not do that in the application?"* — Because it would mean
  pulling every one of a user's days over the wire to count them. The pipeline
  returns one row per track. And the `$match: { userId }` at the front means the
  index narrows 572,152 documents to ~1,000 before any of this runs.

### 3. Weighted compound text search across two collections

- **What.** `searchUserData` (`lib/server/insights/search.ts:47`):
  `$text` over `tracks` and over `notes`, `{ $meta: "textScore" }` projected and
  sorted on, `limit` 20 each.
- **Why advanced.** The index is **compound**: `{ userId: 1, …text fields… }`.
  The `userId` prefix makes every search a one-user search — a security boundary
  as much as a performance one. **Weights** rank a hit in a material's title
  (10) above one buried in the roadmap text (1). `language_override:
  "textSearchLanguage"` stops a stored field accidentally switching a document's
  stemming language.
- **Show.** Search a word from a book title, then its plural. Stemming finds it.
- **The trap.** *"What can't it do?"* — Fuzzy and phrase matching. One text
  index per collection, and it costs real space: on the generated data the
  tracks' text index is about **three times** the size of the tracks themselves
  on disk. Atlas Search is the way out, and it is a paid tier.

### 4. Counting rejections instead of listing them

- **What.** `securityEvents`: one document per *kind of rejection per hour*,
  raised with an atomic `$inc`, deleted by a TTL index after 30 days.
  `rateLimits` is the same idea per client per minute.
- **Why advanced.** The **access pattern, not the data, chose the shape**. One
  document per rejected sign-in would be a denial-of-service vector: anyone
  could fill the database by failing on purpose. A counter costs the same
  whether something happens twice or two million times, and `$inc` makes
  concurrent writes safe with no read first.
- **Show.** `db.securityEvents.find()` and `db.rateLimits.find()`, then
  `npm run ops:check`.
- **The trap.** *"Isn't that the wrong database for a counter?"* — **Yes, and
  say so first.** See Part C.

---

## Part C — Level 2, bullet 2: the types, *for these use cases*

This is the bullet most people answer at the wrong altitude. They ask about the
types for **advanced use cases**, not in general. The table is
`docs/nosql/MODEL.md` §10, *The same comparison, use case by use case*. Learn
the shape of it, not the words.

| Use case | Best fit | Why the others lose |
|---|---|---|
| Sync, merged per item | **Document** | Key-value: no multi-key transaction of this shape. Wide-column: LWW per column is close in spirit, but a five-table sync could half-commit. Graph: a tree with no traversal to pay for. |
| Longest streaks | **Document** | Key-value: impossible in the store. Wide-column: only if a table were designed for this query in advance. Graph: would need day→day edges materialised — expensive writes to make one read cheap. |
| Full-text search | **Neither** — document is *adequate* | A dedicated engine (Elasticsearch, Atlas Search) does phrase and fuzzy, which this cannot. Key-value: no search inside values. Wide-column: hand-built inverted index. |
| Rate / security counters | **Key-value** | `INCR` + `EXPIRE`, in memory, no disk write per request. This is the weakest fit in the project. |

**Two things to volunteer before you are asked.** They are the strongest part of
this answer, because admitting a wrong tool shows you can judge tools:

1. *"The counters belong in Redis. They are in MongoDB because a second
   datastore is a second thing to deploy, secure, back up and explain, and at
   this volume it costs a few documents a day. It is a deliberate trade, and the
   first thing I would change if request volume grew."*
2. *"Text search is my ceiling. It will never do fuzzy or phrase matching."*

Where document is **unambiguously** right: a nested record read and written per
owner, and an aggregation over one owner's days. Those are the two the app does
most.

---

## Part D — Level 3, bullet 1: operate and maintain

A checklist to rehearse, not read. For each one: **what it is, where it is, and
show it**.

### Designed and deployed

| | Evidence | Open |
|---|---|---|
| Live since 2026-09-22 | MongoDB Atlas, free tier, AWS Frankfurt `eu-central-1`, same region as the Vercel functions | <https://horizonroadmap.com> |
| Least privilege | `horizon_prod` has `readWrite` on `horizon` and nothing else. It can create a collection with a validator; it **cannot** change one — that needs `collMod`, an admin privilege — so the app only warns | `docs/DEPLOY.md`, `lib/server/collections.ts` |
| Network | Atlas network access list; the app reaches it only through `MONGODB_URI` in Vercel | `docs/DEPLOY.md` |
| Dev matches prod | Three-member replica set in Docker, three-member replica set on Atlas | `compose.yaml` |

### Operated

| | Evidence | Open |
|---|---|---|
| **Uptime** | `/api/health` every 30 minutes; the run fails, and so emails, when it stops answering 200. It answers `{"ok":true}` and nothing else — no version, no hostname, no error text | `.github/workflows/uptime.yml` |
| **Daily check** | `npm run ops:check` at 06:15 UTC: accounts, and the counters the server keeps when it refuses something | `.github/workflows/ops.yml` |
| **Weekly backup** | Mondays 03:45 UTC: `mongodump` piped straight into `gpg`, encrypted to `ops/backup-key.pub`. The private key is on one machine. A step then **proves** the artifact is encrypted before uploading it | `.github/workflows/backup.yml` |
| **CI** | Every push stands up its own three-member replica set and runs the 59 database tests against it | `.github/workflows/ci.yml` |
| **Retention** | TTL indexes, not cron: sessions 30 days, audit log 90, security counters 30, rate counters two windows | `MODEL.md` §5 |
| **Runbook** | A documented response per failure: compromised session, leaked password, restore, vulnerable dependency, alert fired, database down, deletion request | `docs/security/RUNBOOK.md` §2–§7, §9 |

### Maintained — the two stories

These are what separate Level 3 from a well-documented Level 2. **Tell them as
failures you found, not as features you built.**

1. **The restore that silently restored nothing.** The first test of the backup
   appeared to succeed and restored no data. Cause: `mongorestore` reads a
   database name in the URI as the restore target, so with the name in the
   string it writes nowhere. It is now written out in `RUNBOOK.md` §4, with the
   `--nsFrom`/`--nsTo` form for restoring into a scratch database to inspect.
   **"An untested backup is not a backup"** is the line.
2. **`0.21.4`, a production incident in the data layer.** On the day it went
   live, the first sync of a device holding an old track answered *"Malformed
   request."* The track carried `lastUpdatedDates`, a field the app had retired,
   and the zod request schema refuses any key it does not list. Strictness that
   looked correct in review was wrong against data that already existed. Fixed
   by listing the retired fields it accepts, covered by a regression test, and
   both of the author's real backups now validate. It is also why the
   **schema-versioning pattern** (`MODEL.md` §8) is there rather than described.

### Rehearse these three commands until they are boring

```bash
npm run demo:failover
```

```bash
npm run ops:check -- --uri-env ATLAS_URI
```

```bash
curl -s https://horizonroadmap.com/api/health
```

---

## Part E — Level 3, bullet 2: reason in depth

Twelve decisions. For each, the answer is **one sentence of reason, then one
piece of evidence**. Practise until you stop reaching for the document.

| Decision | The reason, in one line | The evidence |
|---|---|---|
| Document, not relational | The data is a tree read and written per owner; `TrackState` was already a document shape, and the relational version needs ~10 tables plus a nested↔rows mapper | `MODEL.md` §10, `MODULES_PLAN.md` App. A |
| Embed phases, materials, rotations | Small, owned by exactly one track, always read and written with it, merged per item | `MODEL.md` §4 |
| One document per track **per day** | History grows forever (16 MB cap), and ticking one box must not rewrite a year (write amplification) | `MODEL.md` §4 |
| A bucket per *day*, not per week or month | A day's ticks are what change together | `MODEL.md` §4 |
| Not one document per user | Simplest mapping of `Workspace`, and wrong for the same two reasons times every track | `MODEL.md` §4 |
| `{userId, trackId, date}`, in that order | ESR: equality, then sort, then range. With `date` first, one track's days are scattered through the index | `PERFORMANCE.md` §1 — 1,421 keys examined to return 336, versus 336 |
| No separate `{userId}` index | A compound index serves any query on a **prefix** of its fields | `PERFORMANCE.md` §2 |
| Accomplishments as an array of values, not a map keyed by title | A title containing `.` is a path to MongoDB; `$where` would look like an operator. **User input never becomes a field name** | `MODEL.md` §4 |
| Counters, not rows, for rejections | A row per rejection is a DoS vector; `$inc` is safe concurrently with no read first | `MODEL.md` §4 |
| `streakHistory` is not stored | It is derivable — the days with an accomplishment — and the app rebuilds it on every change anyway | `MODEL.md` §4 |
| A note's `updatedAt` is the **device's** clock | It is only ever compared with other devices' clocks; future timestamps are clamped on the way in | `MODEL.md` §4 |
| `{ userId: "hashed" }` as the shard key | Every query names `userId`, so each is targeted to one shard; hashing spreads users evenly and keeps one user's data together. Not the date or `_id` (both increase → hot shard), not `trackId` (not unique across users) | `MODEL.md` §9 |

Two more that are about the *system*, not the schema:

| Decision | The reason |
|---|---|
| Native driver **and** Mongoose, one connection | Driver where its own surface is the point (bulk writes, `$meta`, `$setWindowFields`, transactions); Mongoose for the three collections whose shape is fixed and server-controlled, for casting and `sanitizeFilter`. Mongoose owns the connection; driver work goes through `mongoose.connection.db` |
| Validation in two layers | zod on every request (strict: an unexpected key is refused) **and** `$jsonSchema` in the database, so a bug in the server still cannot store a malformed document (error 121) |

---

## Part F — The questions you do not want, with answers

Rehearse these more than the easy ones.

**"You claim Level 3, but have you ever sharded this?"**
> No. The shard key is designed and argued — `{userId: "hashed"}`, and why not
> the date, `_id` or `trackId` — but the Atlas free tier cannot shard, so it has
> never been executed. The design is ready for it in the sense that matters: no
> query in the app depends on data from two users.

**"Is a free-tier cluster really production?"**
> It is live, publicly reachable, holds real data, is backed up weekly with a
> tested restore, is monitored every 30 minutes and has a runbook. What it is
> not is *scale* — three members in one region, no sharding, no multi-region. I
> am claiming operations, not size.

**"What would break first if this got popular?"**
> The rate and security counters, because every limited request writes to disk —
> they belong in Redis. After that, the text index: it is already about three
> times the size of the tracks on disk, and it grows with the content. Neither is
> the model; both are the tooling around it.

**"Your sync is last-write-wins. Isn't that lossy?"**
> Per item, not per record, so two devices that changed different things both
> keep their change. Where they changed the same item, the later timestamp wins
> — that is a chosen policy. The alternative, CRDTs, is a great deal of
> machinery for a single-user app where genuine same-item conflicts are rare.

**"How do you stay consistent with no foreign keys?"**
> Transactions, unique compound indexes, and `$jsonSchema`. Account deletion is
> the clearest case: MongoDB will not cascade, so `lib/server/account/handlers.ts`
> deletes from every collection holding a `userId` and then the user, in one
> transaction. Either everything goes or nothing does.

**"What happens during an election?"**
> `serverSelectionTimeoutMS: 5000`, so a request waits up to five seconds for a
> primary and then fails with "Sync isn't available right now". The app keeps
> working offline, and the next sync catches up. A graceful stop hands over in
> 0.3 s; a crash takes as long as the election timeout, measured at 10.8 s.

**"Where did you get it wrong?"**
> Three, and I would rather say them than be asked: the strict schema that
> refused real data in production (`0.21.4`); the backup whose first restore
> silently restored nothing; and the history charts that counted a day twice
> when it was active on two tracks, which is why the pipelines group by date
> before they group by anything else.

**"What would you do differently?"**
> Put the counters in Redis from the start, and write the restore test before
> the backup rather than after.

---

## Part G — Cold call: 25, no notes, 60 seconds each

Shuffle. No documents open. Anything you cannot answer in a minute goes on the
revision list.

1. How many collections, and why that many?
2. Why is progress one document per track *per day*?
3. What is in a `tracks` document that is **not** in a `completions` document?
4. Name every index on `completions`, and what each serves.
5. What does ESR stand for, and what did it cost you to get wrong?
6. Why no separate `{userId}` index?
7. How does `longestStreaks` work? Five stages.
8. Why is `$match: { userId }` the first stage of every pipeline?
9. What does `$meta: "textScore"` do, and where does it appear twice?
10. Why does the text index start with `userId`?
11. What are the text index's weights, and why?
12. What is `language_override` protecting against?
13. Why are a day's accomplishments an array and not a map?
14. What does `done: false` with a timestamp mean?
15. What does `updatedAt: 0` mean?
16. Which parts use the native driver, which use Mongoose, and why each?
17. What are the two validation layers, and what can the app's database user **not** do?
18. What happens when two devices sync at the same moment?
19. Write concern, read concern, read preference — what does the sync ask for, and why each?
20. How long does a failover take, gracefully and on a crash, and why the difference?
21. What does replication **not** protect you against?
22. What is the shard key, and why not the date?
23. What is in `securityEvents`, and why is it not one row per event?
24. Which TTL index expires what, and after how long?
25. Tell me about a time this broke in production.

**Scoring.** 20+ cold: you are ready. Under 15: you are rehearsing the demo and
not the model, which is the usual failure.

---

## Part H — Five minutes before you walk in

- [ ] `npm run db:up` — three members `Up`
- [ ] `npm run test:db` — 59 green
- [ ] Compass connected with `MONGODB_URI` from `.env.local`
- [ ] `horizon_perf` has the seeded dataset (`npm run db:seed` if not — 90 s)
- [ ] `curl -s https://horizonroadmap.com/api/health` → `{"ok":true}`
- [ ] GitHub → Actions open in a tab: CI, Uptime, Operations, Backup, all green
- [ ] The live site signed in, and a private window ready for the two-device demo
- [ ] Terminal in the repo; `MODEL.md`, `DATA_LAYER.md`, `PERFORMANCE.md` in tabs
- [ ] Read the claim sentence at the top of this file once, out loud

The full day-before list, shared with the other two exams:
[`day-before.md`](day-before.md).
