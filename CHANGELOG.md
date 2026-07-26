# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

## [0.7.0] - 2026-07-26

Internal restructuring. No feature was added or removed and the UI is
unchanged — this release is about making the next feature cheaper to build.

### Added
- **Workspace state provider** (`components/workspace/WorkspaceProvider.tsx`).
  One place owns the loaded workspace, the debounced write, the flush-on-hide
  safety net, the daily reset and the Drive sync. Consumers use two hooks:
  `useWorkspace()` for data and `useWorkspaceActions()` for the three write
  verbs (`updateTrack` debounced, `commitTrack` immediate, `commitWorkspace`).
  The dashboard and the roadmap page each used to re-implement all of that
  independently, and modals took up to four separate mutation callbacks as
  props.
  - Writers take an updater function (`updateTrack(prev => next)`), which
    removes the "read the newest track through a ref" workaround that
    `RotationModal` needed to stop a debounced autosave clobbering a
    concurrent edit.
- **Versioned migration pipeline** (`lib/migrations/`). The three shape
  upgrades that ran inline — and unconditionally, on every single load —
  inside `fetchWorkspace` are now an ordered, append-only `MIGRATIONS` list
  behind a `schemaVersion` stamp on the workspace record, so each one runs
  once per device. Adding a migration is one function plus one list entry.
- **Migrations now also run on data pulled down from Drive**, before it is
  merged. A backup written by a device on an older version could previously
  win a merge in its old shape and land back in local storage un-upgraded.
- **`lib/completions.ts`** — the completion rules (day id set, accomplishment
  history, derived streak, stored item flag) as pure, tested functions.
- **`lib/trackActions.ts`** — the fifteen material/portfolio/phase/identity
  mutation handlers that lived inside `app/page.tsx`, as pure functions.
- **Per-panel error boundary.** A module that throws is now isolated to its own
  panel instead of taking the whole dashboard down to the app-level error page
  — including the sync button needed to recover.
- **Panel registry** (`components/panels/registry.tsx`) typed against
  `ModuleId`, so a module added to `lib/modules.ts` without a matching panel is
  a compile error. Module id, label, home column, icon and panel were
  previously spread across three files with no link between them.
- 38 new tests (117 → 155) covering the migration pipeline, the completion
  rules and the track actions.

### Fixed
- **A focus-type edit no longer risks being lost in a sync.** `configVersion`
  change detection ran against a hand-maintained list of track fields that
  omitted `focusTypes` entirely, so recolouring or renaming a focus type
  didn't mark the track as structurally changed. The check is now an
  *exclusion* list — progress and bookkeeping fields are named, everything
  else counts as config — which also makes the documented "remember to add
  your new field to `CONFIG_COMPARE_FIELDS`" footgun impossible.
- **Switching tracks now applies that track's daily reset.** A track left
  untouched since yesterday showed yesterday's ticked checkboxes until the
  page was reloaded.
- Completion state is no longer mutated in place inside the `weeklyCompletions`
  map — the previous code copied the outer map but wrote through to the day
  objects held by the current React state.
- `/api/notes` now carries the same localhost-only guard as `/api/git` and
  `/api/open`.
- Opening a material's notes no longer writes an empty note row, which would
  then be uploaded to Drive as an empty `note_<id>.md`.

### Changed
- `lib/api.ts` split by responsibility into `workspaceRepo.ts` (the only module
  that reads/writes the stored workspace), `gitStats.ts`, `notes.ts`,
  `systemLinks.ts` and `selectors.ts`. `lib/localDb.ts` is now just the Dexie
  schema.
- `app/page.tsx` went from 831 lines to 11 — it mounts the provider and renders
  `components/Dashboard.tsx`, which is layout and modal orchestration only.
- `ScheduleDayModal` (607 → ~390 lines) and `WeeklyPlan` use the shared
  completion functions instead of six hand-rolled copies of the same logic.
- `ScheduleDayModal`'s add-item forms and `FocusTypeEditor`'s new-type form use
  controlled React state instead of reading values back out of the DOM by
  `document.getElementById`, which also removes their duplicate global ids.
- The Modules menu draws each icon from the panel registry rather than its own
  parallel map.
