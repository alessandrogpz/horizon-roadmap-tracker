# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

## [0.63.0] - 2026-09-24

Holding a panel now picks it up, rather than switching the screen into a mode that happens to allow
dragging. The whole reorder is one gesture: hold, move, let go.

### Added
- **Pick up a panel by holding it anywhere.** Every panel folds down to its own header, the held one
  comes to the thumb and stays under it, and the rest step aside as it passes. Letting go drops it
  where it is and the column opens back up. The folding is animated in both directions on purpose:
  it is the only thing telling you which panel you are still holding once they all look alike.

### Fixed
- **Holding a panel's title opened it instead of picking it up**, so the gesture only worked in the
  dead space in the middle of a card. `PanelCard` used React Native's `Pressable`, which is not
  built on a gesture and so takes no part in the arbitration around it — the drag above it had no
  way to claim the touch. It now uses Gesture Handler's, which does. A tap still opens the panel.
- **The drop target is counted in slots travelled**, not in where the panel has ended up. Because
  the panel sits under the finger it starts off the grid by however far down it was grabbed, so
  measuring its position made "up one panel" a different distance depending on where you grabbed it.
- **Scrolling is disabled while a panel is held**, and the column keeps its full height as it folds.
  Otherwise the page would scroll under a drag that is itself vertical, and the content shrinking
  would pull the scroll position out from under the gesture.

### Changed
- **Arrange is now only for adding and removing panels.** Reordering by holding covers the rest, and
  a mode you have to enter and leave was a poor fit for something this small.

## [0.62.0] - 2026-09-24

### Changed
- **The phone's phase list is a timeline**, the one the website has always had, rather than four
  bordered cards stacked on top of each other. A single line runs down the left with a dot per
  phase: green behind you, a ringed accent dot at the phase you are in, then dimming with distance
  ahead. The borders were doing a job the line does better — separating phases — while also
  insisting each one was equally important, which is the opposite of what a roadmap is for.
- **What sat in a card's header now sits in a line of its own**: `PHASE 03`, the title beside it,
  the description, then the deadline and task count in one faint row. The phase number is in the
  label, so `Phase 3: ` is stripped from the title rather than printed twice.
- **Phases ahead of the current one fade with distance.** Nothing past the phase you are in has
  been decided in any detail, and showing phase 8 as vividly as phase 4 said otherwise.

### Fixed
- **The glow on the current phase is a circle behind the dot, not a shadow.** Coloured shadows do
  not survive the trip to Android, so the website's `box-shadow` could not simply be copied.

## [0.61.0] - 2026-09-24

The week screen was showing a *pattern*, not a calendar: seven chips reading Mon..Sun, with no way to
ask what the week after next holds. That question has a real answer here — a rotation's topic is
computed from the week number and never stored — so the app knew, and simply had no way to say it.

### Added
- **A dated week you can walk through**, in place of the seven undated chips. Each day is a row: its
  date, what kind of day it is, and what is actually on it — the rotation topics computed for *that*
  week, the day's own checklist, and the gym plan for that kind of day, with a count of what was
  recorded. Stepping forward a week changes the rotation topics, which is the whole point.
- **A month view**, at the scope toggle beside it, for finding the week you want. One dot per day:
  its colour is what kind of day it is, and it is dimmed when nothing is on it. Tapping a day opens
  its contents below the grid. Deliberately less detail than the week — three signals is the most a
  45px cell carries before it becomes a bad week view.
- **A "Today" button**, shown only when it would do something: it appears once you navigate away from
  the current week or month, and disappears when you are back on it.

### Changed
- **The week screen's two halves now split by mode**, following the app-wide read-by-default rule
  from 0.55.0. Reading gives you the calendar, because you want dates. Editing gives you the seven
  chips, because what a *Thursday* is for is not a property of any single Thursday — setting it on a
  dated row would misdescribe what the tap changes.
- **The Weekly Overview panel's day strip carries dates**, so it reads as this week rather than a
  week in general, and agrees with the calendar it opens into.

## [0.60.0] - 2026-09-24

A cleanup pass, found by asking the code rather than reading it: which files nothing imports, which
exports nothing references, which dependencies nothing uses, which comments describe things that no
longer exist.

### Removed
- **Seven files of `create-expo-app` template theming** — `themed-text`, `themed-view`,
  `ui/collapsible`, `constants/theme`, `hooks/use-theme`, `hooks/use-color-scheme` and its web
  variant. They formed a closed island importing only each other, superseded by `src/theme.ts` and
  the theme provider the app actually uses.
- **Five unused dependencies**: `@expo/ui`, `expo-device`, `expo-glass-effect`, `expo-image`,
  `expo-symbols` — all template leftovers, none referenced in source or config.
- **Dead exports.** `getThemePreference` died when the website's Settings lost its theme row.
  `stepsEnabled` / `setStepsEnabled` died when the step panel became opt-in through `hiddenPanels`
  and Today lost its toggle. The edit-mode React context was written, never threaded, and the flag
  passed as a prop instead.

### Fixed
- **Five headings on the website still used the old panel names** — "Weekly Study Plan", "Roadmap
  Timeline", "Portfolio Deliverables", "Consistency Streak". The labels in `lib/modules.ts` were
  renamed in 0.54.0 but these components hardcode their own titles, so the dashboard disagreed with
  its own modules menu.
- **Comments describing Google Drive sync**, removed in 0.32.0, in the server's sync handlers, the
  web workspace provider, `useQuickNote` and a test. The one in `lib/import.ts` stays: it is
  genuinely about clearing the tokens a device that once used Drive still has.

### Changed
- **`isDateStr` in `lib/dates.ts`** replaces six copies of the same `YYYY-MM-DD` regex, with tests.
  It guards the boundary where a pasted or half-written value could otherwise reach date arithmetic.
- **The README documents the Android app**, which it had never mentioned despite being half the
  project — what it shares with the website, what only a phone can do, and where the build workflow
  is written down. Its feature list uses the current names.
- **`MODULES_PLAN.md` records that Drive sync was removed**, rather than leaving a decision that
  reads as current. The plan is a record of what was decided; a superseded decision is worth keeping
  alongside why it was superseded.

## [0.59.1] - 2026-09-24

### Fixed
- **Deleting the track you were standing on took two attempts.** Two provider calls in the same tick
  both read a ref that React only reassigns on the next render, so the second was built on a
  pre-first-call copy and wrote it back: the track was archived, then `switchTrack` rebuilt the
  workspace from the snapshot *without* the archive and saved that. Every write now goes through one
  `commit` that moves the ref before the state, so calls in a tick compose. This was a latent bug in
  any pair of consecutive edits, not only this one.

- **Scrolling felt sticky.** Two causes, both mine. Every row and every panel is wrapped in a swipe
  gesture that waited 12 points of vertical movement before giving up — a dead zone at the start of
  every scroll — now 4. And pull-to-refresh was pointing `simultaneousWithExternalGesture` at a
  plain component ref, which does not register, so the pull and the scroll arbitrated instead of
  running together; it composes with the scroll view's own gesture now.

- **The step count stopped moving while the app was open.** It showed
  `max(healthConnectTotal, sensorSinceSubscription)`, and Health Connect's whole-day total dwarfs a
  freshly-subscribed sensor, so the number pinned itself to a snapshot taken on open and never
  climbed. The snapshot is a *baseline* now: the sensor's reading is paired with it, and every step
  since is added. Whole-day accurate and live, and re-read on resume, which is when the snapshot is
  most stale.

### Changed
- **A day's accomplishments open under the day you tapped**, overlapping the weeks below rather than
  pushing them down — the grid is the thing being read, and having it jump loses your place. Any tap
  outside closes it. The backdrop covers the grid only, so the tabs and header keep working.

## [0.59.0] - 2026-09-24

### Changed
- **Dates are picked, never typed.** Every date field on the phone — a track's start and end, a
  phase's deadline — now opens a picker that narrows year, then month, then day. A text box asked
  the person to know the format, type it correctly on a touch keyboard, and get the month right, and
  then quietly did nothing when they did not, because the only thing the code could do with a
  half-typed date was ignore it.

  Every date here feeds arithmetic — a phase's deadline is stored as a day count from the track's
  start — so an unparseable one was never merely cosmetic. Offering choices removes the invalid
  state rather than handling it: every path through the picker produces a real date.

  It also means a range can be *enforced by omission*. A phase cannot end before its track begins
  and a track cannot end before it starts, so those years, months and days are not offered at all
  rather than refused after the fact.

  Built out of three lists rather than the platform's date picker, which is a native module and
  therefore a new build in everyone's hands.

## [0.58.1] - 2026-09-24

### Fixed
- **The gym panel had no card around it on the website.** `SortablePanel` is transparent chrome that
  only adds the hover controls — every panel brings its own `glass-panel` shell, and this one did
  not, so it floated on the column while its neighbours were boxed.
- **The gym panel was titled with the day's focus label.** Whatever the track calls that weekday —
  "Focus", "Maths" — was being used as the panel's heading, which said nothing about training and
  read as a bug. It says "Gym plan" on both platforms now, and the copy underneath no longer bends
  itself around the label either.

## [0.58.0] - 2026-09-24

### Fixed
- **Deleting a track still promised an undo it no longer offers.** The undo was removed in 0.57.0
  but the confirmation's own text still said "You can undo this for a few seconds afterwards" — so
  the dialog was describing behaviour that had gone. It now says what actually happens.
- **A new track on the phone never asked when it starts or when it should be done.** The template
  decided both silently, so a track arrived with a horizon nobody had chosen and a phase timeline
  scaled to it. Both are asked for now; leaving the end blank keeps the template's own length.

### Changed
- **"Total days" is an end date**, on both platforms. Nobody knows their track is 92 days long; they
  know it should be done by Christmas. The day count is still what gets stored — it is what lets a
  whole track be re-dated without rewriting every phase — so the field converts on the way in and
  out, and the line underneath says how many days that came to.
- **"My day starts at" and "Weeks start on" are one row on the website**, as they already were on
  the phone. When a week begins and when a day rolls over are the same kind of decision, and
  splitting them made one of them easy to miss.

## [0.57.0] - 2026-09-24

### Fixed
- **Deleting a track asked twice.** It had a confirmation *and* an undo, which is two decisions for
  one intent — the sheet has already had the conversation. The rule now: a swipe is a flick and gets
  an undo; a considered tap on something that carries a lot gets a question. One or the other,
  never both.

### Added
- **The Gym panel is on the website.** The log lives in a note, so both platforms read and write the
  same `gym-<trackId>` and neither knows which one wrote it. The website leans to planning — typing
  names, setting numbers, seeing the week — since that is what a desk is better at, with logging
  kept to one click per set.
- **Modules can be opt-in**, which `lib/modules.ts` now says directly. Anything not opt-in still
  appears by itself when a new version adds it; the gym does not, because a gym panel on a track
  about a database course is noise nobody asked for. The two platforms share the answer instead of
  each keeping their own list.

### Changed
- The landing page calls the modules what the app calls them — Weekly overview, Phases, Consistency,
  Deliverables, Timer — and lists the Gym alongside them.
- `MOBILE_PLAN.md` records how the plan actually resolved: four tabs rather than a smaller website,
  read-only by default, undo *or* confirmation, and new data going in a note rather than a new field.
- **Learning log entry 18**, on the twelve releases that added no features and were all design:
  verifying parity mechanically rather than by reading, rendering the UI to find layout bugs code
  review cannot, and why two editors for one fact will always disagree.

