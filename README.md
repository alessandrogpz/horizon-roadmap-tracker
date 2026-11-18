# Horizon

A tracker for long goals — the kind that take months, where the problem is not
remembering today's task but knowing whether you are still on course.

**[horizonroadmap.com](https://horizonroadmap.com)**

## Overview

You set up a *track*: a goal, a start date, a deadline, the phases in between,
and the rhythm you intend to keep each week. Horizon then tells you where you
stand against that plan — a year of days in the track's own colour, what this
week asks of you, which phase you should be in by now, and what you have
actually finished.

It runs in three places from one codebase: a website, an installable PWA, and a
native Android app. Every rule that decides anything lives in a framework-free
TypeScript core that all of them import unchanged. Signed out, nothing leaves
the device. Signed in, the same data syncs through your account — merged per
item on the server, so two devices never overwrite each other.

## Documentation

Documentation of this project is structured using the
[Diátaxis](https://diataxis.fr) framework.

**Tutorial:** step-by-step, from nothing to a running system.

- [Set up the development environment and the database](docs/nosql/SETUP.md)
- [Install it on a phone](docs/INSTALL.md)
- [Work on the phone app](mobile/README.md)

**How-To Guides:** practical guides for specific tasks.

- [Deploy it live (Atlas + Vercel)](docs/DEPLOY.md)
- [Restore from a backup](docs/security/RUNBOOK.md#4-restoring-from-a-backup)
- [Respond to an alert](docs/security/RUNBOOK.md#7-an-alert-fired)
- [Handle a leaked credential](docs/security/RUNBOOK.md#3-a-database-password-may-have-leaked)
- [Branches, checks and versioning](DEVELOPMENT.md)

**Reference:** technical descriptions of the data, the code and the commands.

- [The data model](docs/nosql/MODEL.md) — collections, fields, indexes, validation
- [The data layer](docs/nosql/DATA_LAYER.md) — every use case traced to its query and index
- [Query performance](docs/nosql/PERFORMANCE.md) — `explain()` with and without each index
- [The generated dataset](docs/nosql/DATA.md) — 2,000 users, 572,152 days
- [Security measures](docs/security/MEASURES.md) — every measure, its threat, its test
- [Every document, and when to read it](docs/README.md)
- [Changelog](CHANGELOG.md)

**Explanation:** how it is put together, and why.

- [Architecture](docs/ARCHITECTURE.md) — the shared core, the clients, the layering
- [Why a document database](docs/nosql/MODEL.md#10-why-a-document-database)
- [Replication and failover](docs/nosql/RESILIENCE.md) — measured, with write and read concern
- [Threat model](docs/security/THREAT_MODEL.md) — 44 STRIDE threats, rated, with accepted risks
- [Reporting a vulnerability](SECURITY.md)

## Features

- **Weekly overview** — what each day of a track is for, and what that day
  actually holds: the rotation topics due this week, the day's checklist, the
  gym plan for that kind of day.
- **Phases** — a vertical timeline of a track's phases, their deadlines, and
  what each one asks for.
- **Consistency** — a year of days in the shape everyone knows from a
  contributions graph, drawn in the track's own colour. Rest days carry a dot
  instead of reading as a gap, and bridge a streak rather than breaking it. The
  week is dated, so reshaping it never rewrites what already happened.
- **A colour per track** — chosen at creation, then worn by the whole app while
  that track is open. The track order follows the account, not the device.
- **Deliverables** — repository checklists with live git statistics, from local
  repositories or GitHub.
- **Gym plan** — the exercises a training day asks for, with sets and reps,
  driven by the track's weekly rhythm so the plan and the week are never two
  answers to one question.
- **Materials & notes** — references, a Markdown editor with live preview, and
  repository statistics.
- **Search & insights** *(signed in)* — full-text search across tracks,
  materials, phases, roadmaps and notes, plus history by weekday, week, month
  and track. Both computed by MongoDB.
- **All tracks** *(read-only)* — one board built from every track at once, for
  the question a per-track dashboard cannot answer. Progress is weighted by
  goal length, so a three-year track is not outvoted by a three-week one.
- **Demo data** — three seeded tracks with a year of ticks, so the multi-track
  views have something to show on a new account. The same button removes them.

## Tech Stack

| | |
|---|---|
| **Web** | Next.js 16 · React 19 · Tailwind CSS v4 · TypeScript |
| **Mobile** | React Native 0.88 via Expo SDK 58 · Expo Router |
| **Local storage** | Dexie (IndexedDB) on the web · SQLite, AsyncStorage and Keystore on the phone |
| **Server** | Next.js route handlers · MongoDB (Mongoose and the native driver) |
| **Auth** | Google OpenID Connect · server-side sessions |
| **Tests** | Vitest — 464 unit tests, 59 against a real three-member replica set |
| **CI/CD** | GitHub Actions · EAS Build and EAS Update · Vercel |

## Running it

```bash
npm install && npm run db:up && npm run dev
```

The database is a three-member MongoDB replica set in Docker; `db:up` starts it
and generates its secrets on first run. [SETUP.md](docs/nosql/SETUP.md) covers
a cold machine end to end, including what to do when a step fails and how to
point the app at MongoDB Atlas instead.

## Security

Account data is held under a threat model that is kept current with each
release: [THREAT_MODEL.md](docs/security/THREAT_MODEL.md) rates 44 threats and
records the risks accepted on purpose with their reasons;
[MEASURES.md](docs/security/MEASURES.md) lists every implemented measure with
the file that implements it and the test that proves it. To report a
vulnerability, see [SECURITY.md](SECURITY.md).
