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
| The all-tracks (master) view | `lib/masterTrack.ts` — pure aggregation, never returns a `TrackState`; UI in `components/master/` |
| Pure workspace queries | `lib/selectors.ts` — `orderedTracks` is what any *list* of tracks renders from; `visibleTracks` only when the order cannot matter |
| The order of the track list | `TrackMeta.order` + `reorderTracks` in `lib/trackActions.ts`. Synced, unlike the panel order: written onto every visible track at once so the list is ordered throughout or not at all |
| Where the community lives | `lib/community.ts` — one invite link, used by the landing page, both footers and both Settings screens; an empty override hides every link to it |
| The colours a track can wear | `lib/trackColors.ts` — the list, and why white and black are not on it |
| Days a track takes off, and what they do to a streak | `lib/restDays.ts` — the flag, the fallback for data that predates it, and the bridging rule |
| A track's colour at the grid's four strengths | `lib/colors.ts` (`shadeOf`, `withAlpha`, `lighten`) |
| Making a track's colour readable on a theme | `lib/colors.ts` (`readableOn`, `contrastRatio`, `darken`, `flatten`) + `lib/trackAccent.ts` — the accent and ink variables, written per theme because an inline value would sit above both |
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
| Coursework material (plans, learning log, exam drills) | `university/` — assessment only; nothing the app needs lives there |

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

**The colour is adapted to the theme before it is used, and this is the part
that is easy to undo by accident.** The six were picked on a dark screen; on
white, five of them fail even the 3:1 a control needs. `lib/trackAccent.ts`
emits every variable as a *pair* — `--track-accent-light` and
`--track-accent-dark` — and `globals.css` chooses between them, because an
inline style on `<html>` sits above both `[data-theme]` blocks and so a single
value is one neither theme can correct. `readableOn` walks the colour down its
own hue until it clears contrast; darkening scales every channel by the same
factor, so the hue is preserved exactly and the track still reads as itself.

Two things that caused wrong answers here, both worth keeping in mind:

- The accent is usually written on a **tint of itself**, which moves the
  background *toward* the text and costs contrast. Solving against the bare
  card says a badge passes when the screen gives 4.29.
- **Which surface is "worst" flips with the theme.** Light-mode ink is dark and
  loses most on the *darkest* surface; dark-mode ink is light and loses most on
  the *lightest*.

As fill — a dot, a wash, a ticked box — the colour stays exactly as chosen;
that is what tells two tracks apart. Only ink moves. `.track-ink` on the web
and `useInk()` on the phone are how a text site asks for the moved version.

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

## The all-tracks view

Every track at once, read-only, reached from the top of the track switcher.
Three rules, and breaking any of them is how this feature would go wrong:

1. **Read-only is structural, not a flag.** Nothing in `lib/masterTrack.ts`
   returns a `TrackState` and nothing in `components/master/` takes a change
   handler. There is no master track on disk, nothing to save and nothing to
   merge — which is the only way to be sure that editing the aggregate can
   never mean editing six real tracks by accident. Don't add an `onChange` to
   a master panel; add a link to the track instead.
2. **Everything keeps the colour of the track it came from.** An aggregate
   whose rows all look the same is a list nobody can read. The consistency
   grid *divides* a day into one band per contributing track rather than
   blending their colours: blue and amber average to a muddy grey that is
   neither, and the more tracks a day has the less a blend says.
3. **Averages are weighted by the length of the goal** (`masterProgress`). A
   ninety-day track at 50% and a three-year track at 50% are not the same
   amount of work.

Which tracks are in it lives in `AppSettings.masterExcluded` — the ones
switched *off*, so a track made tomorrow is in the view by default. Whether
the view is open is `AppSettings.masterView`: a device preference, like the
theme, because which track is active is data and syncs while which of the two
ways of looking at it you last used is this browser's business.

On the phone it is a **mode, not a screen**: the same four tabs — My Space,
Today, Plan, Progress — rendered read-only with every track folded in. The
flag lives in `mobile/src/master/MasterMode.tsx` (a provider, because
`@shared/settings` has no subscription a phone can use), each tab returns its
`Master*` body before any single-track hook runs, and the shared furniture is
in `MasterChrome.tsx`. It was one long standalone screen first, which meant
learning a second layout to answer questions the first layout already had
places for.

A track's own consistency panel shows that track and nothing else, on both
platforms. The two ways of seeing all of them — a strip per track, or every
day in one divided square — are a toggle inside the all-tracks view, which is
where that question belongs.

`/roadmap?all=1` is the same idea for the roadmaps: an index down the side and
one document at a time, because six roadmaps printed end to end is a document
nobody reads to the bottom of.

## The gym keeps to itself

A gym log is a note (`gym-<trackId>`), not part of the track, so it never
touches a day's items, completions, streaks or history. What it *is* keyed by
is focus types — the same keys a week is built from — so a plan filed under
`math` is indistinguishable from a maths day's plan, and anything asking "what
is planned for this day's type" finds it. That is how `Math: 0 of 1 exercises`
came to sit under a graphics track's weekly overview.

