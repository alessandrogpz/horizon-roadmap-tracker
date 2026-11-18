# Features

What the app does, feature by feature. For how it is built, see
[ARCHITECTURE.md](ARCHITECTURE.md); for the phone app specifically, [MOBILE.md](MOBILE.md).

- **Weekly overview** — what each day of a track is for, and what that day
  actually holds: the rotation topics due this week, the day's checklist, the
  gym plan for that kind of day.
- **Phases** — a vertical timeline of a track's phases, their deadlines, and
  what each one asks for.
- **Consistency** — a year of days as a contributions-style grid, in the track's
  colour. Rest days carry a dot rather than reading as a gap, and bridge a
  streak instead of breaking it. The week is dated, so changing it does not
  rewrite past days.
- **A colour per track** — chosen at creation, then worn by the whole app while
  that track is open. The track order follows the account, not the device.
- **Deliverables** — repository checklists with live git statistics, from local
  repositories or GitHub.
- **Gym plan** — the exercises a training day asks for, with sets and reps.
  Which days it applies to comes from the track's weekly rhythm.
- **Materials & notes** — references, a Markdown editor with live preview, and
  repository statistics.
- **Search & insights** *(signed in)* — full-text search across tracks,
  materials, phases, roadmaps and notes, plus history by weekday, week, month
  and track. Both computed by MongoDB.
- **All tracks** *(read-only)* — one board built from every track at once.
  Progress is weighted by goal length, so a three-year track is not outvoted
  by a three-week one.
- **Demo data** — three seeded tracks with a year of ticks, so the multi-track
  views have content on a new account. The same button removes them.