## [0.56.0] - 2026-09-24

### Fixed
- **A fast flick downwards sometimes got eaten by pull-to-refresh.** Flicking down is also how you
  scroll back to the top, and the pull was re-checking "are we at the top?" on every frame — so half
  way up the check would start passing and it would grab a gesture that was already a scroll. It now
  decides once, when the finger lands, and needs a deliberate 24-point drag rather than a flick.

### Changed
- **A plan has sets and reps, not just names.** A name said which exercise and nothing about the
  work, so the numbers had to be remembered every session. The **Gym panel now shows the day's
  exercises the way a workout app does** — name, sets done against sets planned, reps — with a tick
  per exercise as you finish it.
- **The Weekly Overview is just a tick**: "Push: 2 of 3 exercises", or done. The plan belongs to the
  gym panel, and repeating it in the week put the same information in two places — which is how the
  two came to disagree in the first place.
- **Tracks are deleted, not archived**, with a confirmation. Swiping is a flick rather than a
  considered tap and a track carries everything on it, so this one asks first — and the undo bar
  still catches it afterwards. It is still stored as a flag underneath, because the sync merge
  reconciles by comparing records: a track removed by *absence* would be handed straight back by the
  next sync from the account's copy. Nothing in the app shows a deleted track; a true erase needs a
  tombstone the server understands.
- **Swiping a panel in My Space hides it**, the same gesture as everywhere else. No undo on this
  one — nothing is lost, it is waiting in Arrange.
- **New tracks say what the field is for.** The name field is labelled "Name" and says so, and the
  kind below it says plainly that it only decides which panels the track opens with.

### Added
- **Track kinds seed default panels** — and nothing else. A fitness track opens with the gym, the
  week, consistency and steps; a learning track with materials and phases. Every panel stays
  available to every track from Arrange, for ever: hiding by kind would produce the unanswerable
  "where did it go?", and a real track is hybrid anyway. `lib/trackKinds.ts` is keyed to the
  existing template ids, because choosing "Fitness" when creating a track already answers the
  question.

## [0.55.0] - 2026-09-24

### Added
- **Swipe a row to act on it.** Left archives, right removes — the gesture every list app on the
  phone already has, and the one that was missing: archiving a track meant holding it, opening a
  panel and finding a button. The action appears behind the row and grows as you pull, so it says
  what it will do while you are still deciding, and a nudge marks the point where letting go
  commits. On tracks, materials and deliverables so far.

  Nothing is confirmed, because the undo bar is already the better answer. The two directions are
  deliberately not interchangeable: the gentle action is always left, the destructive one always
  right, and a row with only one of them only swipes that way.

- **Pulling down actually pulls the page down.** Android's `RefreshControl` drops a spinner over the
  top and leaves the page where it was, which reads as something happening *to* the screen rather
  than because of your thumb. The page now follows the drag with square-root resistance — close at
  first, stiffening as it stretches — reveals the indicator behind it, and springs back. Past the
  threshold the arrow turns over and it commits.

### Fixed
- **A phase on a fitness track was headed "Math Integration" and "Algorithms & Data Structures"**,
  with nothing under either. Those four sections are keys from when Horizon was one computer-science
  curriculum, and every phase on every track rendered all of them regardless of content. Only
  sections that hold something are shown now; the rest are offered as chips while editing. The
  labels were shortened too — "Focus", "Maths", "Algorithms", "Deliverable" — so the ones that *are*
  used read less like a syllabus. Changed on the website's phase modal as well.

### Removed
- **The "Set up a training week" card.** A card offering to rewrite the week of a track you had just
  opened, which nobody asked for, is a confusing thing to meet — especially on a track already in
  use for something else. Plans are built by adding exercises to a kind of day, which is the same
  action without the surprise.

## [0.54.0] - 2026-09-24

A coherence pass: several things in the app were the same idea wearing two names, or two editors for
one piece of data.

### Changed
- **The gym no longer decides what day it is.** It kept its own weekly split — push on Monday, pull
  on Tuesday — while the track's weekly rhythm already answered exactly that question for every
  other part of the app. Two editors for one fact, free to disagree.

  The rhythm now names the days and the gym fills them: a plan is held per *kind of day*, so "what a
  push day asks for" is a list of exercises, and which days are push days is set on the Week screen
  like any other track's days. `lib/gym.ts` lost `split` and gained `plans`.

- **The plan shows up in the week.** The Week screen puts the exercise count under each day, and the
  Weekly Overview panel lists what today asks for and how much of it is done. A day's contents come
  from wherever that kind of day keeps them — a checklist for an ordinary track, a gym plan for a
  training day — and the panel answers without caring which.

- **A "Set up a training week" button** writes a push / pull / legs week with two rest days, its
  focus types, and the exercises for each — all editable afterwards. Offered whenever a track has no
  gym plan, because every track already has a week of some kind and gating it on "no week" meant a
  fitness track never saw it.

- **Panel names name the thing, not a use for it.** "Weekly Study Plan" became **Weekly Overview**,
  since a track stopped being necessarily about studying the moment it could be about training.
  "Roadmap Timeline" became **Phases** — it sat one word away from the Roadmap *document*, which is
  something else entirely. "Portfolio Deliverables" became **Deliverables** and "Consistency Streak"
  became **Consistency**, both matching the screens they open. Changed on the website too.

- **The menu lost its track switcher and its shortcut grid.** Switching track is the track name in
  the header now, and having both meant two ways to do one thing with one of them three taps deep.
  Materials, Notes and the Timer all have panels that link straight to them, so the grid was a third
  route to screens that already had two. Search moved into what remains, being the one thing with no
  other home.

## [0.53.0] - 2026-09-24

### Added
- **A Gym panel and screen**, replacing "Movement" — which was the step counter again under a second
  name, reading the same numbers from the same place. The useful question in a gym is not whether
  the body moved but what today is for and how much of it is done.

  A weekly split says what each day is for (push, pull, legs, cardio…), a day can override it when
  the plan meets reality, and exercises are logged as sets of reps and weight. Every exercise shows
  **what it was last time**, because that is the question every working set starts with and looking
  it up is what a paper notebook is bad at.

  Built for one hand, standing up, between sets: reps and weight are steppers with real increments
  (1 and 2.5 kg) rather than a keyboard, there is no save button, and the entry opens on the last
  set of that exercise because "same again" is the overwhelmingly common case.

  The log lives in a **note** rather than on the track. The server validates the workspace against a
  strict schema that refuses unknown fields — the thing that once locked a real account out of
  syncing — so a new field would have meant a schema change, a migration and a deploy before a
  single set could be logged. Notes already sync, already merge per note, and hold half a megabyte
  each, which is years of training. `lib/gym.ts` holds the format, so the website can read the same
  log whenever it grows a gym panel.

### Changed
- **Tapping the track name switches track.** Which track you are in is the most consequential thing
  on the header and it was three taps inside a menu; the name was already the label for that choice,
  so it is now the control. It also reaches "new track", which was equally buried.
- **The header controls are one size.** The sync chip, the theme button and the menu were three
  different heights with three different borders, because each was written on its own day. They now
  share `HEADER_CONTROL` — 30pt tall, one radius, one border. A row of controls that disagree about
  their own height reads as unfinished however good each one is alone.
- The menu's `⋯` was a text glyph among icons; it is an icon now, at the same weight as its
  neighbours.

### Fixed
- A hundred-kilo session displayed as "0t". Volume shows kilograms until there are enough of them to
  be tonnes.

## [0.52.0] - 2026-09-24

### Added
- **Undo, instead of "are you sure?".** Removing a phase, a deliverable, a rotation or a day's item
  happens immediately and offers to put it back for a few seconds. A confirmation in front of every
  destructive action teaches people to tap through confirmations, so by the time one matters it has
  already been dismissed by reflex. The undo restores the whole previous workspace rather than
  reversing the edit — reversing a removal exactly would mean knowing where in the list it sat.
- **Panels are wrapped in an error boundary.** One panel throwing used to take the whole home screen
  with it; now it costs one card, and the rest keep working. The website has had this for as long as
  it has had panels.
- **Haptics**, on the things that deserve them: ticking an item, lifting and dropping a panel,
  flipping the theme, and anything destructive. Not on navigation, which would turn the phone into a
  buzzing brick.
- **Search works offline.** The phone already holds the open workspace and every note, so it answers
  from those instantly and lets the server's better answer — every track on the account, archived
  ones included — replace it when one arrives. Previously an offline search said "no connection" and
  nothing else.
- **A Movement panel**: today's steps, distance and active time from Health Connect, so a walk to
  the shops or a session recorded by a watch counts without Horizon knowing anything about it.
  Distance and active time show a dash rather than a zero until their permissions are requested —
  "not asked for" and "none today" are different facts.
- **Share progress is back**, in the `⋯` menu. It was taken off Today in 0.47.0 for being an odd
  thing to meet every morning, and never given a new home.

### Changed
- **The theme is two states, not three.** The app starts on whatever the phone is set to, so a fresh
  install already matches its surroundings and there is nothing to choose; the button flips it from
  there. The website's Settings loses its Theme row for the same reason — the icon in the top bar
  was always the faster path, and a "System" option that only mattered on first run was the least
  useful third of it.
- **Tap targets**: the bare `×` remove buttons were a glyph with a few points of padding, well under
  Android's 48dp. They are 44pt targets now, which is most of why they felt fiddly.
- **Font scaling**: the tab bar, the hour wheel and the grid's labels opt out of OS font scaling.
  They are grid-locked layouts where a scaled label clips or breaks the maths deciding which row is
  selected — the bug the tab bar already had once, waiting to be triggered by someone's
  accessibility settings instead of my numbers.
- Missing screen-reader labels on the remove buttons in Notes and the Week screen, and a disabled
  state that now explains *why* it is disabled.

## [0.51.0] - 2026-09-24

### Changed
- **"My day starts at" is one button and a wheel**, not twenty-four chips. A grid of options is fine
  for two or three and absurd for a full day: it fills the screen, every hour looks as likely as
  every other, and the one you want is buried in the middle. The wheel is built from a snapping
  ScrollView rather than a native picker, so it arrived over the air.
- **It sits with "Weeks start on" under one heading**, "Your week and day". They are the same kind of
  decision and were in two places.
- **Monday is the default week start**, on both platforms. It is the ISO week, what most of the
  world writes on a calendar, and it keeps the weekend as two adjacent columns instead of splitting
  it across both ends of the row. A stored value that is neither "sun" nor "mon" now falls back to
  the default rather than to whichever branch happened to be the else.
- **The theme is an icon in the header**, as on the website, and has left Settings. Three chips was a
  lot of screen for something people flip on a train when the light changes — and Settings is
  exactly where they are not when that happens. Tapping cycles follow-the-phone → light → dark, and
  the choice survives a restart. Three states rather than two so the default stays reachable: a
  two-way toggle would strand you on an explicit choice forever.

## [0.50.1] - 2026-09-24

### Fixed
- **The Health Connect build failed: Android's minimum SDK was too low.** Expo defaults
  `minSdkVersion` to 24 (Android 7) and Health Connect's client library declares 26 (Android 8), and
  the manifest merger refuses to build rather than quietly picking one. `expo-build-properties` now
  sets the floor to 26.

  Nothing is lost by raising it: Health Connect needs Android 9 anyway, so no device that could have
  used the feature is excluded — and Android 7 is well under 1% of phones.

## [0.50.0] - 2026-09-24