- Retired `AppState` fields (`dailyFocus`, `dailyStudyPoints`, `studyStreak`,
  `lastDailyRoutineCheck`) are marked deprecated and optional, and are no
  longer seeded into new tracks. Existing records keep them untouched.
- Removed the unused `fetchTrackState` and `setActiveTrack` exports.

## [0.6.0] - 2026-07-25

### Added
- **Phase deadlines are now editable.** The phase detail modal's edit view gains
  a **Phase Ends** section: a date picker, the resulting curriculum day number
  shown beside it, and a *Clear* action that removes the deadline entirely.
  `Phase.recommendedByDay` has existed in the model since multi-track landed but
  was only ever settable by editing stored data by hand — there was no way to
  change a phase's end date from the UI at all.
  - Stored as a day offset from the track start rather than an absolute date, so
    re-dating a whole track later doesn't require rewriting every phase.
  - Clearing the field is how a phase opts out of the deadline and the
    phase-recommendation banner.
- **Deadlines shown in the Roadmap Timeline.** Each phase now renders its end
  date in faint monospace beneath its description (`Ends 31 Aug 2026 · day 88`),
  so the whole schedule is legible from the collapsed timeline without opening
  anything. Mirrored in the phase modal's header. Only rendered for phases that
  actually carry a threshold.
- `dateForDay`, `dayForDate` and `formatDayMonthYear` in `lib/dates.ts`.
  `dateForDay`/`dayForDate` are mutual inverses and share `daysSince`'s 1-based
  convention (day 1 *is* the track start date). `dateForDay` uses `setDate`
  rather than millisecond arithmetic, and `dayForDate` rounds rather than
  floors, so neither can drop a day across a daylight-saving boundary.

### Changed
- **Phase 1 of the Engine & Graphics track now ends 31 Aug 2026** (day 88)
  instead of running into September, so Phase 2 begins exactly on 1 September.
  Phases 2-4 keep their durations unchanged and shift accordingly: day 182
  (3 Dec 2026), day 330 (30 Apr 2027), day 392 (1 Jul 2027).
- **End dates removed from phase titles.** Titles return to `Phase 1: Months 1-3`
  — the date is derived from `recommendedByDay` and rendered by the timeline, so
  it can no longer drift out of sync with the stored threshold.

### Fixed
- **Phase end dates were off by one day.** `daysSince` counts inclusively from
  the track start (day 1 is the start date itself), but 0.5.0's phase boundaries
  were labelled as if day 0 were the start — so every date shown in the roadmap
  was a day late (day 92 is 4 Sep 2026, not 5 Sep). All day numbers and dates in
  the roadmap document and the timeline now use the same 1-based convention the
  rest of the app does.

## [0.5.0] - 2026-07-25

### Changed
- **Engine & Graphics curriculum rebalanced from 12 to 13 months.** The old
  plan gave Phase 2 roughly 2.5× Phase 1's load in 33% more time (four books,
  three tools, an asset database and the scene viewer) while Phase 3 carried
  three tasks across three months — the load curve was inverted, and the
  hardest phase had the least slack. Rebalanced across both the full roadmap
  (`LEGACY_ROADMAP_CONTENT`) and the Roadmap Timeline (`phases[]`):
  - **Phase 2** (now months 4–6) slimmed to one job: get a real-time renderer
    working end to end. LearnOpenGL, Calculus 1, ImGui, RenderDoc, the debug
    drawer and the scene graph, and nothing else.
  - **Phase 3** (now months 7–11, the long phase) absorbs everything
    architectural: *Game Engine Architecture* (Gregory), the Lengyel Vol 2
    deepening pass, the asset pipeline, plus the optimization half — deferred
    rendering, BVH/frustum culling, post-processing, Tracy.
  - **Phase 4** (months 12–13) reduced to Vulkan alone. PBR, image-based
    lighting and multi-threaded command buffer recording moved to a new
    **Beyond the Horizon** section rather than pretending a two-month phase
    could absorb them alongside learning Vulkan from zero.
  - **Phase 1 is unchanged** in content, but now states explicitly that PPP
    and LearnOpenGL are expected to carry into Phase 2.
