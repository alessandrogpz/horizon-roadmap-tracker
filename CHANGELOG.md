# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

## [0.1.2] - 2026-07-25

### Fixed
- A track created through the onboarding wizard is no longer discarded on its
  first sync. `createTrack` now marks the workspace synced, so the first Sync
  against a Drive account that already holds data takes the merge path instead
  of the "unsynced: overwrite local with remote" branch that would wipe the
  new local track. (Connecting an existing account still overwrites correctly,
  since that path syncs before any local track exists.)
- The local `/api/git` route's home-directory guard now matches on a path
  boundary instead of a bare string prefix, so sibling directories such as
  `~/Documents-private` are no longer treated as inside `~/Documents`.

### Performance
- The "last synced" relative-time label now refreshes via its own interval
  inside the header instead of a dashboard-wide 15-second ticker, so the whole
  panel tree (streak grid, materials, weekly plan) no longer re-renders every
  15 seconds.
- The consistency-streak grid computation (a per-day walk across ~53 weeks) is
  now memoized on its inputs rather than rebuilt on every parent re-render.

## [0.1.1] - 2026-07-23

### Fixed
- Weekly-plan checkbox completions now merge per-item (per task/revision id)
  across devices instead of per-day. Previously, whichever device had the
  higher edit count for a day won the *entire* day's completions on sync, so
  two devices checking different items on the same day before syncing would
  silently lose one side's changes.
- The daily rollover now unions a day's snapshot into any completions already
  recorded for it instead of overwriting them, so a completion synced from
  another device can no longer be erased by a stale local snapshot.
- Pending (debounced) saves are now flushed before a manual sync and when the
  tab is backgrounded or closed, so a checkbox toggled just before either no
  longer risks being silently dropped.