### Added
- **Steps from Health Connect** — whole days, including steps taken with Horizon closed and any
  counted by a watch or band. The on-device sensor could only ever report what happened while the
  app was open; Health Connect is the platform's store that whatever is actually counting writes
  into, and that other apps read with the user's permission.

  The two are used together rather than one replacing the other: Health Connect covers the whole
  day, the sensor covers the part spent in the app, and each day shows whichever knows more. A phone
  without Health Connect set up keeps working exactly as before, and the screen says which of the
  two it is showing rather than letting a total imply more than it is.

  Permission is asked for in Android's own dialog, not Horizon's, and only `READ_STEPS` is
  requested. The exercise, heart-rate and calorie permissions go in when the features that read them
  do — declaring health permissions an app does not use is what Play review looks for.

### Changed
- **App version 0.2.0, version code 2.** This is a new native build, and the over-the-air runtime
  version follows the app version, so builds carrying the Health Connect module get their own update
  channel. The previously installed 0.1.0 build stops receiving updates and needs replacing with
  this one.
- `ACTIVITY_RECOGNITION` was listed twice in the manifest. It is still needed — the live count on an
  open screen still comes from the sensor.

## [0.49.0] - 2026-09-24

### Changed
- **The consistency grid is grouped by month.** Each month is its own block, starting on the weekday
  it actually starts on, separated from the one before. A year as an unbroken ribbon of weeks is
  hard to read a month out of, because nothing marks where one ends. The weekday header stays at the
  top of the screen and every block lines up with it, so a Tuesday sits under "T" wherever it falls.
  The old continuous shape is a toggle away — it is still the better way to see a long run at a
  glance.
- **The row of links moved off the top of Plan, Progress and Materials.** Roadmap, Week & rotations,
  Deliverables, History and Search are places you might go, not what those screens are about, and
  they were sitting above the thing you came to read. They are at the foot now, under "More on this
  track".

### Added
- **The to-do list on Today**, collapsed until asked for and remembered per track. The two checklists
  above it are the plan — what this weekday is for, every week; a to-do is the loose end that came up
  today and has no place in a repeating schedule. Different things, same question: what am I doing
  today. It is the same list the Notes screen and the website edit.

## [0.48.0] - 2026-09-24

### Changed
- **Reading is the default; editing is a decision.** Every screen that can change the plan now opens
  read-only and carries a pencil: Today, Plan, a phase, the Week and its rotations, Materials,
  Deliverables. Tap it and the fields, the add boxes and the destructive controls appear together;
  tap Done and they all go away.

  The reason is that a touch screen has no hover, so an editable field and a label look identical
  until one of them moves — and most of the time someone opens Horizon they are checking where
  things stand, not rewriting the plan. A screen whose every field was a live text box invited
  exactly the accident it looked like it wanted.

  Two things are deliberately never behind the switch, because they are the app's whole point:
  ticking something off on Today, and the timer.

- **"My day starts at" accepts any hour**, not a handful ending at 6am, and is midnight by default.
  The old range assumed only night owls would want this. The hour someone's day turns over is theirs
  to state — a shift worker's may well begin at 19:00. Changed on the website too.

### Added
- **A step counter screen**, behind the panel: this week, the last thirty days and the year, the
  last fortnight day by day, and a typical day against the best one. A bare number has no shape —
  4,000 means nothing without knowing last week averaged 9,000.

### Fixed
- The month bands in the consistency grid ran the full width of the screen while the cells stopped a
  third of the way across, so the shading looked like it belonged to nothing. They are now exactly
  as wide as the grid.

### Known limitation
- **Steps are still only counted while the app is open**, and the screen says so rather than letting
  its totals imply otherwise. Counting a whole day is possible in principle — Android's step sensor
  is cumulative since boot, so the difference between two readings is the steps in between — but
  `expo-sensors` normalises that away and its `getStepCountAsync` throws on Android outright. Doing
  it properly needs Health Connect or a small native module, which is a new build rather than an
  update.

## [0.47.0] - 2026-09-24

### Changed
- **My Space is the home tab**, first on the left and what opens. It is the screen that answers
  "where does this track stand" without being asked anything; everything else is a way of drilling
  into part of it. Being first also does the back gesture a favour — the system back from any other
  tab now returns here instead of leaving the app — and every other tab carries a back arrow to it,
  since one tab is not "back" from another and nothing gives them one by itself.
- **The step counter is only a panel now.** It had a card and a toggle on Today as well, which made
  it look like part of every track's day rather than the opt-in it is. Today is the day's checklist
  and nothing else; "Share progress" went with it, being not a daily action.
- **"Focus Timer" is now "Timer", on both platforms.** Twenty-five minutes of work and five of rest
  suits a set at the gym, a language drill or a stretch of reading equally; calling it *focus*
  implied it was for studying and made it look out of place anywhere else. Its modes are "Work" and
  "Rest" for the same reason, and it has left the Progress screen's links — a thing you run is not a
  record of what you did.
- **The timer keeps running when you leave its screen**, which is the point of a timer you start and
  then go and do the thing. It lives above every screen now, and the header shows how long is left
  from wherever you are — tapping that takes you back to it. Still no sound or vibration when it
  ends; that needs a notification permission and a new build.
- **The consistency grid shows months, not weeks.** The cells were sized to fill the width, which
  left only a handful of weeks on screen — the opposite of what the grid is for. Fixed and smaller,
  about five months fit at once, with the month named down the left-hand side and a faint band
  behind alternate months so where one ends and the next begins is visible without counting rows.

## [0.46.0] - 2026-09-24

0.45.0 gave the phone the *shape* of an app. This gives it the idea behind the website: a track is a
set of panels you arrange yourself, and the app should be looked at more than it is read.

### Added
- **My Space**, a new tab: the whole track as a column of panels — the week as seven coloured dots,
  the roadmap as time-spent against work-done, the streak as a block of days, what you are reading as
  bars. Hold any panel, or tap Arrange, to drag them into the order you want, remove one, or add one
  from the list of what is available.

  The model is shared with the website, not reinvented: the same module ids, and closing a panel here
  closes it on the laptop because it writes the same `hiddenPanels`. The *order* deliberately does
  not travel — the website arranges two columns and a phone has one, so a phone writing its single
  order into `panelColumns` would flatten the laptop's layout every time someone dragged something on
  a train. Which panels you have is the same question everywhere; what order they are in is not.

- **The step counter is a panel** like any other, and the only one the website cannot have. Added
  from the same list, removed the same way, off until a track asks for it.

### Changed
- **Progress is vertical.** The website's consistency grid runs weeks across and weekdays down, which
  works on a desk and not in a hand — at phone width it either shrinks below what a thumb can hit or
  scrolls sideways, the one direction a phone is bad at. Turned ninety degrees, seven cells fit
  across at a size you can actually land on, which is what makes **every day tappable**: tap one and
  it says what was done that day. Three numbers across the top replace the paragraph.
- **The menu has icons.** It was a list of sentences; it is now a sync card that shows its own state,
  a grid of tinted shortcuts, and labelled rows — recognisable rather than readable.
- **Library is gone as a tab.** A tab whose whole job was holding the reading list did not earn being
  one tap from everywhere, and the materials panel says more in less space. The full list is still
  there, from that panel and from the menu.

### Fixed
- **Coming back from the background switched the step sensor on for tracks that had said no.** The
  resume handler only looked at the Android permission, never at whether this track wanted a step
  count — so any track could start subscribing to the pedometer after a trip to another app.
- A missing sensor module now leaves the rest of the screen working instead of white-screening
  Today. It is a checklist; it has nothing to do with walking.
- The streak panel gave several cells the same React key: the calendar pads each week out to seven
  with cells whose date is the empty string.
- Panel meters rendered with no labels — just bars and numbers. The label borrowed the card title's
  `flex: 1`, which resolves to `flexBasis: 0` and collapses a fixed width to nothing.
- `semver` resolved to the hoisted v6, which has no `functions/satisfies` subpath, so importing
  Reanimated failed the whole bundle.

## [0.45.0] - 2026-09-24

The phone app had every feature and the shape of a prototype: one screen with the day's work on top
and ten links stacked underneath, sync four taps away on a settings page, and a step counter on
every track whether it meant anything there or not. This is the shape it should have had.

### Added
- **A bottom tab bar** — Today, Plan, Library, Progress — with icons, so the four places you spend
  time are one tap apart from anywhere. Each tab lands on real content rather than a menu of further
  choices: Plan opens on the phases, Library on the reading list, Progress on the streak grid. Their
  siblings are a row of chips at the top.
- **A shared header** carrying the track name, a live sync chip and a `⋯` menu. The track name is
  not decoration: with a dozen screens, "which track am I editing?" stops being obvious the moment
  you leave Today, and every edit belongs to one.
- **Sync is visible and always in reach.** The chip says synced, syncing, offline or local-only, and
  tapping it syncs. It also runs by itself when the app returns to the foreground — the moment most
  likely to follow an edit made on the laptop.
- **Pull down to sync, on every screen.** The gesture people already try, working everywhere rather
  than on a chosen few.
- **The step counter is opt-in, per track.** Off unless turned on, from a control at the foot of
  Today. Right on a fitness track and noise on a graphics engine, which is the whole point. When it
  is off the sensor is never subscribed to, so a track that does not want it does not pay for it in
  battery — and Android is never asked for the activity permission at all.

### Changed
- Today is the day's work and nothing else: the day stepper with the summary under it, the two
  checklists, and two quiet footer actions. The wall of links, the switch button and the streak card
  are gone — the header, the tabs and the Progress tab already carry those.
- Sync lives in one provider instead of on the Account screen, so the chip, a pull-to-refresh and
  the Account button are the same operation with the same status rather than three ideas of it.
- The step-panel preference is stored on the device, not in the workspace. The server validates the
  workspace against a strict schema and refuses unknown fields (learning log 13), and a per-track
  display toggle is not worth a migration on the server — nor does a reading from *this* phone's
  hardware mean anything on another device.

### Fixed
- Material category chips overlapped each other: they were sharing a row evenly, which is right for
  three status buttons and wrong for twelve category names. They size to their labels and wrap now.
- The tab bar clipped its own labels, having given the icon the space first.
- The menu sheet is anchored to the bottom edge and fades in, rather than being slid a whole
  viewport and animated back — which left it off-screen when the animation did not run.

## [0.44.1] - 2026-09-24

### Added
- A deliverable's name and repository link are editable on the phone; it could only be added, ticked
  and removed before.
- "Clear the done" on the to-do list, which the website has had all along.

Both were found by checking which shared actions the website calls and the phone never does — a
mechanical check worth more than reading the screens, which is how the previous two parity claims
came out wrong. Everything in `trackActions`, `completions`, `quickNotes`, `stats`, `rotation` and
`selectors` is now reachable from the phone, except `recommendedPhaseId`, which the phone reaches
through `phaseStats` instead.

## [0.44.0] - 2026-09-24

### Added
- **Any day, not just today.** The phone was locked to the current date, which made the commonest
  evening job — ticking something from yesterday that never got ticked — impossible rather than
  merely awkward. The day can now be stepped through in either direction, and tapping the date comes
  back to today. The streak, the step count and the daily reset stay pinned to the real today: those
  are facts about now, not about the day being looked at.
- **A rotation's plan**, on its own screen. A list of topics does not explain itself — why these, in
  this order, on these days — and that reasoning was editable on the website and invisible on the
  phone.
- **Archived materials.** A material can be archived from its card and brought back from a folded
  group at the bottom of the list, as on the website. Archiving keeps the progress, the notes and
  the history and takes the material off the list; removing does not, and the screen now says so.

