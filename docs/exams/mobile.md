# Mobile App Development: the oral

One-to-one, 15 to 30 minutes, with the phone and the laptop. Show the app running on real hardware,
then expect questions about the framework, the lifecycle, storage, permissions and shipping.

The plan, the framework decision and the schedule are in [`../../MOBILE_PLAN.md`](../../MOBILE_PLAN.md).
Shared checklist for the day before all three exams: [`day-before.md`](day-before.md).

## What this project is claiming

Level 1 in full, and the Level 2 items that came with the work. Level 3 needs depth in a *second*
framework, which this project doesn't have — say so plainly if asked, rather than bluffing. Knowing
where your knowledge stops is itself part of the grade.

## The demo (about 8 minutes)

Do it on the phone, mirrored or held up. Every step below answers a specific criterion, so say which.

1. **The app, running (1 min).** Open Horizon on the phone. Today's plan, the streak, the track
   switcher. Tick an item.
2. **State restoration (1 min).** Force-close the app from the app switcher, reopen it: the tick is
   still there. Say why — every edit is written to SQLite the moment it happens, because Android can
   kill the process without warning and there is no reliable "before closing" moment.
3. **The sensor (2 min).** Tap "Count my steps", walk a few steps, watch the number climb. Then the
   honest part: Android has no "how many steps today" call — `getStepCountAsync` is iOS only — so the
   app accumulates from `watchStepCount`, which delivers nothing while the app is in the background.
   The card says so rather than implying a full day. Closing that gap means Health Connect, a second
   permission system.
4. **Permissions (1 min).** Show the denial path: Android's "don't ask again" means the app can never
   prompt again, so it detects that state, says where to turn it on, and notices when you come back
   from settings. This was found by hitting it for real, not by reading about it.
5. **The account (2 min).** Sign in with Google on the phone, sync, and show the same tracks that are
   on the laptop. Then say what makes that cheap: the phone talks to the *same* server API, and the
   server merges devices in a transaction with the same merge code the phone itself runs.
6. **The architecture (1 min).** Open a file from `lib/` on the laptop and point out that the phone
   imports it unchanged — types, dates, completion rules, streaks, selectors, merge, migrations.
   About 1,500 lines shared, because none of it imports React or the browser.

## The questions, and short answers

| Question | Answer from this project |
|---|---|
| Which framework, and why that one? | React Native through Expo. The deciding factor was that Horizon's domain logic imports nothing from React or the browser, so it moves to the phone unchanged; Flutter would have meant rewriting the merge engine and migrations in Dart and maintaining two copies that can disagree. `MOBILE_PLAN.md` §3 |
| What did you give up by choosing it? | A JavaScript runtime uses more memory than Kotlin; the bridge to native code is slower than Flutter's own rendering; Expo's managed workflow hides native configuration until you need it |
| Why not just wrap the website? | A wrapper has no framework lifecycle, no sensor access and no state restoration of its own — the browser does all of it. It would be a store listing, not an app. `MOBILE_PLAN.md` §2 |
| Native, cross-platform or web — when would you pick each? | Native when the platform's own APIs and performance dominate; cross-platform when the logic is shared and the UI is ordinary; web when reach and no install matter most. Horizon is all three, and the split is deliberate: the website is the full product, the phone is the daily surface |
| How does the view lifecycle work here? | Screens are React components under expo-router; the app re-reads its state, the date and the sensor permission whenever it returns to the foreground, because any of the three can have changed while it was away |
| What happens when Android kills your app? | Nothing is lost: every change is written to SQLite as it happens. On reopening, the workspace, the day and the step count are read back |
| Which storage options are there, and why did you pick these? | SQLite for structured data that must survive and may grow; a key-value store for small preferences; the platform keystore for the session token; files for backups; the server for the shared copy. `MOBILE_PLAN.md` §4 |
| How does an app read and write the user's files? | It doesn't, in general — there is no permission that grants it. Android hands the app one file or folder at a time through the Storage Access Framework: the system shows a picker, the user chooses, the app gets access to exactly that. Horizon's backup export asks for a folder and the restore opens a file picker, which is why neither prompts for anything |
| Why would a JavaScript library fail to bundle? | Because React Native is not Node. A package written for the server can `require("fs")`, `"crypto"` or `"punycode"` — none of which exist on a phone. Horizon hit exactly that adding a markdown renderer; the fix was installing the real `punycode` from npm and aliasing it in `metro.config.js` (`../LEARNING_LOG.md` entry 17) |
| Where do you keep the session token, and why not a cookie? | The Android Keystore, sent as a `Bearer` header. A browser's HttpOnly cookie is the best a web page has, but a phone has hardware-backed storage — and a bearer token is never attached automatically, so it can't be used by another app or page by accident |
| How does the permission system work? | Declared in the manifest, asked at the moment of use, refusable, and permanently refusable. After "don't ask again" only the user can change it in settings, so the app has to detect that and say so |
| What is inter-app communication on Android? | Intents: the share sheet, deep links (`horizon://`), and content providers. Horizon accepts shared links into a track's materials |
| How do you ship it, and what breaks? | EAS builds in the cloud, Play's internal testing track, then production. The thing that breaks is version skew: an app installed months ago keeps talking to today's server. Horizon has already lived that — a strict schema refused a field an older client still sent (`../LEARNING_LOG.md` entry 13) |
| What is the difference between a development build and a release? | A development build loads JavaScript from a dev server and can hot-reload; a release has it bundled. And the deeper rule: JavaScript can be replaced in an app that is already installed, native code cannot — that needs a new build in the user's hands |
| What's different about developing for mobile? | Resources are limited, the OS can kill you, the network comes and goes, permissions can be refused, screens are small and varied, and shipping is slow and irreversible compared with a web deploy |
| How do you choose a dependency? | First question: does it contain native code? If it does, it can only reach users in a new build; if it is pure JavaScript, it ships over the air. The markdown renderer and the file pickers were both chosen on that test |
| What would you do next? | Health Connect for full-day step data, a background sync, and iOS — the same codebase builds for it |

## Things to be honest about

- **Expo Go could not run this.** The pedometer permission isn't in its manifest and Google sign-in
  needs native code, so both needed a development build. That is the clearest illustration of what
  "native module" means, and it cost an afternoon to learn properly.
- **The step count misses what happens while the app is closed.** Stated on screen, not hidden.
- **One framework, not two.** Level 3 asks for two, compared in depth. This is Level 1–2 work.
