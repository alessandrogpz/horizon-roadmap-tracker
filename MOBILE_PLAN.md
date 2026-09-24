# Plan: Mobile App Development, on Horizon

> **Written 2026-09-22 against v0.24.0.** The exam is on the same day as SE_06 NoSQL and Cyber
> Security — **the first week of November 2026**, confirmed on 2026-09-23, so about six weeks out —
> and those two are already ready. So this plan is scoped to what can be built *and rehearsed* in
> that time, not to everything that would be nice.
>
> **Target: Level 1 in full, with the Level 2 items that come cheaply.** Level 3 needs a second
> framework and is not reachable here; saying so plainly is better than pretending.

---

## 1. What the module asks, and where it is answered

| Criterion (Level 1) | Where it is met |
|---|---|
| Basic knowledge of one mobile framework, demonstrated on a project | React Native via Expo, the whole of `mobile/` |
| Reflect on the software architecture and the framework chosen | §3 below, and the fact that the domain core is shared with the web app unchanged |
| Create an application with the framework | The app itself, released to Play's internal testing track |
| Non-trivial user interfaces connected to functionality | Today's plan with tickable items, the track switcher, the streak grid, materials |
| Understand and interact with the application and view lifecycle | §5: what happens when Android kills the process, `AppState`, re-reading on resume |
| Access sensors, and the concerns that come with it | The pedometer: permission, refusal, battery, data that arrives late |
| Restore state when restarted | §5: the app reopens where it was, with the data it had |

| Criterion (Level 2) | Where it is met |
|---|---|
| Awareness of all data storage options and their trade-offs | §4: SQLite, key-value, files, secure storage, the server copy — and why each is used where it is |
| Experience with the rollout process and its implications for client-server apps | §6: internal testing, versioning, and old clients syncing to a server that has moved on — which already happened on the web (learning log 13) |
| Mechanisms for inter-app communication | A share target: share a link from a browser into a track's materials |
| The permission system and its implications | The pedometer permission, asked at the right moment, refused gracefully |

---

## 2. Why a wrapper is not enough

The cheap path — Bubblewrap or PWABuilder turning the existing PWA into a Trusted Web Activity — puts
Horizon on Play in a day. It is worth doing eventually as a product. It cannot pass this module: there
is no framework, no view lifecycle, no sensor access, and the state restoration is the browser's, not
the author's. Against the Level 1 list it scores nothing but "an application exists".

It is still worth *knowing* this, and saying it in the exam: the decision to write a real app rather
than wrap the website is the first framework decision the project makes.

---

## 3. The framework decision

**Chosen: React Native, through Expo.**

| Option | Why not chosen |
|---|---|
| **Native Android (Kotlin)** | The best platform fit and the clearest lifecycle story, but nothing is shared with the existing project and iOS would need writing twice over. With four weeks and two other exams, the rewrite cost is the deciding factor, not the quality. |
| **Flutter** | A genuinely good cross-platform choice, and a strong performance story. But Dart means the domain logic — the merge engine, the streak rules, the migrations — is rewritten and then maintained in two languages, where the two copies can disagree. That is precisely the risk this project has spent weeks removing. |
| **Capacitor** | Wraps the existing web app in a native shell with access to native APIs, so it would satisfy the sensor criterion. But the UI is still a web view: the lifecycle and the rendering belong to the browser, which leaves the module's central questions unanswered. |
| **TWA / PWABuilder** | §2. |

**Why Expo wins here**, and this is the reflection the module asks for: Horizon's `lib/` folder imports
nothing from React and nothing from the browser — 1,500 lines of types, date handling, completion
rules, streak calculation, selectors, the merge engine and the schema migrations. In React Native,
that is reused **as it is**, tests included. What gets rewritten is the layer that was always going to
be platform-specific: the views, and the storage underneath them.

