# Mobile Development Framework Analysis

> Hand-in for **SE_47 Mobile App Development**. Follows the official
> *Framework Analysis Template*, section for section. Target level: **2**.
>
> Everything below describes Horizon's phone app as it actually stands. Where a
> claim is a measurement, the number is the measured one.

## General Information

**Student Name:** Alessandro Perez
**Semester:** Fall Semester 2026
**Framework:** React Native 0.88.1 via Expo SDK 58 (expo-router, TypeScript)

---

# Level 1

## Project Goal

Horizon is a local-first tracker for long-horizon goals: you define a *track* —
one goal with a start date, a deadline, the phases in between and a weekly
rhythm — and the app tells you where you are against it rather than what is
left on a list. The phone app is one of two clients over a shared TypeScript
core, the other being a Next.js web app, so the same domain rules run on both.

## Software Architecture

Three parts. A **shared core** (`lib/`, 46 modules, ~6,200 lines of
framework-free TypeScript) holds every domain rule: dates and phase maths,
streaks and rest days, the weekly rhythm, the merge algorithm, colour
derivation. It imports nothing from React, React Native or Next. The **phone
app** (`mobile/`, 82 files, ~16,200 lines) is Expo Router over React Native: a
four-tab layout (My Space, Today, Plan, Progress) plus about eighteen stack
screens, with React context providers for the workspace, sync, the timer, the
theme and undo. The **web app** is Next.js and consumes the identical core. The
core is imported as `@shared/*` on the phone and `@/lib/*` on the web — 133
import sites on the phone side — which is what stops the two clients drifting
into disagreeing about what a streak is.

```
                  ┌────────────────────────┐
                  │  lib/  (shared core)   │   dates · phases · streaks
                  │  framework-free TS     │   rhythm · merge · colours
                  └───────────┬────────────┘
                 @shared/*    │    @/lib/*
            ┌─────────────────┴──────────────────┐
            ▼                                    ▼
   ┌──────────────────┐                 ┌──────────────────┐
   │  mobile/ (Expo)  │                 │  Next.js web app │
   │  expo-router     │                 │  App Router      │
   │  SQLite + AS +   │                 │  IndexedDB       │
   │  SecureStore     │                 │  (Dexie)         │
   └────────┬─────────┘                 └─────────┬────────┘
            └───────────── sync ────────┬─────────┘
                                        ▼
                            ┌───────────────────────┐
                            │  Next API + MongoDB   │
                            └───────────────────────┘
```

## Framework Choice

The web app existed first, so the question was not "which framework is best"
but "which one lets the domain logic stay in one place". React Native with
TypeScript was the only option where the existing core could be imported
unchanged — logic travels across the platform boundary, styling does not, and
that split is exactly where React Native sits. Native Kotlin would have meant
reimplementing phase maths, streak rules and the merge algorithm in a second
language, giving two sources of truth for rules that must agree or sync
produces nonsense. Flutter has the same problem for a different reason: Dart
cannot consume a TypeScript core either. I chose Expo over bare React Native
because it supplies audited native modules for everything this app needs —
SQLite, sensors, secure storage, over-the-air updates — and EAS builds the
binaries without me maintaining Android and iOS toolchains locally. The cost I
accepted knowingly: I am tied to Expo's release cadence for native upgrades,
and React Native's performance ceiling is lower than a native app's — neither
of which binds a goal tracker whose hottest operation is rendering a year of
small squares.

## Lifecycle Management

**Application lifecycle.** React Native exposes three states through
`AppState`. `active` — the app is in the foreground and receiving events.
`background` — it is off-screen; timers still fire for a while, sensors stop
delivering, and the OS may kill the process without further notice.
`inactive` — a brief transitional state on iOS (an incoming call, the app
switcher) where the app is visible but not receiving input.

**View lifecycle.** A screen is an ordinary React component: it mounts, renders
on state change, and unmounts. Expo Router adds *focus* on top of that — a
screen can stay mounted in the navigation stack while not being the one you are
looking at, so "mounted" and "visible" are different questions.

**The mechanism.** `AppState.addEventListener("change", handler)` returns a
subscription whose `remove()` must be called on cleanup. For views, `useEffect`
with a cleanup function covers mount and unmount; `useFocusEffect` covers focus
when mounted-but-hidden matters.

