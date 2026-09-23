# The day before

One checklist for all three exams. The three exams are on the same day, so everything here is set
up once.

## The day before

- [ ] `npm run db:up`, and check `docker compose ps` shows three members running.
- [ ] `npm run db:seed` (about 90 seconds) if `horizon_perf` is empty, so `db:explain` has data.
- [ ] `npm run test:db`: all green.
- [ ] Your usual data synced to your account at least once (so search and insights have something).
- [ ] MongoDB Compass connected with `MONGODB_URI` from `.env.local`.
- [ ] Terminals open in the repo; the documents below open in tabs. [`README.md`](../README.md) in this
      folder says what every document is, if you need to find one mid-answer.
- [ ] The live site signed in and synced: <https://horizonroadmap.com>, Settings → Account.
- [ ] `curl -s https://horizonroadmap.com/api/health` answers `{"ok":true}`.
- [ ] `npm run ops:check -- --uri-env ATLAS_URI` runs clean (and is worth showing).
- [ ] GitHub → Actions: the last runs of CI, Uptime, Operations and Backup, all green.
- [ ] The exam laptop: disk encryption on, screen lock on (threat I10). If it's a different machine,
      clone the repo, install Docker, run `npm install` and `npm run db:up` there first.
- [ ] Hand-in admin: repo access for `peterruppel` (see RUNBOOK §1 about write access), and the
      Learning Platform form.

For the mobile exam, also:

- [ ] The newest build installed on the phone, and opened once to check it still runs.
- [ ] `cd mobile && npm start` works, in case a development build needs the server.
- [ ] The phone charged, off silent, and on the same network as the laptop.
- [ ] A few steps walked with the app open, so the step counter has something to show.
