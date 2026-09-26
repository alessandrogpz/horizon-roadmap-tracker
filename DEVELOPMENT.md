# Development Workflow

Internal notes for working on this repo. Not shown to end users — see `README.md` for that.

## Branches

| Branch        | Purpose                                   | Vercel deploy         |
|----------------|--------------------------------------------|------------------------|
| `main`         | Production. Always deployable.             | Production URL         |
| `development`  | Preview / staging for in-progress features. | Preview URL (separate origin, isolated IndexedDB) |

There is no other long-lived branch. (The `overhaul` branch used for the multi-tenant rework — multi-track data model, onboarding wizard, drag-and-drop panels — was merged into `main` on 2026-07-20 and deleted. `development` is its replacement for all future preview work.)

Short-lived feature branches can branch off `development` and merge back into it if useful, but for solo day-to-day work it's fine to commit directly to `development`.

## Workflow

1. Do work on `development`. Before committing, bump the version in `package.json` (and `package-lock.json`'s two matching root `version` fields) per [Versioning](#versioning) below, and add a `CHANGELOG.md` entry. Commit, push to `origin/development` — this deploys to the Vercel preview URL.
2. Verify the preview build (manually exercise the feature; for touch/mobile-only behavior, test on an actual phone since browser automation tooling is mouse-only and can't simulate real touch/long-press gestures).
3. When ready to ship, merge `development` into `main` and push. Before merging:
   - Confirm a clean fast-forward is possible: `git merge-base --is-ancestor origin/main origin/development`
   - Re-run the full check on `main` after merging, before pushing:
     ```bash
     rm -rf .next   # stale cache can reference deleted routes and produce false errors
     npx tsc --noEmit
     npm run lint
     npm run test
     npm run build
     ```
4. Push `main` only after all of the above pass clean.

Never force-push either branch. Never skip the pre-push checks on `main` — it's production.

## Versioning

`package.json`'s `version` field is the single source of truth — the small
`v0.x.y` badge in the app's bottom-right corner reads from it directly, so it
never needs updating separately. Follows [SemVer](https://semver.org/),
pre-1.0:

- Stay on major `0` until the app is considered beta-ready — under SemVer,
  `0.x.y` itself signals "not yet stable," so there's no need for `-alpha`/
  `-beta` suffixes on top of it.
- Bump **minor** (`0.X.0`) for a meaningful feature or user-facing change.
- Bump **patch** (`0.1.X`) for bug fixes and small tweaks.
- Reserve `1.0.0` for a deliberate "this is beta-ready" decision, not an
  automatic bump.

Bump the version in both `package.json` and `package-lock.json` (the two root
`"version"` fields near the top) together, and add a `CHANGELOG.md` entry, as
part of committing the change — not as a separate cleanup pass later.

## Testing against real data

The Dexie (IndexedDB) database and Google Drive `database.json` used for daily personal use are real, live data — never test against them directly. When verifying changes in a browser:

- Use an isolated port (e.g. `next start -p 3003`, `3001`, `3002`) rather than the port-3000 dev server used for daily use — a different port is a different origin, so it gets a fresh IndexedDB with no risk to real data.
- Stop the isolated test server when done (`pkill -f "next start -p <port>"` or equivalent).

## Where things live

| Concern | Module |
|---|---|
| Reading/writing the stored workspace | `lib/workspaceRepo.ts` — the only module that touches the workspace record |
| Dexie schema | `lib/localDb.ts` |
| Shape upgrades | `lib/migrations/` (pipeline in `index.ts`, steps in `steps.ts`) |
| Merge/conflict resolution | `lib/merge.ts` |
| What an edit does to a track | `lib/trackActions.ts` (materials, portfolio, phases, identity) and `lib/completions.ts` (checkboxes, streak) |
| Pure workspace queries | `lib/selectors.ts` |
| The colours a track can wear | `lib/trackColors.ts` — the list, and why white and black are not on it |
| A track's colour at the grid's four strengths | `lib/colors.ts` (`shadeOf`, `withAlpha`, `lighten`) |
| Demo tracks (`test1`/`test2`/`test3`) | `lib/demoTracks.ts`, offered from Settings on both platforms |
| App state + persistence timing | `components/workspace/WorkspaceProvider.tsx` |
| Which dashboard modules exist | `lib/modules.ts` (data) + `components/panels/registry.tsx` (icon + panel) |
| Local MongoDB (replica set, users, secrets) | `compose.yaml`, `docker/mongo-init.js`, `scripts/dev-env.mjs`; usage in the README |
| Accounts: sign-in, sessions, request checks | `lib/server/` (server only; never import it from browser code), `app/api/auth/session/route.ts`; browser side in `lib/account.ts` + `components/AccountRow.tsx` |
| Search and stats | `lib/server/insights/` (queries and pipelines), `app/api/search`, `app/api/stats`, `components/InsightsModal.tsx` |
| Generated dataset, query measurements, failover demo | `scripts/seed.ts`, `scripts/explain.ts`, `scripts/failover.ts` (run with `tsx`, against `horizon_perf`); results in `docs/nosql/` |
| Tests that need MongoDB | `*.db.test.ts`, run by `npm run test:db` (`vitest.db.config.mts`) against `horizon_test`; `npm test` skips them |
| CI and dependency updates | `.github/workflows/ci.yml` (checks, database tests, gitleaks, Semgrep), `.github/dependabot.yml` |
| Security measures, and what to do in an incident | `docs/security/MEASURES.md`, `docs/security/RUNBOOK.md`, `SECURITY.md` |
| Threats and how each is handled | `docs/security/THREAT_MODEL.md`: update it when adding a route, a data store or a third party |
| What each step teaches (for the exams) | `docs/LEARNING_LOG.md`: add an entry with every step of `MODULES_PLAN.md` |

Rules of thumb: `lib/` stays free of React, components stay free of business
rules. A new mutation belongs in `lib/trackActions.ts` as a pure
`(track, args) => nextTrack` function with a test, not inline in a component.

## The phone updates before the server does

An over-the-air update reaches installed phones within minutes of `eas update`.
The server changes only when the site is deployed from `main`. So a phone is
routinely running code newer than the server it syncs with, and anything the
phone sends that the server has not heard of has to be survivable.

`TrackSchema` and `WorkspaceSchema` therefore *drop* unknown fields rather than
refusing them: the field is lost until the deploy catches up, and nothing else
is. Refusing meant one unrecognised key rejected the whole payload — every
track and every note — which is how sync broke twice: once on a retired field
(0.21.4) and once on `phaseDaysSpent`, which shipped to phones over the air
while `main` sat several versions behind.

The envelope around them, `SyncRequestSchema`, stays strict. It gains nothing
as features are added, so anything unexpected in it is a reason to stop.

When a change adds a field that must reach the server, deploy `main` before or
alongside the OTA update — the schema tolerating it is a safety net, not a
substitute for the field actually arriving.

## A track's colour

Every track carries `meta.color`, chosen when the track is created from the
six in `lib/trackColors.ts`. It is not decoration: it is the accent the whole
app wears while that track is open, and the ink that track's history is drawn
in.

- **The web** rewrites CSS variables. `components/TrackAccent.tsx` sets
  `--accent`, `--accent-hover`, `--accent-muted`, `--ring` and `--streak-1` …
  `--streak-4` on `<html>` from the open track. Everything already reads from
  those variables, so nothing else had to change.
- **The phone** does the same thing one level up: `setAccent` on
  `mobile/src/theme/ThemeProvider.tsx` overlays `palette.accent`, and
  `TrackAccent` in `mobile/src/app/_layout.tsx` calls it when the track
  changes. Components that need the raw colour — the grids — read
  `track.meta.color` and pass it to `shadeOf`.

`--streak-0`, the colour of a day with nothing on it, is deliberately left to
the theme. It belongs to the page, not to the track, and in light mode it is
the only one of the five that has to stay readable against white.

Two rules that are easy to break:

1. **The picker offers six colours and never white or black.** The day a track
   began is drawn in the page's opposite — white on a dark screen, black on a
   light one — so that it is findable whatever the track is wearing. Add white
   to the list and that mark vanishes on exactly one track. It was previously
   drawn in the accent, which stopped meaning anything the moment the scale
   itself became the accent.
2. **A free-form colour input is not an improvement.** The grid paints four
   strengths of the chosen hue, and a colour near the page's own is four
   shades of nothing. The web used `<input type="color">` and lost it for this
   reason.

## Type on the phone

`mobile/src/theme.ts` holds `TYPE`: nine sizes, one per role — `display`,
`figure`, `title`, `heading`, `subhead`, `body`, `label`, `caption`, `micro`
and `eyebrow`. Spread the role first in a style and set colour and weight
after it:

```ts
title: { ...TYPE.subhead, color: palette.foreground, fontWeight: "600" },
```

There should be no `fontSize:` literal anywhere under `mobile/src` except in
`theme.ts`; `grep -rn "fontSize:" mobile/src | grep -v theme.ts` should come
back empty. If a role does not fit, the answer is usually that a role is
missing, not that this one place is special.

`TYPE` deliberately carries size only. An earlier version gave each role a
weight as well, which turned every muted 13pt explanation semi-bold, because
the role that matched its size was the one meant for control labels. Two texts
can be the same size and mean differently, so weight stays with the style.

## Adding a dashboard module

1. Append it to `MODULES` in `lib/modules.ts` (id, label, home column).
2. Add the matching entry to `PANEL_REGISTRY` in `components/panels/registry.tsx`.

Step 2 is enforced: `PANEL_REGISTRY` is typed as a full map over `ModuleId`, so
forgetting it fails the build rather than leaving a gap on the dashboard.

## Adding a migration

Write a pure `Workspace -> Workspace` step in `lib/migrations/steps.ts` and
append it to `MIGRATIONS` in `lib/migrations/index.ts`. Appending is what
advances `CURRENT_SCHEMA_VERSION`; nothing else needs updating.

**Never reorder or remove an existing entry** — a device's stored
`schemaVersion` is an index into that list. Steps must be idempotent: records
written before the pipeline existed report version 0 and replay every step, and
data pulled down from Drive is replayed through them too.

## Sync/merge correctness

`lib/workspaceRepo.ts`'s `applyTrackBookkeeping` decides whether a track edit
bumps `configVersion` (which drives "higher side wins" conflict resolution
during Drive sync). Fields with a dedicated smart-merge in `lib/merge.ts`
(`materials`, `portfolio`) are safe by construction. Everything else relies on
that comparison detecting in-place edits, not just additions/removals.

The comparison is deliberately an **exclusion** list (`NON_CONFIG_FIELDS`):
progress and bookkeeping fields are named explicitly, and any other field on a
track counts as structural config. So a new structural field on `TrackState`
needs no action — it is covered automatically. Only a new *progress* field
needs an entry, and getting that wrong merely over-bumps a counter, whereas the
old inclusion list silently lost edits when someone forgot (which is exactly
what happened to `focusTypes`).

When you do add a progress field, add a regression test in
`lib/__tests__/workspaceRepo.test.ts` following the existing pattern (create a
track, change the field, assert `configVersion` does *not* bump).