- **Sequencing over parallelism.** LearnOpenGL (tutorial) and Lengyel Vol 2
  (derivation reference) no longer share a phase — the reference is now a
  second pass over code that already exists.
- **The SQLite thread is now an offline asset pipeline.** The database is
  editor-side, with a bake step emitting a flat binary that the runtime loads;
  the engine never opens the database. Previously the scene viewer deliverable
  loaded directly from SQLite, which coupled a schema bug to the graphics
  milestone and misrepresented how asset pipelines actually work. Phase 3's
  frame-timing database is kept as-is; Phase 4's half-edge relational-vs-
  document comparison is dropped (half-edge is an index structure whose point
  is cache-coherent traversal).

### Added
- **`recommendedByDay` on every phase** (92 / 186 / 334 / 396, from the
  2026-06-05 track start). This field existed in the model but was set on no
  phase, so the "time to switch phase" banner never fired and
  `DashboardHeader` fell back to its hardcoded 365-day horizon. Both now
  reflect the real 396-day plan.
- **A consolidation week closing every phase** — no new material, used to
  finish the in-flight chapter, polish the deliverable and write the README.
  This is the plan's explicit shock absorber; previously there was no slack
  anywhere across the twelve months.
- **A portfolio artifact in every phase.** Only Phase 1 had one (the visual
  README). Phase 2 now ends with a demo video, Phase 3 with a written
  performance case study drawn straight from the frame-timing database, and
  Phase 4 with an OpenGL-vs-Vulkan writeup plus a full portfolio pass.
- **Probability and Monte Carlo basics in Phase 4**, and multivariable
  calculus started early in Phase 3. Probability was absent from the entire
  curriculum despite Phase 4 requiring Monte Carlo integration and the
  rendering equation.
- **A required measurement artifact for Gregory's memory chapter** (arena +
  pool allocator with before/after load-time and allocation counts), so the
  book produces something instead of being passive reading.
- Phase task lists expanded from 18 to 37 entries so the timeline names
  everything the roadmap document does — deferred rendering, the allocator
  pass, the asset pipeline and the portfolio milestones were all previously
  described in the roadmap but invisible in the timeline.

### Notes
- The full roadmap and the Roadmap Timeline are now kept deliberately in step:
  phase names, deliverables, day thresholds and end dates agree across the
  document's overview table, its per-phase sections, and `phases[]`.
- `lib/legacyPersonalData.ts` and `data/database.json` are migration/test
  fixtures — they seed the Dexie v1→v2 upgrade and the merge tests, and do not
  retroactively update an already-migrated local workspace.

## [0.4.3] - 2026-07-25

### Changed
- **Roadmap curriculum now includes a data-management thread.** Added a
  "Data Management" topic to Phase 2 (modeling the scene graph as a
  relational adjacency table vs. nested documents, plus a SQLite-backed
  asset/material database feeding the OpenGL Scene Viewer deliverable) and
  Phase 3 (piping profiler frame captures into SQLite and querying them),
  with a callback from Phase 4's half-edge mesh topic. Master curriculum
  table's Phase 2/3 deliverables updated to match.

## [0.4.2] - 2026-07-25

### Fixed
- **Modules menu now stays fully on-screen.** After 0.4.1 the popover always
  opened rightward from its trigger, so when the *Modules* button sat near the
  right edge of the window the menu ran off-screen and clipped the module
  labels. It now measures the trigger on open and aligns to whichever edge
  keeps the whole menu inside the viewport (right-aligned when the trigger is
  near the right edge, left-aligned otherwise), and is capped at the viewport
  width for very narrow screens. Still overlaps content without shifting the
  layout.

## [0.4.1] - 2026-07-25

### Fixed
- **Modules menu no longer shifts the dashboard.** The header's *Modules*
  popover carried both the `absolute` utility and `glass-surface` (whose
  `position: relative` won the cascade), so it opened *in the layout flow* and
  pushed the hero metrics and every panel below it downward — by a varying
  amount depending on how the header wrapped at each screen width. It now
  forces `position: absolute` and overlaps the content instead. Also anchored
  it to the left of its trigger so the menu stays fully on-screen.

## [0.4.0] - 2026-07-25

