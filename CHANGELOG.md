# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

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
