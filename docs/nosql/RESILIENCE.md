# Replication and failover

Horizon's database runs as a **replica set** of three MongoDB servers holding the same data, locally in
Docker (`compose.yaml`) and on Atlas in production. This is how it survives a server going down, and
what the app asks of it when it writes and reads.

## How a replica set works

- One member is the **primary**; it accepts every write. The others are **secondaries**: each copies the
  primary's **oplog** (its log of operations) and applies it, so each holds a full copy.
- Members exchange **heartbeats** every 2 seconds. If the primary stops answering for
  `electionTimeoutMillis` (10 seconds by default), the remaining members hold an **election**.
- A candidate needs votes from a **majority** of members: 2 of 3. So one member can fail and the set
  carries on. With only two members, losing one leaves no majority and no primary, which is why three is
  the minimum.
- When the old primary comes back, it rejoins as a secondary and catches up from the new primary's oplog.
  Nothing switches back automatically: all members have equal priority here.

## The demo

`npm run demo:failover` writes a small document every 200 ms, with `writeConcern: "majority"`, while it
stops whichever member is primary. After the old primary has been brought back, it counts the documents
to prove that every acknowledged write survived. `-- --crash` kills the member instead (no warning, like a
power cut).

Both runs, on the local set (2026-09-10):

**Graceful stop** (`docker compose stop`):
```
  0.0 s  Primary is localhost:27017 (mongo1). Writing every 200 ms with writeConcern "majority"…
  3.0 s  Stopping mongo1 (the primary) gracefully…
  3.3 s  New primary: localhost:27018, 0.3 s after the signal.
 13.3 s  mongo1 is down (10.3 s after the signal).
 18.3 s  Starting mongo1 again…
 27.1 s  Done. 130 writes acknowledged, 0 failed; the slowest took 498 ms (#65).
 27.1 s  Counted back with readConcern "majority": 130 of 130 acknowledged writes are there — none lost.
```

**Crash** (`docker compose kill`):
```
  0.0 s  Primary is localhost:27018 (mongo2). Writing every 200 ms with writeConcern "majority"…
  3.0 s  Killing mongo2 (the primary), as if it crashed…
  3.2 s  mongo2 is down (0.1 s after the signal).
 13.9 s  New primary: localhost:27017, 10.8 s after the signal.
 13.9 s  write #16 took 10744 ms: it waited for the new primary, then succeeded
 27.8 s  Done. 83 writes acknowledged, 0 failed; the slowest took 10744 ms (#16).
 27.8 s  Counted back with readConcern "majority": 83 of 83 acknowledged writes are there — none lost.
```

What they show:

- **A graceful stop hands over almost instantly (0.3 s).** On a stop signal, a primary steps down first,
  prompting an election, and then enters *quiesce mode*: it finishes in-flight work while clients notice
  the new primary. That's why the process only exited 10 s later (Docker's grace period). No write
  noticed anything.
- **A crash takes as long as the election timeout (10.8 s).** Nobody told the others. They waited for
  missed heartbeats (10 s), then elected a new primary.
- **No write failed in either case.** The write in flight during the crash waited for a primary and was
  then retried by the driver. That's a **retryable write**: the driver retries a failed write once, on
  the new primary, and the server recognises a retry and never applies it twice.
- **Nothing acknowledged was lost.** Every write asked for `majority`, and all of them were there
  afterwards.

## What the app asks for

**Write concern: when a write counts as done.**
- `w: 1`: the primary has it. Fast, but if the primary crashes before a secondary copied it, the write is
  *rolled back* when the old primary rejoins: acknowledged, then gone.
- `w: "majority"`: at least 2 of 3 members have it. Any future primary must have it too, so a failover
  can't undo it. Every sync commits with `majority` (`lib/server/sync/store.ts`), and so does the demo.

**Read concern: which data a read may see.**
- `local`: whatever this member has, even writes not yet on a majority (which could be rolled back).
- `majority`: only data a majority has, which can't be rolled back. The demo's final count uses it.
- `snapshot`: one consistent point in time across every read in a transaction. Sync transactions use it,
  so the merge never sees half of another sync's writes.

**Read preference: which member serves a read.**
- `primary` (default, and what the sync uses): always the latest data. Needed there, because the merge
  must see every earlier sync.
- `secondaryPreferred` / `nearest`: spreads reads across members and lowers latency, at the cost of
  possibly reading slightly stale data (*replication lag*). Horizon's statistics could tolerate that; the
  sync can't.

**Timeouts.** `serverSelectionTimeoutMS: 5000` in `lib/server/db.ts`: during an election, a request
waits up to 5 s for a primary before failing with "Sync isn't available right now". The app keeps
working offline meanwhile, so the next sync simply catches up.

## What it doesn't protect against

- **Two members down at once**: no majority, so no primary. Secondaries can still serve reads to clients
  that allow it, but writes stop until a majority is back.
- **Deleting data**: replication copies mistakes too. That's what backups are for: the Atlas free tier has
  none, so a scheduled `mongodump` is planned (MODULES_PLAN.md, Step 6). Every device also keeps a full
  copy of its user's data.
- **A whole region**: the Atlas cluster's three members are all in one region (Frankfurt). Surviving the
  loss of a region would need members in several regions, a paid-tier option.
