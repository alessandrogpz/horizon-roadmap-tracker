# SE Self-Assessment: Reflection on the Learning Process

> **Read this first.**
>
> SE_47's assessment instructions say, about the reflection essay specifically:
> *"Please do not use Large Language Models when writing your reflection essays,
> it should be in your own words, even if English is not your native
> language."* CODE's standard assessment instructions are shared across modules,
> so the same rule very likely applies here — **check SE_06's own wording before
> you start**, and if it is silent, assume it does.
>
> So this file is deliberately **not** a draft essay. It is the structure, and
> underneath each heading: the **facts** from the repository and the git history
> — things you would otherwise spend an hour digging out — and **questions** to
> answer in your own words.
>
> Delete every `>` block as you write. What is left should be entirely yours,
> which matters beyond the rule: you have to defend it in an oral exam.

**Name:** Alessandro Perez
**CODE Email:** alessandro.perez@code.berlin
**Current Semester:** Fall Semester 2026
**Module:** SE_06 (NoSQL Databases)
**Project Name:** Horizon

---

## 1. What did you set out to learn and to build?

> **The facts, if you want them.**
> - You started this module knowing essentially nothing about databases. That
>   is the honest starting point and it is worth stating plainly; the distance
>   travelled is the thing being assessed.
> - The database work runs from **2026-09-10** (`0.17.1`, the local replica set)
>   to **2026-09-22** (`0.22.0`, operations), with the live deployment on
>   **2026-09-22** (`0.21.4`).
> - The decision recorded in `MODULES_PLAN.md` was *NoSQL (SE_06), not Relational
>   (SE_05)* — because Horizon's data is a tree (user → track → days), read and
>   written one track at a time, and `TrackState` in `lib/types.ts` was already a
>   document shape. The relational alternative would have needed about ten
>   tables and a nested↔rows mapper (Appendix A of that plan).
>
> **Questions to answer in your own words.**
> - Did you choose MongoDB because it was right, or because it was the least
>   change to an app you already had — and are those actually different?
> - Horizon worked offline, with no server, before this module. What did adding
>   a database actually buy the person using it? Name it concretely.
> - What did you expect to be the hard part before you started? Was it?

## 2. What topics did you learn about which you previously knew nothing about?

> **Candidates from the history. Pick the ones that were genuinely new to you,
> not the ones that sound most impressive.**
> - **Modelling for the access pattern, not for the data.** The clearest case in
>   the project is `securityEvents`: one document per *kind of rejection per
>   hour*, raised with `$inc`, because a document per rejected sign-in would let
>   anyone fill the database by failing on purpose. The shape came from how it is
>   written, not from what it is.
> - **The bucket pattern**, and why one document per user is wrong: the 16 MB
>   document cap, and write amplification (ticking one box rewriting a year).
> - **Compound indexes and the ESR rule.** Measured, not read: 572,152 documents
>   examined without the index, 27 with it; and `{date, …}` first examines 1,421
>   keys to return 336 where `{userId, trackId, date}` examines 336
>   (`docs/nosql/PERFORMANCE.md`).
> - **Text indexes**: one per collection, weights, stemming, and the fact that
>   the tracks' text index is about three times the size of the tracks on disk.
> - **The aggregation framework**, up to `$setWindowFields` and `$documentNumber`
>   for gaps-and-islands in `longestStreaks` (`lib/server/insights/stats.ts`).
> - **Replication and elections**: write concern, read concern, read preference,
>   and what a stopped primary actually costs — 0.3 s to a new primary, 0 writes
>   lost, measured by `npm run demo:failover`.
> - **Transactions without foreign keys**: account deletion has to cascade in
>   application code, and the transaction is what makes that safe.
> - **Injection in a document database**: user input must never become a field
>   name (a title containing `.` is a path to MongoDB), `sanitizeFilter`,
>   `strictQuery: "throw"`.
>
> **Questions.**
> - Which of these did you not know *existed*, versus know about but never have
>   to handle?
> - Was there a moment where the database changed the design rather than just
>   the code? The day-bucket is one; the accomplishments-as-array decision is
>   another, and it came from a security concern rather than a data one.
> - What do you now think you *still* do not know? Naming a gap honestly reads
>   better than claiming there is none — sharding, for instance, is designed
>   here and never run.

## 3. Which specific learning resources did you use, and how did you use them?

