# Query performance, with and without indexes

Measured by `scripts/explain.ts` (`npm run db:explain`) on the generated dataset
(`docs/nosql/DATA.md`: 572,152 completion documents), for the user with the most
days (998 documents), on the local three-member replica set. Times are the median of 5 runs
on a development machine and will differ elsewhere; the keys and documents examined won't.
The full `explain("executionStats")` output of every run is in `docs/nosql/explain/`.

How to read a plan: `COLLSCAN` reads every document in the collection; `IXSCAN <index>` walks an
index; `FETCH` then loads the matching documents; `TEXT_MATCH`/`TEXT_OR` are the text index at work.
The number that matters most is **documents examined** compared with **returned**: ideally equal.

## 1. One track's days over a date range

`completions.find({ userId, trackId, date: { $gte: …, $lte: … } })`

| Run | Plan | Index keys examined | Documents examined | Returned | Median time |
|---|---|---|---|---|---|
| A month, no index (collection scan) | `COLLSCAN` | 0 | 572,152 | 27 | 189.0 ms |
| A month, index `{date, userId, trackId}` (range first) | `IXSCAN date_first → FETCH` | 117 | 27 | 27 | 0.7 ms |
| A month, index `{userId, trackId, date}` (the app's) | `IXSCAN user_track_date → FETCH` | 27 | 27 | 27 | 0.6 ms |
| A year, index `{date, userId, trackId}` (range first) | `IXSCAN date_first → FETCH` | 1,421 | 336 | 336 | 5.4 ms |
| A year, index `{userId, trackId, date}` (the app's) | `IXSCAN user_track_date → FETCH` | 336 | 336 | 336 | 3.7 ms |

The **ESR rule** in action: in a compound index, **E**quality fields go first, then **S**ort, then
**R**ange. With `date` first, the index is ordered by day, so this track's entries are scattered: one
per day, among every other user's. MongoDB has to jump to them day by day, examining keys it then
skips, and the waste grows with the range. With the equality fields first, this track's days form one
contiguous stretch of the index, and MongoDB reads exactly the keys it returns.

## 2. All of one user's days (what a sync reads)

`completions.find({ userId })`

| Run | Plan | Index keys examined | Documents examined | Returned | Median time |
|---|---|---|---|---|---|
| No index (collection scan) | `COLLSCAN` | 0 | 572,152 | 998 | 177.7 ms |
| Prefix of `{userId, trackId, date}` | `IXSCAN user_track_date → FETCH` | 998 | 998 | 998 | 5.6 ms |

No separate `{userId}` index is needed: a compound index serves any query on a *prefix* of its fields.

## 3. Searching one user's tracks for "interpretation"

| Run | Plan | Index keys examined | Documents examined | Returned | Median time |
|---|---|---|---|---|---|
| Regex, no index (collection scan) | `COLLSCAN` | 0 | 3,450 | 1 | 18.0 ms |
| Regex, `{userId, trackId}` index | `IXSCAN user_track → FETCH` | 3 | 3 | 1 | 0.4 ms |
| `$text`, compound text index (the app's) | `IXSCAN user_track_text → FETCH → TEXT_MATCH user_track_text` | 1 | 1 | 1 | 0.4 ms |

The `userId` prefix does most of the narrowing on its own; the text index then finds the word
without reading any document's text, ranks results by relevance, and matches stems ("algebras").
A regex can do neither, and a leading-wildcard regex can't use an ordinary index at all.

## 4. The stats pipelines (one user)

| Run | Plan | Index keys examined | Documents examined | Returned | Median time |
|---|---|---|---|---|---|
| `byMonth`, no index (collection scan) | `COLLSCAN → PROJECTION_DEFAULT` | 0 | 572,152 | 998 | 179.6 ms |
| `byMonth`, with the index | `IXSCAN user_track_date → FETCH → PROJECTION_DEFAULT` | 998 | 998 | 998 | 5.8 ms |
| `longestStreaks`, no index (collection scan) | `COLLSCAN → PROJECTION_DEFAULT` | 0 | 572,152 | 998 | 186.8 ms |
| `longestStreaks`, with the index | `IXSCAN user_track_date → FETCH → PROJECTION_DEFAULT` | 998 | 998 | 998 | 7.5 ms |

Each pipeline starts with `$match: { userId }`, so the index hands it only this user's days; the
`$group`, `$setWindowFields` and `$lookup` stages then work on a few hundred documents instead
of all 572,152.
