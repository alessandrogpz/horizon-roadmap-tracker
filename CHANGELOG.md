# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

## [0.13.2] - 2026-07-26

### Fixed
- **Dropdown lists still unreadable in dark mode.** 0.13.1 set `color-scheme`,
  which is enough on browsers that apply it to the popup a `<select>` opens —
  but not on all of them: each `<option>` kept inheriting the control's light
  `color` while the list stayed on its default white backdrop, so the rows read
  as pale grey on white and only the one under the cursor was legible. Now the
  option colours are stated outright (`select option { background-color:
  var(--card-bg); color: var(--foreground) }`), which Chrome honours on Windows
  and Linux; `color-scheme` stays for macOS, which draws its own list and
  ignores per-option colours. Belt and braces, because there's no single
  property every platform respects. Disabled options get the subtle-foreground
  token so they stay visible-but-quiet against the dark backdrop.

## [0.13.1] - 2026-07-26

Three fixes on top of 0.13.0.

### Fixed
- **Unreadable dropdowns in dark mode** — an opened `<select>` drew its popup
  list in the browser's own light chrome: white text on white, legible only
  under the cursor. Fixed at the root with `color-scheme: dark` (and `light` on
  the light theme), which is the property that tells a browser to render *its*
  widgets — select popups, date/time pickers, form-control defaults, scrollbars
  — to match. Applies everywhere, not just to the settings dialog: the weekly
  rhythm editor's day dropdowns had the same problem.

### Changed
- **`components/PhaseTracker.tsx`** — a "Full Roadmap" button next to
  "[+ Add Phase]". The link moved into the header's ⋮ menu in 0.13.0, which is
  the right home for it but a long way from where you're reading the phases the
  document describes; the timeline is a summary of that roadmap, so it should
  open it. Locked with the same "connect Drive to unlock" state as the menu
  entry.
- **Removed the daily reminder** — the setting, the `reminder` field, and
  `components/DailyReminder.tsx`. It was the one addition that promised more
  than it could deliver (no server means no notification unless the app happens
  to be open), and it isn't wanted.

## [0.13.0] - 2026-07-26

Settings, restore-from-backup, and a top bar that fits on a phone.

The header had grown to seven items on one wrapping row, and every piece of
configuration lived behind a different unlabelled icon. Two changes: an overflow
menu holding everything you *do*, and a Settings dialog for the choices that
belong to the device rather than to a track. The bar keeps only what you *read*
— the mark, which track you're on, and whether it's saved.