**How I use it.** Four places, each solving a problem the lifecycle creates.
The clearest is `src/timer/TimerProvider.tsx`: the focus timer stores an
absolute `endsAt` timestamp instead of decrementing a counter, and on the
transition back to `active` it calls `recompute()`, which re-derives the
remaining time from the clock. That is the whole reason the timer is correct
after you put the phone in your pocket — a countdown driven by `setInterval`
would simply have stopped, and come back wrong by exactly the time you were
away. `src/workspace/WorkspaceProvider.tsx` listens for the same transition to
flush any debounced write before the process can be killed, so an edit made a
second before you switch apps is not lost. `src/sync/SyncProvider.tsx` syncs on
return to the foreground, which is the moment the data is most likely stale.
And `src/steps/usePedometer.ts` removes its sensor subscription on unmount —
without that cleanup the step counter keeps the sensor awake and drains the
battery after you have left the screen.

## Sensors

The app reads the **step counter** through `expo-sensors`' `Pedometer`, on the
Steps screen (`src/app/steps.tsx`, logic in `src/steps/usePedometer.ts`). It is
the one thing the phone app can do that the website cannot, which is also the
honest argument for the app existing at all.

The platform shapes the whole implementation. Android has no way to ask "how
many steps today?" — `getStepCountAsync` is iOS-only. Android offers
`watchStepCount`, which reports steps *since you subscribed*, and only while
the app is in the foreground. So the running total has to be kept by the app
itself: each batch of new steps is added to today's stored count and written to
SQLite immediately, because the process can be killed at any moment and nothing
is delivered while it is away.

That leads to a limitation I decided to state rather than hide: **steps taken
while the app is closed are not counted.** Closing that gap needs Health
Connect on Android, which is a second permission system and its own grant UI.
The permission is already declared (`android.permission.health.READ_STEPS`) and
`react-native-health-connect` is installed, so it is the next step rather than
a hidden flaw.

The concerns I had to handle, all of which generalise to any sensor. The
hardware may not exist — `isAvailableAsync()` is checked before anything else,
and the screen says so instead of showing a dead zero. The permission may be
refused, so the app has to stay useful without it. The subscription must be
removed when the screen goes away, or it holds the sensor open and costs
battery for a screen nobody is looking at. The day can roll over while the app
is open, so the stored total is keyed by date rather than accumulated forever.
And a permission request can return without ever showing a dialog — Expo Go not
declaring it, or Android remembering a previous "don't ask again" — which is
indistinguishable from a broken button unless the app surfaces what the
platform actually said, so it does.

## State Restoration

The app's state is of two kinds. **Information**: the workspace — every track
with its phases, tasks, deliverables, materials, weekly rhythm, completion
history and notes — plus device-local preferences and today's step count.
**Navigation**: which tab you were on and which screen was pushed above it.

Information lives in SQLite through `expo-sqlite`
(`src/storage/db.ts`). The workspace is a single row — `workspace(id, data)` —
holding the whole document as JSON, with separate tables for `notes` and
`steps`. `WorkspaceProvider` reads that row on mount and every commit writes it
back, so the app restores to exactly the state it was killed in. The shape is a
deliberate choice rather than laziness: the domain object is a document, it is
read and written whole, it is merged whole during sync, and normalising it
across tables would mean maintaining a relational schema and a migration path
for a structure that is never queried by field on the device.

Device-local settings that must not sync — theme preference, which panels are
open — go to `AsyncStorage` (`src/storage/deviceSettings.ts`), because they
describe this phone rather than the account. The session token goes to
`expo-secure-store`, which is backed by the Android Keystore, because it is a
credential and the other two stores are plain text on disk.

Two pieces of state restore by being derived rather than stored. The timer
keeps an absolute `endsAt`, so restarting recomputes the remainder from the
clock instead of resuming a counter that stopped. The step count is written per
batch, not per session, so a kill between batches costs at most one batch.

Navigation is restored by Expo Router, which rebuilds the route from the URL it
holds. What is deliberately *not* restored is transient UI: a half-typed note
in an unsaved field, an open modal, a scroll position. Those are cheap to
re-establish and restoring them would mean persisting on every keystroke.

---

# Level 2

## Framework Comparison

**React Native** renders real platform views from a JavaScript description.
Under the New Architecture, Fabric lets the JS and native sides talk
synchronously through JSI instead of serialising across the old asynchronous
bridge. Your buttons are the platform's buttons, so they inherit its
accessibility and behaviour for free — and its inconsistencies with them.

**Android-Kotlin with Jetpack Compose** is the platform itself. Everything the
OS can do is available on the day it ships, performance has no bridge to cross,
and the tooling is first-party. It buys that with a codebase that runs on
exactly one platform.

**SwiftUI** is the same bargain on Apple's side: declarative, deeply integrated,
excellent on the hardware it targets, and useless off it.

**Flutter** takes the opposite approach to React Native. Rather than wrapping
platform views it draws every pixel itself through Skia/Impeller, so a widget
looks identical everywhere — which is an advantage when you want one brand and
a disadvantage when you want an app that feels native on each platform.

