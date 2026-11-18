# Setting up the development environment and the database

From nothing to a running app on a three-member MongoDB replica set. Each step
states its expected output, how long it takes, and what to do when it fails.

Last run end to end on 2026-11-08: cold database start **13 s**, database tests
**2.9 s** (59 tests, 6 files), app answering `/api/health` with `{"ok":true}`.

## What the machine needs

| | Why | Check it |
|---|---|---|
| **Node 24 or newer** | `package.json` → `engines` | `node -v` |
| **Docker, with Compose** | the local replica set | `docker compose version` |
| **Git** | the clone | `git --version` |

On Linux, Docker must be usable without `sudo`: `sudo usermod -aG docker $USER`,
then log out and back in. On Docker Desktop (macOS, Windows), turn on **host
networking** in its settings first — the replica set uses `network_mode: host`
so that the addresses members hand to clients (`localhost:27017-19`) work both
inside and outside the containers.

Nothing else is needed. No MongoDB installed on the machine, no Atlas account,
no secrets to copy: the passwords are generated on first run.

## The four commands

```bash
git clone <repository> horizon && cd horizon
npm install
npm run db:up
npm run dev
```

Then open <http://localhost:3000>.

### 1. `npm install`

About a minute on a warm npm cache, a few on a cold one. It does **not** touch
`mobile/` — the phone app has its own `package.json` and is irrelevant here.

### 2. `npm run db:up`

One command, three things:

1. **`node scripts/dev-env.mjs`** generates whatever is missing and changes
   nothing that already exists:
   - `.env.docker` — `MONGO_ROOT_PASSWORD` and one password per application
     user. Read *only* by the `init` container.
   - `.env.local` — `MONGODB_URI`, `MONGODB_TEST_URI`, `MONGODB_PERF_URI`, and
     the public Google client ID copied from `.env.example`.

   Both files are git-ignored. The app never sees the root password.
2. **`docker compose up -d`** starts `mongo1`, `mongo2`, `mongo3` (`mongo:8.3`),
   each `mongod --replSet rs0` bound to `127.0.0.1` on 27017, 27018 and 27019,
   authenticating to each other with a shared key file generated once into its
   own volume.
3. **`docker compose wait init`** blocks until the one-shot `init` container has
   run `docker/mongo-init.js`: `rs.initiate()` and then the users — `root`, and
   `horizon_app` / `horizon_test` / `horizon_perf`, each with `readWrite` on one
   database and nothing else. It is idempotent: it runs on every `up` and
   changes only what is missing.

It should end with `horizon-init-1 exited with status code 0`. Confirm:

```bash
docker compose ps
```

Three members, `Up`. The app connects as `horizon_app`:

```
mongodb://horizon_app:<password>@localhost:27017,localhost:27018,localhost:27019/horizon?replicaSet=rs0&authSource=admin
```

All three members are listed and the replica set is named, so the driver
discovers the topology and follows the primary through an election.

### 3. `npm run dev`, and proving the connection

```bash
curl -s http://localhost:3000/api/health
# {"ok":true}
```

That endpoint runs `connectDb()` and an `admin().command({ ping: 1 })`. A 503
and `{"ok":false}` means the app is running and the database is not.

The endpoints that require an account refuse without one:

```bash
curl -s http://localhost:3000/api/sync          # {"error":"Sign in to sync."}      401
curl -s http://localhost:3000/api/stats         # {"error":"Sign in to use this."}  401
curl -s http://localhost:3000/api/auth/session  # {"account":null}                  200
```

Sign-in is **Google Identity Services**, and the client ID in `.env.example`
accepts `localhost` as an origin, so *Sign in with Google* works on a fresh
machine with no configuration — but it needs the internet. Without it, the app
still runs completely: everything is in IndexedDB, and only sync, search and
history are unavailable.

## Verifying the database layer, not just the connection

```bash
npm run test:db
```

