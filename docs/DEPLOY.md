# Deploying accounts and sync to horizonroadmap.com

Until these steps are done, the live site works exactly as before. Without a Google client ID and a
database it hides sign-in, and the new API routes answer "not available". Planned for week 5
(MODULES_PLAN.md §5). Do them in order.

## 1. Atlas: the database users and network access

In [cloud.mongodb.com](https://cloud.mongodb.com), project **Horizon**, cluster **horizon** (Frankfurt):

1. **Security → Database Access → Add New Database User.**
   - Authentication: Password. Username `horizon_prod`. **Autogenerate Secure Password** and copy it
     somewhere safe for the next two minutes; don't paste it into chats or files in the repo.
   - Database User Privileges: **Specific Privileges → readWrite** on database **`horizon`** only. Not
     "Atlas admin", not "Read and write to any database". This is threat E5.
   - Add User.
2. **Security → Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Vercel's
   servers have no fixed addresses. Threat I8 records why this is acceptable: the password, TLS and the
   narrow user carry the protection.
3. **Database → Connect → Drivers.** Copy the `mongodb+srv://…` string, put `horizon_prod` and the
   password in it, and add the database name before the `?`:
   `mongodb+srv://horizon_prod:<password>@<cluster-host>/horizon?retryWrites=true&w=majority`.

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
2. **Functions → Function Region → Frankfurt, Germany (fra1)**, next to the database.

## 3. Ship it

When `development` has everything you want live:

```bash
git checkout main
```
```bash
git merge --ff-only development
```
Then run the checks from DEVELOPMENT.md ("Workflow", step 3), push `main`, and switch back:
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

- **Backups.** The Atlas free tier makes none. Weekly, from your laptop:
  `ATLAS_URI='<connection string>' npm run db:backup -- --uri-env ATLAS_URI` (put a reminder in your
  calendar). The file lands in `backups/`, readable only by you.
- **Logs.** Vercel → the project → Logs: sign-in rejections show as "Sign-in rejected: <reason>", and
  floods as "Rate limit reached".
- **Level 2** (only if time allows): uptime monitoring, log alerts on those lines, a scheduled backup job
  with an encrypted archive, and a second Atlas user for a staging database.
