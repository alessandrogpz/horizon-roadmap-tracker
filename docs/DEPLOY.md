# Deploying accounts and sync to horizonroadmap.com

Until these steps are done, the live site works exactly as before. Without a Google client ID and a
database it hides sign-in, and the new API routes answer "not available". Do the steps below in
order.

## 1. Atlas: the database users and network access

In [cloud.mongodb.com](https://cloud.mongodb.com), project **horizon**, cluster **horizon-cluster**
(AWS Frankfurt, `eu-central-1`). A free cluster's region can't be changed later, so check it before
anything else: **Database** -> the cluster card names it.

1. **Security → Database Access → Add New Database User.**
   - Authentication: Password. Username `horizon_prod`. **Autogenerate Secure Password** and copy it
     somewhere safe for the next two minutes; don't paste it into chats or files in the repo.
   - Database User Privileges: **Specific Privileges → readWrite** on database **`horizon`** only. Not
     "Atlas admin", not "Read and write to any database". This is threat E5.
   - Add User.
   - Atlas's quickstart creates a user of its own, usually with "Atlas admin" or "Read and write to any
     database". Delete it; that breadth is the thing this step exists to avoid.
2. **Security → Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Vercel's
   servers have no fixed addresses. Threat I8 records why this is acceptable: the password, TLS and the
   narrow user carry the protection.
3. **Database → Connect → Drivers** (driver Node.js). Copy the `mongodb+srv://…` string and make three
   changes: the password in place of `<db_password>`, the database name `horizon` after the host, and
   `retryWrites=true&w=majority` among the options. Atlas's string already ends `…mongodb.net/?appName=…`,
   so the database name *replaces* that slash's emptiness rather than adding a second slash — `//horizon`
   leaves the driver with no database name at all. The result:
   `mongodb+srv://horizon_prod:<password>@<cluster-host>/horizon?retryWrites=true&w=majority&appName=<cluster>`.
   Those two options are today's defaults, but stating them keeps the durability the failover demo
   measures from changing silently under a future default.
4. **Prove the string works before touching Vercel.** Put it in `.env.local` as `ATLAS_URI=…` (git-ignored,
   readable only by you, and unlike a shell command it leaves no password in your history), then run
   `npm run db:backup -- --uri-env ATLAS_URI`. It reads and writes nothing, and a near-empty archive in
   `backups/` means the password, the user's privileges, the network list, DNS and TLS are all correct.
   An authentication error means the credentials; a timeout means the access list isn't Active yet.

Preview deployments don't get a database. Their addresses change with every deploy, and Google only
accepts sign-in from listed addresses, so accounts can't work there anyway. One fewer credential to
protect.

## 2. Vercel: the environment variables and region

In [vercel.com](https://vercel.com), the Horizon project → **Settings**:

1. **Environment Variables**, each for **Production only** (untick Preview and Development):
   - `MONGODB_URI` = the connection string from step 1.3. Mark it **Sensitive**.
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` =
     `82064719586-e6s5ajaef0qrun4g7j3667mii5etojm5.apps.googleusercontent.com` (public, but only needed
     where sign-in works).
2. **Functions → Function Region → Frankfurt, Germany (fra1)**, next to the database. `vercel.json`
   asks for the same region, and that file is what actually decides it — the dashboard setting alone
   did not reach the deployments here. A Hobby project may run in exactly one region, which is why
   `regions` names one; Pro allows five. Check it afterwards: the response header
   `x-vercel-id: fra1::fra1::…` names the edge that received the request and the region that ran the
   function. Two different codes there (`fra1::iad1::…`) mean the functions are running somewhere
   else, with every database round trip crossing an ocean and personal data processed outside the EU.

## 3. Ship it

When `development` has everything you want live:

```bash
git checkout main
```
```bash
git merge --ff-only development
```
Then run the checks from DEVELOPMENT.md ("Workflow", step 3), push `main`, and switch back. The push
prints "Bypassed rule violations for refs/heads/main" — that is the ruleset working, letting you
through on the bypass list (RUNBOOK §1) while it still holds for everyone else:
```bash
git push origin main
```
```bash
git checkout development
```

## 4. Check it live

- [ ] `https://horizonroadmap.com` → Settings → Account shows Google's button. Sign in, and a first sync
      runs.
- [ ] The sync button says "Synced with account"; in Atlas → Browse Collections, `horizon.tracks` and
      `horizon.completions` have your documents.
- [ ] A second device (or a private window) signs in and gets your data.
- [ ] Menu → Search & insights works.
- [ ] The response headers have the CSP and HSTS: `curl -sI https://horizonroadmap.com | grep -iE 'content-security|strict-transport'`.
- [ ] An attack request is refused: `curl -s -X POST -H 'Origin: https://evil.example' -H 'Content-Type: application/json' --data '{}' https://horizonroadmap.com/api/auth/session` → `403`.

## 5. Afterwards

- **Backups.** The Atlas free tier makes none, so `.github/workflows/backup.yml` makes one every Monday,
  encrypted to the public key in `ops/` and kept as a workflow artifact for 90 days. It needs two
  one-time steps — the `ATLAS_URI` secret and the key pair — in RUNBOOK §8. By hand, any time:
  `npm run db:backup -- --uri-env ATLAS_URI` (add `--encrypt-to ops/backup-key.pub` to encrypt it).
  The file lands in `backups/`, readable only by you.
- **Logs and alerts.** Vercel → the project → Logs shows each rejection as it happens. Nobody watches a
  dashboard, so the server also counts them in the database (`securityEvents`), a scheduled check reads
  the counters every morning, and `/api/health` is asked every half hour; either one failing emails you.
  What each alert means and what to do: RUNBOOK §7.
- **Level 2**: uptime monitoring, alerts on those lines and a scheduled encrypted backup all shipped in
  0.22.0. What's left of that list is a staging database with its own user, which needs a fixed preview
  URL registered with Google before sign-in can work there.