59 tests in 6 files, about 3 seconds, against a **real** replica set on the
`horizon_test` database as the `horizon_test` user — sign-in, sync and merging,
search, statistics, rate limiting and account deletion, transactions included.
`npm test` is the rest of the suite and needs no database.

Two further commands:

```bash
npm run db:seed        # ~90 s: 2,000 users, 572,152 day documents into horizon_perf
npm run db:explain     # ~30 s: re-measures every query and rewrites PERFORMANCE.md
npm run demo:failover  # ~30 s: stops the primary mid-writes; nothing is lost
```

`db:seed` is deterministic (`--seed 42`): the same command produces the same
data, and the documents go in through the server's own `splitWorkspace`, so they
pass the collections' `$jsonSchema` validators on the way in.

## Looking inside

```bash
npm run db:shell
```

`mongosh` as `horizon_app`; paste `MONGO_APP_PASSWORD` from `.env.docker` when
it asks. For a GUI, paste `MONGODB_URI` from `.env.local` into
[MongoDB Compass](https://www.mongodb.com/products/tools/compass).

```js
db.getCollectionNames()
db.tracks.getIndexes()
db.completions.find().sort({ date: -1 }).limit(1)
db.runCommand({ collStats: "completions" }).count
rs.status().members.map(m => [m.name, m.stateStr])
```

## Stopping it

| Command | Effect |
|---|---|
| `npm run db:down` | stops the containers, **keeps** the data |
| `npm run db:reset` | stops them and deletes the volumes — all local data and the key file |

## When it goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| `permission denied … docker.sock` | not in the `docker` group | `sudo usermod -aG docker $USER`, log out and in |
| `port is already allocated`, or the init container never finishes | something else on 27017-19, usually a MongoDB installed on the machine | stop it (`sudo systemctl stop mongod`), or `npm run db:reset` and change the ports in `compose.yaml` and `scripts/dev-env.mjs` together |
| members start, `init` hangs | host networking off in Docker Desktop | turn it on, then `npm run db:reset && npm run db:up` |
| `MongoServerSelectionError` after 5 s | the database isn't up, or `.env.local` points elsewhere | `docker compose ps`; the timeout is deliberate (`serverSelectionTimeoutMS: 5000`) so a dead database fails fast instead of hanging a request |
| `MongoServerError: Authentication failed` | `.env.local` and `.env.docker` disagree — usually one was deleted | `npm run db:reset`, delete **both** files, `npm run db:up` |
| tests fail with `Transaction numbers are only allowed on a replica set` | connected to a standalone `mongod`, not the set | check `MONGODB_TEST_URI` carries `replicaSet=rs0` |
| `/api/health` is 503 while the page loads fine | the page is static and served from the CDN, so it loads while the database is unreachable | see above |

## If Docker is not available at all

The app reads one variable, `MONGODB_URI`, and nothing in the code assumes
Docker. Point it at any MongoDB **replica set** — transactions and retryable
writes require one, so a standalone `mongod` will not do.

A free MongoDB Atlas cluster is a three-member replica set and works unchanged:

1. Atlas → **Create** → M0 (free). Any region; production uses AWS Frankfurt
   `eu-central-1`, in the same region as the Vercel functions.
2. **Database Access** → add a user with `readWrite` on the `horizon` database
   and nothing else.
3. **Network Access** → add the current IP address.
4. Copy the `mongodb+srv://…` string into `.env.local` as `MONGODB_URI`, with
   the database name in the path.
5. `npm run dev`; `curl -s localhost:3000/api/health` → `{"ok":true}`.

The collections, their `$jsonSchema` validators and every index are created by
`lib/server/collections.ts` (`openDb`, which every handler calls before
touching the database), so a brand-new cluster needs no manual setup. The one thing that cannot be done by the app's
own user is *changing* a validator afterwards — that needs `collMod`, an admin
privilege, by design.

The deployed instance is exactly this: Atlas free tier, `eu-central-1`, user
`horizon_prod` with `readWrite` on `horizon`. Step by step, including the
network access list: [`../DEPLOY.md`](../DEPLOY.md).
