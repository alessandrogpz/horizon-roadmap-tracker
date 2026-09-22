# Operations runbook

What to do when something goes wrong, and the one-time settings that keep it from happening. Commands
assume the repo root and a running local database (`npm run db:up`); for Atlas, use its connection
string instead.

## 1. GitHub, Vercel and Atlas settings (once)

**Two-factor authentication** on GitHub, Vercel and Atlas (each account's security settings). Whoever
controls these accounts controls the deployed code and the data (threat T9).

**GitHub → the repository → Settings:**
1. **Code security → Dependabot alerts** and **Dependabot security updates**: turn both on.
   (Version updates are already configured in `.github/dependabot.yml`.)
2. **Code security → Secret scanning / Push protection**: turn them on if your plan offers them for
   private repositories. CI's gitleaks job covers the history either way.
3. **Rules → Rulesets → New branch ruleset** (needs GitHub Pro for a private repository):
   - Name `protect main`, enforcement **Active**, target branch `main`.
   - Tick **Restrict deletions** and **Block force pushes**.
   - Tick **Require a pull request before merging**, then add yourself to the **Bypass list** (Add
     bypass -> your account, or "Repository admin", mode **Always**). A ruleset binds the repository's
     owner too, so without a bypass the fast-forward push in `docs/DEPLOY.md` §3 is rejected. The
     assessor, who gets write access, stays bound by it (threat E7).
   - Tick **Require status checks to pass** and add these four names, pasting each one whole:

     ```
     Types, lint, tests, build, dependencies
     Database tests (three-member replica set)
     Secret scan (gitleaks, whole history)
     Static analysis (Semgrep)
     ```

     They are the `name:` of each job in `.github/workflows/ci.yml`; the first is a single name that
     happens to contain commas. A name that doesn't match a real job never reports, and GitHub treats a
     never-reported required check as permanently pending, blocking every push. The search box only
     suggests checks it has seen in the past week, so if CI last ran longer ago, type the name and click
     "+ Add ...  Any source". Releasing by fast-forward carries `development`'s green checks to `main`
     (it is the same commit), so nothing has to re-run.
4. **Collaborators** (for the assessor): on a private repository you own personally, a collaborator
   always gets write access. With the ruleset above, they can't change `main`, which is what matters
   (threat E7).

**Atlas** (at deployment, MODULES_PLAN.md 4a): one database user per environment, each with `readWrite`
on its own database only, and a long generated password. Network access `0.0.0.0/0` is expected
(threat I8). The connection string goes only into Vercel's environment variables.

## 2. A session or account may be compromised

End every session of one user; they sign in again, the attacker's cookie is dead:

```bash
npm run db:shell
```
```js
const user = db.getSiblingDB("horizon").users.findOne({ email: "someone@example.com" })
db.getSiblingDB("horizon").sessions.deleteMany({ userId: user._id })
db.getSiblingDB("horizon").auditLog.find({ userId: user._id }).sort({ at: -1 }).limit(20)   // what changed, and when
```

End **every** session (for example after a cookie-handling bug): `db.sessions.deleteMany({})`.

## 3. A database password may have leaked

Rotate it first; cleaning up comes after.

- **Locally:** put a new value in `.env.docker` (`MONGO_APP_PASSWORD`) **and** the same one in
  `.env.local`'s `MONGODB_URI`, then run `npm run db:up`. Its init step sets the stored password to
  the one in the file. Restart the app.
- **Atlas:** Database Access → the user → Edit → new generated password → update `MONGODB_URI` in
  Vercel → redeploy. The old password stops working immediately.
- **If it was committed to git:** rotating is what protects you. Then remove it from the history
  (`git filter-repo`), force-push once with the ruleset temporarily relaxed, and check with gitleaks.

## 4. Restoring from a backup

Backups: `npm run db:backup` (local) or `npm run db:backup -- --uri-env ATLAS_URI` (any database whose
connection string is in that environment variable). They go to `backups/`, readable only by you.

Restore, overwriting the collections in the backup:

```bash
docker run --rm -i --network host -e URI mongo:8.0 \
  sh -c 'mongorestore --uri="$URI" --archive --gzip --drop --nsInclude="horizon.*"' < backups/horizon-<time>.archive.gz
```

`URI` is the connection string of a user allowed to write that database, **without the database name
in it** (`…/?replicaSet=rs0&authSource=admin`), because mongorestore would take a name there as the
target and restore nothing. To restore into a different database for inspection, use
`--nsFrom="horizon.*" --nsTo="horizon_restore.*"`.

Devices keep their own full copies: after a restore, each device's next sync merges back anything newer
it has.

## 5. A vulnerable dependency

CI fails on `npm audit --audit-level=high`, or Dependabot opens a pull request.
1. Read the advisory: is the vulnerable code reachable in Horizon? That sets the urgency, not whether to
   upgrade.
2. Upgrade (`npm install <package>@<fixed version>`, or merge Dependabot's pull request into
   `development`).
3. Run the checks, ship it as a patch release, and note it in the threat model (T8).

## 6. The database is down

Signed-in users see "Sync isn't available right now". The app keeps working offline, and syncing
catches up later. One member down: nothing to do, the others carry on (see
`docs/nosql/RESILIENCE.md`). Two down: writes stop until a majority is back. Locally,
`docker compose ps` shows which, and `docker compose start <member>` brings one back.

## 7. Someone asks for their data to be deleted

They can do it themselves: Settings → Account → Delete account. That removes everything the account
stored on the server, in one transaction. Their device keeps its copy until they use "Delete local data"
there too.
