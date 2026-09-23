# SE_06 NoSQL Databases: the oral

One-to-one, 15 to 30 minutes, laptop open: an overview and a demo, then questions.

The hand-in documents are [`../nosql/`](../nosql/README.md); the concepts behind each step are in
[`../LEARNING_LOG.md`](../LEARNING_LOG.md), entries 4, 7, 9, 10, 11 and 13.

Shared checklist for the day before all three exams: [`day-before.md`](day-before.md).

## SE_06 NoSQL: the demo (about 10 minutes)

1. **The app (1 min).** Tick something, sync. The header shows "Synced with account".
2. **The model (2 min).** [MODEL.md §2](../nosql/MODEL.md#2-diagram), the diagram. In Compass, open a
   `tracks` document (everything embedded) and a few `completions` (one per day: the bucket pattern).
   Say why: small, owned, read together → embed; unbounded → buckets; no user input as field names.
3. **Two devices (2 min).** A normal window and a private window on `localhost:3000` are two "devices"
   (separate cookies and IndexedDB). Sign in in both: the fresh one *adopts* the account's data. Tick a
   different box in each, sync both, and both have both ticks. That's a per-item merge on the server,
   inside a transaction.
4. **Search and history (2 min).** Menu → Search & insights. Search a word from a book title, then its
   plural (stemming). The charts come from aggregation pipelines: open
   `lib/server/insights/stats.ts` and walk `byMonth`, then the gaps-and-islands `longestStreaks`.
5. **Performance (1.5 min).** [PERFORMANCE.md](../nosql/PERFORMANCE.md): 572,152 documents examined without
   the index, 27 with it; the ESR rule (1,421 vs 336 keys). Or run `npm run db:explain` live (about
   30 s).
6. **Resilience (1.5 min).** `npm run demo:failover` live: the new primary in 0.3 s and no write lost.
   Then `-- --crash` if there's time (10.8 s, a retried write). Explain `w: majority`.

7. **If there's time (1 min).** `db.securityEvents.find()` and `db.rateLimits.find()`: two collections
   that exist for operational reasons, both counting rather than listing, both cleaned up by TTL
   indexes rather than a cron job. It's the clearest case of the access pattern deciding the shape.

**Queries to have ready in `mongosh`** (`npm run db:shell`, as the app's user):

```js
const me = db.users.findOne({ email: "<your email>" })._id
db.tracks.find({ userId: me }, { "meta.name": 1, "materials.title": 1 })
db.completions.find({ userId: me }).sort({ date: -1 }).limit(3)
db.completions.aggregate([
  { $match: { userId: me } },
  { $group: { _id: { $substrBytes: ["$date", 0, 7] }, days: { $sum: 1 } } },
  { $sort: { _id: 1 } },
])
db.tracks.find({ userId: me, $text: { $search: "algebra" } }).explain("executionStats").executionStats
```

## SE_06 NoSQL: the questions

The "Exam questions" sections of learning log entries 4, 7, 9, 10 and 11 cover the objectives. The ones
that come up most:
- *Why a document database here, and not relational?* MODEL.md §10.
- *Embedding or referencing?* MODEL.md §4.
- *Why not one document per user?* The 16 MB cap and write amplification.
- *How do you keep data consistent without joins?* Transactions, unique indexes, validators, and the
  application-level cascade in account deletion (MODEL.md §7).
- *How does your full-text search work?* Learning log 9.
- *What does an index cost?* Space (the text index is about 3× the tracks' size on disk) and a little on
  every write.
- *Replication, election, write concern?* RESILIENCE.md.
- *Sharding?* `{userId: "hashed"}`, and why not the date (MODEL.md §9).
- *How much data did you test with?* DATA.md.
- *Mongoose or the native driver?* Both, each where it fits (MODEL.md §6 and learning log 7).
- *How many collections, and why that many?* Seven: five for the data, two operational (`rateLimits`,
  `securityEvents`), both counting per time window so a flood costs one document (MODEL.md §1, §4).
- *What happens to old data?* TTL indexes: sessions at 30 days, audit entries at 90, security counters
  at 30, rate counters within minutes (MODEL.md §5).
