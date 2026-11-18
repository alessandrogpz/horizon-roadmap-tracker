# The phone app

Why `mobile/` is a native app rather than a wrapper, what it shares with the web app, and how it
is stored, restored and shipped. For the day-to-day workflow — dev loop, builds, releases — see
[`../mobile/README.md`](../mobile/README.md).

## 1. Why not a wrapper

Bubblewrap or PWABuilder can turn the existing PWA into a Trusted Web Activity and put it on Play
in a day. It remains worth doing as a distribution option, but it is not an app in any sense that
matters here: there is no framework, no view lifecycle, no sensor access, and state restoration
belongs to the browser rather than to the code. Capacitor goes further — a native shell with access
to native APIs — but the UI is still a web view, so the lifecycle and the rendering are still the
browser's.

## 2. The framework decision

**React Native, through Expo.**

| Option | Why not |
|---|---|
| **Kotlin / Jetpack Compose** | The best platform fit, but nothing is shared with the existing project and iOS would need writing a second time. |
| **Flutter** | A strong cross-platform choice, but Dart means the domain logic — merge engine, streak rules, migrations — is rewritten and then maintained in two languages that can disagree. |
| **Capacitor / TWA** | §1. |

The deciding factor is that `lib/` imports nothing from React and nothing from the browser: about
1,500 lines of types, date handling, completion rules, streak calculation, selectors, the merge
engine and the schema migrations. React Native reuses it as it is, tests included. What gets
rewritten is the layer that was always platform-specific — the views, and the storage underneath
them.

The cost: React Native's bridge to native code is slower than Flutter's own rendering, Expo's
managed workflow hides native configuration until you need it, and a JavaScript runtime uses more
memory than Kotlin would.

Logic crosses the platform boundary; styling does not. `mobile/src/theme.ts` is the concrete case —
React Native has no CSS, so the theme is rebuilt even though every rule that decides anything is
imported unchanged.

## 3. Architecture

```
ProductivityApp/
├── lib/                     shared, unchanged: types, dates, completions, streak,
│                            selectors, merge, trackActions, migrations
├── app/, components/        the web app
└── mobile/                  the Expo app
    ├── app/                 screens (expo-router)
    ├── src/storage/         SQLite, and the settings adapter
    ├── src/sync/            talks to the same server API
    └── src/steps/           the pedometer and Health Connect
```

**What is reused:** the whole domain core, and the server. `/api/auth/session`, `/api/sync`,
`/api/search`, `/api/stats` and `/api/account` are unchanged — the phone is another device syncing
through the account, and the server-side merge already handles two devices editing the same day.

**One server-side detail.** The server accepts ID tokens for exactly one client ID
(`lib/server/auth/googleIdToken.ts`). A native Google sign-in issues tokens for its own Android or
iOS client ID, so either the app requests the web client ID as its `serverClientId`, or the server
accepts a list of audiences. The app does the first, which changes no server code.

## 4. Storage on the device

| Option | Used for | Why |
|---|---|---|
| **SQLite** (`expo-sqlite`) | tracks, days, notes | Structured, queryable, survives restarts, and holds a year of data without loading all of it. The phone's equivalent of IndexedDB. |
| **Key-value** (`AsyncStorage`) | device preferences: theme, when the day starts | Small, no schema, unencrypted. What `localStorage` covers on the web. |
| **Secure storage** (`expo-secure-store`) | the session token | Backed by the Android Keystore and the iOS Keychain, so another app or a dump of a rooted device cannot read it. The closest equivalent to the web's HttpOnly cookie. |
| **Files** (`expo-file-system`) | backups, in and out | A `.json` written into a folder the user picks and read back from a file the user picks. Android gives an app no access to user storage at all — only to a location handed over through the Storage Access Framework, one item at a time, which is why no storage permission is requested: none is involved. |
| **The server** | the synced copy | — |

## 5. Lifecycle and state restoration

Android can terminate the process at any time, with no warning and no reliable moment to finish
work in. The app is built to survive that rather than to avoid it:

- Every edit is written to SQLite as it happens — not on a timer, and not on close.
- The screen the user was on, and the track they had open, are restored.
- `AppState` transitions re-read what may have changed while the app was away: the day rolling over
  past midnight, and new steps.
- Returning to the foreground triggers a sync, and the server-side merge resolves whatever happened
  meanwhile, using the same code the web app runs.

## 6. Rollout

Builds come from Expo's cloud service, so no Android Studio and no Mac are required. Distribution is
Play Console's **internal testing** track — minutes rather than the days a production review takes.

The rule that governs everything here: **new JavaScript can be handed to an app already installed;
new native code needs a new build in the user's hands.** `runtimeVersion` pairs a bundle with the
binary able to run it.

The client–server implication is one this project has lived: a phone not opened for a month syncs to
a server that has moved on. In `0.21.4` a device holding an old track sent a retired field and the
server's strict schema rejected it.

**iOS** is configured in `mobile/app.json` but has never been built: `eas.json` defines Android
profiles only, and the Apple Developer Program is a separate cost. The codebase targets it; that is
not the same as having shipped it.