### Changed
- The roadmap's reader and editor became `components/MarkdownDocument`, shared with a rotation's
  plan. They are the same kind of document, and two copies would have drifted the first time one got
  a fix.
- These three were missed when 0.43.0 claimed parity was complete. It was not; this is.

## [0.43.0] - 2026-09-24

### Added
- **Materials can be added and removed on the phone**, which was the last screen still telling you
  to go to the website. Three fields — title, kind, category — not the website's ten: a phone is
  where "that book someone just mentioned" gets written down, and a form demanding page counts and
  links before it accepts anything is how that does not get written down. A material's page count
  can be set from its card afterwards, which is what makes the progress bar and the bookmark appear.

### Changed
- With this, every feature the website has that a phone can meaningfully hold is on the phone. What
  is left is deliberate: git statistics read a repository on the computer running the app, and a
  phone has no checkout to read.

## [0.42.0] - 2026-09-24

### Added
- **Rotations can be created and configured on the phone**, not only have their topics edited: the
  name, which list they feed, which days they run on, and the week they count from. A new one starts
  empty and on no days, so creating it doesn't change today's plan before it has been given any
  topics. The Week screen no longer tells you to go to the website for this, because it no longer
  has to.
- **Longest run, active days and the last thirty** on the consistency screen, and **progress against
  the calendar** on the phases screen — time spent beside work done, broken down by phases, phase
  tasks, deliverables and materials. The pace is the point: a track can be 70% through its calendar
  with 30% of the work finished, and neither figure says that alone.

## [0.41.0] - 2026-09-24

### Added
- **Today's list is editable on the phone.** It could tick items and nothing else, which made the
  phone a viewer of a plan made elsewhere — the wrong way round for the screen that is actually in
  your hand. Items can now be added to either list, renamed, or removed. Holding a row opens it for
  editing rather than a visible button doing so: ticking happens a dozen times a day and editing
  once a week, so the common action keeps the whole row.

  Rotation items can be ticked but not edited there. Nothing is stored to edit — they are computed
  from the rotation and the week number — and next week they will be something else. The list they
  come from is on the Week screen.

- **The pool of focus types**, on the Week screen: add a kind of day, rename one, recolour it,
  delete it. Renaming rewrites every day showing the old name, and deleting moves its days to
  whatever is left, because a day pointing at a type that no longer exists is worse than a day of
  the wrong kind. Those rules moved to `lib/focusTypes.ts` with tests, out of the React component
  that was holding them.

- **A track's own settings**: its name, colour, start date and length. Changing the length rescales
  every phase deadline in proportion, so making a track longer or shorter keeps the shape of its
  roadmap. Unlike the rest of the app this panel saves on a tap rather than as you type — typing
  "120" over "90" one digit at a time would otherwise rescale the whole roadmap three times on the
  way to a number nobody had finished typing.

- Colours are chosen from a fixed set rather than a colour picker, here and for focus types. A
  picker is a native module — a new build on every phone for one field — and a fixed set stays
  legible in both themes, which an arbitrary hex picked on a bright screen does not.

## [0.40.0] - 2026-09-24

### Added
- **A phase, in full, on the phone.** Tapping a phase opens it: its title, what it is about, its
  tasks, its deadline, and the four detail sections — core focus, math integration, algorithms and
  data structures, the deliverable goal. All editable, all saving as you type. This was the last
  real gap against the website, where the same thing is a modal; on a phone it is a route, so the
  back gesture works and a phase can be linked to.

  The phases list keeps its job — the shape of the plan, where today falls, adding and removing and
  making current — and hands off the inside of a phase to the new screen. The inline title edit went
  with it, because editing one field of something in a list is worse than opening it.

- The deadline is edited as a date and stored as a day number from the track's start, so re-dating a
  track moves its phases with it. A date that falls before the track begins is refused rather than
  clamped — silently moving a deadline somewhere nobody asked for is worse than ignoring a typo.
  Typed rather than picked from a calendar: a date picker is a native module, and a native module is
  a new build on every phone for one field.

### Changed
- `lib/phaseDetails.ts` holds the four sections' labels and order, and the normaliser for the older
  tracks that stored a section as a sentence rather than a list. That normaliser lived inside a
  React component while there was one reader; both platforms import it now, so a track shows the
  same headings wherever it is opened.
- The phases screen no longer says phases must be added on the website — they can be added from
  either, and have been able to for a while.
- The phases screen's header said "Roadmap", which is the *other* screen's name.

## [0.39.1] - 2026-09-24

### Changed
- **Learning log entry 17** and the mobile exam notes: what the last two releases actually taught —
  that React Native has no Node standard library (which is why a markdown renderer broke the
  bundle), that Android grants file access one user-chosen item at a time rather than by permission,
  and that whether a dependency contains native code decides whether a feature ships over the air or
  waits for a new build.

## [0.39.0] - 2026-09-24

### Added
- **Backups on the phone, in both directions.** Settings can write every track, phase, tick and note
  this device holds into a file, and read one back. It is the same file the website writes, so a
  backup taken on the laptop restores on the phone and the other way round — the shape and its
  validation moved into `lib/backupFormat.ts`, which both platforms import, so there is one parser
  rather than two that drift.

  This matters more on a phone than on a laptop. A laptop's copy can be reached from the machine
  itself; a phone's cannot, so a reset, a loss or an uninstall takes whatever was never synced with
  it.

  Restoring replaces rather than merges — the same decision the website makes, because a restore
  means "put it back the way it was" and a merge would need per-item timestamps the file may
  predate. Because it replaces everything, the file is parsed and described first: how many tracks,
  which ones, how many notes and recorded days, and when it was taken. A backup from the wrong week
  looks exactly like the right one until it has already overwritten today.

  Step counts are deliberately left out, for the same reason they are left out of sync: they are a
  reading from this particular phone's hardware and mean nothing on another device.

### Changed
- Files get in and out through Android's Storage Access Framework — the export asks for a folder,
  the import opens the system picker. An app has no access to the user's storage and cannot ask for
  any; it is only ever handed one location at a time, by the user. That is why the feature involves
  no permission prompt, and why it needed no new native dependency: `expo-file-system`, already part
  of every Expo app, carries both pickers, so this shipped over the air rather than as a new build.
- `MOBILE_PLAN.md`'s storage table said exports would go to the share sheet. They do not, and the
  reason they do not is the more interesting answer.

## [0.38.1] - 2026-09-23

### Fixed
- **The roadmap is rendered on the phone, not shown as its source.** The earlier judgement that a
  page of prose "reads fine with its headings intact" did not survive contact with a real roadmap:
  `##`, `- ` and `**` on every line is not prose. It now goes through a markdown renderer styled
  from the app's palette, with the raw text still shown while editing — that is what you are
  editing. The renderer is pure JavaScript, so the fix reached the phone as an over-the-air update
  rather than a new build.
- **Metro can resolve `punycode`.** React Native ships no Node standard library, so the markdown
  parser's `require("punycode")` — used for internationalised domain names in links — resolved to
  nothing and failed the entire bundle. The npm package is now installed and aliased in
  `metro.config.js`.

## [0.38.0] - 2026-09-23

### Added
- **The week and its rotations, on the phone.** Tap a day to change what it is for; add or remove a
  rotation's topics. Which topic shows today is computed from the week number rather than stored, so
  editing the list changes what comes up without touching anything already logged.
- **The roadmap**, readable in full and editable behind a deliberate switch — a stray tap in a
  4,000-word document on a touch keyboard is how plans get mangled. Shown as markdown rather than
  rendered: a parser and a component library would be a lot of machinery for a page of prose that
  reads fine with its headings intact.
- **Deliverables**, with ticking one off feeding the streak exactly as on the website. The git
  statistics stay on the web, because they read a repository on the machine running the app and a
  phone has no checkout.
- **Archiving a track**, from the same long-press that renames it. Archiving rather than deleting, so
  the change merges like any other edit rather than having to represent a deletion as an absence.

## [0.37.0] - 2026-09-23

### Added
- **History on the phone**: totals, which weekdays you actually show up, the last twelve months, and
  per-track figures with longest runs — all computed by the aggregation pipelines on the server,
  because they read every day document the account owns. The bars are plain views; a charting library
  would be a megabyte of dependency for what flexbox already does.
- **Track management**: create a track from any of the four templates, and hold a track in the list to
  rename it. The templates answer the questions the website's wizard asks, since a five-step form is
  the wrong shape for a phone and everything stays editable afterwards.
- **Phase editing**: tap a title to change it, make any phase current, add one, remove one.
  Descriptions stay on the website — a paragraph of prose on a phone keyboard is desk work.

### Changed
- The `Stats` response shape joined `SearchResult` in `lib/apiTypes.ts`, so the phone can name what the
  API returns without reading a file that imports Mongoose.

## [0.36.0] - 2026-09-23

### Added
- **Material notes on the phone.** Notes are keyed by the material's own id, the same as on the
  website, so one written on the sofa opens on the laptop. Saved after a short pause rather than per
  keystroke.
- **Delete account** from the phone, calling the same endpoint the website does. The device keeps its
  own copy and carries on offline — which is what the privacy page promises, now reachable from both
  places.
- **A focus timer.** It derives the remaining time from the clock rather than counting ticks, because
  JavaScript timers stop when Android backgrounds an app; coming back from ten minutes away shows the
  right number instead of ten lost minutes. It says plainly that it cannot notify you when it ends —
  that needs a notification permission and a new build.
- **Device settings on the phone**: theme (system, light or dark), when a day starts, and which day a
  week begins on.

### Changed
- `lib/settings.ts` takes its storage as a dependency instead of assuming `localStorage`. The browser
  keeps using it; the phone installs a key-value store loaded once at startup, because settings are
  read synchronously from hot paths like "which day is it" and an async read there would spread
  `await` through every caller.
- Every phone screen now takes its palette from a theme provider rather than reading the system
  scheme directly, which is what makes an explicit light/dark choice possible.

## [0.35.1] - 2026-09-23

### Fixed
- **The phone showed the wrong rotation items.** Rotations cycle — one topic this week, another next —
  so their items are computed from the rotation's definition and the week number, never read back
  from storage, and a stored one is last week's answer. Today's list now computes them exactly as the
  website's weekly plan does, from the same shared functions, and filters the stale stored copies out.
- **The daily reset didn't run on the phone.** Yesterday's ticks could carry into today. It now runs
  on load and whenever the app returns to the foreground — where the day may well have rolled over
  while the app sat in the switcher — and is written back immediately, since a reset held only in
  memory would be undone by the next process kill.

## [0.35.0] - 2026-09-23

### Added
- **The rest of the phone-first port**, all shipped over the air:
  - **Roadmap** — the phases between the start and the deadline, which one today falls in, and how
    far behind the schedule thinks you are. Read-only: rewriting a phase description is desk work,
    knowing where you are is not.
  - **Notes** — the notepad and the to-do list for the open track, saved as you type because Android
    can end the process without warning. The to-do list is the same markdown checklist the website
    reads and writes, through the same `quickNotes` functions.
  - **Search** — a thin client over `/api/search`, so the database's text index does the work instead
    of the phone loading every track and note into memory to scan them. Says plainly when it needs an
    account or a connection.
  - **Settings** — account, what this device holds, links to the privacy and security pages, and
    "delete local data" with a confirmation that disarms itself after a few seconds.

