# SE Self-Assessment: Reflection on the Learning Process

> **Read this first.**
>
> The SE_47 assessment instructions say, about this document specifically:
> *"Please do not use Large Language Models when writing your reflection
> essays, it should be in your own words, even if English is not your native
> language."* The Framework Analysis is explicitly allowed to be written with
> LLM support; **this one is not.**
>
> So this file is deliberately **not** a draft essay. It is the structure of
> the reference essay you gave me, and underneath each heading: the **facts**
> from the repository and the git history (dates, versions, what was actually
> built — things you would otherwise spend an hour digging out), and
> **questions** to answer in your own words.
>
> Delete every `>` block as you write. What is left should be entirely yours —
> which matters beyond the rule, because you have to defend it in an oral exam.

**Name:** Alessandro Perez
**CODE Email:** alessandro.perez@code.berlin
**Current Semester:** Fall Semester 2026
**Module:** SE_47 (Mobile App Development)
**Project Name:** Horizon

---

## 1. What did you set out to learn and to build?

> **The facts, if you want them.**
> - The phone app's first commit is **2026-09-22**; the most recent is
>   **2026-11-05**. 109 commits touch `mobile/`.
> - It started as *"the phone app, with the shared core running on it"*
>   (0.25.0) — the premise was reusing the existing TypeScript core, not
>   starting again.
> - Stack: React Native 0.88.1, Expo SDK 58, expo-router, TypeScript.
> - By the end: 4 tabs, ~18 stack screens, 82 files, ~16,200 lines, backed by
>   a shared core of 46 modules and ~6,200 lines used by both clients.
>
> **Questions to answer in your own words.**
> - Did you set out to learn mobile development, or to put Horizon on a phone
>   and learn mobile development as the cost of that? Be honest — the second
>   is a perfectly good answer and it is the one the history suggests.
> - Why did a tracker for long-horizon goals need to be on a phone at all?
>   What can it do there that the website cannot? (The step counter is the
>   literal answer; is it the real one?)
> - What did you expect to be hard before you started, and was it?

## 2. What topics did you learn about which you previously knew nothing about?

> **Candidates from the history — pick the ones that were genuinely new to you,
> not the ones that sound most impressive.**
> - **The application lifecycle as a design constraint.** `0.47.0` is called
>   *"a timer that outlives its screen"* — the timer stores an absolute
>   `endsAt` instead of counting down, which is a direct consequence of
>   `background` meaning your JS may simply stop.
> - **Sensors and what the platform will not give you.** `0.26.0`, *"the step
>   counter, and what to do when it says no"*, then `0.26.1`, *"say why the
>   sensor is refused"*. Android has no "steps today" query; you keep the total
>   yourself.
> - **The Android permission model** — manifest plus runtime, "don't ask
>   again" being permanent, and Health Connect being a second system
>   (`0.50.0`, and `0.50.1` where it forced `minSdkVersion` to 26).
> - **Over-the-air updates and runtime versions.** `0.30.0`, *"over-the-air
>   updates, with a runtime version to keep them safe"*, and then the SDK 58
>   upgrade (`0.117.0`) where the version had to go 0.2.0 → 0.3.0 or old and
>   new binaries would have been served each other's bundles.
> - **Gestures and touch**, if the drag-to-reorder work counts for you
>   (`0.46.0`, `0.55.0`).
>
> **Questions.**
> - Which of these did you actually not know existed, versus know about but
>   never have to handle?
> - Was there a moment where a platform constraint changed the design rather
>   than just the code? (The step counter's "steps while closed are not
>   counted" is one; the timer is another.)
> - What do you now think you *still* do not know? Naming a gap honestly is
>   worth more at Level 2 than claiming there is none.

## 3. Which specific learning resources did you use, and how did you use them?

> **Prompts, not answers — I do not know what you actually read.**
> - Expo's documentation, React Native's documentation, Android developer docs
>   (permissions, Health Connect)? Which did you lean on, and for what?
> - Was there a resource that was *not* documentation — a talk, a book, a
>   codebase you read, another app you took apart?
> - Did you attend the Learning Unit this semester? If not, say so, as the
>   reference essay does.
> - Be specific about *how* you used each one: read once up front, or returned
>   to repeatedly when stuck? The reference essay's strength is that it says
>   "I kept coming back and reading more" rather than just listing a link.

## 4. In which ways did you use LLMs as a part of the learning process?

> **This question asks you to be accurate, and you have an unusually detailed
> record to be accurate from. Some of what happened on this project, as fact:**
> - A large amount of the code was written with LLM assistance, across 109
>   mobile commits.
> - It was also used for *verification* rather than generation in places —
>   measuring contrast ratios against WCAG thresholds, measuring touch-target
>   sizes, recording the device at 120fps to check an animation actually ran.
> - It got things wrong in ways you caught: a window-edge constraint on the
>   dashboard drag caused a React "maximum update depth" crash (0.117.2 →
>   0.117.3), and a touch-target count reported in 0.110.0 was measured on an
>   almost-empty screen and was wrong for a real one.
>
> **Questions.**
> - Where was the line for you between using it and learning from it? Did that
>   line move over the project?
> - What did you have to understand yourself before you could tell a good
>   suggestion from a bad one? (The two mistakes above are a concrete way in:
>   why did you catch them?)
> - Would you be able to re-derive the lifecycle, sensor and permission
>   decisions without assistance? That is what the oral exam will test, so the
>   honest answer here is also the useful one.

## 5. Where do you currently stand with respect to content outlined in the module description?

> **The module's Level 2 criteria, and where the project stands against each.
> Use this as a checklist to argue from — in your own words, and only where
> you actually believe it.**
>
> | Level 1 criterion | Evidence in the project |
> |---|---|
> | Create an application with the framework | Expo SDK 58 / RN 0.88, 4 tabs + ~18 screens, shipped to a device |
> | Non-trivial UI connected to functionality | Arrangeable panel grid, drag-to-reorder, swipe actions, weekly planner |
> | Understand and interact with the lifecycle | `AppState` in `TimerProvider`, `WorkspaceProvider`, `SyncProvider`, `usePedometer` |
> | Access sensors and the concerns involved | `expo-sensors` Pedometer; availability, permission, battery, day rollover |
> | Restore state on restart | SQLite workspace, AsyncStorage settings, SecureStore token, absolute `endsAt` |
>
> | Level 2 criterion | Evidence in the project |
> |---|---|
> | Awareness of all storage options and their trade-offs | Four in use for four different reasons; see Framework Analysis → Data Storage |
> | Rollout experience and its client-server implications | EAS Build + EAS Update; the SDK 58 runtime-version episode; a real sync-validation incident where a server rejected an older client's data |
> | Awareness of inter-app communication | `Linking.openURL` outbound, `scheme: "horizon"` + Expo Router inbound; App Links identified as not yet done |
> | Understanding of the permission system | Two declared permissions, runtime request on a tap, usable when refused, platform message surfaced |
>
> **Questions.**
> - Which level do you claim, and why that one rather than the one above or
>   below? The reference essay states it in one sentence and then justifies it
>   — do the same.
> - Where is your knowledge thinnest? For Level 2 the comparison across
>   frameworks is reasoned rather than lived — is that a gap you want to name
>   before an examiner does?
> - What would you do differently if you started the app again now?

**GitHub link:** <add the repository URL>
**Video:** <add the screencast link>