### Added
- **Per-track modules.** Each track now controls which dashboard modules
  (Weekly Study Plan, Roadmap Timeline, Consistency Streak, Focus Timer,
  Portfolio Deliverables, Materials) are open, and in what order/column.
  - A **Modules** menu in the header toggles any module on/off for the active
    track, and each panel gets a hover **close (eye-off)** button. Reopen a
    closed module from the menu — it returns to its home column.
  - **Closing a module never deletes data.** It's a pure view change: the
    module is removed from the track's layout only; its data (streak history,
    materials, portfolio, …) stays untouched and reappears intact on reopen.
  - Different tracks keep independent layouts. An empty-state prompt shows when
    every module is closed.

### Changed
- Dashboard layout moved from a single shared workspace-level setting to
  **per-track** (`TrackState.panelColumns` + `hiddenPanels`). Existing layouts
  are migrated on load (each track seeded from the old shared value), and the
  per-track layout now syncs/merges via the track's own configVersion. New
  tracks are seeded with the default layout.

## [0.3.0] - 2026-07-25

### Added
- **Light theme.** A Sun/Moon toggle in the header switches between light and
  dark; the choice persists (localStorage) and first-time visitors get their
  OS `prefers-color-scheme`. An inline pre-paint script applies the theme
  before first render, so there's no light/dark flash on load.

### Changed
- Migrated the component tree off hardcoded dark-only colors (~430 usages of
  `text-white`, `text-zinc-*`, `bg-black/*`, `bg-white/*`, `border-white/*`,
  etc.) to semantic design tokens (`text-foreground`, `text-muted-foreground`,
  `text-subtle-foreground`, `bg-card`, `bg-input-bg`, `bg-surface-muted/hover`,
  `border-card-border[-hover]`), so both themes derive from one token set.
  Dark mode is visually unchanged. On-color text (`text-black` on accent/
  success chips) and modal scrims were intentionally left as-is.
- Added `--subtle-foreground` and exposed `--input-bg` as Tailwind utilities.

## [0.2.1] - 2026-07-25

### Changed
- Completed the lucide line-icon sweep across the modals and onboarding
  wizard: every remaining unicode close (`✕`) and check (`✓`) glyph is now a
  lucide icon, matching the dashboard. Covers the phase/schedule/rotation/
  track-settings/drive/rhythm modals, the onboarding steps, the wizard
  stepper's completed-step check, and the roadmap/rotation "Saved" labels.
  Close/remove buttons also gained `aria-label`s. (The checkbox tick remains a
  styled CSS pseudo-element by design.)

## [0.2.0] - 2026-07-25

### Changed
- Premium-minimal UI pass (shadcn/Vercel-flavored), dark mode. No information
  was moved behind menus — the dashboard stays as dense as before.
  - **Depth & elevation:** panels now sit on a proper surface ladder
    (page → card → inner rows) with a faint top-edge highlight and soft
    shadows, instead of a single flat plane of hairline-outlined boxes.
    Modals/notes drawer use a real translucent backdrop-blur surface.
  - **Hero metrics:** the header leads with an at-a-glance stat band —
    current streak (animated count-up), a Day X / Y timeline progress ring,
    phase day, and overall progress — all previously smaller inline text.
  - **Faint light source:** a low-opacity accent glow anchors the top of the
    page; base tone warmed slightly off pure black.
  - **Softer borders + motion:** relies more on elevation than outlines;
    checkbox check spring, staggered panel entrance, streak-cell hover, and
    progress-ring/count-up transitions (all respect `prefers-reduced-motion`).
  - **Icons:** dashboard chrome now uses lucide line-icons (edit, drag, more,
    cloud, roadmap, per-panel section icons, close/check) in place of unicode
    glyphs. Modal/onboarding-internal glyphs are a tracked follow-up.
- Section titles restyled as compact uppercase eyebrow labels.

### Added
- `currentStreakLength()` streak helper (consecutive-day count, anchored on
  today or yesterday) powering the hero streak metric, with unit tests.
- Light-theme design tokens staged in CSS (`:root[data-theme="light"]`),
  ready for a future toggle once the component color-token migration lands.

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