**What they have in common** is more striking than what separates them. All
four are declarative: you describe what the UI should be for a given state and
the framework reconciles the tree. All four have a reactive state model
(hooks, `remember`/`State`, `@State`, `setState`/Riverpod) and the same
unidirectional data flow. All four give you hot reload. All four surface the
same lifecycle concepts under different names — Activity callbacks, scene
phases, `AppState` — because those come from the operating system rather than
the framework. Learning one of them well transfers most of the way to the next;
what does not transfer is the ecosystem and the native escape hatch.

**Where they differ** in ways that bite: the language (Kotlin, Swift, Dart,
TypeScript) and therefore what existing code you can reuse; how they render
(platform views versus own canvas); how quickly new OS features arrive (same
day for native, a release behind for cross-platform); binary size and cold
start (native wins, Flutter ships a runtime, RN ships a JS engine); and how
much native code you must write to reach the long tail of platform APIs.

**What actually decided it for this project** was none of the above in
isolation — it was the shared core. Horizon's domain rules already existed as
framework-free TypeScript, tested, and shared with a web app. React Native was
the only option that lets that code run on the phone unchanged. Had the project
started on the phone with no web client, the calculus would have been quite
different and Kotlin would have been a serious candidate.

## Data Storage

React Native and Expo offer, roughly in order of weight:

- **`AsyncStorage`** — asynchronous key/value, unencrypted, backed by SQLite on
  Android. Simple, fine for small preferences, no querying, no transactions.
- **`expo-secure-store`** — key/value backed by the Android Keystore and iOS
  Keychain. Encrypted at rest, limited value size, meant for credentials.
- **`expo-sqlite`** — a real relational database with transactions and WAL. The
  right answer for anything structured or large.
- **`expo-file-system`** — files on disk, plus the document picker and sharing
  for import and export.
- **MMKV** (third party) — a much faster key/value store than AsyncStorage,
  memory-mapped; worth it when preferences are read on a hot path.
- **Remote** — in this project, a Next.js API over MongoDB, which is the
  durable copy and the thing that makes two devices one account.

Horizon uses four of them, each for a different reason. **SQLite** holds the
workspace, the notes and the step counts; it is the only option here with
transactions, and `PRAGMA journal_mode = WAL` lets a sync read run while a tap
is writing, which matters because both happen at once. **AsyncStorage** holds
device-local settings — the theme, which panels are open — precisely because
they must *not* reach the account; putting them in the synced workspace would
mean changing the theme on a laptop also changed it on a phone. **SecureStore**
holds the session token, because it is a credential and the other two stores
are readable files. **FileSystem** backs the backup export and restore, which
writes the whole workspace as a `.json` file the user owns.

The one choice worth defending is storing the workspace as a single JSON
document in one SQLite row rather than normalised tables. The object is read
whole on launch, written whole on commit, and merged whole during sync; nothing
on the device ever queries it by field. Normalising would buy query power this
app does not use and cost a relational migration on every shape change.

Two devices are reconciled by `lib/merge.ts` in the shared core, which is worth
being precise about because "last write wins" is the usual shorthand and is not
quite what happens. The unit of conflict resolution is the **record**, not the
field: for a material, whichever side carries the more recent per-item
`updatedAt` wins the whole record, so an edit on one device cannot be partly
reverted by stale values from the other. There is one domain-specific exception
— a real `http(s)` URL beats a local file path for a material's link whatever
the timestamps say, because that is genuinely better data rather than a race —
and a fallback to the older field-by-field merge for legacy records that have
no `updatedAt` on either side.

## Rollout Process

Horizon's phone app is Android, built with **EAS Build** and distributed two
ways: an internal-distribution APK on the `preview` channel for my own device,
and a Play Store track for release. The JavaScript is updated separately
through **EAS Update**, which publishes a new bundle to a channel; the app
checks on launch, downloads in the background, and applies it on the next
launch. That split is the central fact of the rollout process: JS changes can
ship in minutes, anything touching native code needs a new binary and, for the
store, review.

What binds the two together is `runtimeVersion`, and getting it wrong is the
sharpest trap in the process. Horizon uses the `appVersion` policy, so the
runtime version *is* the app version. **An over-the-air update is only offered
to a binary whose runtime version matches.** Upgrading this app from Expo SDK 57
to SDK 58 changed native code, which means an SDK-58 JS bundle cannot run inside
an SDK-57 binary. Had I left the version at 0.2.0, the new build and every
existing install would have claimed the same runtime, so the five updates
already published to 0.2.0 would have been offered to the new binary and the
next update to every old install — each one a native/JS mismatch, which is a
crash on launch. Bumping to 0.3.0 gave the new binary its own runtime; the old
installs stop cleanly at the last update they can actually run. I verified this
on a device: the SDK 58 build correctly reports "No update available" against
the 0.2.0 branch.