> **Prompts, not answers — I do not know what you actually read.**
> - The MongoDB manual and MongoDB University? Which parts, and for what?
> - The Mongoose documentation, separately from the driver's?
> - Something that was not documentation: a book, a talk, a blog post on the
>   bucket pattern or gaps-and-islands, another codebase?
> - Did you attend the Learning Unit this semester? If not, say so.
> - Be specific about *how*: read once up front, or returned to when stuck?
>   `../LEARNING_LOG.md` was written as you went — if a particular entry came
>   out of one source, say which.

## 4. In which ways did you use LLMs as a part of the learning process?

> **You have an unusually detailed record to be accurate from. As fact:**
> - A large amount of this code was written with LLM assistance.
> - It was also used for *verification* rather than generation: measuring
>   `explain()` output, running the failover demo, checking the ER diagram
>   against `lib/types.ts` rather than against memory.
> - It got things wrong in ways you caught. The best example for this module is
>   `0.21.4`: a strict validation schema refused the owner's own track over a
>   retired field — the live sync rejected real data. Strictness that looked
>   correct in review was wrong against data that existed.
>
> **Questions.**
> - Where was the line between using it and learning from it? Did that line move
>   over the module?
> - What did you have to understand yourself before you could tell a good
>   suggestion from a bad one? The `0.21.4` incident is a concrete way in: why
>   did you catch it, and what would have caught it earlier?
> - Could you re-derive the indexing and consistency decisions unassisted? The
>   oral exam will test exactly that, so the honest answer here is also the
>   useful one.

## 5. Where do you currently stand with respect to content outlined in the module description?

> **The objectives, and where the project stands against each. A checklist to
> argue from — in your own words, and only where you believe it. The full
> mapping with links is in `docs/nosql/README.md`; the Level 1 rows are
> below, and Levels 2 and 3 follow them.**
>
> | Objective | Evidence |
> |---|---|
> | Define and adapt a data model to the project's needs | `docs/nosql/MODEL.md` §1–4; schema versioning in §8 |
> | NoSQL vs relational, advantages and disadvantages | MODEL §10; `MODULES_PLAN.md` Appendix A |
> | NoSQL concepts, characteristics, significance, limitations | MODEL §4, §7, §10 — and the limitation that bit: no foreign keys, so the cascade is yours |
> | Pros and cons of the NoSQL types | MODEL §10: key-value, wide-column, graph, document, each with why not |
> | A query or full-text search function | Compound text indexes with weights and stemming; `lib/server/insights/search.ts` |
> | Optimise for large data, performance, efficiency | 572,152 generated documents; `docs/nosql/PERFORMANCE.md`; the ESR rule measured |
> | Access the database directly *and* through a framework | Native driver for sync, search and aggregation; Mongoose for users, sessions, notes — `docs/nosql/DATA_LAYER.md` §3 |
> | Replication, distribution, sharding, resilience | Three-member replica set in dev and on Atlas; failover measured; sharding designed (`{userId: "hashed"}`) and argued, not deployed |
>
>
> | Level 2 objective | Evidence |
> |---|---|
> | Design and implement an **advanced use case** | Four: the per-item sync merge in one multi-document transaction across five collections; longest streaks by gaps and islands (`$setWindowFields`); weighted compound text search over two collections; counting rejections rather than listing them |
> | The types' trade-offs **for advanced use cases** | `MODEL.md` §10, second half — those four against document, key-value, wide-column and graph, including where MongoDB is the wrong tool and why it is used anyway |
>
> | Level 3 objective | Evidence |
> |---|---|
> | Independently design, **operate and maintain** in production | Atlas since 2026-09-22; least-privilege user and network list; weekly encrypted backup with a restore tested (and broken the first time); daily ops check and 30-minute uptime check in CI; TTL retention; a runbook per failure mode; CI brings up its own replica set on every push |
> | Reason about own decisions **in great depth** | `MODEL.md` §4, §9, §10; `PERFORMANCE.md` measures the index decisions; `LEARNING_LOG.md` records each as it was taken |
>
> **Questions.**
> - **You are claiming Level 3.** Say it in one sentence and justify it — the
>   strongest single sentence is probably about operating the thing, not
>   designing it.
> - Where is your knowledge thinnest? **Sharding is reasoned but never run** (the
>   free tier cannot), and "production" here means live with real data, backups
>   and monitoring — not scale. Name both before an examiner does.
> - The `0.21.4` incident is your best maintenance story. What did it change
>   about how you think about strict validation against data that already exists?
> - What would you model differently if you started again now?

**GitHub link:** <add the repository URL>