That is not luck. The web app was built in layers on purpose (`lib/` knows nothing about React,
`components/` holds no business logic), and this is the first time that decision is cashed in. It is
also the answer to "reflect on the software architecture": the architecture is what makes a second
platform a three-week job instead of a rewrite.

The cost, stated honestly: React Native's bridge to native code is slower than Flutter's rendering,
Expo's managed workflow hides some native configuration until you need to eject, and a JavaScript
runtime on a phone uses more memory than Kotlin would.

---

## 4. Architecture

```
ProductivityApp/
├── lib/                     ← shared, unchanged: types, dates, completions, streak,
│                              selectors, merge, trackActions, migrations
├── app/, components/        ← the web app (untouched by this plan)
└── mobile/                  ← the Expo app
    ├── app/                 ← screens (expo-router)
    ├── src/storage/         ← SQLite, and the settings adapter
    ├── src/sync/            ← talks to the same server API
    └── src/steps/           ← the pedometer
```

**What is reused:** the whole domain core, and the server. `/api/auth/session`, `/api/sync`,
`/api/search`, `/api/stats` and `/api/account` are unchanged — the phone is simply another device
syncing through the account, and the server-side merge already handles two devices editing the same
day.

**One server-side detail:** the server accepts ID tokens for exactly one client ID
(`lib/server/auth/googleIdToken.ts`). A native Google sign-in issues tokens for its own Android/iOS
client ID. Either the app requests the web client ID as its `serverClientId`, or the server accepts a
list of audiences. The first is simpler and changes no server code; the decision is recorded here
because it is a good exam question.

**Storage on the device** — the Level 2 "all options" answer, with what each is for:

| Option | Used for | Why |
|---|---|---|
| **SQLite** (`expo-sqlite`) | Tracks, days, notes | Structured, queryable, survives restarts, handles a year of data without loading it all. The phone's equivalent of IndexedDB on the web. |
| **Key-value** (`AsyncStorage`) | Device preferences: theme, when the day starts | Small, synchronous-feeling, no schema. What `lib/settings.ts` uses `localStorage` for on the web. |
| **Secure storage** (`expo-secure-store`) | The session token | Backed by the Keychain and the Android Keystore, so another app or a rooted-device dump cannot read it. The web's HttpOnly cookie has no direct equivalent on a phone, and this is the closest thing. |
| **Files** (`expo-file-system`) | Backups, in and out | A .json written into a folder the user picks, and read back from a file the user picks. Android gives an app no access to the user's storage at all — only to a location handed over through the Storage Access Framework, one item at a time. That is why there is no storage permission prompt: there is no storage permission involved. |
| **The server** | The synced copy | Already built. |

---

## 5. Lifecycle and state restoration

Android kills the process whenever it wants. This is the biggest difference from the web and the
module asks about it directly, so the app is built to survive it rather than to hope:

- Every edit is written to SQLite as it happens, not on a timer and not on close.
- The screen the user was on, and the track they had open, are saved and restored.
- `AppState` transitions re-read what might have changed while the app was away, including the day
  rolling over past midnight and new steps arriving.
- Coming back online triggers a sync, and the merge on the server resolves whatever happened
  meanwhile — the same logic the web app uses.

---

## 6. Rollout

Play Console's **internal testing** track, which is minutes rather than the days a production review
takes, and enough to demonstrate the process. Builds come from Expo's cloud service, so no Android
Studio and no Mac are needed.

The client-server implication is one this project has already lived: a phone that has not been opened
for a month syncs to a server that has moved on. The strict schema and the legacy field that broke
sync on release day (learning log 13) are exactly that story, told from the other side.

**iOS:** the same codebase builds for it, but the Apple Developer Program is $99 a year and review is
slower. Decide separately; the module needs one platform done properly, not two done thinly.

---

## 6b. Staying on SDK 57, on purpose

Expo Go warns that its next release will only support SDK 58. That warning does not apply here: Expo
Go is one shared app that can hold one SDK at a time, and this project stopped using it the moment it
needed a permission and a native module Expo Go doesn't carry. A development build is this app,
compiled against the SDK it was written for.