### Changed
- The API's response shapes moved to `lib/apiTypes.ts`. A type-only import is erased at build time,
  but TypeScript still reads the file it came from — and reading `lib/server/**` from a React Native
  project means resolving Mongoose's types in an environment that has no business having them. One
  definition, imported by both sides.

## [0.34.0] - 2026-09-23

### Added
- **The consistency grid on the phone.** One cell per day since the track began, shaded by how much
  landed on it, scrolling sideways and opening on the present — a year is 53 columns, which is more
  than a phone can show without the cells becoming meaningless. Tapping the streak on Today opens it.
- The cells come from `streakCalendar` in the shared core, the same function the website's grid and
  the landing page's miniature use, so the three cannot drift into disagreeing about what a day was
  worth.

## [0.33.1] - 2026-09-23

### Documentation
- Corrected a wrong claim: a build variant does **not** share the original's signing key. EAS keeps
  credentials per application identifier, so `com.horizonroadmap.app.dev` got its own keystore, and
  Google refused sign-in there with "This android application is not registered to use OAuth2.0". The
  mobile README and the runbook now say to read the fingerprint from the built APK
  (`apksigner verify --print-certs`) and list both variants' fingerprints.

## [0.33.0] - 2026-09-23

### Added
- **Materials on the phone.** Every book, course and paper on the open track, with its author, status
  and progress bar; tap one to change its status, move the bookmark, or open its link. Marking one
  Completed feeds the streak, because the shared core decides that — `setMaterialStatus` is the same
  function the website calls.
- The phone can now make any change the shared `trackActions` express, not just tick items: the
  workspace provider gained `editTrack`, which stamps and stores the result exactly as a tick does.

## [0.32.0] - 2026-09-23

### Removed
- **Google Drive sync is gone.** It predated accounts and did the same job worse: a second copy of
  everyone's data in a place this project doesn't operate, reached with an access token the browser
  had to hold. Signing in now covers every reason it existed, and signed out the app is local-only —
  a complete way to use it, not a degraded one.
- What went with it: `lib/googleDrive.ts`, the connect/disconnect modal, the cloud entries in the
  menu and settings, the Drive token in `localStorage`, and `https://www.googleapis.com` from the
  content security policy's `connect-src`. "Delete local data" still clears the old Drive keys, since
  a device that used it still has them.
- **The only sensitive Google scope went with it.** `drive.appdata` was what would have required a
  verification review before the OAuth app could be published publicly; sign-in alone needs none.
- The threat model records I12 as **Removed** rather than mitigated: deleting a feature is the
  strongest mitigation available, and it is worth distinguishing from defending one.

### Changed
- The sync button now says "On this device" when signed out, and opens Settings rather than
  pretending there is somewhere to sync to.
- `loadGoogleGisScript` moved into `lib/googleSignIn.ts`, where it belongs — it loads Google's
  identity script, which sign-in still needs.

## [0.31.1] - 2026-09-23

### Documentation
- `mobile/README.md` now carries the day-to-day workflow: the dev loop, what needs only a saved file,
  what needs an over-the-air update, what forces a rebuild and how long each takes — and the rule
  underneath, that JavaScript can be replaced in an installed app while native code cannot.
- The three Google OAuth clients are written down with what identifies each: the web client whose ID
  the server verifies as the token's audience, and an Android client per package name carrying the
  signing fingerprint. Also in `docs/security/RUNBOOK.md` §1, next to the other one-time account
  settings, with the consequence noted — a new build variant needs a new Android client, or sign-in
  fails there while the real app keeps working.
- `docs/README.md` indexes both `mobile/README.md` and `MOBILE_PLAN.md`.

## [0.31.0] - 2026-09-23

### Changed
- **The development build is now a separate app on the phone.** `app.config.ts` gives the
  `development` profile its own package name (`com.horizonroadmap.app.dev`), display name and deep
  link scheme, so it no longer replaces the real app on install — hot reload and the standalone build
  can coexist. The cost, documented in `mobile/README.md`: Google ties an OAuth client to a package
  name, so signing in from the development variant needs a second Android client in Google Cloud with
  the same fingerprint.

## [0.30.1] - 2026-09-23

### Fixed
- **Unticking an item on the phone came back ticked after a sync.** Ticking worked; unticking didn't.
  The website records an edit in two steps — what the new state is, then *which items changed and
  when* (`applyTrackBookkeeping`) — and the phone only did the first. Without those timestamps an
  untick is indistinguishable from "never ticked", so the account's timestamped copy won and the tick
  returned.
- The bookkeeping moved out of `lib/workspaceRepo.ts`, which is tied to Dexie and the browser, into
  `lib/bookkeeping.ts`, which is pure. Both the website and the phone now run the same code — two
  copies of a merge rule would be two rules.
- Three tests pin it: an untick with a newer timestamp survives, a tick the account lacks is still
  accepted, and — kept deliberately — an untick with *no* timestamp is shown losing, which is the bug
  itself preserved as a warning.

## [0.30.0] - 2026-09-23

### Added
- **Over-the-air updates for the phone app.** `expo-updates` with a channel per build profile, so a
  change to a screen, a layout or any other JavaScript reaches installed apps on their next launch —
  no rebuild, no queue, no store review. This is the practical half of the rule the platform keeps
  teaching: JavaScript can be replaced in an app that is already installed; native code cannot.
- A `runtimeVersion` tied to the app version, which is the safety catch. An update whose JavaScript
  expects native code the installed build doesn't have would crash on launch for everyone, with no
  way back from the user's side. Tying the runtime version to the app version means any release that
  changes native code gets a new one, and older builds stop receiving updates rather than receiving
  broken ones.

## [0.29.2] - 2026-09-23

### Documentation
- The exam date is confirmed: all three are on the same day in the **first week of November 2026**,
  about a week later than the estimate both plans were written against. `MOBILE_PLAN.md`'s schedule
  is rewritten around it — weeks 1 and 2 were finished in two days, so the time bought back goes to
  rehearsal rather than to more features.

## [0.29.1] - 2026-09-23

### Documentation
- Learning log entries 15 and 16, covering the phone: what moved between platforms unchanged and what
  could never move; where a session lives when there is no browser; why a sensor is not a data source
  you can simply read; how a permission can be refused permanently; why native code and JavaScript
  ship differently, which is the platform's central fact; and the CSRF check that was measuring the
  wrong thing, found because the security counters stayed at zero while the phone kept failing.

## [0.29.0] - 2026-09-23

### Added
- **Inter-app communication on the phone, both directions.** Outgoing: a share button hands Android a
  plain-text summary of where a track stands, and the system offers whatever can receive it — a
  message, a note, an email — with no permission involved, because the user picks the destination.
  Incoming: `horizon://track/<id>` opens the app on that track, matched by the scheme declared in
  `app.json`. A link is outside input, so it may only choose between tracks that already exist, and
  an unknown id falls back to Today rather than failing.
- Verified over USB: `adb shell am start -a android.intent.action.VIEW -d "horizon://track/…"`
  reached the running app and switched to that track.

## [0.28.2] - 2026-09-23

### Fixed
- **Signing in from the phone was refused before the token was even read.** The same-origin check
  rejected every request without an `Origin` header, and a native app doesn't send one — so the
  server answered 403 and never looked at Google's identity token. Found from the security counters:
  `sign-in-rejected` stayed at zero while the phone kept failing, which ruled out the token and
  pointed at the gate in front of it.
- The check now asks what it actually means to ask. Cross-site request forgery depends on the browser
  attaching credentials by itself, so a request carrying **no cookie** has no authority to abuse and
  is allowed without an `Origin`; whatever authenticates it — the phone's Bearer token — was supplied
  deliberately. A cookie without an `Origin` is still refused, because that shape is a browser and a
  browser should have sent one. Covered by tests for both shapes, and recorded in the threat model
  as T5.

## [0.28.1] - 2026-09-23

### Documentation
- `MOBILE_PLAN.md` §6b records why the project stays on Expo SDK 57: Expo Go's warning about SDK 58
  doesn't apply to a development build, and an SDK upgrade moves React Native, the toolchain and every
  native module at once — a poor trade four weeks before three exams, with a working build to lose.
  The exception worth watching is Play's own minimum `targetSdkVersion`, which is a platform deadline
  rather than a preference.

## [0.28.0] - 2026-09-23

### Documentation
- **One preparation document per exam**, in `docs/exams/`, since all three are on the same day and
  each examiner cares about a different face of the same work: `security.md` (the 5-minute talk and
  its question map), `nosql.md` (the demo and the questions), and `mobile.md` — new — with an
  8-minute demo on the phone, the framework comparison, and answers on lifecycle, storage,
  permissions and rollout. `day-before.md` holds the set-up checklist shared by all three.
- `docs/ORAL_PREP.md` is now the index to those, and names the overlaps worth pointing out in the
  room: the legacy field that broke sync is a validation story, a security story and a version-skew
  story at once.

## [0.27.1] - 2026-09-23

### Fixed
- **A build missing a native module no longer takes the whole app down.** Secure storage and Google
  sign-in are compiled into the app rather than downloaded, so a build made before they were added
  simply doesn't have them — and importing one at the top of a file crashed on startup. They are now
  loaded when first used, and a missing one reports "this build can't sign in" while everything else
  keeps working. Signing out finishes either way, since ending the server's session is the part that
  matters.

### Added
- The step counter logs each sensor event in development. Android's hardware counter batches — the
  first few steps often arrive as nothing, then a burst — and this is how that was observed rather
  than assumed. Verified on a Pixel 7 Pro: permission asked on tap, count climbing while walking.

## [0.27.0] - 2026-09-22

### Added
- **Sign in and sync on the phone.** The app asks Google for an identity token addressed to Horizon's
  existing web client, posts it to the same `/api/auth/session` the website uses, and receives a
  session token. Sync then runs against the same `/api/sync`, so the phone is simply a third device:
  the server merges it with the account's copy in a transaction, using the same `mergeWorkspace` the
  phone itself runs.
- An Account screen on the phone: sign in, sync, sign out, with plain messages for being offline,
  signed out or rate-limited.

### Changed
- **The server now accepts a session carried either way.** A browser keeps using the HttpOnly cookie
  no script can read. A native client asks for the token in the response body — by sending
  `X-Horizon-Client: native` — keeps it in the Android Keystore or iOS Keychain, and sends it as a
  `Bearer` header. Unlike a cookie, a bearer token is never attached automatically, so a request
  carrying one cannot be forged by pointing a browser at the API.
- Five database tests cover the phone's path: the token comes back in the body with no cookie set, it
  authenticates later requests, signing out kills it, an unissued token is refused, and a browser
  still gets a cookie rather than a token from the same endpoint.

## [0.26.1] - 2026-09-22

### Fixed
- The step-counter card now says what Android actually replied when a permission request goes
  nowhere, instead of looking like a dead button — including the case that matters, "refused, and
  Android won't ask again", with where to turn it on.
- The app re-checks the permission whenever it returns to the foreground, so granting it in Android's
  settings and switching back is enough. After a permanent denial an app can never prompt again, so
  noticing on resume is the only way back.

### Notes
- Expo Go does not declare Android's activity-recognition permission, so the pedometer cannot work
  inside it at all — confirmed on a Pixel 7 Pro, whose permission list for Expo Go has no "Physical
  activity" entry. It needs a development build carrying this app's own manifest, which is also what
  native Google sign-in needs. `eas.json` now defines development, preview and production build
  profiles, and `expo-dev-client` is installed.

## [0.26.0] - 2026-09-22

