# The data layer, use case by use case

Each use case traced from the control a person touches, through the client, the
route and the handler, to the MongoDB operation and the index that serves it.

## 1. Shape of the data layer

Every query runs inside a request handler or the sync transaction; there is no
standalone script that reads the database. Two clients drive it over HTTP — the
website and the Expo phone app — through the same five endpoints. It runs on
MongoDB Atlas (AWS Frankfurt) behind [horizonroadmap.com](https://horizonroadmap.com),
with `/api/health` checked every 30 minutes. `npm run test:db` exercises it
against a real three-member replica set: 59 tests in 6 files.

A sync is **one multi-document transaction** across `tracks`, `completions`, `notes`, `users` and `auditLog`
(`lib/server/sync/store.ts:47` `inTransaction`), with `writeConcern: majority`
and an automatic retry when two devices collide.

## 2. The trace

Every use case follows the same path:

```
a control in the UI
  → a client function (web: lib/*.ts, phone: mobile/src/*)
    → fetch() an API route (app/api/*/route.ts — a thin forwarder, nothing else)
      → a handler  (lib/server/*/handlers.ts — auth, rate limit, zod validation)
        → the DATA LAYER (lib/server/sync/store.ts, insights/*, account/, models.ts)
          → MongoDB
```

The routes under `app/api/` contain no database code at all; they exist so the
data layer can be unit-tested by calling the handler with a `NextRequest`, with
no HTTP server running. That is exactly what `lib/__tests__/*.db.test.ts` does.

---

### Use case 1 — Sign in with Google, and stay signed in

| | |
|---|---|
| **UI** | Settings → Account → *Sign in with Google* |
| **Client** | `lib/account.ts:17` (web), `mobile/src/auth/session.ts:148` (phone) |
| **Route** | `POST /api/auth/session` → `app/api/auth/session/route.ts` |
| **Handler** | `handleSignIn`, `lib/server/auth/handlers.ts:65` |
| **Data layer** | `upsertUser`, `lib/server/auth/handlers.ts:132`; session creation in `lib/server/auth/session.ts` |
| **MongoDB** | `users.findOneAndUpdate({ googleSub }, …, { upsert: true })` through **Mongoose** (`lib/server/models.ts`), then `sessions.insertOne`. |
| **Index** | `{ googleSub: 1 }` unique — one account per Google identity. `sessions` has a **TTL index** on `expiresAt`, so MongoDB expires sessions itself rather than a cron job. |

The `_id` of a session is the SHA-256 of the cookie token, never the token: a
leaked `sessions` collection holds nothing a browser could replay.

### Use case 2 — Sync tracks, progress and notes between devices

The biggest one, and the reason the model is shaped the way it is.

| | |
|---|---|
| **UI** | The sync button in the dashboard header; automatic on load and on change |
| **Client** | `syncWithServer`, `lib/serverSync.ts:19` → `components/workspace/WorkspaceProvider.tsx:258`; phone: `mobile/src/sync/syncWithServer.ts:32` → `mobile/src/sync/SyncProvider.tsx:89` |
| **Route** | `GET`/`PUT /api/sync` |
| **Handler** | `handleSyncGet` / `handleSyncPut`, `lib/server/sync/handlers.ts:65,84` — zod-validated (`lib/server/sync/schema.ts`), strict: an unexpected field is refused |
| **Data layer** | `loadUserData` `lib/server/sync/store.ts:61`, `saveUserData` `:110`, inside `inTransaction` `:47` |
| **Mapping** | `splitWorkspace` / `assembleWorkspace`, `lib/server/sync/model.ts` — the app's one nested object ⇄ track documents + one document per day |
| **Merge** | `lib/merge.ts`, the same code the offline clients use, reused unchanged on the server |
| **MongoDB** | `find` on four collections, then `bulkWrite` of only the documents that changed, then an `auditLog` insert — all in one transaction with snapshot reads and `writeConcern: majority`. Written with the **native driver**. |
| **Index** | `{userId, trackId}` unique on `tracks`; `{userId, trackId, date}` unique on `completions`; `{userId, noteId}` unique on `notes`. |

Three properties of this use case:

1. **The bucket pattern.** Progress is one document per track *per day*, not one
   per track. History grows forever (16 MB document cap), and ticking one box
   must not rewrite a year. `docs/nosql/MODEL.md` §4.
2. **Per-item last-write-wins.** Every tick box, accomplishment and material
   carries its own `updatedAt`, so two devices that both changed the same day
   keep both changes. This is why a write conflict can simply be retried.
3. **User input never becomes a field name.** On the device a day's
   accomplishments are keyed by *title*; a title containing `.` would be read as
   a path by MongoDB. The server stores them as arrays of values.

### Use case 3 — Full-text search across tracks, materials, phases, roadmaps and notes

| | |
|---|---|
| **UI** | *Search & insights* (`components/DashboardHeader.tsx:334` → `components/InsightsModal.tsx:176`); phone: `mobile/src/app/search.tsx:43` |
| **Route** | `GET /api/search?q=…` |
| **Handler** | `handleSearch`, `lib/server/insights/handlers.ts:30` |
| **Data layer** | `searchUserData`, `lib/server/insights/search.ts:47` |
| **MongoDB** | `find({ userId, $text: { $search: q } })` with a `{ $meta: "textScore" }` projection and sort, over **two** collections (`tracks` and `notes`), then one scoped lookup to label each note. |
| **Index** | `user_track_text`: a **compound text index** `{ userId: 1, "meta.name": "text", "materials.title": "text", "materials.author": "text", "phases.title": "text", "phases.description": "text", roadmapContent: "text" }`, weighted so a hit in a material's title outranks one buried in the roadmap, with `language_override: "textSearchLanguage"`. `user_note_text` does the same for notes. |

MongoDB allows **one text index per collection**, and
on the generated data the tracks' text index is about three times the size of the
tracks themselves. The `userId` prefix makes every search a one-user search — it
is a security boundary, not only a performance one.

### Use case 4 — History: active days, weekday habits, months, per-track totals, longest streaks

The aggregation framework use case.

| | |
|---|---|
| **UI** | *Search & insights* → the history panels (`components/InsightsModal.tsx:163`); phone: `mobile/src/app/insights.tsx:33` |
| **Route** | `GET /api/stats` |
| **Handler** | `handleStats`, `lib/server/insights/handlers.ts:42` |
| **Data layer** | `userStats` and the `pipelines` object, `lib/server/insights/stats.ts:46,153` |
| **MongoDB** | Six aggregation pipelines over `completions`, all beginning with `$match: { userId }` so the index does the narrowing before anything else runs. |

| Pipeline | What it does |
|---|---|
| `totals` | days active, items ticked, accomplishments |
| `byWeekday` | `$isoDayOfWeek` — which days of the week you actually work |
| `byWeek` | `$dateToString` with `%G-W%V` — ISO weeks, correct across year boundaries |
| `byMonth` | `$substrBytes` on the stored `YYYY-MM-DD` |
| `byTrack` | `$lookup` into `tracks` **scoped by `userId` as well as `trackId`**, because track ids are only unique per user |
| `longestStreaks` | **gaps and islands**: `$setWindowFields` + `$documentNumber` to rank each active day, subtract the rank from the day number so consecutive days share a constant, `$group` by that constant, take the longest run per track |

`longestStreaks` is the least obvious pipeline in the project; the gaps-and-islands
technique is described in §2, use case 4.

### Use case 5 — Use the app with no account, offline

| | |
|---|---|
| **Where** | `lib/localDb.ts` (IndexedDB via Dexie, browser), `mobile/src/storage/db.ts` (SQLite, phone) |
| **MongoDB** | none, deliberately. |

Listed because it shapes the server: the clients are the source of truth between
syncs, which is why the merge is per item and why the server never assumes it has
seen every change.

### Use case 6 — Delete my account and everything stored for it

| | |
|---|---|
| **UI** | Settings → Account → *Delete account* |
| **Client** | `lib/account.ts:46`; phone: `mobile/src/auth/session.ts:201` |
| **Route** | `DELETE /api/account` |
| **Handler / data layer** | `handleDeleteAccount`, `lib/server/account/handlers.ts:24` |
| **MongoDB** | `deleteMany({ userId })` on every collection that holds a `userId`, then the user and their sessions — **in one transaction**. |

MongoDB has no foreign keys and no cascading delete, so the cascade is the
application's job; the transaction is what makes it safe. See
[MODEL.md](MODEL.md) §7.

### Use case 7 — Share a track with someone else

**Not planned.** Every index starts with `userId` and every query names it, and
the sharding design (`{ userId: "hashed" }`) depends on no query needing data
from two users. Sharing would break that property.

### Use case 8 — See what the server has been refusing, without keeping anything personal

| | |
|---|---|
| **Where** | `lib/server/securityEvents.ts`, read by `npm run ops:check` |
| **MongoDB** | One document per *kind of rejection per hour*, raised with an atomic `$inc`; a TTL index deletes them after 30 days. |

The access pattern determines this shape: one document per rejected
sign-in would be a denial-of-service vector — anyone could fill the database by
failing on purpose. A counter costs the same whether something happens twice or
two million times.

## 3. Native driver and Mongoose

Both are used, each where it fits:

| | Native driver | Mongoose |
|---|---|---|
| **Used for** | sync reads and writes, search, aggregation, the audit log, security counters | `users`, `sessions`, `notes` |
| **Why** | bulk writes, `$meta: "textScore"`, `$setWindowFields`, transactions — the driver's own surface, with no schema in the way | casting and schema checks on the documents whose shape is fixed and server-controlled, plus `sanitizeFilter` |
| **Where** | `db().collection(TRACKS)…` in `lib/server/sync/store.ts`, `lib/server/insights/*` | `lib/server/models.ts` |

They share one connection: Mongoose owns it (`lib/server/db.ts`) and the driver
work goes through `mongoose.connection.db`. `lib/server/db.ts` also sets
`sanitizeFilter: true` and `strictQuery: "throw"`, caches the connection on
`globalThis` so a warm serverless function reuses it, and fails fast with
`serverSelectionTimeoutMS: 5000`.

## 4. Validation, in two layers

1. **zod, on every request** (`lib/server/sync/schema.ts`): strict — an
   unexpected field, a wrong type, an operator where a value belongs, or an
   oversized string or array is refused before it reaches the data layer.
2. **`$jsonSchema` validators, in the database** (`lib/server/collections.ts`):
   required fields, types, `date` matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`,
   `additionalProperties: false` on a day's items. If a bug let something
   malformed through, MongoDB itself refuses it (error 121).

The app's database user has `readWrite`, which can create a collection with a
validator but not change one afterwards — `collMod` is an admin privilege. A
changed validator is therefore applied by an administrator, and the app warns
until then.

## 5. Scale

Real use is small: about 28 KB for a year of one user. `scripts/seed.ts`
generates **2,000 users and 572,152 day documents (251 MB of data, 48 MB on
disk)** deterministically, through the server's own `splitWorkspace`, so the
documents are real ones and pass the validators on the way in.

Measured on that data ([PERFORMANCE.md](PERFORMANCE.md)):

| Query | Without its index | With it |
|---|---|---|
| One track's month of days | `COLLSCAN`, 572,152 documents examined, 189 ms | `IXSCAN`, 27 examined for 27 returned, 0.6 ms |
| All of one user's days (a sync read) | `COLLSCAN`, 572,152 examined, 178 ms | 998 examined for 998 returned, 5.6 ms |

ESR (equality, sort, range) decides the field order. An index with `date` first
still beats a scan, but examines 1,421 keys to return 336, because one track's
days are scattered through it. With the equality fields first they form one
contiguous stretch.