Gym data is now read only by the gym panel itself (`components/GymTracker.tsx`
on the website, the `FITNESS_PANEL` case and `/gym` on the phone).
`grep -rn "@shared/gym\|@/lib/gym\|useGymLog" lib components app mobile/src`
outside those files should come back empty. `focusOfDay` used to live in
`lib/gym.ts` and is not gym logic — it reads `weekSchedule` — so it moved to
`lib/focusTypes.ts`, which is what made that grep meaningful.

## A day holds one list

A day used to carry two — "revision" and "focus" — and you had to pick one
before you could write anything down. The split never survived contact with
real tracks: a single focus list would hold a book, a tutorial and a project,
which are three different kinds of work. Worse, "focus" already named a *day's*
type here, the thing the tag shows (Math, Rendering, Reading). Two meanings,
one word, on the same card. The day's type now says what the day is about, and
the day keeps one plain list.

**The two stored arrays are still there.** `dailyRevisionItems` and
`dailyTasks` are what every device and the server already hold, and completion
timestamps are keyed `r:` and `t:` by a `^[tr]:` regex in the server's schema
(`lib/server/sync/schema.ts`). Collapsing them into one array is a migration
with a sync protocol attached — server deployed before any client writes the
new shape — not a change of labels, so the labels went first. `DayItem.kind` is
how an item finds its way back to the array it lives in. No screen shows it.

**Every screen that lists a day's items goes through `dayItems`**
(`lib/dayItems.ts`): the weekly plan, the day editor, the phone's Today screen
and its rhythm calendar. That is what keeps a Tuesday the same Tuesday on all three, including
the order items read in. `grep -rn "dailyRevisionItems\|dailyTasks" components
mobile/src` should only find storage-level code, never a screen building its
own list.

New items are written with `NEW_ITEM_KIND`, which is the revision array,
because that is the one whose stored shape has a description field — `TaskItem`
has none, and its schema on the server is strict, so giving tasks a description
is a server change before it is a client one.

## Rotations, and the phase they belong to

A rotation's current item is `(weekNumber - startWeek) mod itemCount`, so it
turns once a week and wraps. `RotationDef.phase` scopes it: absent means every
phase (what every rotation did before, and the right default for a standing
habit), a phase id means it only runs while the track is on that phase.

Scoping exists because a cycle and a curriculum are different shapes. Ten
topics on a twenty-four week track wrap at week ten, so phase three brings
back what phase one already covered. Four short rotations, one per phase, say
"work through these once and be done" — and without scoping all four would run
at once, which is the problem, not the fix.

**Every caller of `computeRotationItemsForDay` must pass the track's
`currentPhase`.** The parameter is optional so that a caller with no phase to
hand gets the old behaviour rather than silently nothing — which also means
forgetting it is invisible. `grep -rn "computeRotationItemsForDay(" lib
components mobile/src` should show a `currentPhase` argument on every call.

Scoping decides *which* rotation runs, never how fast it turns: a three-item
rotation across a six-week phase still comes round twice.

## Days a track takes off

A focus type can be marked as a day off (`FocusType.restDay`), from the moon
button in either platform's focus-type editor. Those days:

- **bridge a streak** rather than breaking it, and never extend it — the count
  stays a count of days worked (`lib/restDays.ts`);
- **are drawn as a dot** in the consistency grid rather than filled in, because
  nothing was done on them and the square has to keep saying so.

Two things to know before changing any of it:

1. **The flag may be absent**, on every type written before it existed. So
   `isRestType` falls back to the two keys every template ships — `free` and
   `rest` — and `setRestDay` always writes the flag, including when it agrees
   with that fallback, so turning `free` into a working day survives a reload.
   Never guess from a label: a type called "Recovery" is a working day until
   somebody says otherwise.
2. **The week is dated, so changing it never rewrites the past.** A schedule
   is a decision about what comes next, not a claim about what already
   happened: turn Thursday from a day off into a working day and every
   Thursday already taken off stays taken off — dot, streak and all — while
   Thursdays from today onward are working days. `TrackState.restDaysFrom` is
   the log, `setWeeklyRhythm` is the only thing that writes it, and
   `restScheduleOf` turns it into the `RestOn` resolver everything else asks.

   Three rules about that log. It only grows when the *set of days off*
   actually changes, so renaming or recolouring a focus type leaves it alone.
   The first entry is seeded at the track's start with the set as it was
   before the first recorded change — a track written before the log existed
   still has a past that has to keep meaning what it meant, and "it has always
   been what it is now" is the only answer available. And it is sorted on
   read, because a merge between two devices can interleave entries.

   **Anything that writes `weekSchedule` must go through `setWeeklyRhythm`.**
   Writing it in place skips the dating, and the damage — a silently rewritten
   past — does not show up until somebody looks at last month.

Views that combine several tracks use the days *every* track in scope had off
on that date (`masterRestOn`) — a day one of them was supposed to work on is
not a day off, and two tracks can agree about Sunday in March and disagree
about it in September. `streakStats` takes that resolver as an optional third
argument.

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