### Added
- **The step counter on the phone** (`mobile/src/steps/usePedometer.ts`), the one thing the app can
  do that the website cannot. It asks for the activity-recognition permission only when tapped,
  keeps working when refused, checks the hardware exists first, releases the sensor subscription when
  the screen goes away, and reloads the day when the app comes back from the background.
- Step counts live in their own SQLite table, deliberately outside the synced workspace: they are a
  reading from one phone's hardware, they would mean nothing merged with another device's, and the
  server's schema refuses fields it doesn't know (learning log 13).
- The app is now called Horizon rather than the template's name, with the `horizon://` deep-link
  scheme, the Android package `com.horizonroadmap.app`, and the activity-recognition permission
  declared.

### Notes
- Android has no "how many steps today" call — `getStepCountAsync` is iOS only — so the app keeps a
  running total from `watchStepCount`, which delivers only while Horizon is in the foreground. Steps
  taken while it's closed are therefore missed, and the screen says so rather than implying a full
  day's count. Closing that gap needs Health Connect and a development build.

## [0.25.0] - 2026-09-22

### Added
- **A phone app**, in `mobile/`: Expo (React Native), for the Mobile App Development module
  (`MOBILE_PLAN.md`). It reads and writes the same workspace the website does, through the same
  domain code — `lib/` is imported as `@shared/*` and runs unchanged, about 1,500 lines of types,
  dates, completion rules, streaks, selectors, merge and migrations.
- Storage behind one API with two implementations: SQLite on the phone, `localStorage` on web, the
  bundler choosing on the `.web.ts` extension. Every edit is written as it happens, because Android
  kills background processes without warning, and the app re-reads on resume so a phone left open
  overnight shows the new day.
- On screen: today's focus and revision items with working checkboxes, the streak, and a track
  switcher. Verified through `react-native-web`: ticking an item records it, the streak goes from 0
  to 1, and the change survives a restart.

### Changed
- The web app's `tsconfig.json` and ESLint config exclude `mobile/`, so the two toolchains can't
  trip over each other. The web app's own checks are unaffected.

## [0.24.1] - 2026-09-22

### Documentation
- `MOBILE_PLAN.md`: the plan for a third module, Mobile App Development, whose exam falls on the same
  day as the other two. It records why a PWA wrapper cannot pass it, why React Native through Expo is
  the choice over Kotlin, Flutter and Capacitor, what the phone reuses from this repository (the
  1,500-line domain core, imports nothing from React or the browser, and the whole server API), which
  storage each kind of data gets on a device and why, and a four-week schedule with rehearsal running
  alongside rather than after.

## [0.24.0] - 2026-09-22

### Added
- **A security page** at `/security`, written for the people using Horizon rather than for a reviewer:
  no password to lose, sessions that can be revoked, data that is only ever your own, encryption in
  transit and storage in the EU, backups nobody else can open, and deletion that really deletes. It
  also says what is checked on every change, what Horizon deliberately doesn't do (no analytics, no
  tracking, no sharing), and is honest that this is one person's project with a written list of risks
  knowingly accepted.
- Reachable from where people actually are: **Settings → This device** now has **Security**,
  **Privacy** and **About** buttons, the landing page links it from the accounts section and the
  footer, and both new pages link to each other.

## [0.23.2] - 2026-09-22

### Changed
- The public contact address is now `alessandroperez.developer@gmail.com`, on the privacy page and —
  newly — in `SECURITY.md`, which asked for private reports without saying where to send them.

## [0.23.1] - 2026-09-22

### Added
- **A privacy page** at `/privacy`, linked from the landing footer and listed in the sitemap. It says
  what Horizon stores and what it doesn't: nothing at all without an account; with one, the Google
  account id, email and name, the synced data, hashed session records and per-sync counts. Where it
  lives (Frankfurt, in the EU), who processes it (Google for sign-in, Vercel, Atlas — nobody else),
  how long each thing is kept and which index enforces that, how to delete it in one click, and how
  to export it. Every claim is checkable in the code.

## [0.23.0] - 2026-09-22

### Added
- **The landing page now describes the app as it is.** It was written before accounts existed and
  still promised "no account" and "no server holding your goals". A new **Accounts** section explains
  what signing in gets you — the same tracks on every device, merged item by item rather than
  last-one-wins; search and history computed by the database; queries scoped to your own account; and
  deletion in one click — while keeping the promise that none of it is required.
- **A questions section** answering what a stranger asks before trying something: whether an account
  is needed, what it costs, where the data is kept (Frankfurt, in the EU, if you sign in), whether it
  works on a phone, how to get the data out, and whether it's finished.
- `app/robots.ts` and `app/sitemap.ts`, so the landing page can be found and the API routes aren't
  crawled.

### Fixed
- **The canonical URL pointed at a hostname with no certificate.** The page told search engines and
  link previews that the authoritative copy lived at `www.horizonroadmap.com`, which doesn't serve.
  Both the canonical and the Open Graph URL now name the apex domain, and `metadataBase` in the root
  layout makes every relative metadata URL resolve there.
- The Google Drive card no longer implies Drive is the only way to sync.

## [0.22.2] - 2026-09-22

### Documentation
- `docs/README.md`: an index of every document — what it is, when to read it, which module it serves —
  plus a table mapping each feature to the code that implements it and the document that explains it.
- `docs/nosql/MODEL.md` now covers the `securityEvents` collection: its shape, its indexes, and why
  counting rejections per hour rather than listing them is the access pattern deciding the shape.
- `docs/nosql/README.md`: the deployed setup described as it actually is, and the new commands.
- `docs/ORAL_PREP.md`: the talk now ends on a live system that notices things (the Level 2 claim),
  with the day-before checklist covering the live site and the scheduled workflows, eight more
  questions answered, and the release-day bugs as the "tell me about a bug in production" story.
- Corrected what had gone stale: the MongoDB image in copy-paste commands (8.0 → 8.3), and three
  places still describing deployment, Atlas credentials and alerting as future work.

## [0.22.1] - 2026-09-22

### Added
- `ops/backup-key.pub`: the public half of the key the scheduled backup encrypts to, so
  `.github/workflows/backup.yml` can run. The private half never leaves the owner's machine, which is
  what makes it safe to keep encrypted backups of real accounts in a GitHub artifact. Verified by
  making one: 25 KB, encrypted to that key.

## [0.22.0] - 2026-09-22

### Added
- **The server now notices things, and says so.** Every rejection it already logged — a sign-in whose
  token doesn't verify, a client past its rate limit, a body that fails validation, a write the
  database refuses — also raises a counter in a new `securityEvents` collection: one document per kind
  per hour, so a flood costs one document an hour rather than one per attempt. The counters hold a
  kind, an hour and a count, and nothing else; a TTL index removes them after 30 days.
- **A daily check** (`npm run ops:check`, and `.github/workflows/ops.yml` each morning) reads those
  counters against thresholds and fails the run when something is out of character — which emails the
  owner. That is the whole alerting chain: no paid log drain, no third-party service.
- **`/api/health`**, asked every 30 minutes by `.github/workflows/uptime.yml`. It answers 200 only when
  the server can reach the database, because the page itself keeps loading from the CDN even when
  nothing works. It answers `{"ok":true}` or `{"ok":false}` and nothing else.
- **A weekly encrypted backup** of the live database (`.github/workflows/backup.yml`), piped straight
  from `mongodump` into gpg and encrypted to the public key in `ops/`. The private half never leaves
  the owner's machine, so GitHub keeps a file it cannot read. Tested end to end: dumped from Atlas,
  encrypted, decrypted, restored.
- Runbook entries for each alert — what it means and the first move — and the one-time setup for the
  `ATLAS_URI` secret and the backup key (`docs/security/RUNBOOK.md` §7–§8).

### Changed
- `@types/node` back to the 24 line, matching the Node that Vercel and CI actually run, with
  `engines.node` recording it. Type definitions ahead of the runtime can let code compile that isn't
  there when it runs.

## [0.21.9] - 2026-09-22

### Changed
- **Dependencies brought current in one pass**, with the whole check suite run against the result:
  Next 16.3.5, React 19.3.0, Mongoose 9.10.1, Dexie 4.4.6, zod 4.6.5, Tailwind 4.3.3, tsx, Lucide,
  the React type definitions, and the local MongoDB image from 8.0 to 8.3 (the database tests pass
  against it).
- **Two major updates deliberately not taken**, and Dependabot told to stop proposing them:
  TypeScript 7 (typescript-eslint refuses to run against it) and ESLint 10 (it removed an API that
  the eslint-plugin-react inside eslint-config-next still calls, so linting fails on the first
  file). Both were tried and reverted; minor and patch updates to each still arrive. The comment in
  `.github/dependabot.yml` says what has to ship upstream before they can be revisited.

### Security
- **CI now runs on pull requests into `development`, not only `main`.** Dependabot aims its pull
  requests at `development`, so until now they arrived with no checks of their own — the green
  marks on them came from the preview deployment, not from the tests. Every proposed dependency
  change is now type-checked, linted, tested against a real replica set, scanned for secrets and
  statically analysed before it can be merged (threat T8).

## [0.21.8] - 2026-09-22

### Changed
- **vitest 4 → 5 and `@types/node` 20 → 26, together.** Dependabot proposed them as two pull
  requests and neither could pass alone: vitest 5 requires `@types/node` 22 or newer, so its own
  update failed to install against the pinned `^20`. Both dependencies are development-only; 288
  unit tests, 47 database tests, lint, types and the production build all pass on the new versions.

## [0.21.7] - 2026-09-22

### Changed
- **The server now runs in Frankfurt, beside the database.** `vercel.json` pins the function region
  to `fra1`; the dashboard setting alone wasn't reaching deployments, which left every request
  executing in Washington — each database round trip crossing the Atlantic, and personal data
  processed outside the EU. The header `x-vercel-id: fra1::fra1::…` confirms it.

## [0.21.6] - 2026-09-22

### Fixed
- **Sync worked once, then failed every time afterwards.** A material old enough to have no
  `updatedAt` of its own made the merge write that field as `undefined`, which the database stores
  as `null` — and the collection's validator requires a number, so it refused the whole track. The
  merge no longer invents a timestamp the data never had, and anything on its way into the database
  now has its undefined fields dropped, since "optional" in the schema means absent. Query filters
  are deliberately untouched: dropping a key there would widen the query instead of narrowing it.
  Covered by a merge test and a database test that writes a timestamp-less material through the
  real validator.

### Security
- When the database refuses a write, the server log now names the rule and the property that failed
  (field names only, never values), instead of just `MongoBulkWriteError` (threats I4, I6).

## [0.21.5] - 2026-09-22

### Documentation
- `MODULES_PLAN.md`: the progress note records the deployment — what is live, what the live checks
  proved, and that Cyber Security Level 2 is now in reach.

## [0.21.4] - 2026-09-22

### Fixed
- **Sync failed for a device holding a track made years ago.** The first sync after signing in
  answered "Malformed request.": the track carried `lastUpdatedDates`, a field the app retired long
  ago, and the sync schema refuses any key it doesn't list. It is now listed among the retired
  fields it accepts, so old tracks sync and keep what they carry. A regression test covers it, and
  both real backups the author holds now validate.

