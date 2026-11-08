# The day before

One checklist for all three exams, which are on the same day.

## Database and app

- [ ] `npm run db:up` — `docker compose ps` shows three members running
- [ ] `npm run db:seed` (~90 s) if `horizon_perf` is empty, so `db:explain` has data
- [ ] `npm run test:db` — 59 green
- [ ] `npm test` — 464 green
- [ ] Your own data synced to your account at least once, so search and insights have content
- [ ] MongoDB Compass connected with `MONGODB_URI` from `.env.local`

## Live site

- [ ] Signed in at <https://horizonroadmap.com>, Settings → Account
- [ ] `curl -s https://horizonroadmap.com/api/health` → `{"ok":true}`
- [ ] `npm run ops:check -- --uri-env ATLAS_URI` runs clean (worth showing)
- [ ] GitHub → Actions: CI, Uptime, Operations and Backup, all green

## Phone (SE_47)

- [ ] Newest build installed and opened once
- [ ] `cd mobile && npm start` works, in case a development build needs the server
- [ ] Charged, off silent, same network as the laptop
- [ ] A few steps walked with the app open

## The laptop itself

- [ ] Full-disk encryption on and a screen lock set — **an examiner can see this** (threat I10)
- [ ] If it is a different machine: clone, install Docker, `npm install`, `npm run db:up` there first
      ([SETUP.md](../docs/nosql/SETUP.md) covers a cold machine end to end)
- [ ] Terminals open in the repo; the documents you will cite open in tabs

## Admin

- [ ] Read access for `peterruppel` granted
- [ ] Hand-in forms submitted