Upgrading an SDK moves React Native, the build toolchain and every native module together. Four weeks
before three exams, with the sensor working and sign-in working, there is nothing to gain and a
working build to lose. Play accepts SDK 57 builds; nothing is blocked.

The rule worth stating in the exam: upgrade when something you need is on the other side, or when the
version you are on stops receiving security fixes — not because a newer number exists. The one thing
to watch is Google Play's own minimum `targetSdkVersion`, which is a deadline set by the platform
rather than by a framework, and is a genuine reason to upgrade whether or not it is convenient.

---

## 7. Scope

**In**, because Level 1 asks for non-trivial UI connected to real functionality:
- Sign in with Google, and sync with the account
- The track switcher, and today's plan with tickable tasks and revisions
- The consistency streak
- Phases, read-only
- Materials, with progress
- The pedometer filling in a fitness track's day
- State restoration, permissions, a share target

**Out**, deliberately, and it is worth being able to say why: the markdown roadmap editor, git
statistics, the insights charts, drag-and-drop panel layout, and Drive sync. Each is either
desktop-shaped work, or a second implementation of something the web already does well.

---

## 8. Schedule

Four and a half weeks, with two other exams to rehearse for. Rehearsal happens alongside, not after.

The exam is in the **first week of November**. Weeks 1 and 2 of this plan were both done on
2026-09-22–23, which buys back a fortnight; the rest of the time goes to rehearsal, not to more
features.

| Week (from) | Mobile | Also |
|---|---|---|
| ~~1–2~~ (09-22) | **Done:** Expo app, shared core, SQLite, today's plan, sign-in, sync, the pedometer, permissions, share sheet and deep links | — |
| 3 (09-29) | Play internal-testing release once identity verification clears; the standalone preview build on the phone | First full rehearsal of the security talk |
| 4 (10-06) | Polish what the rehearsals expose; optional: today's checklist in the share text, Health Connect | Rehearse NoSQL and mobile |
| 5 (10-13) | Hand-in admin: repo access, the Learning Platform forms | Rehearse all three (`docs/exams/`) |
| 6 (10-20) | Buffer | Rehearse |
| 7 (10-27) | Buffer, and the day-before checklist | Rehearse |

If a week slips, the share target goes first, then materials. The sensor and state restoration never
go: they are Level 1 criteria.

---

## 9. What the author needs to do

- A Google Play Console account ($25, once) before week 4.
- An Android phone to test on — the pedometer needs real hardware; an emulator cannot walk.
- Decide whether iOS is worth $99 this term.


---

## 9. Where it ended up

The plan above was written before any of it existed. What shipped differs in
four ways worth recording, because each was a decision rather than a drift:

- **The phone is not a smaller website; it is the same app with a different
  shape.** Four tabs — My Space, Today, Plan, Progress — with My Space as the
  home: the whole track as a column of panels you arrange yourself. The
  website's two-column dashboard and the phone's single column are the same
  model (`lib/modules.ts`, `hiddenPanels`), and only the *order* is per-device,
  because one column and two columns are not the same question.

- **Reading is the default; editing is a decision.** Every screen that can
  change a plan opens read-only behind a pencil. A touch screen has no hover,
  so an editable field and a label look identical until one of them moves.

- **Destructive actions get either an undo or a confirmation, never both.** A
  swipe is a flick, so it gets an undo; a considered tap on something that
  carries a lot — deleting a track — gets a question. Asking *and* offering to
  take it back is two decisions for one intent.

- **New data goes in a note, not a new field.** The gym log is JSON in
  `gym-<trackId>`. The server validates the workspace against a strict schema
  that refuses unknown fields (learning log 13), so a field would have meant a
  migration and a deploy before a single set could be logged. Notes already
  sync, already merge per note, and hold half a megabyte each.