### Security
- A rejected request body now leaves a line in the **server** log saying which rule failed and where
  (the first three path segments, never a value, so free text used as a key can't reach the log).
  The client is still told only "Malformed request." (threats I4, I6).

### Documentation
- `docs/LEARNING_LOG.md` entry 13, "Going live": Atlas, Vercel, the protected `main`, what the live
  checks proved, and the sync failure above with what it teaches.
- `docs/security/RUNBOOK.md` §1: the four required status checks written out exactly as CI reports
  them (the old wording read as five), and the bypass-list step without which the release push to
  `main` is rejected.
- `docs/DEPLOY.md`: the real cluster name, the connection string's two easy mistakes (a doubled
  slash before the database name, and a missing database name), and a pre-flight check that proves
  the string works before it reaches Vercel.

## [0.21.3] - 2026-09-11

### Added
- `docs/ORAL_PREP.md`: preparing the two oral exams. A checklist for the day
  before, the 5-minute security talk part by part, a 10-minute NoSQL demo
  using the real app and scripts, and short answers to the likely questions.
- `docs/DEPLOY.md`: switching accounts and sync on at horizonroadmap.com, step
  by step (the Atlas user and network, Vercel's variables and region, the
  release, and the checks afterwards).

## [0.21.2] - 2026-09-11

### Fixed
- **The top bar now says "Unsynced" as soon as you change something.** It
  used to keep saying "Synced" until the page was reloaded: the save recorded
  that there were changes to sync, but the screen never heard about it. This
  affected Drive and account sync alike.

## [0.21.1] - 2026-09-10

### Security
- **Continuous integration.** Every push now runs, on GitHub: type checks,
  lint, the unit tests, a production build, the database tests on a real
  three-member replica set, a dependency audit that also verifies every
  package's registry signature, a scan of the whole git history for leaked
  secrets, and static analysis for security bugs. The pipeline's own token
  can only read, and every action and scanner is pinned to an exact version
  that can't be swapped underneath it.
- **Dependabot** proposes updates for npm packages, the CI actions and the
  database image.
- A scan of all 149 commits found no leaked secrets; static analysis found
  nothing either.

### Added
- `npm run db:backup`: a compressed backup of the database into `backups/`,
  readable only by you, keeping the latest 14. Restoring one has been
  tested end to end.
- `SECURITY.md`, and in `docs/security/`: every implemented security measure
  with where it lives and how it's verified, and a runbook for incidents
  (revoking sessions, rotating a password, restoring a backup, and more).

## [0.21.0] - 2026-09-10

### Added
- **Delete your account**, in Settings → Account. It removes the account and
  everything it stored on the server (tracks, progress, notes, history and
  sessions, from every device) in one go, after you confirm. The data on this
  device stays, and the app keeps working without an account. Signing in
  again later starts a new, empty account.

### Notes
- The `explain()` measurements in `docs/nosql/explain/` no longer record the
  name of the computer they ran on.

## [0.20.1] - 2026-09-10

### Added
- **A generated dataset** for testing at scale: `npm run db:seed` creates
  2,000 users with a year of realistic activity (572,152 days of progress) in
  a separate database, the same every time.
- **Measured query performance**: `npm run db:explain` runs the app's
  queries against that dataset with and without their indexes and writes
  `docs/nosql/PERFORMANCE.md`. Per-user queries read only that user's data:
  1 to 7 ms, instead of about 200 ms scanning everything.
- **A failover demo**: `npm run demo:failover` stops the database's primary
  server in the middle of a stream of writes. A new primary takes over (in
  0.3 s after a graceful stop, 10.8 s after a crash) and not one
  acknowledged write is lost.
- **`docs/nosql/`**: the data model with its diagram, the design decisions,
  the dataset, the measurements, and how replication keeps the data safe.

### Notes
- New development dependency: `tsx`, to run the TypeScript scripts.
- The generated data lives in its own `horizon_perf` database, with its own
  user, so it never mixes with development data.

## [0.20.0] - 2026-09-10

### Added
- **Search & insights**, in the menu when you're signed in.
  - **Search** across every track, material, phase, roadmap and note your
    account has synced, from every device. Results show which materials and
    phases matched, and the passage of a note that did. "Books" finds "Book":
    words are matched by their stem, and a hit in a title ranks above one
    buried in a roadmap. Click a track to open it.
  - **Your history**: active days, total accomplishments, your longest streak
    and when it ran, how often each weekday is active, active days per month,
    and the same per track. Every chart has a table view.
- Both run in MongoDB on the server (a full-text index, and aggregation
  pipelines), over what has been synced; `docs/LEARNING_LOG.md` explains how.

### Security
- Search and history only ever read the signed-in account's data, including
  where the history joins in track names. They're rate-limited per account
  (120 requests a minute), and a search is 1 to 100 characters.

## [0.19.1] - 2026-09-10

### Security
- **Rate limits** on signing in (10 attempts a minute per address), checking
  the session (60) and syncing (30 a minute per account). Past the limit, the
  server answers "Too many requests" with the seconds to wait. The counters
  hold a hash of the address rather than the address, and disappear within
  minutes.
- `/api/git` no longer reveals whether a path exists outside `~/Documents`:
  every forbidden path now gets the same answer, and the answer no longer
  names your home folder. It and `/api/notes` return generic errors instead
  of internal messages.
- `/api/open` refuses a link that isn't plain text, is absurdly long, or
  starts with `-` (which `xdg-open` would read as an option).
- Restoring a backup checks that every note is text under a proper id.

## [0.19.0] - 2026-09-10

### Added
- **Sync through your Horizon account.** Signed in (Settings → Account), the
  sync button at the top sends this device's tracks, progress and notes to
  your account, and brings back whatever your other devices added. Signing in
  runs the first sync straight away. Signed out, sync goes through Google Drive
  exactly as before; a device never uses both at once.
  - The server merges, not the device: two devices ticking different boxes on
    the same day both keep their ticks, even if they sync at the same moment.
  - A new device with nothing of its own yet takes the account's data,
    instead of adding a stray "My Track" to it (the same rule as Drive).
  - Your data stays on the device too, and the app works offline as before.
    An edit made while a sync is in flight is kept and goes up next time.
  - Notes, including each track's Notepad and To-do List, sync one by one:
    the newest copy of each note wins.
- In the database, tracks keep their settings in one document each, and each
  day of progress gets a small document of its own. `docs/LEARNING_LOG.md`
  explains why.

### Security
- Every sync reads and writes only the signed-in account's data. The account
  comes from the session cookie, never from the request.
- Every sync request is checked against a strict schema, down to the last
  field, and refused if anything is unexpected, malformed or oversized (2 MB).
  MongoDB checks every stored document against a schema of its own as well.
- Timestamps from the future are pulled back to the present, so a device with
  a wrong clock can't win every merge.
- Each sync that changes something is recorded in an audit log, kept for 90
  days.

## [0.18.1] - 2026-09-10

### Security
- **Next.js 16.3.4** (from 16.2.7), and `npm audit fix` for the rest:
  `npm audit` now reports 0 known vulnerabilities, down from 10 (one
  critical). Neither of the serious Next.js advisories could be exploited in
  Horizon, which uses no middleware or proxy and no Server Actions, but they're
  closed before anything is built on top.

### Added
- `docs/LEARNING_LOG.md`: what each step of the database and security work
  built, why, and the ideas behind it, with ways to see it working and the
  exam questions it answers.

### Notes
- Next 16.3.4's lint rules flag two `window.location.assign()` calls. Both
  full page loads are deliberate (one makes sure pending edits are saved, the
  other restarts the app after "Delete local data"), so the warnings are
  suppressed with the reason next to each.
- The test configs are now `vitest.config.mts` and `vitest.db.config.mts`, as
  the updated Vite expects.

## [0.18.0] - 2026-09-10

### Added
- **Sign in with Google**, in Settings → Account. This is the first half of
  accounts: signing in creates your Horizon account on the server. Syncing
  your tracks through it comes next; until then Cloud sync (Drive) works
  exactly as before.
  - The server doesn't take the browser's word for who you are. It checks
    Google's signature on the ID token against Google's published keys, that
    the token was issued to Horizon and not some other app, that it hasn't
    expired, and that Google has verified the email.
  - Signing in starts a server-side session. The browser gets a random 256-bit
    token in a cookie that page scripts can't read, sent only over HTTPS and
    never with other sites' requests. The database stores only the token's
    hash. Signing out deletes the session on the server, so a copied cookie
    stops working. Sessions last 30 days.
  - Shown only where the deployment sets a Google client ID, so nothing
    changes on horizonroadmap.com until accounts are switched on there.
- `npm run test:db`: tests that run against the local MongoDB, as their own
  user on their own database. Sign-in and sessions are covered end to end.

### Security
- The Content-Security-Policy no longer lets the page load images from other
  sites. The app never did, and an open rule would have let injected script
  send data out inside an image URL.
- The account API refuses requests from other sites' pages, anything that
  isn't JSON, oversized bodies and unexpected fields. Its errors are generic,
  and its logs never contain tokens.
- MongoDB queries made through Mongoose neutralise operator injection: a
  `{"$ne": null}` smuggled in where a plain value belongs is refused rather
  than run.
- "Delete local data" also signs this browser out.

### Notes
- New dependencies: `mongoose`, `jose` (checks Google's tokens; no
  dependencies of its own) and `zod` (validates request bodies).
- `npm audit` reports advisories for Next.js 16.2.7 that predate this release.
  Neither applies to Horizon, which has no middleware or proxy and no Server
  Actions, but the upgrade to 16.3.4 is next.

## [0.17.1] - 2026-09-10

### Added
- **A local MongoDB for development**, groundwork for accounts and server
  sync. `npm run db:up` starts a three-member replica set in Docker
  (`compose.yaml`). Access control is on: the members share a generated key
  file, and there are two users, `root` and `horizon_app`. `horizon_app` can
  read and write the `horizon` database and nothing else. Passwords are
  generated per machine into git-ignored files, the app is only ever given
  `horizon_app`'s, and the database listens on `127.0.0.1` only. Stopping one
  member shows failover: the other two elect a new primary within seconds.
  Nothing in the app uses the database yet. Setup is in the README.
- **A threat model**, `docs/security/THREAT_MODEL.md`. It covers the system as
  it will be once sign-in with Google and MongoDB sync exist: a data-flow
  diagram with its trust boundaries, 41 threats rated by likelihood and impact
  and tracked to a fix or an accepted risk, and the same threats by network
  layer and by security goal.

### Notes
- The university modules plan moved from `temp/` to the repo root as
  `MODULES_PLAN.md`.

## [0.17.0] - 2026-09-10

### Added
- **A Notepad panel.** One plain text box per track for getting something down
  before it has a proper home. It saves as you type.
- **A To-do List panel.** One per track: add, tick, delete, and "Clear done" —
  nothing more.
- Both open by default on every track; close either from the Modules menu. They
  live with the material notes rather than in the track record, so typing in
  them never bumps the track's config. Each syncs to Drive as its own
  `note_notepad_<trackId>.md` / `note_todo_<trackId>.md` (newest edit wins),
  comes along in every backup, and shows up in the .zip export under
  `notepads/` and `todos/`, named after the track. The to-do list is stored as
  a markdown checklist, so those files stay readable.

### Notes
- An open panel re-reads its note after every Drive sync or restore, so it
  can't save a stale copy over something newer from another device — unless
  you're mid-edit, in which case your edit is the newest and wins.

## [0.16.0] - 2026-09-10

### Removed
- **The setup wizard**, and the `/onboarding` route with it. A first visit now
  opens straight onto the dashboard with a blank track — "My Track", four
  placeholder phases and a weekly rhythm, all editable. **New Track** adds
  another blank one, makes it active and opens its Track settings, which is
  where it gets its name, colour, start date and length.
