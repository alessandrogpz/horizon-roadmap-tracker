# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

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
