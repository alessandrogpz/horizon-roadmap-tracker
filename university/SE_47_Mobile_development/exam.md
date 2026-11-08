# SE_47 Mobile — exam drill

1:1, 15–30 min, with the **phone and the laptop**. Show the app on real hardware, then questions on
the framework, lifecycle, storage, permissions and shipping.

Reference: [framework-analysis.md](framework-analysis.md) (the hand-in) ·
[MOBILE_PLAN.md](MOBILE_PLAN.md) (the decisions as they were made) ·
[`../LEARNING_LOG.md`](../LEARNING_LOG.md) entries 15–18.

## How to practise

| Pass | Do this | Done when |
|---|---|---|
| 1 | Read framework-analysis.md line by line | You can defend every claim out loud |
| 2 | Run the demo on the phone, in order, twice | 8 min, no notes, nothing crashes |
| 3 | Cold-call yourself with **Questions** | 15 of 18 |

## The claim

> *"Level 1 in full, plus the Level 2 items the work produced. Level 3 needs depth in a **second**
> framework, which I don't have."*

Say the last part plainly if asked. Knowing where your knowledge stops is part of the grade.

## The demo — 8 minutes, on the phone

Each step answers a criterion. **Say which one** as you do it.

| # | Min | Do | Say |
|---|---|---|---|
| 1 | 1 | Open Horizon. Today's plan, streak, track switcher. Tick an item | Non-trivial UI connected to functionality |
| 2 | 1 | **Force-close from the app switcher**, reopen | State restoration. Every edit hits SQLite as it happens, because Android can kill the process with no warning and there is no reliable "before closing" moment |
| 3 | 2 | Tap *Count my steps*, walk a few steps | The sensor — **and the honest part**: Android has no "steps today" call (`getStepCountAsync` is iOS only), so the app accumulates from `watchStepCount`, which delivers nothing in the background. The card says so. Closing the gap means Health Connect, a second permission system |
| 4 | 1 | Deny the permission, then show the recovery | "Don't ask again" is permanent — the app detects it, says where to turn it on, and notices when you return from settings. Found by hitting it, not by reading about it |
| 5 | 2 | Sign in with Google on the phone, sync, show the laptop's tracks appear | Client–server. Same server API, same merge code, merged in a transaction |
| 6 | 1 | Open a file from `lib/` on the laptop | The phone imports it **unchanged** — types, dates, completion rules, streaks, merge, migrations. ~1,500 lines shared, because none of it imports React or the browser |

## Show it works

On the laptop, phone connected by USB:

```bash
adb devices
```

```bash
cd mobile && npm start
```

Useful if something misbehaves mid-demo: `adb logcat -s ReactNativeJS:V` shows the app's own JS logs.

**Have ready without a terminal:** the Play Console internal-testing track, the EAS build list
showing `runtimeVersion` per build, and `mobile/app.json` (permissions, plugins, scheme,
`runtimeVersion` policy).

## Questions — cold call

**Framework**
1. Which framework, and why that one? → RN via Expo. Horizon's domain logic imports nothing from React or the browser, so it moves to the phone unchanged. Flutter would mean rewriting the merge engine and migrations in Dart and maintaining two copies that can disagree.
2. What did you give up? → More memory than Kotlin; the native bridge is slower than Flutter's own rendering; Expo's managed workflow hides native config until you need it.
3. Why not wrap the website? → A wrapper has no framework lifecycle, no sensor access, no state restoration of its own. It would be a store listing, not an app.
4. Native vs cross-platform vs web — when each? → Native when platform APIs and performance dominate; cross-platform when logic is shared and the UI is ordinary; web for reach with no install. Horizon is all three, deliberately.

**Lifecycle and storage**
5. How does the lifecycle work here? → Screens are React components under expo-router; the app re-reads state, the date and the sensor permission on every return to the foreground, because all three can change while it is away.
6. What happens when Android kills the app? → Nothing is lost. Every change is written to SQLite as it happens; the workspace, the day and the step count are read back on open.
7. Which storage options exist, and why these? → SQLite for structured data that must survive and may grow; key-value for small preferences; the platform keystore for the session token; files for backups; the server for the shared copy.
8. How does an app read the user's files? → It doesn't, in general. The Storage Access Framework hands over one file or folder at a time through a system picker — which is why the export and restore prompt for nothing.
9. Where is the session token, and why not a cookie? → The Android Keystore, sent as a `Bearer` header. Hardware-backed, and a bearer token is never attached automatically, so no other app or page can use it by accident.

**Permissions and inter-app**
10. How does the permission system work? → Declared in the manifest, asked at the moment of use, refusable, and *permanently* refusable. After "don't ask again" only the user can change it in settings.
11. What is inter-app communication on Android? → Intents: the share sheet, deep links (`horizon://`), content providers. Horizon accepts shared links into a track's materials. App Links are identified and not done.

**Shipping**
12. How do you ship, and what breaks? → EAS builds in the cloud → Play internal testing → production. What breaks is **version skew**: an app installed months ago still talks to today's server. Already lived it — a strict schema refused a field an older client sent.
13. Development build vs release? → A dev build loads JS from a dev server and hot-reloads; a release bundles it. The deeper rule: **JS can be replaced in an installed app, native code cannot.**
14. What is `runtimeVersion` for? → It pairs a JS bundle with the native binary that can run it. The SDK 58 upgrade forced 0.2.0 → 0.3.0; without that, old and new binaries would have been served each other's bundles and crashed on launch.
15. Why would a JS library fail to bundle? → React Native is not Node. A server package can `require("fs")`, `"crypto"`, `"punycode"` — none exist on a phone. Hit exactly that with a markdown renderer; fixed by installing real `punycode` and aliasing it in `metro.config.js`.
16. How do you choose a dependency? → First question: does it contain native code? If yes it only reaches users in a new build; if it's pure JS it ships over the air.
17. What's different about developing for mobile? → Limited resources, the OS can kill you, the network comes and goes, permissions get refused, screens vary, and shipping is slow and irreversible compared with a web deploy.
18. What next? → Health Connect for full-day steps, background sync, and iOS — the same codebase builds for it.

## Be honest about these

- **Expo Go could not run this.** The pedometer permission isn't in its manifest and Google sign-in
  needs native code, so both required a development build. The clearest illustration of what "native
  module" means, and it cost an afternoon to learn properly.
- **The step count misses what happens while the app is closed.** Stated on screen, not hidden.
- **One framework, not two.** Level 3 wants two, compared in depth. This is Level 1–2 work.

## Before you walk in

- [ ] Newest build installed on the phone, opened once to check it still runs
- [ ] `cd mobile && npm start` works, in case a development build needs the server
- [ ] Phone charged, off silent, same network as the laptop
- [ ] A few steps walked with the app open, so the counter has something to show
- [ ] A track synced, so step 5 has data on both devices

Shared checklist: [`../exam-day.md`](../exam-day.md).