- **AI roadmap generation** (0.14.0–0.14.3). It was only reachable through the
  wizard. The AI settings are gone, any provider key saved in this browser is
  deleted the first time the app loads, and the CSP no longer allows
  connections to Gemini or OpenRouter.

### Changed
- **Restoring from Drive on a new device still works without the wizard's "I
  already have an account" step.** The starter track counts as disposable until
  you change something: connect Drive before your first edit and the first sync
  replaces it with your real tracks, instead of merging a stray "My Track" into
  them. From your first edit on, syncing merges as usual, so nothing you wrote
  is ever overwritten.

### Notes
- The landing page no longer describes the wizard or pickable templates.
- The Learning, Fitness and Work templates are still in `lib/templates`, but
  nothing uses them now; the blank track comes from Custom.

## [0.15.0] - 2026-09-10

### Added
- **Archive a material instead of deleting it.** Finishing a book used to leave
  two options: let it clutter the list, or delete it and lose its progress and
  notes with it. Every material now has an **Archive** button. Archived
  materials move to a collapsed **Archived** group at the bottom of the panel,
  where their notes stay readable, and **Unarchive** puts them back exactly as
  they were. It's an ordinary per-item edit, so it syncs between devices like
  any other change.

### Notes
- Archived materials still count in the Materials figure of the progress
  stats — a finished book is still finished work. They no longer fetch repo
  stats, which saves GitHub API budget.

## [0.14.4] - 2026-09-10

### Security
- **Other websites can no longer reach the local-only routes.** `/api/open`,
  `/api/git` and `/api/notes` only checked the `Host` header. That stops other
  devices on the LAN and DNS rebinding, but not a page on any website you have
  open: the browser sends `Host: localhost` for it. A no-cors `POST` with a
  `text/plain` body skips the CORS preflight, and `/api/open` parsed it as JSON
  anyway — so while the dev server was running, any site you visited could make
  your machine `xdg-open` a URL or file of its choosing. Confirmed from a real
  browser, from a page on another origin. The guard now also refuses requests
  whose `Origin` isn't this exact origin or whose `Sec-Fetch-Site` says they came
  from another site, and `/api/open` only accepts `application/json`, which other
  sites can't send without a preflight that Next's automatic `OPTIONS` never
  approves.

### Fixed
- **`[::1]` was never recognised as localhost.** The guard split the `Host`
  header on `:`, so an IPv6 loopback request read as `[` and was refused. The
  header is parsed as a URL now.

### Notes
- Still open, and documented in `lib/server/localRequest.ts`: with
  `npm run dev:lan`, someone on the LAN with a raw HTTP client can forge every
  header. Only a firewall closes that.

## [0.14.3] - 2026-07-27

### Added
- **A Content-Security-Policy, with a strict `connect-src` allowlist.** Horizon
  asks you to paste an API key for your own AI provider, and "we don't send your
  key anywhere" is worth nothing as a promise — whoever ships the app controls
  the code your browser runs. A CSP is different: the *browser* enforces it, the
  header is visible in devtools in seconds, and no script on the page — ours, a
  dependency's, or one injected through a hole nobody has found yet — can open a
  connection to an origin that isn't on the list. The list is exactly the five
  the app already talks to: Gemini, OpenRouter, Google APIs, Google accounts,
  and the GitHub API. Also sets `Referrer-Policy`, `X-Content-Type-Options`,
  `X-Frame-Options`, `frame-ancestors 'none'` and `object-src 'none'`.
- Settings now says the policy exists and invites you to verify it rather than
  trust it, and suggests restricting the key and setting a spend limit at the
  provider — protection that is yours and can't be taken away by us.

## [0.14.2] - 2026-07-27

### Added
- **Materials have an author.** Shown under the title in smaller, muted text,
  editable everywhere a material is, and generated by AI alongside the title.
  Optional — plenty of references have no author worth recording, and existing
  materials simply don't have one.
- **A "find" search on materials without a link.** Built from the material's own
  title and author rather than generated, so it always resolves — and when a
  title was fabricated, the search visibly finds nothing, which is how you catch
  it.

### Notes
- **AI still never generates URLs**, deliberately. A model asked for a link
  produces one that looks right and resolves to nothing, or to something
  unrelated — and unlike a wrong title, a wrong link is clickable, so you find
  out by going there. Authors are different: a misattribution is visible at a
  glance and costs nothing to correct, so those are generated (with the prompt
  telling the model to omit the author rather than guess at it).

## [0.14.1] - 2026-07-27

### Added
- **"Try again" on AI errors that can actually succeed.** Every generation error
  already knew whether retrying was worth it; nothing used that. A rate limit or
  a truncated response now offers a retry that re-runs the same request. A
  rejected key does not — it would fail identically however many times you ask.

### Changed
- **Material categories are no longer locked to a graphics curriculum.** The
  list was `Mathematics / Computer Graphics / Programming Languages / DSA /
  Other`, which was right when Horizon held one personal track and wrong the
  moment a track could be about anything — a couch-to-5k plan filed every book
  under "Other". Added general categories (Fundamentals, Technique, Practice,
  Reference, Health & Fitness, Language, Business) and types (Podcast, Paper),
  kept every original so existing materials keep their grouping, and surfaced
  any category already in use so a value typed earlier never vanishes from the
  dropdown. The materials UI and AI generation now share one source of truth,
  so they cannot drift apart.

### Fixed
- **The roadmap step asked permission to overwrite text you never wrote.**
  Leaving the Phases step auto-fills the box with a generated outline, and
  "Draft this for me" then treated that as your own work and asked before
  replacing it.

## [0.14.0] - 2026-07-27

### Added
- **AI roadmap drafting, bring-your-own-key.** Describe a goal on the wizard's
  first step — *"Learn Vulkan, C++ memory management, and graphics rendering in
  3 months"* — and get a complete starting roadmap: phases, tasks, deliverables
  and a weekly rhythm, all editable before anything is saved. Also adds a
  "Draft this for me" button on the Roadmap step for the markdown document.
  - **Horizon operates no AI backend and never will.** There is no subscription,
    no key held by us, no inference bill, and no abuse surface. Requests go from
    your browser straight to the provider you configure. Gemini (free tier, no
    card) and OpenRouter are supported; the key lives in `localStorage` and is
    deliberately kept out of the workspace, so it is never written to
    `database.json`, never synced to Drive, and never included in a backup.
  - **Generation only ever creates a new track**, through the existing wizard
    and the existing `seedTrackFromTemplate` → `createTrack` path. It cannot
    modify or overwrite an existing track — a bad overwrite would propagate to
    every device through Drive sync.
  - **Every request is capped and timed out.** Model screening found ~23% of
    small-model generations never emit a stop token at all, two of them running
    to 40k and 81k tokens. On your own key that is your money, so a truncated
    response is treated as a failure with a retry rather than parsed, and
    cancelling actually aborts the request instead of hiding a spinner.
  - **Nothing the model returns is trusted.** A validator assigns all ids,
    reschedules phase deadlines that don't fit the horizon, drops phases with no
    tasks, replaces invalid colours, and strips unknown keys — then tells you
    what it adjusted rather than silently shipping a mangled plan.

### Notes
- **On-device generation was evaluated and deliberately cut.** Running Qwen2.5
  at 1.5B/3B/7B against the real schema, the small models that could plausibly
  ship in a browser produced roadmaps worth keeping in roughly 0% and 35% of
  cases respectively, against a 7B control at ~78%. That means no offline or
  fully-private generation path in this release; the goal text does leave your
  device. Reasoning and evidence are recorded in the branch's planning notes.

## [0.13.6] - 2026-07-26

### Fixed
- **Repo stats exhausted GitHub's rate limit and then hammered it.** Each repo
  costs two requests (metadata + last commit) against an unauthenticated budget
  of 60/hour per IP, so four linked repos burn eight per pass — and passes were
  firing far more often than the repo list changed. Four causes, all addressed:
  - **`MaterialsTracker` / `PortfolioTracker` keyed their fetch effect on the
    `materials` / `portfolio` arrays.** Those get a new identity on every
    unrelated workspace edit — a ticked checkbox, a sync, the daily reset — so
    the stats re-fetched constantly. They now key on `serializeGitSources()`, a
    string of the id→source pairs, which only changes when a repo is actually
    added, removed, or re-pointed. (Strict Mode's double-invoked effects in dev
    were doubling all of it.)
  - **A `403` was never recorded**, so every subsequent render retried and
    failed again, flooding the console. `lib/gitStats.ts` now parks all
    requests until GitHub's own `x-ratelimit-reset` time — persisted, so a
    reload during the lockout doesn't start a fresh round of doomed requests —
    and logs once, with the fix, instead of once per repo per render.
  - **No in-flight deduplication.** Materials and Portfolio routinely link the
    same repo and mount together, so each opened its own round trip for
    identical data. One shared promise per repo now.
  - **The cache TTL was 15 minutes**, which is far shorter than a last-commit
    message stays interesting. Raised to 1 hour. `404`s are cached too — a
    typo'd URL was re-asking forever.

### Changed
- **`README.md`** — the Git Stats section documented the old 15-minute TTL and
  said nothing about the `github_token` escape hatch, which only existed in a
  code comment. Both fixed; the token raises the ceiling to 5000/hour.

Covered by `lib/__tests__/gitStats.test.ts`, and verified in a browser: three
workspace updates with the cache wiped between each made zero requests, while
adding a new repo fetched immediately.

## [0.13.5] - 2026-07-26

### Removed
- **`public/feature_graphic.jpg`** — the Play Store feature graphic added in
  `5a973e0`. Nothing referenced it (it was never in the manifest or any icon
  set), so it was shipping to every visitor as dead weight in `public/`. Still
  in the history if a store listing needs it again.

## [0.13.4] - 2026-07-26

### Fixed
- **Dragging the Materials panel slid the notes drawer into view.** The drawer
  is `position: fixed` and stays mounted whether open or not — "closed" is
  `translateX(100%)`, parked one drawer-width off the right edge, which is what
  makes the slide animate. But it was rendered *inside* the Materials panel, and
  a transformed ancestor becomes the containing block for its fixed
  descendants. dnd-kit puts a transform on a panel for the whole duration of a
  drag, so mid-drag that 100% stopped meaning "off the viewport" and started
  meaning "one panel-width across" — comfortably on screen. Nothing had opened;
  the closed drawer had simply been re-anchored.
- **`components/Portal.tsx`** (new) — renders into `<body>`, so a fixed overlay
  inside a panel can't be captured by an ancestor transform. Used by the notes
  drawer and by the streak's day-detail modal, which sits in a draggable panel
  with the same exposure. The hazard was already known here — `globals.css`
  warns about it for the panel entrance animation — but the drag transform is a
  second source of it, so this makes it structurally impossible rather than
  something each overlay has to remember.

## [0.13.3] - 2026-07-26

### Fixed
- **Panels squashed and stretched while being dragged.** `SortablePanel` styled
  the drag node with `CSS.Transform.toString(transform)`, which emits dnd-kit's
  `scaleX`/`scaleY` alongside the translation — factors it derives from the
  ratio between the dragged item and whatever it's currently over. For a list
  of same-sized rows that's invisible; for dashboard panels, where a Focus Timer
  can be a fifth the height of a Roadmap Timeline, it visibly distorted the
  panel's text mid-drag and snapped back on release (the transform is dropped
  once the panel lands, which is why only the moving panel ever looked wrong).
  Now `CSS.Translate.toString(transform)` — position without the scaling.

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