### Added
- **Restore from a backup** (`lib/import.ts`) — the way back in for what
  `lib/export.ts` writes out, and the gap that mattered most: you could export a
  full backup but nothing could read one, so a cleared browser with a lapsed
  Drive connection meant the file was unreadable by its own app. Accepts either
  export format (the `.json`, or the `.zip`'s `database.json`), validates before
  touching anything, shows what's inside — tracks, notes, active days, export
  date — and only then replaces. Replace rather than merge: a restore means "put
  it back", and merging would need per-item timestamps a file may predate. The
  workspace goes through the migration pipeline on the way in, so an old backup
  lands at the current schema exactly as Drive data does.
- **`components/SettingsModal.tsx`** — theme, day rollover, week start, daily
  reminder, cloud connection, export, restore, storage used, and a two-step
  "delete local data". Explicitly *app*-level: a user hunting for "start date"
  should never find it next to "Client ID", so track identity, rhythm and
  rotations stay in their own dialogs.
- **`lib/settings.ts`** — device preferences in localStorage, deliberately not
  in the synced workspace: they describe how *this* device behaves, and syncing
  them would let one device silently reconfigure another. Malformed or missing
  fields fall back to defaults rather than breaking the app.
- **Day rollover hour** — `todayYMD()` now honours it, so work logged at 01:00
  can count for the previous day. It's the one setting that changes what the
  data *means*, and it lands in one place: every existing caller (the daily
  reset, which card the weekly plan highlights, which date a checkbox records
  against, the streak anchor) picks it up without threading a parameter.
- **Week start** — the consistency grid can open its columns on Monday.
- **Daily reminder** (`components/DailyReminder.tsx`) — fires once a day if
  nothing has been recorded by the chosen time. Only while the app is open:
  scheduled push needs a server holding a subscription, and this app doesn't
  have one (having one would mean your goals leaving your device). Settings says
  so plainly rather than implying otherwise.
- **Three-state theme** (`lib/theme.ts`) — Light, Dark, or System. "System" is
  encoded as *no stored value*, which is what the pre-paint script already
  treats as "follow the OS"; it now also re-applies when the OS flips while the
  app is open. Previously, once you clicked the toggle, "follow my system" was
  unrecoverable.

### Changed
- **`components/TopBarMenu.tsx`** (replaces `ModulesMenu.tsx`) — one `⋮` holding
  track settings, weekly rhythm, new rotation, full roadmap, new track, panel
  visibility, cloud & backup and settings. Module toggles are a section rather
  than their own popover: a menu that opens a menu is the worse trade.
- **`components/DashboardHeader.tsx`** — sync status stays in the bar on
  purpose; a status indicator hidden inside a menu stops being one. The theme
  toggle stays too (one click, and it's 28px).
- **`components/StreakGraph.tsx`** — builds its grid from `streakCalendar`
  instead of its own copy of the same week-walking logic, which is also what
  makes week-start work everywhere at once.
- **`WorkspaceProvider`** exposes `reload`, for changes made underneath the
  provider rather than through it — a restored backup, a wiped database.

Tests: `lib/__tests__/settings.test.ts` (settings normalisation and clamping,
rollover arithmetic) and `lib/__tests__/import.test.ts` (both file formats,
every rejection path, the summary) — 192 passing overall.

## [0.12.1] - 2026-07-26

Landing page trims and a theme toggle.

### Changed
- **`app/landing/page.tsx`** — one call to action instead of two: the hero's
  secondary "Build your first track" link is gone, since `/` already forwards
  to `/onboarding` when there are no tracks, so both buttons led to the same
  place for the visitors the page is written for. The footer's Dashboard /
  New track / Roadmap links are gone too — they pointed into an app the
  visitor hasn't set up yet.

### Added
- **Theme toggle in the landing nav** — the app's own `ThemeToggle`, not a
  copy. It writes the same `horizon-theme` localStorage key that the pre-paint
  script in `layout.tsx` reads on every route, so a choice made on either side
  carries to the other in both directions, with no flash on the way.

## [0.12.0] - 2026-07-26

The four hero metrics under the header — Current Streak, Timeline, Phase Day,
Progress — are now buttons, and each opens a detail panel for the number it
shows. Until now they were the only numbers in the app you couldn't ask a
follow-up question about: the streak said "1 day" without saying what the
longest run was, and Progress was a bar with no legend at all.

### Added
- **`lib/stats.ts`** (new) — pure, read-only summaries behind the panels:
  `streakStats` (current run, longest run anywhere in the history, active days,
  last 30, consistency, recent accomplishments), `streakCalendar` (day cells
  from the track's start, aligned back to the preceding Sunday), `timelineStats`
  (days passed/remaining, and each phase's day window, derived by opening each
  phase the day after the previous one's `recommendedByDay`), `phaseStats` (day
  within the phase, deadline, days left, task progress, and how many phases
  behind the schedule says you are) and `progressStats`. Covered by
  `lib/__tests__/stats.test.ts` (17 cases, clock pinned).
- **`components/StatDetailModal.tsx`** (new) — the panel itself, one body per
  metric, closing on Escape, backdrop click or the X. The streak body renders
  the same `StreakGrid` the dashboard panel and the landing page use.

### Changed
- **`components/DashboardHeader.tsx`** — `StatTile` is a `<button>` (keyboard
  focusable, with a focus ring) and takes an `onClick`; the Progress tile,
  which was a bare `<div>`, got the same treatment. The header owns which
  metric is open, the way it already owned the track-settings modal.

Progress deliberately reports two numbers rather than one: the share of the
work done, and the share of the time spent, with the gap between them stated in
words. Only the dimensions that actually hold items (phases, phase tasks,
deliverables, materials) count toward the work figure, so a track with no
portfolio isn't permanently capped below 100%.

## [0.11.0] - 2026-07-26

The consistency streak now renders as one grid that fills its panel instead of
a sideways-scrolling strip of fixed 10px cells, and the dashboard and the
landing page share the same component so the two can't drift.

### Changed
- **`components/StreakGrid.tsx`** (new) — the grid itself: seven rows, one
  column per week, columns sharing the available width evenly. Holds no state
  and no hooks, which is what lets the landing page (a server component) render
  it too; `onCellClick` is what makes it interactive for the dashboard.
  Cell width is capped at 16px, because a track that's only two weeks old would
  otherwise stretch its handful of columns into huge tiles — past the cap the
  grid stays left-aligned at its natural size rather than filling the panel.
- **`components/StreakGraph.tsx`** — builds cells for the grid rather than
  laying out the squares itself. Dropped the horizontal scroll container and
  the effect that pinned it to the right edge; there's nothing left to scroll.
  Tooltips, the click-through day detail modal and the shade thresholds are
  unchanged.
- **`components/landing/DashboardPreview.tsx`** — renders through the same
  grid, and lost the weekly-rhythm strip that used to sit under it. The
  hero miniature now ends on the streak, matching the dashboard panel.

### Added
- **`components/landing/WeeklyPlanPreview.tsx`** + a new "A real week" section
  on `/landing` — a static replica of the Weekly Study Plan panel showing week
  12 of the engine track (its focus types and colours, both rotations, and the
  real per-day work), as a concrete example of what a configured track looks
  like. It mirrors `WeeklyPlan.tsx`'s DayCard and reuses the app's own
  `.week-grid` / `.week-grid-scroll` classes, so it scrolls sideways on a phone
  exactly like the real panel. Checkboxes are drawn rather than real inputs —
  it's a picture, and a disabled `<input>` would still take tab focus.

## [0.10.0] - 2026-07-26

Added a public landing page at `/landing`, so the domain has somewhere to send
people who haven't used the app yet. `/` still opens straight into the
dashboard (and still forwards to `/onboarding` when there are no tracks) —
nothing about the app's entry path changed; the landing page is purely
additive, and both its calls to action lead back into it.

The page is a static server component: no workspace, no IndexedDB, no client
state, so it prerenders at build time and renders identically for a first-time
visitor with an empty browser. It states the thing that's easiest to get wrong
about this app — it is a roadmap tracker, not a to-do list — and explains
tracks, the six dashboard modules, the setup wizard, and where the data lives.

### Added
- **`app/landing/page.tsx`** — the page itself: nav, hero, a to-do-list
  comparison, tracks, the module grid, a four-step "how it works", the
  local-first/data section, closing call to action, and a footer. Page-level
  `metadata` (title, description, canonical, Open Graph) points at
  `https://www.horizonroadmap.com/landing`.
- **`components/landing/DashboardPreview.tsx`** — a decorative miniature of the
  dashboard for the hero (horizon bar, phase timeline, streak grid, weekly
  rhythm). Deliberately not the real panels: it has to render without a
  workspace. Its streak cells come from a fixed-seed generator rather than
  `Math.random` so server and client markup always match.
- **`app/globals.css`** — `.btn-sm` / `.btn-lg` / `.btn-solid` size and
  emphasis variants of `.btn`, plus `.landing-cta`, `.landing-panel-accent` and
  `.landing-preview`. These exist because the app's component classes live
  outside Tailwind's layers and so can't be overridden by utilities like
  `px-5`; the landing page otherwise reuses the app's own tokens and surfaces,
  so the two can't drift apart, and it inherits both themes for free.

## [0.9.1] - 2026-07-26

Corrected the PPP chapter numbers in the engine track's roadmap fixtures. The
curriculum was drafted against *Programming: Principles and Practice Using C++*
**2nd edition**, but the copy actually being read is the **3rd**, which dropped
the old chapter 1, merged the two I/O chapters, added a new chapter 17, split
the old chapter 21, and cut chapters 22-27. Under 3rd-edition numbering the old
groups pointed at the wrong material: Phase 1's "ch 1-10 core" ended five
chapters short of any pointer or free-store content while walking into the
book's GUI-library block, and the roadmap's "prioritise ch 8-10 — the ray
tracer depends on them" named functions, classes and I/O rather than the
memory-management chapters it meant.

### Changed
- **`lib/legacyPersonalData.ts`** (`LEGACY_ROADMAP_CONTENT`) — Phase 1 §1 now
  reads ch 1-6, 7-8, 9, 12, 15-17 with the reason each group is there, and
  Phase 2 §1 reads ch 18, 19, 20, 21 one bullet apiece. Added an explicit
  edition warning, a "deliberately skipped: ch 10, 11 past 11.2, 13, 14"
  paragraph so the GUI chapters don't read as an oversight, and a carry-over
  rule ordering the phase 1-9 → 12 → 15-17 (15-17 may slip into Phase 2, but
  never behind 18-21 — pointers gate the ray tracer, templates don't). The
  Phase 1 overview row and both resource lines now say "3rd ed".
- **`data/database.json`** — the four Roadmap Timeline strings holding chapter
  numbers, kept in step with the document above per the "the timeline is a
  summary of this document, never a second plan" rule.

Both files are migration/test fixtures — `LEGACY_ROADMAP_CONTENT` is read once
by the Dexie v1→v2 upgrade and `data/database.json` only by
`lib/__tests__/mergeWorkspace.test.ts` — so neither reaches an installation
that has already migrated. The live roadmap and timeline are edited in the app.

## [0.9.0] - 2026-07-26

Collapsible category groups in Materials. A long reading list pushed every
other panel down the page; now each category heading is a disclosure control,
so groups you're not actively working through can be folded out of the way.

### Added
- **Fold/unfold per category** in `components/MaterialsTracker.tsx` — the
  category heading became a button with a rotating chevron and an item count
  (e.g. `Mathematics (2)`), carrying `aria-expanded`/`aria-controls` for
  screen readers. The count stays visible when folded, so a closed group still
  says how much is inside.
- **Fold state persists** under the `horizon-materials-collapsed` localStorage
  key. It's a per-device view preference, not track data, so it deliberately
  stays out of the workspace record and off Drive sync — the same reasoning as
  `horizon-theme`. A device with no stored value starts fully expanded.

### Notes
- Folded groups are hidden with a display utility rather than unmounted, so an
  in-progress edit form inside a group survives folding it shut and back open.

## [0.8.0] - 2026-07-26

A real logo. The app had three different marks in the three places you
actually see it: a `>_` terminal glyph in the header, a stock rainbow torus on
the phone home screen, and the untouched Next.js default in the browser tab.
All three are now one mark, drawn from the app's own design tokens — a sun
clearing the horizon, where the horizon line doubles as the track's progress
bar.

### Added
- **`app/icon.svg`** — the master artwork, and also what modern browsers get
  as their favicon (`sizes="any"`, so it stays crisp at any tab size).
- **`components/HorizonMark.tsx`** — the same mark drawn plate-free in
  `currentColor` for use inside the app, so it follows the theme. Replaces the
  `>_` glyph in the dashboard header and on all three onboarding screens.
- **`app/apple-icon.png`** (180×180) and **`public/icon-maskable-512.png`** —
  purpose-built variants. Both are full-bleed with no corner radius of their
  own, because iOS and Android each apply their own mask; the maskable one
  keeps the mark inside the 80% safe zone so the ends of the horizon bar
  survive the circular crop.
- **`brand/build-icons.sh`** — regenerates every PNG and the `.ico` from the
  SVG sources, so the set can't drift apart by hand-editing one of them.

### Changed
- `app/favicon.ico` is now the Horizon mark at 16/32/48 px, replacing the
  Next.js starter default.
- `public/icon-192.png` and `public/icon-512.png` re-rendered from the new
  master.
- The manifest points `purpose: 'maskable'` at the dedicated maskable art
  instead of reusing the standard 512 icon, and its `background_color` now
  matches the app's actual `--background` (`#0a0a0c`, was `#09090b`).
- `app/layout.tsx` no longer declares `metadata.icons`. The app-directory file
  conventions (`favicon.ico`, `icon.svg`, `apple-icon.png`) emit better
  `rel`/`type`/`sizes` tags per file, and a manual `icons` block would have
  overridden them.
- Service worker cache bumped to `v3` and the maskable icon added to the
  precache list — without the bump, installed PWAs would have kept serving the
  old icons out of cache.

### Removed
- `public/icon.png` and `public/icon.jpg` — 1024 px source art for the old
  rainbow torus, referenced by nothing but the README. Recoverable from git
  history if ever wanted.

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