**What happens when users do not upgrade** is the client-server half of the
same problem. An old install keeps working against the server indefinitely, so
every schema change has to be additive and the server has to tolerate documents
written by a client that predates the field it is reading. Horizon has already
been bitten by the opposite: a release tightened sync validation and the server
rejected a track written by an older client over a field that had since been
retired, locking real data out of the account. The lessons I now apply are to
add fields rather than repurpose them, to have the server ignore what it does
not recognise instead of refusing the whole document, and to treat a rejected
sync as a bug in the server's tolerance rather than in the client's data. For
genuinely breaking changes the remaining tools are a minimum-supported-version
check that tells the user to update, and EAS's rollback-to-embedded.

## Inter-app Communication

Android's mechanisms are **Intents** — explicit (name the component) or
implicit (describe the action and let the system offer handlers) — plus **deep
links and App Links**, **content providers** for sharing data, and the **share
sheet** as the user-facing form of an implicit intent. iOS covers the same
ground with **URL schemes**, **Universal Links**, **share extensions** and the
document picker. Expo wraps the common cases so one call works on both.

**Calling another app** is `Linking.openURL(url)`, which hands the URL to the
system and lets it choose the handler. Horizon uses this in four places: opening
a material's link or a deliverable's repository URL in the browser
(`src/app/materials.tsx`, `src/app/portfolio.tsx`), opening the hosted privacy
and security pages, and opening the Discord invite (`src/app/settings.tsx`).
`expo-web-browser` is also available for an in-app browser tab, which is what
an OAuth flow wants so the user does not lose the app. Google Sign-In is itself
an inter-app flow: it hands off to the system account picker and comes back with
a token.

**Making the app callable** is a matter of declaring a scheme. Horizon sets
`"scheme": "horizon"` in `app.json`, and because routing is Expo Router — which
maps URLs to files — any route is addressable without extra wiring: a
`horizon://track/<id>` link resolves to `src/app/track/[id].tsx`. For links that
must survive the app not being installed, the stronger form is an Android App
Link or an iOS Universal Link, verified by hosting an assetlinks file on the
domain, so `https://horizonroadmap.com/track/<id>` opens the app when present
and the website when not. That is the natural next step and is not implemented
yet.

What I would add if the app needed it is a **share target**: declaring an
intent filter for `text/plain` so a URL shared from a browser lands directly in
the materials list of the open track, which is the one inbound flow this app
would genuinely use.

## Permission System

**Android** splits permissions into *normal* ones, granted at install simply by
declaring them, and *dangerous* ones, which must be declared in the manifest
*and* requested at runtime since API 23. The user can refuse, and can refuse
permanently — a second refusal sets "don't ask again", after which the request
returns immediately with no dialog. Some capabilities sit outside this system
entirely in *special access*, with their own settings screens; Health Connect
is one, with its own grant UI and its own per-data-type model. **iOS** works
differently: there is no manifest request, but every protected capability needs
a usage-description string in `Info.plist`, the prompt appears at first use, and
you get exactly one chance — after a refusal the only route back is the Settings
app.

In Horizon, `app.json` declares two Android permissions:
`android.permission.ACTIVITY_RECOGNITION`, which is the dangerous permission
guarding the step counter, and `android.permission.health.READ_STEPS` for the
Health Connect work. The runtime request lives in `src/steps/usePedometer.ts`,
behind an explicit `request()` that the Steps screen calls.

Three design choices, each with a reason. **The app never asks on first paint.**
The request happens when you tap a control that says what it is for, because a
permission dialog shown before the person knows what the app does is the one
most likely to be refused — and on Android a second refusal is permanent, so a
badly-timed ask can cost the feature for good. **The app stays useful when
refused.** The step counter is one panel; refusing it leaves every other part of
the app working, and the screen says what was refused rather than showing a
dead zero. **The app reports what the platform actually said.** A request that
returns without a dialog — Expo Go not declaring the permission, or a
remembered "don't ask again" — is indistinguishable from a broken button, so
the last platform message is surfaced on screen.

The broader point I took from this is that a permission is a product decision
before it is a technical one. The question is not "how do I request
ACTIVITY_RECOGNITION" but "what is this app if the answer is no" — and if the
honest answer is "broken", the feature needs rethinking rather than a more
persuasive dialog.

---

# Level 3

> Not claimed. My depth is in React Native; I have not built a comparable
> project in a second framework, and the comparison above is reasoned from
> documentation and architecture rather than from having shipped both. Stated
> plainly rather than overclaimed.
