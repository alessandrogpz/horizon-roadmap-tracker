# Horizon

A tracker for long goals: plans that run for months, where the question is not
what to do today but whether you are still on course.

**[horizonroadmap.com](https://horizonroadmap.com)**

## Overview

You set up a *track*: a goal, a start date, a deadline, the phases in between,
and the rhythm you intend to keep each week. Horizon then tells you where you
stand against that plan — a year of days in the track's own colour, what this
week asks of you, which phase you should be in by now, and what you have
actually finished.

It runs in three places from one codebase: a website, an installable PWA and a
native Android app. Every domain rule lives in a framework-free TypeScript core
that all three import unchanged. Signed out, no data leaves the device. Signed
in, it syncs through your account, merged per item on the server so two devices
cannot overwrite each other.

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

- [Features](docs/FEATURES.md) — what the app does, feature by feature
- [The data model](docs/nosql/MODEL.md) — collections, fields, indexes, validation
- [The data layer](docs/nosql/DATA_LAYER.md) — every use case traced to its query and index
- [Query performance](docs/nosql/PERFORMANCE.md) — `explain()` with and without each index
- [The generated dataset](docs/nosql/DATA.md) — 2,000 users, 572,152 days
- [Security measures](docs/security/MEASURES.md) — every measure, its threat, its test
- [Every document, and when to read it](docs/README.md)
- [Changelog](CHANGELOG.md)

**Explanation:** how it is put together, and why.

- [Architecture](docs/ARCHITECTURE.md) — the shared core, the clients, the layering
- [The phone app](docs/MOBILE.md) — the framework decision, device storage, lifecycle, rollout
- [Why a document database](docs/nosql/MODEL.md#10-why-a-document-database)
- [Replication and failover](docs/nosql/RESILIENCE.md) — measured, with write and read concern
- [Threat model](docs/security/THREAT_MODEL.md) — 44 STRIDE threats, rated, with accepted risks
- [Reporting a vulnerability](SECURITY.md)

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
a fresh machine end to end, including failure modes and how to use MongoDB
Atlas instead.

## Security

[THREAT_MODEL.md](docs/security/THREAT_MODEL.md) rates 44 threats by likelihood
and impact and lists the risks accepted deliberately, with reasons.
[MEASURES.md](docs/security/MEASURES.md) lists each implemented measure, the
file that implements it and the test that covers it. Both are updated with each
release. To report a vulnerability, see [SECURITY.md](SECURITY.md).
