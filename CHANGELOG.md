# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/), version numbers follow
[Semantic Versioning](https://semver.org/) (pre-1.0: anything may still change;
`1.0.0` is reserved for the first release considered beta-ready).

This log starts at `0.1.1` — everything before that predates the changelog.

## [0.117.0] - 2026-11-05

### Changed
- **Expo SDK 57 → 58**, the upgrade parked since 0.107.1, and with it the last three dependency
  advisories: `npm audit` reports **0 vulnerabilities** where it reported 3 (1 high). The high one
  was `decode-uri-component` reached through `query-string` from `expo-router`, and no override
  could fix it — the patched release is ESM-only while `query-string@7` requires it as CommonJS,
  so the override bundled clean and threw on every URL parse. `expo-router@58` drops
  `query-string` entirely, which is why this was the only way through.
- 26 packages moved with it, including React Native 0.86.3 → 0.88.1, React 19.2.3 → 19.3.0,
  Reanimated 4.5.1 → 4.7.1, Worklets 0.10.1 → 0.13.0 and gesture-handler 2.32 → 3.3, a major.
- **Four `ScrollView` refs retyped.** RN 0.88 makes `ScrollView` a function component, so
  `useRef<ScrollView>` describes the component rather than the thing the ref holds, and
  `scrollTo` / `scrollToEnd` vanish from the type. `ScrollViewInstance` is the type of what you
  actually get.
- **The app version is 0.3.0, and that matters more than it looks.** `runtimeVersion` uses the
  `appVersion` policy, so the runtime version *is* the app version. SDK 58 changes native code: an
  SDK-58 bundle cannot run inside an SDK-57 binary. Left at 0.2.0, the new build and every
  existing install would have claimed the same runtime, so the five updates already published to
  0.2.0 would have been offered to the new binary and the next update to every old one — each a
  native/JS mismatch, which is a crash on launch. At 0.3.0 the new build has its own runtime and
  old installs stop cleanly at the last update they can run.

### Notes
- `expo install --fix` could not complete the upgrade in place: npm hit an ERESOLVE between
  `expo-router@57` on disk and the `@expo/ui@58` arriving to satisfy its peer. The versions it had
  already written to `package.json` were correct, so a clean `rm -rf node_modules package-lock.json
  && npm install` resolved it in one pass.
- expo-doctor: 19/20, the one failure being the deliberate `resolver.disableHierarchicalLookup`
  that Metro needs here — unchanged from before the upgrade.

## [0.116.0] - 2026-11-05

### Added
- **The panel cards and the track rows give under a thumb.** They were the last controls in the
  phone app without press feedback, and the only ones that genuinely could not use `Tappable`: the
  gesture above them is the one thing watching how far the finger travelled, so it is the one
  thing that can tell a press from the end of a drag — a Pressable inside the card saw a press
  whenever a finger went down and came up on it, which is also what dragging the column to its end
  looks like. The gesture already knows, so it drives the give itself through `onBegin` and
  `onFinalize`, and the handoff to the pick-up lift is free: `Gesture.Exclusive` cancels the tap
  the instant the drag activates, so the give is already springing back as the lift starts.

### Notes
- **Verified on a device at last — a Pixel 7 Pro over USB — and the answer settles an open
  question.** Reanimated animates correctly there: recorded at 120fps, the untouched `Segmented`
  thumb travels 12 → 512 pixels over 41 frames with the step size decaying from 25px to 1px, which
  is a damped spring of about 340ms. The press feedback works too: holding the sync chip moves its
  left edge inward by 5px of a 233px control, which is the 4% `PRESS_SCALE` asks for.
- So the finding recorded in 0.111.0 — that `useAnimatedStyle` does not update — was true of the
  react-native-web preview this repo verifies the phone app through, and only of it. The device
  was always fine. Worth remembering before trusting that preview on anything time-based.

## [0.115.0] - 2026-11-05

Everything in this release was found by the critique pass that followed 0.114.0, and measured
before and after rather than assumed.

### Added
- **Undo on the web.** The phone app has had `UndoBar` since it was written, and its reasoning is
  worth repeating: a dialog in front of every destructive action teaches people to click through
  dialogs, so the action happens at once and a bar offers it back. The web app had inherited the
  half of that policy that removes the guard and not the half that replaces it — deleting a
  deliverable, a material, a to-do or a phase was final on the first click of a 14x14 target, in a
  local-first app with no server history. `components/UndoBar.tsx` restores a whole previous
  workspace rather than inverting the edit, because `commitWorkspace` already takes one. Verified
  end to end: two phases, delete, one, Undo, two.

### Fixed
- **49 of 78 interactive elements failed 44x44 at phone width; 35 failed 24x24.** `.tap-44` had
  been applied to panel chrome and never to panel contents, which is where every failure lived —
  all 24 elements carrying it passed, and none of the 49 failures had it. Now 15 and **0**: every
  control clears the 24x24 that WCAG 2.5.8 actually requires, and the 15 still under Apple's 44
  are labelled buttons at least 24 in both axes. **The 0.110.0 release notes claimed 22 under
  44x44; that was measured on a near-empty dashboard and was wrong for a populated one.**
- **The focus ring failed WCAG 2.2 SC 1.4.11 in both themes** — `rgba(accent, 0.45)` composited to
  2.23:1 over the page and 2.27 over a panel, against the 3:1 a non-text indicator needs. The alpha
  was buying softness on the one element whose whole job is to be unmistakable. Full strength now:
  **7.14** and 6.85.
- **14 text-contrast failures on the dashboard, 1.94–2.78 against 4.5, identical in both themes —
  now 0 in both.** Two causes, both de-emphasis implemented as opacity multiplying against tokens
  that were already as quiet as they could be: `opacity-50` on future day cards, and
  `muted-foreground/60` captions nested under a further `opacity-70`. No opacity fixes the first —
  even 0.85 drops the subtle tier to 3.84 — so a future day is a dashed, quieter *frame* now and
  its text is left alone, which is also what you want from looking ahead.
- The contrast target the track colours solve against went from 4.6 to **5.2**, because the surface
  it models is not the surface they land on: the weekly plan composites to `#153345` where the
  model says `#17171b` plus a wash, and a tag the model scored 4.77 measured 4.42 on screen.
- **"New track" had no Create button.** The four template rows *were* the irreversible submit,
  directly under a sentence promising the choice was low-stakes — so clicking one to read what
  "Work" sets up created a track, with no moment to check the name and dates. They are a radio
  group now, with **Create track** beside Cancel.
- The week pager's heading row, the checkbox (18x18, the most repeated action in the product) and
  the day-card header (full width, 18 points tall) all grew real targets.

### Changed
- **The phone's front door was three words in an empty screen.** "No track open." — no
  illustration, no explanation, nothing to press, as the first thing a new person sees. The app
  already had `EmptyState` doing this properly two tabs away. `NoTrack` is that now, with a
  **Create a track** button, and the eight screens that had written the three-word version out
  inline go through it instead of each inventing an answer.
- **The uppercase ban finished.** `.section-title` and the phone's `TYPE.marker` each removed small
  tracked capitals with a written argument naming them the commonest tell of a generated
  dashboard — and the rule reached panel headings and stopped at the panel border. 53 survivors
  across 21 components, in tab labels, field labels and section markers, now sentence case.
- The landing page was advertising a dashboard that no longer exists: four bordered stat tiles with
  icons and a progress ring reading Streak / Timeline / Active / Last 30, against a real header of
  four bare figures reading Streak / Phase day / Timeline / Progress. The preview's own comment
  claimed it showed them "as the real header shows them".
- `globals.css` said the light theme was "Not yet activated by a toggle" and that "the component
  tree still hardcodes many dark-only colors". Both false, in the file that is the de-facto design
  system document.
- "1 points behind the calendar" is singular when it is one. "Time spent 1/100" is a percentage,
  beside the figure that was already written as one. The focus-type swatches no longer read a raw
  hex to screen readers.

## [0.114.1] - 2026-11-05

### Fixed
- **The week pager came apart at phone width**, and 0.113.0 did it. That release gave the
  `‹ Week 1 ›` pill `flex-wrap` to stop it overflowing a 288-point panel at 200% text, and bought
  that by breaking the ordinary case: at 390 points the three glyphs of one control landed on
  three different lines — `‹` at y=239, the label at y=241, `›` at y=269 — on the panel people look
  at first, every day, at the width most of them are in. Fixing an extreme case by breaking the
  common one is the wrong trade, and the pass that made it did not re-measure the common one
  afterwards. The pill is `flex-nowrap shrink-0` now and the heading row above it wraps instead, so
  it moves under the heading as one piece. Measured at 390: one line at 100% text and still one
  line at 200%.

## [0.114.0] - 2026-11-05

### Fixed
- **Four contrast failures, all of them the same shape: a fixed colour on a surface that changes
  with the theme.** A primary button's label on the phone was `#04121c`, which reads 6.84 on the
  dark theme's bright accent and **3.19** on the light theme's deep one. The web app fixed exactly
  this in `.btn:hover` a while back and recorded why; the phone never got it. Four screens, now on
  `palette.background` — the colour always furthest from the accent, whichever theme is on: 7.14
  and 5.74.
- The phone's checkbox tick was white, which reads **2.54** on the dark theme's success green —
  under even the 3:1 floor for graphics — and 5.48 on the light one. No fixed colour clears both.
  Following the theme gives 7.80 and 5.30. Same for the confirm sheet's destructive button, where
  white read 2.77.
- **The colour picker's tick was the hardest thing on the row to see**, in both apps: white on the
  six track colours reads 2.15 on the amber, 2.28 on the green, and clears 4.5 on exactly one of
  them. `onColor()` in the shared core picks black or white per swatch, and a test holds every
  track colour to 4.4.
- Swipe actions carried white labels on literal `#ef4444` and `#f59e0b` — **3.76 and 2.15**. The
  palette would have been worse (`danger` on dark is `#f87171`, where white reads 2.77), because a
  solid action slab is a different job from a text colour. `ACTION` names three fills chosen so
  white holds in both themes: 6.47, 5.02, 7.56.
- The sync dot — the most-looked-at chrome in the app — was the one piece that ignored the theme.
  Three of its four states were raw Tailwind palette colours with a mismatched literal hex in the
  glow, so in light mode it kept the dark-mode greens while every token around it deepened.

### Changed
- **The type scale finally reaches the app.** 0.109.0 put the informational pages on it and left
  391 literal sizes in the app itself — 347 arbitrary values and 44 Tailwind steps — which is why
  changing `--text-body` still moved the website and not the dashboard. All 391 now name a role.
  The scale was derived from exactly these values, so the sizes are unchanged; what changes is that
  there is one vocabulary instead of two. Measured on the rendered dashboard: 8 distinct sizes,
  every one of them a named step, none off-scale. The phone was already clean — zero literals.
- 27 `leading-*` utilities dropped where the type class now supplies the line-height, rather than
  left as silent no-ops under an unlayered rule that beats them.
- The untyped-day grey was written out twice as `#a1a1aa`; it is `DEFAULT_TYPE_COLOR` in the shared
  core, so the swatch you pick from and the tag you get cannot drift.
- Removed `.no-press`, an opt-out added in 0.111.0 that nothing opted out of, and `Reveal`'s
  `delay` prop, which has never been passed.

## [0.113.0] - 2026-11-05

### Fixed
- **A track name could break the whole page.** Seeded with a 196-character name that had no spaces
  in it — a long German compound, a pasted URL, a file path — the dashboard measured 1,662 pixels
  wide inside a 320-pixel window and scrolled sideways, the whole way, on every screen. `body` now
  carries `overflow-wrap: break-word`, and the one place where that is not enough — a person's text
  inside a flex row, where the longest unbreakable word becomes the row's minimum width — has a
  `.user-text` class that drops that floor as well. Measured after: scroll width 320 at a 320-pixel
  viewport, nothing spilling.
- Six control clusters could not wrap: the week's `‹ Week 1 ›`, the phases header, the progress
  switch, the timer's `-5m / +5m`, a material's four buttons, the consistency key. At 200% text on
  a narrow screen they ran from 239 to 393 points wide inside a 288-point panel. With text at 200%,
  elements overflowing went from 24 to 8 at 320 points, 3 at 390 and 1 at 463.
- A material's row collapsed its own title to zero width once the title could be clipped: the four
  buttons beside it are `shrink-0` and come to about 190 points, which on a 288-point panel left
  nothing. The row wraps now, so the buttons take their own line rather than the name losing its.
- **The reading list had no ceiling.** Sixty materials in one category made that panel 14,905 pixels
  tall — twenty screens of it, with seven other panels stranded underneath. A category shows twelve
  and offers the rest: 1,494 pixels for the same data.
- List titles clamp to two lines with the full text in the tooltip, in materials, deliverables,
  phase tasks, the day editor and the stat breakdown. A single 200-character title was rendering
  4,468 pixels tall on its own.

### Changed
- **Nothing capped what a person could type.** One `maxLength` existed in the whole product, on the
  insights search box; the other 65 fields — 37 on the web, 29 on the phone — took whatever
  arrived. `lib/limits.ts` now holds one set of ceilings that both apps import, because a value one
  app accepts and the other truncates is a sync conflict with no resolution. They are deliberately
  generous: a name is 80, a title 200, a description 1,000, a document 200,000. Wrapping is the
  second line of defence; this is the first.
- The phases panel and the phone's plan screen had no empty state. A track can lose every phase, and
  one started from the blank template never had any, and the panel answered that with its header,
  its two buttons and a 2px gradient line hanging in the dark. Both say what a phase is for and
  offer the control that makes one. The phone's progress screen gets the same treatment without a
  button, because progress is recorded elsewhere and a button here would lead away.

### Notes
- Evidence is a seeded workspace: a 196-character unbroken name, 60 materials, 40 tasks, titles in
  Chinese, Arabic and emoji, and empty days among full ones, measured at 320, 390 and 463 points,
  each at 100% and 200% text. The phone app was measured at 280 points, where it holds: scroll
  width 280, nothing spilling.
- The informational pages were already clean and needed nothing: privacy and security measure zero
  overflowing elements at 320 points at both 100% and 200% text, and the landing page never exceeds
  the viewport either.
- Not covered: right-to-left *layout*. Arabic text renders correctly and is not clipped, but the
  app does not mirror for `dir="rtl"` and there is no translation layer to drive it.

## [0.112.0] - 2026-11-05

### Changed
- **Modals and popovers now leave as deliberately as they arrive.** 0.111.0 gave the nine modals
  and two popovers a proper entrance and left the exit for later, on the grounds that keeping
  eleven surfaces mounted past the state change that removes them meant touching eleven call
  sites. It does not: `components/useDismiss.ts` does it from inside. The surface takes the close
  request, marks itself as leaving, plays its exit and only then tells its owner it is gone.
  Nothing above it changed.
- The exit is 140ms against the entrance's 200ms, and that asymmetry is the point: opening is the
  interface presenting something and may take its time, closing is it getting out of the way and
  must not keep you waiting for it.
- Every way out now goes through one place. The top bar's menu had been closing itself from four
  (the trigger, a click outside, Escape, picking an item) and the track list from eight; both have
  a single `dismiss` now, so the animation arrived everywhere at once rather than at whichever
  exits someone remembered.

### Notes
- Verified in slow motion, which is the only way it could be. Played at normal speed, an animation
  that starts on an element already on the page never leaves `pending` in either the in-app
  browser or Chrome under automation — a start-up latency in the renderer swallows a 120ms
  animation whole — while an animation on a *freshly inserted* element runs fine. That is why the
  entrances measured clean in 0.111.0 and the exits looked dead. Stretched to four seconds, both
  run exactly as written: the backdrop at opacity 0.05, the panel at 0.97 scale, `pending: false`.
  Worth remembering for the next time something here looks broken.
- Unmounting is timed at 160ms against animations of 140 and 120, so the last frame is never raced
  away.
- Nothing in this entry touches the phone app.

## [0.111.0] - 2026-11-05

### Changed
- **The dashboard's panels stopped arriving one after another thirteen versions ago and nobody
  noticed.** `SortablePanel` sets a 60ms-per-panel `animation-delay`, and the `@keyframes panel-in`
  it referred to was deleted by accident in 0.97.0 — a commit about the weekly overview. The delay
  has been applied to no animation ever since, and the `prefers-reduced-motion` block has been
  switching off a class that did not exist. Restored, with the note that made it work: the fill is
  `backwards`, not `both`, because a retained transform would make the panel the containing block
  for its `position: fixed` descendants and lay the notes drawer out inside a dashboard card.
- **Nothing in the app answered a press.** Every control had a hover state and not one had an
  `:active` state, which on a phone — where there is no hover and your thumb is covering the thing
  you touched — meant a tap produced no response at all until the work it started finished.
  Buttons now give by 3% over 140ms. Small enough that nobody will name it; what you notice is its
  absence, as the interface feeling dead under the finger.
- The same on the phone app, where it was worse: 141 `Pressable`s, zero `activeOpacity`, zero
  `android_ripple`, and exactly one component — the SubNav chip — that did anything when touched.
  That chip's spring is now `src/components/Tappable.tsx` and ~135 of the 141 use it. The handful
  left out are deliberate: the four full-screen backdrops have nothing to give, and `Segmented`
  already answers a press by moving its thumb to where you touched.
- **Hover states were sticking after a tap.** Tailwind v4 wraps its own `hover:` utilities in
  `@media (hover: hover)`; the eight hover rules hand-written in `globals.css` were not, so on a
  touch screen they latched on the last thing tapped and stayed. All eight gated. Press feedback is
  deliberately *not* gated — touch is where it matters most.
- Nine modals and two popovers existed on one frame and not on the one before. They fade their
  backdrop and scale up from 0.96 now; the popovers scale out of the corner of the button that
  opened them rather than out of their own centre, and the modals keep a centred origin because a
  modal is the one surface that is not anchored to anything. Enter only — a real exit means keeping
  nine components mounted past the state change that removes them.
- The three ad-hoc modal backdrops (`bg-black/80`, `bg-black/85`, `.modal-overlay`) are one.
- Three easing curves as tokens — `--ease-out`, `--ease-in-out`, `--ease-drawer` — replacing the
  browser's built-in `ease` nearly everywhere and two hand-written `cubic-bezier(0.16, 1, 0.3, 1)`s
  that nothing else referenced. They live in `@theme`, not `:root`, and that distinction is the
  whole point: Tailwind v4 ships its own `--ease-out`, so declaring one in `:root` left two
  definitions of the same name in the stylesheet — ours winning for hand-written CSS and Tailwind's
  weaker curve staying behind the `ease-out` *utility*. One definition now, and the override is a
  decision rather than a collision.
- The notes drawer opens in 340ms on the iOS drawer curve and closes in 220ms. Opening is the
  interface presenting something and can take its time; closing is it getting out of the way.
- `transition: all` is gone from all fifteen places it appeared. It was putting a 200ms transition
  on `flex`, `padding` and `border-width` — every layout property those elements had.
- Three progress bars filled over 500ms; 280ms now. `width` is kept rather than `scaleX`, which
  would distort a 6px pill's rounded caps.
- The phone app had no equivalent of `prefers-reduced-motion` at all, while the web app has
  honoured it since the landing page's reveals went in. `useReducedMotion()` now reads the same
  system setting on both platforms. Reduced means fewer and gentler, not none: fades stay, because
  a fade still says a thing arrived; movement goes.

### Notes
- **The press feedback on the phone app is not verified.** Reanimated's `useAnimatedStyle` updates
  do not run under the react-native-web preview this repo verifies the phone app through — the
  pre-existing `Segmented` thumb, untouched by this change, sits at `translateX(3px)` through a
  whole switch there too. So the proxy cannot show this working. What is verified is that
  `onPressIn` fires and the animated style is attached to the right element; whether it *looks*
  right wants a simulator or a device.
- On the web app it is verified: a transform transition starts on the button on mousedown, 38
  hover rules sit inside `@media (hover: hover)` and the one that does not is the rule whose job is
  to override one of them, the panel stagger measures 0 / 60 / 120 / 180ms across two columns, and
  the menu's `transform-origin` lands exactly on its trigger's left edge.
- `PanelCard` — the most-tapped thing in the phone app — still has no give, and cannot use
  `Tappable`: a gesture handler above it decides whether a touch was a tap, a drag or a scroll, and
  it is the only thing watching how far the finger travelled.
- Expo SDK 58 is still deferred until the restyle is finished, along with the native build owed for
  `orientation` and `ios.supportsTablet`.

## [0.110.0] - 2026-11-05

### Changed
- **The phone app was never laid out for anything but a phone held upright.** It shipped
  `orientation: "portrait"` and without `supportsTablet`, so on an iPad it ran as a scaled-up
  iPhone: panels 800 points wide holding one short sentence, a week's seven dots spread from edge
  to edge, meters running the full width of the screen.
- Layout now comes from the window's width class, never from the device — a phone in landscape, an
  iPad in Split View and a small tablet all hand you the same width and all three want the same
  answer. `mobile/src/layout.ts` holds the thresholds (Material's window size classes, which line
  up closely enough with iOS's regular/compact to serve both).
- Every tab screen caps its content at 620 points and centres it, and the tab bar's four items are
  gathered under that column instead of sitting in the far corners of an 834-point bar, which is
  what iPad's own tab bars do. On a phone the cap is wider than the screen, so there is one code
  path rather than a phone layout and a tablet layout free to drift apart.
- `orientation` is `default` and `ios.supportsTablet` is on. Those two are deliberately last:
  unlocking rotation before the layouts could take it would have shipped a worse app.
- **The phone stopped shouting too.** `TYPE.eyebrow` — 11pt, uppercased, letter-spaced — was used in
  seventeen places, which made small tracked capitals the most repeated gesture in the app, and the
  website had already dropped the same device. It is `TYPE.marker` now: 12pt, sentence case. One
  role, seventeen call sites, both apps finally agreeing on what a label looks like.
- **Touch targets on the web app at phone width**: 44 controls were under 44x44, the week's chevrons
  as small as 22x19. A `.tap-44` utility adds the missing area through a pseudo-element, so the hit
  region grows and the icon stays the size the dense layout was built around, and only on coarse
  pointers. 44 down to 22 under 44x44, and 6 under the 24x24 that WCAG 2.5.8 actually requires.

### Notes
- `orientation` and `supportsTablet` live in `app.json`, so they need a **new native build** to take
  effect; an over-the-air update carries the layout work but not those two.
- Evidence for the native work is an emulated viewport through react-native-web at 375, 834 and
  844x390 — layout, not gestures. The panel drag-reorder was not exercised by touch, and neither was
  rotation on real hardware; both want a device before release.
- The two-column panel grid an iPad could carry is not done. My Space's drag-to-reorder assumes a
  single column, and breaking that gesture to gain a column was not a trade worth making quietly.

## [0.109.0] - 2026-11-05

### Changed
- **The informational pages are on the product's type scale, so style changes reach them.** This was
  the real complaint behind "the landing page should work side by side with the product", and the
  cause turned out to be worse than drift: the ten-role scale added in 0.105.0 was being used by
  **one file out of fifty-nine**. Everything else, the app included, carried its own hard-coded
  `text-[0.85rem]`. Colour propagated because colours are tokens; type never could, because nothing
  read the tokens.
- The landing page's 81 literal font sizes, the shared document page's 12 and the security page's 2
  are now `type-*` roles. Change `--text-body` and the dashboard, the landing page, the privacy page
  and the security page all move.
- Two roles were added to the scale for the pages that are read rather than worked in: `--text-hero`
  and `--text-section`, both fluid, because a headline sized for 1440 is wrong at every other width.
  `--text-prose` finally got the class it never had.
- **Eleven eyebrows are gone from the landing page** — the small tracked-uppercase label above each
  section heading — along with the `SectionLabel` component that made them. Every heading under them
  turned out to say the whole thing already: "One colour each" sat above "Every track in its own
  colour, on one year."
- The remaining shouted labels on the landing page and in the document pages' sidebars are sentence
  case, and the accent-coloured word inside the "a to-do list tells you what's left" headline is set
  in one colour like the rest of it.
- The landing page's app, phone and weekly-plan mock-ups are marked `data-ui`: they are scaled
  pictures of the real interface, so 9px type and 2px radii inside them are correct and the design
  inspector should read them by the app's rules rather than the page's.

### Notes
- The privacy and security pages now measure clean apart from the deliberate typeface choice.
- The landing hero still sets in three lines. Its column is 388px against a 54px headline, so two
  lines would need either shorter copy or a full-width hero — both are changes to the page's design
  rather than to its consistency, so they are left for a decision rather than taken quietly. The
  accent phrase in that headline is kept for the same reason: it is the page's signature, not drift.

## [0.108.0] - 2026-11-05

### Changed
- **The dashboard stopped looking like every dashboard.** Measured against the design skill's
  app-screen rules, the screen scored 6 failures, and the list read like an inventory of the stock
  template: nineteen tiny tracked-uppercase labels, twenty text blocks at 10px, nine panels each
  casting a drop shadow, a decorative radial gradient, `PHASE 01 / 02 / 03`, and a row of four
  bordered metric tiles. None of it was wrong. None of it had been decided.
- **Panel headings are sentence case**, set in one place — `.section-title`, which ten components
  share. They were 0.8rem uppercase tracked at 0.06em; a panel called "Deliverables" is not clearer
  shouted. This also put the website in step with the phone, which had been setting the same
  headings in sentence case all along.
- **The four metric tiles are type, not tiles.** Label in sentence case, figure at regular weight,
  sitting on the page instead of in a bordered card, each still opening its detail panel. The
  circular progress ring went with them; a single measure under them says the same thing at full
  width.
- **Panels no longer float.** The drop shadow is gone from every panel at rest: a panel is told from
  the ground by one tone step and a 1px border, which is what the surfaces ladder was always for.
  Dialogs, menus and the notes drawer still float, because they genuinely do.
- **`PHASE 01` is gone.** The dot and the line beside a phase already give its order, and the active
  one now says "You are here" rather than relying on a number's colour.
- The decorative radial glow behind the app and both document pages is removed, the version badge
  sits inside the margin instead of 10px from the screen edge, and the weekly plan's day names,
  dates and focus badges are sentence case at a size that clears 11px.
- **On the phone, the panel icons lost their coloured squares.** Each panel had an icon in a rounded
  tile filled with its own hue — sky, violet, green, amber, red, teal. Beyond being the stock
  dashboard device, those six hues were chrome competing with the one colour in this app that
  carries meaning: the open track's. The icons are plain glyphs in muted ink now, matching the
  website's, and the meters and figures that used those hues take the track's accent instead.
- The landing page's app and phone mock-ups were restyled with everything above, because they are
  pictures of the product and had become pictures of a product that no longer exists.
- Two label-above-a-heading eyebrows are gone — on the privacy and security pages, and over the
  notes drawer's title, where "Study notes" now sits under the title as an ordinary line.

### Notes
- Three of the skill's findings are left standing deliberately. The dealt sheet wanted Instrument
  Sans; Horizon keeps Inter, which is the documented way to treat an existing brand. The one
  remaining "floating panel" is the notes drawer, which is an overlay. The "covered text" on the
  timer is a false positive — nothing is above it, checked by hit-testing the element at its own
  scroll position — as is the "dark panel borders" warning, which reads `rgba(255, 255, 255, 0.06)`
  as pure black because it ignores alpha.

## [0.107.1] - 2026-11-04

### Security
- **27 dependency advisories down to 10, and the 10 that remain are two packages with no fix to
  apply.** The website's 8 all came from one `minimatch` inside `@typescript-eslint`; npm's offered
  fix was a *downgrade* of `eslint-config-next` from 16 to 15, which would have unpinned it from
  Next 16, so it is an override to `minimatch@^11` instead. The website now reports zero.
- The phone went 19 → 10 through overrides on `node-forge`, `minimatch` and `glob`, and on `zod`,
  which `@expo/cli` pulls at a version with a memory-exhaustion advisory. Four Expo packages that
  had drifted behind their own SDK 57 patch releases came up to them, which is also what took
  `expo-doctor` from 19/21 to 20/21.
- What is left is two root causes, neither reachable on a phone. `deepmerge` has **no patched
  release at all** — 4.3.1 is both the latest and the flagged version — and it sits inside
  `@expo/config`, which runs at build time. The three highs are all one chain:
  `decode-uri-component` under `query-string` under `expo-router`.
- **That last chain cannot be fixed by an override, and the attempt would have shipped a broken
  app.** The patched `decode-uri-component@0.5.1` is ESM-only, while `query-string@7` is CommonJS
  and calls `require('decode-uri-component')` as a function — so the override resolves to a module
  namespace and every URL parse throws. It typechecks and it bundles; it only fails at runtime, on
  the phone, in routing. Clearing it properly means `expo-router` 58, which drops `query-string`
  altogether, and that is an SDK major and a new native build rather than an update.
- Also worth recording, because it cost a bundle: this project's `metro.config.js` sets
  `resolver.disableHierarchicalLookup: true`, so Metro only resolves **hoisted** packages. Adding
  and then removing an override left `decode-uri-component` nested under `query-string`, where node
  still found it and Metro did not. `npm dedupe` does not undo it; the fix is deleting
  `node_modules` and installing again.

## [0.107.0] - 2026-11-04

### Fixed
- **The light theme was never really composed — an open track overwrote it.** `TrackAccent` writes
  the track's colour onto `<html>` as an inline style, which sits above both `[data-theme]` blocks,
  so whatever light mode declared for `--accent` never applied. And all six track colours were
  picked on a dark screen: on white, sky read 2.77, green 2.28, amber 2.15 — five of the six below
  even the 3:1 a control needs, for a colour that is the ticked box, the link and the number on a
  stat.
- The accent is now written as a *pair*, one value per theme, and the cascade picks. Each one is the
  track's own colour walked down its own hue until it clears contrast on the surface it lands on, so
  a track stays the colour the person chose and stays legible. Dark is untouched except slate, which
  was the one colour too dim there. The theme can flip with nothing subscribed to it.
- The same fix covers focus-type badges, whose defaults are pastels: "Math" in `#a78bfa` read 2.42
  on white. The wash behind a badge keeps the raw colour — that is what tells two types apart — and
  only the text moves.
- Solving against the bare card was not enough, and that was the subtle part: the accent is nearly
  always written on a tint of *itself*, which pulls the background toward the text rather than away.
  Contrast is now solved against the washed surface, and against each theme's genuinely worst one —
  the darkest in light, where ink is dark, and the lightest in dark.
- `.btn-solid` put near-black text on the accent fill, which is right under a bright dark-mode
  accent and gave 3.21 on the light theme's "Open the app". It takes the page's own background now,
  which is always the colour furthest from the accent.
- `.notes-tab-btn.active` still washed itself in a literal `rgba(14, 165, 233, …)` — the sky the
  accent used to be — so an open track showed green text on a blue tint.
- `--subtle-foreground` rose a step in both apps. It was solved against a bare card, and the open
  day card carries a 6% wash of the accent that lifts it enough to take the date on it to 4.43.
- Measured across the dashboard and the landing page, in both themes: no text below its WCAG
  threshold. It was 15 on the light landing page alone.

### Added
- `readableOn`, `contrastRatio`, `darken` and `flatten` in the shared `lib/colors.ts`, so the phone
  solves this the same way the website does rather than growing a second answer, and 17 tests
  pinning the guarantee — including that darkening preserves hue exactly, which is why a track
  survives being made readable.

## [0.106.1] - 2026-11-04

### Fixed
- **The four stat tiles arranged themselves by accident on a phone.** Content-sized tiles in a
  flex-wrap meant the streak sat alone with half a row empty beside it, then two tiles of unequal
  width, then the progress bar — four rows, two of them half used. Two columns now: the streak and
  the phase day pair, and the two that carry a ring or a bar take the row. Three rows, nothing
  stranded.
- Making that work meant moving the phase day up beside the streak in the markup rather than
  reaching for `grid-flow-dense`, so the reading order a screen reader and the keyboard follow is
  still the order the eye sees. The visible consequence above `sm`, where all four fit on one row,
  is that the two bare numbers now sit together and the ring and the bar follow them.

## [0.106.0] - 2026-11-04

### Fixed
- **Every panel in the app rendered at one density, whatever its code asked for.** `.glass-panel`
  sets its padding outside Tailwind's layers, so a utility could never reach it: five dialogs asked
  for `p-8`, the roadmap's empty state for `p-12`, the weekly plan for `py-5`, and all of them
  silently came out at 1.5rem. One density for a dense dashboard panel and for a dialog holding a
  form is not a decision anybody made — it was a cascade accident.
- Density is a named role now: the default for panels, `.panel-roomy` (2rem) for dialogs, and
  `.panel-flush` for a panel whose child draws its own edges. Every dialog shares one value instead
  of some asking for 2rem and others taking whatever they got, and on a phone roomy steps back to
  1.5rem, because 2rem a side is a sixth of a 390-point screen spent on margin.
- The dead utilities are gone rather than left to imply control they never had.
- On the phone, the panel error boundary was the one component off the spacing scale — raw 16, 8 and
  12 where `SPACING` exists. Its colours stay literal, and now say why: it has to render when the
  tree above it has failed, possibly the theme provider itself, so it cannot call a hook.

## [0.105.0] - 2026-11-04

### Changed
- **The web had forty font sizes; it now has ten.** 0.78, 0.8 and 0.82rem all did the same job, six
  values sat between 0.45 and 0.58rem — 7 to 9 points, under anything readable — and ten more
  crowded between 1.08 and 1.7. Sizes a third of a pixel apart cannot carry different meanings. The
  ten that remain are drawn from the values that already dominated, so the app looks like itself,
  and they are named for their job — display, figure, title, heading, subhead, body, label, caption,
  micro, eyebrow — which is deliberately the same vocabulary the phone's `TYPE` already used. Two
  apps, one word for "the subhead".
- Line height is part of each role rather than an afterthought: tight for display sizes, which are
  read as shapes, looser for small text on a dark surface, which needs the air.
- **The notes and roadmap panes are read, not scanned**, so they get a reading size (1rem against the
  dashboard's 0.85) with the leading to match and a 68-character measure. Past about 75 characters
  the eye loses its place on the way back to the next line. The cap only bites on a wide panel.
- Headings balance their line breaks and body copy avoids a stranded last word, where the browser
  supports it.

### Fixed
- The smallest text in the app was 7.2 points. Everything below the micro role came up to it, which
  is the same reason the date on a day card is legible now rather than merely present.
- **On the phone, a hard-coded line height is an accessibility bug**, not a style: React Native's
  `lineHeight` is absolute points and does not grow when the reader turns their text size up, so
  text clips. The role scale deliberately carries no line height, which is now written down in it,
  and a `leading()` helper folds the reader's scale in for the places that genuinely need to set it.
  The daily screens use it. At the default text size nothing moves; at 200% the lines no longer
  collide.

## [0.104.0] - 2026-11-04

### Fixed
- **Small text now meets WCAG AA.** The quietest text tier carried real content — the date and the
  done-count on every day card, the label on a rotation waiting for a later phase — and read 2.87:1
  in dark and 2.61:1 in light, against a 4.5 requirement. Both themes and the phone's palette are
  retuned against the *lightest* surface the tier lands on, which is the worst case, so those three
  now read 4.85 / 4.60 / 4.70. The tier stays dimmer than the one above it, so the hierarchy is
  unchanged.
- **Four controls had no name for a screen reader**: the timer's session length, both deliverable
  checkboxes, and the two Markdown editors, which offered a placeholder where a label belongs.
- **One keyboard focus ring, from the app's own token.** Buttons and checkboxes used `--ring`;
  everything else fell back to the browser's default outline — always visible, so never a failure,
  but a different shape on most of the app.
- The weekly plan's heading was an `h3` sitting directly under the page's `h1`, skipping a level for
  anyone navigating by headings. It is an `h2` like every other panel, and looks identical.
- The `|` and `•` in the header are decoration and are now hidden from assistive tech rather than
  announced between every item.

### Changed
- Dropped the accent stripe down the left edge of the weekly plan and of the all-tracks rows — the
  single most recognisable tell of a generated interface, and in both places redundant: the panel has
  a heading, and the row already carries a chip with the track's name and colour. Where the stripe
  was the only colour cue, on the roadmap header, it became a dot beside the name, which keeps the
  information and puts it next to what it identifies. The blockquote rule and the two warning banners
  keep theirs: one is ordinary typography, the other is what makes a warning read as a warning.
- On the phone, the timeline ring's percentage and the segmented control's labels scale with the
  reader's text size again, capped so they cannot outgrow the shapes they sit in, rather than opting
  out of Dynamic Type entirely.
- ESLint ignores `.claude/**`. Vendored agent skills are somebody else's source, and linting them
  fails `npm run lint` — a CI step — the moment that folder is committed.

## [0.103.3] - 2026-10-24

### Security
- **The phone's own dependency tree, which CI never looks at.** The audit step runs at the repo root,
  so it only ever sees the website's packages; `mobile/` has its own `package-lock.json` and had 16
  advisories of its own, one of them critical. Safe fixes take it to 10 and critical to zero:
  `shell-quote` (critical, command injection — reached only through react-devtools, which does not
  ship), `source-map-js` (the Metro bundler) and `markdown-it` 15.0.2 → 15.0.3, which *does* ship:
  it renders the roadmap and a rotation's plan. That advisory needs `html` enabled and the app
  leaves it off, so the path was not reachable; patched regardless.
- The 10 left are Expo's own chain — `@expo/cli`, `expo-updates`, `node-forge`, `expo-router`,
  `google-signin`. **Do not run `npm audit fix --force` on `mobile/`**: npm's idea of a fix is
  `expo@44.0.6`, four years and thirteen SDKs backwards, and `expo-router@58` from `59`. These clear
  when Expo ships an SDK with the patched versions, not before.

## [0.103.2] - 2026-10-24

### Fixed
- **CI is green again.** The "Types, lint, tests, build, dependencies" job runs
  `npm audit --audit-level=high`, which counts *development* dependencies too — so clearing the
  advisories that could reach production in 0.103.1 left it still failing, on `vite` and
  `source-map-js` inside the vitest toolchain. It failed in about 25 seconds because the audit is
  the fourth step, long before anything is built, which is why the emails said "build" but no build
  had run. The toolchain is updated (vitest 5.0.2 → 5.0.5, vite 8.3.2 → 8.3.5) and the audit now
  reports zero vulnerabilities at any level.
- Only the lockfile moved: no declared dependency range changed, and nothing here ships to either
  app.

## [0.103.1] - 2026-10-24

### Security
- **Next.js 16.3.5 → 16.4.3**, clearing the critical advisory that has been failing the audit step in
  CI. Its two halves are an RCE in `next/og`'s `ImageResponse` and a Draft Mode leak through a
  pending `use cache` — neither reachable here, since the app uses no `next/og`, no `ImageResponse`,
  no `draftMode` and no `use cache`. Patched anyway: an unreachable path today is one refactor away
  from reachable.
- **zod 4.6.5 → 4.6.7.** This one is worth more than its "high" rating suggests: zod validates every
  sync payload from every device, which is the app's main untrusted input, and the advisory is
  memory exhaustion on oversized constrained collections. The 2 MB cap `readJsonBody` applies before
  zod ever sees a request already limited it; the fix removes the rest.
- Nothing with a production path is left. The four remaining advisories are all in the vitest
  toolchain, which never ships.

### Fixed
- Two date tests asserted that a week is 604,800,000 milliseconds. True except when the clocks
  change, which they do this Sunday — so the suite failed today on dates that were correct. They
  compare calendar days now, and one of them crosses a daylight saving boundary on purpose so the
  behaviour is pinned in March and October rather than discovered there.

## [0.103.0] - 2026-10-16

### Added
- **A to-do can be reworded.** Once an item was written there was no way to change it — only tick it
  or delete it and type the whole thing again. On the website, click the text to edit it: Enter or
  clicking away saves, Escape abandons the change. On the phone, hold a to-do, on the Notes screen
  or in the list under Today, and it opens with a Save beside it. Rewording keeps whether the item
  is ticked.
- Blank text cancels rather than empties: an item with no text is not a to-do, and because the list
  is stored as a markdown checklist it would simply vanish on the next read. Deleting stays its own
  button.

## [0.102.2] - 2026-10-14

### Changed
- More internal tidying, still no change to what the apps do. The longest run of worked days was
  computed by the same eight-line loop in two places — once for a track, once for every track at
  once — which is two chances to disagree about what a run is. It lives beside the current streak
  now, in `lib/restDays.ts`, with tests of its own.
- Materials and portfolio projects each carried their own copy of the git-status effect, identical
  down to the error message, including the part that matters: keying the fetch on the serialised
  repo list rather than the array, so ticking a checkbox does not re-fetch every repo and burn the
  GitHub API's hourly budget. Both use one `useGitStats` hook.

## [0.102.1] - 2026-10-14

### Changed
- Internal tidying, no change to what the apps do. The stacked all-tracks year was built twice —
  the website and the phone each had their own copy of the ruler it hangs on and of the logic that
  decides where a month's name goes, byte for byte the same. Both now call `yearRuler`, and the
  month names come from the one list that already existed.
- The weekly plan built a colour map of every focus type for each of the seven day cards, by slicing
  hex digits by hand. It asks `withAlpha` for the one colour it needs. That also stops a focus type
  whose colour is not a hex triple — a CSS variable, a named colour — rendering as
  `rgba(NaN, NaN, NaN, 0.2)`.
- Removed: a gym helper nothing called, two copies of a one-line alias for `formatDateYMD`, a second
  copy of the `~/` path resolver in the local-only API routes, and a key fallback that could never
  run because the expression before it was always truthy.

## [0.102.0] - 2026-10-14

### Changed
- **The gym keeps to itself.** Its plans are keyed by focus type — the same keys a week is built
  from — so a plan filed under `math` was indistinguishable from a maths day's plan, and every
  screen asking "what is planned for this kind of day" found it. The phone's week strip showed an
  exercise count under such a day, and its rhythm calendar folded planned exercise names in among
  the day's own items. Both are gone. A gym log is read by the gym panel and nothing else now.
- `focusOfDay` moved from `lib/gym.ts` to `lib/focusTypes.ts`. It answers "what is this weekday
  for" by reading the week's own schedule and was never gym logic; living there made every screen
  that wanted a day's type import from the gym module.
- The phone's rhythm calendar builds a day's list with `dayItems`, like every other screen, instead
  of assembling its own fourth copy.

## [0.101.0] - 2026-10-14

### Changed
- **Every item can carry a description.** Only one of the two stored lists had the field, which was
  invisible while a day had two lists and absurd once it had one: the same checklist offered a
  description box on some items and not others, and the items without it were the older ones. Both
  lists hold the same shape now, so an item written months ago takes a note like any other. Nothing
  was moved or rewritten to make that true.
- **The phone's Weekly Overview is the week, and only the week.** It carried a line underneath
  counting the day's gym plan — "Math: 0 of 1 exercises" — which reads as a progress line about the
  day itself on a track that has nothing to do with training. The week strip stays; what today asks
  of you is the Today tab, one tap away. The gym panel still shows the plan in full.

## [0.100.0] - 2026-10-14

### Changed
- **A day holds one list.** It used to carry two — Revision and Focus — and you had to pick one
  before you could write anything down. The split never survived contact with a real track: a single
  focus list would hold a book, a tutorial and a project, which are three different kinds of work.
  And "focus" already named something else here — a *day's* type, the thing the tag shows (Math,
  Rendering, Reading). Two meanings, one word, on the same card. What the day is about is the type
  at the top, which you set and name yourself; what is on it is a plain list.
- The day editor has one checklist and one place to add to it: "Add an item…" with an optional
  description, in place of "New revision topic…" and "Add a focus item…". The weekly plan shows the
  items with no headings over them, which also gives a stacked day two fewer lines. The phone's
  Today screen is one list for the same reason, and its add box says "Add to Wed…" rather than
  asking which list you meant.
- A rotation no longer asks which list it feeds, on the website or the phone. It has a label, the
  days it runs, the phase it belongs to and its items.
- Nothing was reclassified and nothing moved: items written before this keep their place, their
  ticks and their history, and sync keys are unchanged. The two arrays still exist underneath, where
  only storage can see them — collapsing those is a migration with a sync protocol attached, and the
  labels did not need to wait for it.

## [0.99.1] - 2026-10-13

### Changed
- **The week has two shapes again, not three.** Four days across and three below fitted the space, and
  read as a broken calendar rather than a week — a weekend on its own row and an empty fourth cell.
  It is gone. What is left is the week across, Monday to Sunday in a row, and the week down the page,
  one day per row with the days you are not looking at shut.
- Where it switches is derived rather than picked: seven columns need 627 points to leave a day 84,
  which is 42 beside its tick box — enough for a two-line title and no less. An ordinary dashboard
  column at 706 points gets the week across, at about 95 points a day; a narrow panel or a phone gets
  the week down the page rather than seven slivers.

## [0.99.0] - 2026-10-13

### Changed
- **A stacked week opens one day at a time.** One day per row reads well and costs a screen per day,
  so a phone went from scrolling the week sideways to scrolling it downwards — seven days of it,
  most of them already past or not yet arrived. A day you are not looking at is now a single line:
  its name, its date, how much of it is done, and what the day is for. Tap the line to open it;
  today starts open, because that is the day you came to look at, and more than one can be open at
  once. The week fits on one screen again.
- Only in the stacked shape. Four-and-three and seven-across show every day in full, as before —
  a column has nothing to hide behind, and nothing there changed.
- Tapping an open day's body still opens that day's editor, and ticking an item off still only ticks
  it off. The threshold where this all switches lives once, in CSS (`--stacked-max`), and the
  behaviour reads it from there rather than keeping a second copy that could drift.

## [0.98.0] - 2026-10-11

### Changed
- **A rotation waiting for a later phase no longer poses as this week's topic.** The pills above the
  weekly plan listed every rotation on the track and showed each one's current item — but a rotation
  scoped to phase 3 has a "current" item only in the arithmetic sense, since the cycle turns with
  the week whether or not anything reads it. Nothing was putting that item on a day. Split a ten-week
  cycle into one rotation per phase and the header would claim four topics were running at once,
  which is the opposite of what scoping is for. A rotation that is not running is now drawn quietly
  and names the phase it is waiting for instead of a topic, and stays clickable, because its pill is
  the only way into it.
- On the phone, the rhythm screen's rotation list says which phase each rotation belongs to, so a
  list of them stops reading as a list of things all running at once.

## [0.97.0] - 2026-10-11

### Changed
- **The weekly overview now fits the room it has.** It was seven `1fr` columns at anything above
  phone width, which divides whatever the panel has by seven however little that is — and the panel
  is a dashboard column, not the window. On a 1440-wide screen that left a day 75 points, and on a
  1024 one, 62: narrower than the day's own focus-type tag, which overflowed and was clipped at
  *both* ends, so "Pattern Study" arrived as "ATTERN STUD". A title got 45 points and broke over
  three lines. The week was at its least readable on the screens a viewport query calls roomy.
- The week now asks the panel how much room it has, not the window, and answers in one of three
  shapes: all seven across when they fit, four-and-three — a calendar, which is a shape people
  already read — in an ordinary dashboard column, and one day per row when it is narrower than
  that. Nothing is clipped and nothing scrolls sideways in any of them.
- **A phone reads the week downwards.** Seven columns on a 375-wide screen showed two days and a
  sliver of a third, so reading the week meant dragging it past the window while holding the rest
  in your head. Each day is now a full-width row: the day, its date and what the day is for sit on
  one line across the top instead of stacking three deep, titles land on one line at a readable
  size, and the rows are taller to hit.
- The same three shapes apply to the all-tracks week and to the panel pictured on the landing page,
  which share the grid.

## [0.96.0] - 2026-10-11

### Added
- **A rotation can belong to a phase.** Pick one under "Runs during" in the rotation editor, on the
  website or the phone, and it only appears while the track is on that phase. Leave it on *Every
  phase* and nothing changes — which is what every rotation written before this does.
- The reason: a cycle and a curriculum are different shapes. Ten algorithm topics on a twenty-four
  week track wrap at week ten, so phase three brings back what phase one already covered, and the
  list never finishes. Four short rotations, one per phase, say "work through these once and be
  done by the end" — and without scoping all four would run at once, which is the opposite of the
  problem being solved.
- Scoping decides *which* rotation runs, not how fast it turns: a three-item rotation across a
  six-week phase still comes round twice.

## [0.95.1] - 2026-10-11

### Fixed
- **The weekly plan's tick boxes were too small to hit.** They were drawn at 18 points and then
  scaled to 0.8 — and a transform shrinks the hit area along with the drawing, so the real target
  was about fourteen points square. That is under half what a thumb needs and fiddly even with a
  mouse. The box is drawn at its full size again, and the whole row is now the target: the title
  beside it toggles the item too, which is where the eye goes anyway. A row is at least 27 points
  tall, past the 24 the guidelines ask for, without widening the column.
- The row swallows its own click, so ticking something off no longer risks opening the day editor
  behind it.

## [0.95.0] - 2026-10-01

### Fixed
- **Changing the week no longer rewrites the past.** Turning Thursday from a day off into a working
  day used to erase every Thursday you had already taken off — the dots went, and the streak they
  were bridging went with them. A schedule is a decision about what comes next, not a claim about
  what already happened.
  - The week is **dated** now. Each track keeps a short log of when its days off changed
    (`TrackState.restDaysFrom`), and every grid, streak and key asks what the week was *on that
    day* rather than what it is today. Past days off keep their mark; days from the change onward
    follow the new week. The same in reverse: making a day free from today does not sprinkle dots
    through last spring.
  - The log only grows when the set of days off actually changes, so renaming or recolouring a
    focus type costs nothing. A track whose week never moves carries no log at all, and one written
    before this reads as "it has always been what it is now" — which is what it already assumed.
  - Views that combine several tracks ask the same question per date: two tracks can agree about
    Sunday in March and disagree about it in September.
  - Web and phone, every grid.

### Changed
- **The day editor now routes its changes through `setWeeklyRhythm`** like the rhythm editor does.
  It wrote `weekSchedule` in place, which would have skipped the dating — and a silently rewritten
  past is not the kind of bug that shows up until somebody looks at last month.

### Notes
- Retrofitting has one honest edge: the first entry a track records has to assume the week it has
  now is the week it always had, because nothing recorded when it last changed. That is the answer
  that *keeps* your existing marks, which is the point — but a change you made before this shipped
  is dated to the track's start rather than to the day you made it.

## [0.94.0] - 2026-10-01

### Changed
- **All tracks on the phone is now a mode, not a screen.** It is the same four tabs you already
  know — My Space, Today, Plan, Progress — read-only, with every track folded into each of them and
  the information where that tab already puts it. It was one long standalone screen, which meant
  learning a second layout to answer questions the first layout already had places for.
  - **My Space** — the numbers across all of it, then the phases, deliverables, materials and
    to-dos of every track.
  - **Today** — what each track is asking of today, and what each has already put down. Nothing
    ticks: there is nothing to tick into.
  - **Plan** — the week, with each track's name for each day and the rotations it lands there.
  - **Progress** — the days, with the same **One per track / All in one** toggle the website has.
  - The switches that say which tracks are in the view are on every one of those tabs. With six
    tracks "what am I looking at" is asked constantly, and an answer behind a tap is an answer you
    stop checking.
- **The phone's own Progress shows the open track and nothing else.** Its "This track / All tracks"
  toggle is gone, the same change the website's consistency panel got — a view about every track is
  a strange thing to find behind a switch inside one track's screen.

### Fixed
- **Picking the track you were already in left you stuck in all-tracks on the phone too.** Same
  cause as the website's, same fix: choosing a track is how you leave the mode, including the one
  already open.

## [0.93.0] - 2026-10-01

### Changed
- **A track's consistency panel now shows that track and nothing else.** The "This track / All
  tracks" toggle inside it is gone. There were three ways to look at the same days and two of them
  were in the wrong place: a view about every track is a strange thing to find behind a switch
  inside one track's panel.
- **Both ways of seeing every track now live together**, in the all-tracks view where that question
  belongs, as one toggle:
  - **One per track** (the default) — a strip each, on the same calendar columns, so the same
    Tuesday is the same column on every row and one track's summer reads against another's. It
    answers "how is each of them going".
  - **All in one** — every day in one square, divided into a band per track that did something on
    it. It answers the other question, "did I do anything at all that day", which rows make you
    scan a column for.
  - By month / continuous applies to the combined grid only; a row per track is always a ribbon,
    which is what makes the rows comparable. Switching a track off updates both.

## [0.92.2] - 2026-10-01

### Fixed
- **Choosing the track you were already in did nothing.** From the all-tracks view it is how you go
  back to that one track, and it was the only row in the list that did not respond: the menu
  swallowed the click as a no-op, so nothing above it ever heard the choice. The menu reports every
  choice now, and the caller decides what it costs — a switch writes, so the one case with no work
  to do is skipped there instead.

## [0.92.1] - 2026-10-01

### Fixed
- **The day-off dot appeared on days that had not happened yet.** The rule was left to whichever
  calendar fed each grid — `yearCalendar` and `monthCalendar` blank out everything past today, so
  most views were right by accident, and "right by accident" is not a property you can check. The
  mark now asks for itself: a day off is marked only once it has passed, and only on a day the
  track existed for. Web and phone, every grid.
- **A day off before the track started was marked too.** `streakCalendar` runs from the *week* its
  track began in, so up to six real dates arrive before the first day with a count of zero — days
  the track was not there to take off. The same rule covers them.
- **Today never showed its own dot.** The day-off mark and today's ring were competing for one
  slot and the ring won, so the one day you are most likely to be looking at was the one day the
  mark never appeared on. They are separate things now and a free day you are standing in gets
  both. Work recorded on it still fills the square and drops the dot, as before.
- **The track switcher's strips grew a white blob** at the end of every row — a side effect of
  telling them what day it is, which they now need for the rule above. They say what day it is
  without ringing it; at four points a day the ring was most of a cell, and those strips end at
  today anyway.

### Added
- **The all-tracks screen on the phone draws the days itself**, one square per day split between
  the tracks that did something on it, with a key naming each colour — the same picture the website
  shows, in the phone's shape. It had only a link to Progress before, which is a different question
  about the same days rather than a substitute for this one.
- That link now opens Progress **already showing every track**. It was landing on a grid of
  whichever single track happened to be open, which is the opposite of the screen it came from.

## [0.92.0] - 2026-10-01

### Added
- **Everything still on your plate, in the all-tracks view** — every track's open to-dos in one
  list, each with the track it belongs to, on the website and on the phone. It is the one panel
  there that has to fetch something: a to-do list is a note rather than a field on the track, so it
  comes from the notes table instead of out of the aggregation with the rest, and is re-read when a
  sync lands. Done items are left out; a combined list is long enough already, and the question it
  answers is what is left.

## [0.91.1] - 2026-10-01

### Fixed
- A redundant guard on the track switcher's delete button — the handler it was checking for is a
  required prop and is always there.

## [0.91.0] - 2026-10-01

### Added
- **All tracks on the phone**, from the row above your track list. The same aggregation the website
  uses — the numbers, the week, every track's phases on one timeline, the deliverables and the
  materials — running down one column in the order it would be read, since a phone has one column.
  The same switches decide which tracks are in it, and the same read-only banner says what it is.
- The stacked consistency grid is *linked* from that screen rather than redrawn on it: Progress has
  had an all-tracks mode for several versions, and two copies of the same picture are two things to
  keep in step.
- Tapping a phase, or a roadmap, opens the track it belongs to — which is the only way anything in
  this view gets changed.

## [0.90.0] - 2026-10-01

### Added
- **All tracks: one read-only board built from every track you have.** A workspace with six tracks
  answers six questions well and the seventh — *what am I actually doing, across all of it* — not at
  all. It is the first entry in the track switcher, and it is the same board you already know how to
  read with more in it.
  - **The week** shows what every track calls each day, in that track's colour, with the rotations
    each one puts on it. Each track keeps its own week number: they started on different days, so
    "week 12" is a different week for each of them.
  - **The consistency grid** puts every track's day in one square, *divided* into a band per track
    rather than blended. Blending was the obvious idea and the wrong one — blue and amber average to
    a muddy grey that is neither, and the more tracks a day has the less a blend says. A day one
    track worked is a solid square exactly as it is on that track's own panel.
  - **The phases of every track on one timeline**, ordered by the date a phase opens rather than
    grouped by track, because the question is "what is running now and what is next" — which is a
    question about the calendar. Finished ones are folded away.
  - **Deliverables and materials** from every track, each row carrying the colour and name of the
    track it belongs to, unfinished first.
  - **The numbers**: a streak that counts a day on which *any* track did something, and a progress
    figure weighted by how long each goal is. A ninety-day track at 50% and a three-year track at
    50% are not the same amount of work, and a plain mean would say they were.
  - **`/roadmap?all=1`**: every roadmap on one page, as an index down the side and one document at a
    time. Six roadmaps printed end to end is a document nobody reads to the bottom of.
- **Tracks can be switched in and out of it** from a row of toggles at the top. The *excluded* list
  is what gets stored, so a track made tomorrow is in the view by default — "everything except these
  two" survives a new track and "these four" quietly loses it. Switching one off changes nothing but
  this view.

### Notes
- It is read-only, and structurally rather than by a flag: there is no master track on disk, nothing
  to save and nothing to merge, which is the only way to be sure that editing the aggregate can
  never mean editing six real tracks by accident. The menu drops everything that would change a
  track while it is open, rather than showing those rows disabled — a disabled row is a thing that
  looks like it should work.
- Whether the view is open, and which tracks are in it, are device preferences alongside the day
  rollover hour. Which track is *active* is data and syncs; which of the two ways of looking at the
  workspace you last used is this browser's own business.
- Only offered with more than one track. One track's all-tracks view is a worse copy of that track.

## [0.89.0] - 2026-10-01

### Added
- **Somewhere to talk: there is a Discord now.** A section on the landing page between the questions
  and the last call to action, a link in the nav and in the footer, and a row in Settings on both
  the website and the phone — because somebody who wants to report something is already inside the
  app, not on the page that sells it.
- The invite lives in `lib/community.ts`, one constant rather than a URL typed into four files.
  `NEXT_PUBLIC_DISCORD_INVITE` overrides it on the web and `EXPO_PUBLIC_DISCORD_INVITE` on the
  phone — two names because the two bundlers inline two different prefixes. Set it to an empty
  string and every link to it disappears rather than pointing at nothing.

## [0.88.0] - 2026-10-01

### Added
- **One working control on the landing page: the track name.** The hero's dashboard is still a
  picture — 0.85.0 took the simulation out for good reasons and it stays out — but switching tracks
  is the exception, and the only one. It is the idea the whole product rests on, and it is the one
  thing a still picture genuinely cannot say: that the accent, the consistency grid, the phase, the
  deliverables, the materials, the to-dos and the week all change together. Open the menu and it
  lists the three tracks exactly as the app's own switcher does — a colour dot, a name, a streak and
  a year of days each — and picking one repaints the whole card.
  - A line under the card says so, which is the whole of the invitation: *Try it: the track name at
    the top really does switch.*
  - `aria-hidden` moved off the card and onto the parts of it that are pictures, so the menu reads as
    the control it is and the drawn dashboard still reads as a photograph. One interactive element
    in the card; everything else is drawn.
- **The preview's consistency grid now wears the track's colour too**, through the same four
  `--streak-*` variables `TrackAccent` writes when a track is opened — scoped to the card. It had
  stayed the theme's green while the rest of the card was blue, which contradicted the one claim
  that section of the page is making.

## [0.87.1] - 2026-10-01

### Changed
- **The landing page's weekly plan now shows the "+ New Rotation" button**, drawn exactly as the app
  draws it — same dashed outline, same size, same words. Without it the two rotation pills read as a
  fixed pair rather than a list you add to, which understates the one feature that section is about.
  Still a span rather than a button: the panel is a photograph, and a dotted outline that does
  nothing when pressed is a worse lie than one that is plainly part of the picture.

## [0.87.0] - 2026-10-01

### Added
- **The track list can be put in an order**, on all three — website, PWA and phone. It used to sit
  in the order the tracks were made in, for good, which is the one order nobody chose: the track you
  open every morning ends up third because you happened to think of it third.
  - **On the phone**, hold a card and the whole list folds down to its headers, the held one comes to
    your finger and the rest step aside as it passes — the same gesture, and the same code, as
    rearranging the panels on My Space. Letting go drops it where it is and *does not* open it:
    holding something to move it and finding you have navigated away is the worst outcome this
    screen has.
  - **On the website and the PWA**, each row grew a handle. Mouse: grab the handle. Touch: hold the
    row anywhere, the same as a dashboard panel.
  - The order is kept on the track (`meta.order`) rather than on the device, so it syncs. That is
    the opposite of the panel order, which is per-device because the phone has one column and the
    website has two — but "which of my tracks comes first" is the same question everywhere. It is
    written onto every visible track at once, so the list is ordered throughout or not at all; a
    track made afterwards has no position and sorts last, which is where a new track belongs.
  - Everything that shows a list of tracks follows it: the switcher, the phone's track screen, and
    the stacked all-tracks consistency grid.

### Changed
- **The phone's track card: holding it now moves it, so its settings moved to a left swipe.** Delete
  stays on the right. Two directions, two meanings, which is the same arrangement every other list
  in the app uses.

### Fixed
- **The PWA's track menu scrolled the page behind it** instead of the list — most obviously with a
  handful of tracks, where the menu was short enough not to scroll at all and every drag went
  straight through to the dashboard. Three things together, because no one of them covers every
  browser: `overscroll-contain` on the list, `overflow: hidden` on the document while the menu is
  open, and a `touchmove` that did not start inside the menu refused outright, which is what Safari
  on iOS needs. The page keeps its scroll position throughout.

## [0.86.0] - 2026-10-01

### Added
- **A day off is now a kind of day, and it does not break a streak.** Any focus type can be marked
  as one — the moon button in the focus-type editor, on both platforms — and the two every template
  ships with, Free and Rest, already are. A day off *bridges* a run rather than extending it: the
  streak survives it, and the number stays a count of days worked, because a track resting five days
  a week should not look like the most consistent thing anyone has ever done. Before this, a plan
  with Sunday off could never hold a streak past six, which punished people for following their own
  schedule.
- **The consistency grid marks them with a dot** rather than filling the square. Nothing was done on
  that day and the square has to keep saying so; the dot, in the track's own colour, says the gap was
  the plan. Web, PWA and phone, in the month grid, the continuous grid, the stacked all-tracks view,
  the track switcher's strips and the phone's track list. The key gained a "day off" swatch.
- The longest streak uses the same rule as the current one — they sit next to each other on the same
  card, and a longest of 6 under a current of 41 reads as a bug.

### Notes
- A track stores the week it has *now*, not the week it had in March, so changing which days are off
  re-reads the past under the new shape. Keeping a dated history of the schedule would cost a field
  on every track, a merge rule and a migration, for an answer that changes only when someone reshapes
  their week — and when they do, the new shape is usually the one they would rather be judged by.
- Views that combine several tracks use the days *every* track in scope has off. A day one of them
  was supposed to work on is not a day off.

## [0.85.1] - 2026-10-01

### Fixed
- **The stacked all-tracks grid on the web drew its days thirteen columns right of the month they
  were under.** Each row was padded out to a full fifty-three weeks — the right thing to do when a
  strip is one of a list of tracks of different ages, and the wrong thing here, where every row is
  already the same year as every other and as the ruler the month names are placed along. A year
  capped at today is forty columns in October, so the thirteen weeks still to come were pushed in
  at the front of every row and the whole stack slid right while the labels stayed put. The phone
  never had this: it draws the rows itself, unpadded.

## [0.85.0] - 2026-09-26

### Removed
- **The simulated app on the landing page.** 0.83.0 and 0.84.0 made the previews behave: the stat
  tiles opened, the boxes ticked, the track menu recoloured the card, the phones' tab bars switched
  screens, a rotation could be added. On reflection that was the wrong idea. A preview that
  half-works tells a visitor something about the product that is not true, and the moment one of
  those ticks fails to save, the thing they have been misled about is the only thing the page is
  for. The layouts are exactly as they were; every control in them is drawn again.
- **And the hover states that went with them.** A hover is a claim that something will happen on a
  click. On a page whose job is to describe an app rather than be one, that claim is false
  everywhere except the links and the buttons, which have their own. The cards no longer lift, the
  previews no longer rise off their shelf, and the panels inside them no longer light up. All three
  previews are `aria-hidden` again, which is what a picture of an interface should be.

### Kept
- The scroll reveals and the easing on in-page links. Those are how the page moves, not claims about
  what it can do.
- The layouts, the examples and the copy from 0.83.0 and 0.84.0, including the fix that stopped the
  hero's dashboard widening past its own card.

## [0.84.0] - 2026-09-26

### Fixed
- **The hero's dashboard broke out of its own card** at every width between a phone and a desk. A
  bare `fr` grid track has an automatic minimum of `auto`, so a column whose content does not fit
  widens the grid instead of shrinking itself — the same mistake that pushed the colour section's
  headline off the right edge in 0.82.0, in a second place. The consistency months scroll now rather
  than being clipped mid-month.

### Added
- **The four numbers across the top of the preview open**, as the app's own stat tiles do: what the
  streak counts, how far through the timeline you are, what "last 30" is measuring. The percentage
  and the phase name open the phase list too — a small link in the corner was a small target.
- **The stacked all-tracks preview responds.** Picking a row brings it forward and pushes the others
  back; picking a day says what was done on it. It was `aria-hidden` and inert, sitting next to a
  paragraph claiming the stack reads at a glance.
- **The weekly plan ticks, picks and adds.** Every box toggles, a day can be opened, and there is a
  **New rotation** button that adds one and a cross that removes it — a rotation is the one idea in
  this app nobody arrives already knowing, so it is the one worth letting people try.
- **The phones' tab bars work**, and each screen responds: the shape control switches, a day
  highlights, a set ticks, a panel opens where it stands. Three phones you cannot touch, under a
  heading about what the app is like in your hand, made the opposite point.
- **In-page links roll rather than snap**, easing in and out, with the speed rising as the distance
  does — a jump to the questions is quicker than four times the hop to the next section, not four
  times slower. A wheel or a touch mid-flight cancels it, and `prefers-reduced-motion` gets the jump.

### Changed
- The colour section stops counting to three: "Every track in its own colour, on one year", and it
  says outright that you can run as many as you like.
- Specialised examples swapped for ones anybody can picture: the rotation is an exercise rotation
  rather than an algorithm one, Materials lost its markdown editor and preview pane, and Deliverables
  leads with the things a track produces rather than with git statistics.

## [0.83.0] - 2026-09-26

### Changed
- **Every panel in the landing page's dashboard now does what its counterpart does.** Pick a day in
  the Weekly Overview and that day's checklist opens under it; open the phase list and click a phase
  to make it current; tick a deliverable, a material or a to-do; add a to-do; type in the notepad.
  It is still a mock — nothing survives a reload — but nothing in it is a picture any more, and the
  cards lift under the pointer, as do the cards on the rest of the page.
- **The examples are ones anybody can picture.** The hero track was "Graphics & engine dev" and the
  week was that track's twelfth, rotating through "Two Pointers" and "Linear Algebra" — which asks a
  visitor to understand two unfamiliar things before they can judge the third. The hero track is
  learning the guitar; the week is a training week, push and pull and legs, with the upper and lower
  rotations moving on. Same panels, same behaviour, an example that explains itself.
- Six pieces of copy cut or rewritten: the hero's sign-up footnote, the paragraph about why the
  colours stop short of white and black (the swatches now carry a label instead), the second half of
  the colour section's paragraph, and the phone section's. The hero no longer asks you to open it
  *every morning*, and the comparison headline names Horizon rather than "a roadmap".

## [0.82.0] - 2026-09-26

### Added
- **The landing page's dashboard is the dashboard now, and it works.** The hero used to hold a
  sketch — a card with a progress bar, three phase dots and a grid of green squares — that matched
  nothing in the app. It is the real thing at one third scale: the app's own `StreakGrid`, the app's
  own colour maths, the same three demo tracks Settings will put in your workspace. Open the track
  menu and pick another and the whole card takes that track's colour and that track's data, exactly
  as the app does, because both write the same handful of CSS variables — here scoped to the card so
  the page around it is untouched. Days open to show what was done on them; deliverables tick.
- **The phone screens have the app's chrome.** They were close and not quite: no title bar, no
  segmented control, no year stepper, no key under the grid. All four are there, which is most of
  what made them read as drawings rather than screenshots.
- **Sections arrive as you reach them.** One page of scroll needs something to reward the scrolling.
  An `IntersectionObserver` and two CSS rules — no library, and nothing at all for anyone who has
  asked their machine to stop moving things.
- **A shelf under the hero, and a lift under every panel.** The preview sits in a soft pool of the
  open track's colour and rises a little as the pointer arrives; the panels inside it do the same,
  the way the real ones do.

### Changed
- **Privacy and Security were two columns of small print with the same chrome written out twice.**
  They now share one shell: a title band with an eyebrow and a lede, a contents column that follows
  you down on a wide screen, and section headings on an accent rule. Security's six measures move
  above the prose, where they are the answer most people came for. Not a word of either page
  changed — the content was always the strongest thing about them.
- The landing copy is shorter in six places. The hero's paragraph in particular said in five lines
  what it says now in three.
- The demo tracks' days are called things like "Worked through a chapter" rather than "test1 item
  1", which was fine in a fixture and embarrassing the moment a day was opened.

### Fixed
- The colour section pushed its own headline off the right edge of a phone. A grid with no base
  column template has one `auto` column, sized to its widest child — and its widest child is half a
  year of days.

## [0.81.1] - 2026-09-26

### Fixed
- **The consistency grid is one row now, in both shapes, and it opens with today at the right.**
  0.81.0 got the month shape half right and the continuous one wrong. Months wrapped onto a second
  and third line, which puts the current month in the middle of the panel and the oldest one in the
  corner the eye starts at; the continuous shape opened on January, so a track that began in June
  opened on five months of empty squares with its history off the right edge. Both are a single row
  in one scroller, pinned to the recent end, scrolled back by hand for the rest of the year.
- The continuous shape also drops the weeks before the track existed, the same way months with
  nothing in them were already dropped — otherwise they are width you have to scroll past to reach
  a day.
- The pin survives the panel changing width — a phone turning, the dashboard's two columns
  collapsing into one — which the first version could not see, because nothing about the content
  changes and it was left sitting on January at the old width's offset. Only on a width change:
  scrolling back through the year is never yanked forward.

## [0.81.0] - 2026-09-26

### Added
- **By month on the website**, and it is the default, as it is on the phone. A calendar year as one
  unbroken ribbon of weeks is hard to read a month out of, because nothing marks where one ends;
  months wrap across the panel instead, each block starting on the weekday its 1st fell on. The
  continuous shape is still a tap away, and a year stepper sits between them.
- **Deleting a track from the switcher.** Every row carries a trash icon that asks once and does it
  on the second tap. It was previously only possible for the track you already had open, through its
  settings dialog.

### Changed
- **A day in the consistency grid is a fixed size now, not a share of the panel's width.** The
  columns used to stretch to fill, which is fine for a season and unreadable for a year: fifty-odd
  columns in a half-width panel gave cells about four points across, too small to see a shade in and
  far too small to hit. The grid also shows one calendar year rather than the whole track, so it
  stops growing as the track does — the same model the phone has used since 0.77.0.
- **The stacked all-tracks view opens at the recent end.** A year starts in January and a track
  rarely does, so it opened on however many blank months came first, with the actual history off the
  right edge. The landing page's preview had the same problem and now draws the last half-year.
- `monthCalendar` and `yearsWithHistory` joined `yearCalendar` in `lib/stats.ts`, replacing the
  phone's inline copies. Both apps arrange the same days the same way.

### Fixed
- **A panel's hover chrome swallowed taps meant for the panel.** The hide, edit and drag buttons in
  every panel's top-right corner are `opacity-0` until the panel is hovered — but invisible is not
  absent, and an `opacity-0` button still takes the tap. On a phone, where there is no hover to
  reveal them, tapping the Consistency panel's scope toggle hid the panel instead. They are now out
  of the way of pointers until they are actually shown, and the toggle moved to a row of its own
  besides.
- **The track switcher no longer runs off the side of a phone.** A 360-point menu anchored to a
  button sixty points from the left edge is 400 points wide on a 375-point screen, which made the
  dashboard the one page in the app that scrolled sideways. It is pinned to the viewport below the
  header on a phone and hung off the button on a desk.

## [0.80.0] - 2026-09-26

### Added
- **The website catches up with the phone.** Everything the last four releases built on Android now
  exists on the web, arranged for a desk rather than a hand:
  - A track's colour is asked for when the track is made, from the same six swatches, and applied to
    the whole page. `components/TrackAccent.tsx` rewrites `--accent`, `--accent-hover`,
    `--accent-muted`, `--ring` and `--streak-1` … `--streak-4` on `<html>`, so every accent in the
    app follows the open track without a colour being threaded through a single component.
  - Making a track is now a dialog — name, colour, start, deadline, template — instead of a click
    that dropped a track called "New Track" into the workspace with a horizon nobody had chosen.
  - The track switcher carries a year of each track's days under its name, in that track's colour,
    with the run it is on. It was a column of names, which answered "which tracks exist" and nothing
    else.
  - Consistency is drawn in the track's colour, with the day it began marked in the page's opposite,
    and a key under it. With more than one track open, a control stacks every track's year on the
    same calendar columns.
  - Settings will add and remove `test1`, `test2` and `test3`, the same three demo tracks the phone
    offers, from the same generator.
- **The landing page shows the phone.** Three drawn screens — Progress, My Space and a workout being
  logged set by set — built from the app's own components and the app's own demo data rather than
  photographed, so they cannot go stale. Plus a section on what a colour per track buys you, drawn
  with the real stacked view, and an honest word about the PWA: installing the website is a complete
  way to use Horizon, and the Android app is for the handful of things a browser cannot reach.

### Changed
- `shadeOf`, `withAlpha` and the shade scale moved from the phone's theme into `lib/colors.ts`, and
  the list of track colours into `lib/trackColors.ts`. Both apps paint the same grid from the same
  numbers; two implementations of "four steps of one hue" is two ramps that drift.
- The phone's track colour picker replaced the website's `<input type="color">`. A free choice lets
  someone pick a colour the app then has to work around — the grid paints four strengths of it, and
  a colour near the page's own is four shades of nothing.
- `yearCalendar` moved into `lib/stats.ts`, where the stacked views on both platforms and the
  landing page's previews all reach it.
- README and `DEVELOPMENT.md` gained what a track's colour is and the two rules that are easy to
  break: the picker never offers white or black, because the day a track began is drawn in the
  page's opposite; and a free-form colour input is not an improvement.

### Removed
- **Dragging one row of the stacked view on its own.** Added in 0.79.0 and taken out after use: it
  was a second gesture on a view whose whole claim is that the columns line up, and it earned its
  complexity from nobody. The spacing between rows, which arrived with it, stays.

## [0.79.0] - 2026-09-26

### Added
- **Hold a row to scroll it on its own.** The stack of tracks in Progress answered one question —
  what did these months look like across all of them — and could not answer the other, which is how
  one track's summer compares with another's winter. A swipe still moves every row together, so the
  columns stay lined up; holding a row for a moment first and then dragging moves that one alone. It
  lifts, lights up in its own colour and the rest fade back, so it is never in doubt which one the
  finger has hold of, and it keeps its new position after release until it is put back.

  Hold-then-drag is the one that has to be asked for, because the common case should be the one you
  get without knowing there is a choice — and it is already what My Space means by "pick this one
  up".

### Changed
- The rows have air between them. They were a single block of squares in which a row was something
  you had to count out.
- The strips are no longer in a `ScrollView` — rows that can drift apart need an offset each, and a
  `ScrollView` has exactly one — so they carry a scroll bar of their own making instead.

## [0.78.0] - 2026-09-26

### Added
- **Three tracks to look at**, from Settings. Every screen that shows more than one track at once is
  impossible to judge on an account with one track and no history, and ticking several hundred days
  by hand to see it is not a reasonable ask. `test1`, `test2` and `test3` arrive in three colours
  with a year or more of days already on them, generated from a fixed seed so they are the same
  three tracks tomorrow — a screenshot of something wrong in test2 is worth something only if test2
  does not change underneath it. They are ordinary tracks otherwise, and the same button takes them
  away again.

- **All tracks, read sideways.** The combined view in Progress is no longer one grid with the
  colours fought over; it is one strip per track, stacked, in the shape everyone knows from a year
  of contributions — weeks across, weekdays down — zoomed out from the single-track grid's
  thumb-sized days and scrolled side to side instead of down. Each track's name and a progress ring
  in its own colour stay pinned at the left while the years slide underneath, which is what makes
  the stack comparable: the same Tuesday is the same column on every row. It opens at the recent
  end, and month names run along the top.

  A single track keeps the vertical grid. Seven columns down the page is the only way a day stays
  big enough to tap, and tapping a day is what a single track's grid is for.

### Changed
- **The day a track began is drawn in white on a dark screen and black on a light one**, never in a
  colour. It was the track's own colour with a ring cut out of it, which is legible until you
  compare it to a day at full strength. The six colours a track may wear deliberately stop short of
  white and black so this mark can never collide with one — that constraint now lives with the list
  itself rather than in whoever remembers it.
- The same mark appears on the year under each track in the switcher, so the beginning of a track
  reads the same wherever it is drawn.
- The colours a track can be moved out of the phone's track screen and into the shared core, where
  the demo tracks and anything else that needs them can reach the one list.

## [0.77.0] - 2026-09-26

### Added
- **A colour per track, and a year of days to show it off.** Every track already carried a `color`
  nobody had chosen and almost nothing drew. It is now asked for when the track is created — six
  swatches beside the name, pre-picked to the first one no other track has taken — and from then on
  it is the track's accent everywhere inside it: buttons, rings, links, the progress grid. Opening a
  track changes the app's accent to it, which is one `setAccent` on the theme rather than a colour
  threaded through every screen.

- **The track list is now a list of years.** Each row carries fifty-three weeks of its own days
  under the name, in the track's own colour, with the live streak beside it — which turns the track
  switcher into the place you go to see which tracks you are actually keeping up. The grid measures
  the card it is in and sizes a day to fit, and always draws the full year with the empty weeks
  padded in at the front, so a three-week-old track and a two-year-old one have days of the same
  size and can be compared at all.

- **All tracks at once, in Progress.** A control beside the year switches the grid between this
  track and every track combined — the one question three separate grids could not answer, which is
  whether *anything* happened yesterday. A combined day is painted in the colour of whichever track
  put the most into it, the key below the graph stops explaining depth and starts naming colours,
  and tapping a day still says what was done, with each item told which track it came from. It only
  appears when there is more than one track to combine.

### Changed
- The consistency grid is drawn in the track's colour instead of a hard-coded green. The day a track
  began used to be painted in the accent, which stopped meaning anything once the scale itself
  became the accent; it is now the full colour with a ring of the page cut out of it.
- Months with nothing in them are no longer drawn. In the year a track began there could be eleven
  of them — a heading over a block of empty squares — between the top of the graph and the first
  real day.

## [0.76.2] - 2026-09-26

### Fixed
- **The two failing Dependabot jobs**, which were the only two high-severity advisories in the phone
  app: `linkify-it` and `markdown-it`, both reached through `react-native-markdown-display`. It pins
  `markdown-it@^10` — six years old, current is 15 — and is itself the latest release, so there was
  no update for Dependabot to make and the jobs failed rather than opening a pull request.

  `overrides` in `mobile/package.json` pull both to patched versions, five majors up. That is a
  jump worth checking rather than assuming, so the renderer was put through headings, emphasis,
  inline code, autolinks, nested and ordered lists, a blockquote exercising the smartquotes rule
  named in one of the advisories, a fenced code block, a table and a rule: all correct, nothing in
  the console. Sixteen moderate advisories remain, all inside Expo's own tree and none with a fix
  available.

  Worth its own sentence: both advisories are quadratic-complexity denial of service on
  attacker-supplied text, and this parser only ever sees the user's own roadmap on the user's own
  phone. The practical exposure was close to nil; the failing jobs and a 2019 parser were the real
  reasons to move.

## [0.76.1] - 2026-09-26

### Fixed
- **Lint, and so CI, failed on the workout tests.** Three bindings declared with `let` were never
  reassigned. Local checks had covered types, tests and the build but not `npm run lint`, which is
  one of the four jobs the pipeline runs — so the merge to `main` went red on something a single
  command would have caught.

## [0.76.0] - 2026-09-25

### Fixed
- **Sync was refusing every payload.** `TrackSchema` was a strict object, and a strict object does
  not ignore a key it has not heard of — it rejects the whole request. `phaseDaysSpent` reached
  phones over the air within minutes of 0.71.0; the server only changes when the site is deployed,
  and `main` sat at 0.57.0. So the field appeared the first time a phase was switched, and from
  then on nothing synced at all: not that track, not any track, not one note.

  Tracks and workspaces now drop fields they do not know instead of refusing them. The field is
  lost until the deploy catches up and nothing else is, and a stripped key never reaches the
  database, which is what the strictness was protecting. The envelope around them stays strict: it
  gains nothing as features are added, so anything unexpected in it is still a reason to stop. The
  rule, and why phones are routinely ahead of the server, is written down in `DEVELOPMENT.md`.

### Added
- **Workouts are named and kept**: a push day, a pull day, each with its own exercises and their
  sets. Opening the screen asks which one; opening one shows it as you left it, weights and all,
  because a workout is a thing you come back to. A refresh button unticks every set and leaves the
  numbers, ready to be done again and beaten.

### Changed
- **The date, sets-done and volume tiles are gone.** They described a session on a day, and what
  this screen is now about is a workout you repeat.
- **One parser for exercises**, shared by dated sessions and named workouts, so the two cannot
  drift — which is exactly how a set's tick came to be dropped on the way back in last version.

### Fixed
- **Two workouts made in the same millisecond shared an id**, and two workouts sharing an id are
  one workout to every lookup and every edit. Ids now carry a random tail as well as the clock.

## [0.75.0] - 2026-09-25

### Added
- **A workout you log set by set.** Each exercise is a table: a row per set carrying what was lifted
  last time, the weight and reps for this one, and a tick. Rows exist before they are done, which is
  the point — you arrive knowing roughly what you are about to do, the rows are there with last
  time's numbers in them, and you tick each one off as you finish it. Add a set, add an exercise,
  or cancel the day. Nothing is joined to the calendar or the week yet; it logs today.
- **`done` on a set**, with the helpers to edit one in place, rename an exercise and clear a day.
  The day's volume counts only what was actually ticked: sets written down but not lifted have not
  moved anything.

### Changed
- **"Gym plan" is "Workout"**, on both the phone and the website.

### Fixed
- **A set's tick would not have survived a reload.** `parseGymLog` rebuilds every set it reads, and
  rebuilt them without the new flag — so the log wrote `done` and read it back as nothing, and a
  session would have come back untouched after every launch. Caught by comparing what was on the
  screen with what was in storage. Sets recorded before the flag existed still carry no flag, and
  still count, rather than being read as "not done" and emptying the history.

## [0.74.2] - 2026-09-25

### Fixed
- **A dropped row could draw one name over another for a frame.** Position came from React —
  `top: index * ROW` — while the stepping-aside came from a shared value, and the two are applied by
  different threads. Dropping changed the order and cleared the shifts in one breath, but React's
  commit could paint first, so for a single frame every row carried its new index and its old shift
  and two of them landed on the same line. Caught it in a screen recording: one frame in twenty-four
  showed "Phases" twice.

  Where a row sits is now a shared value too, written in the same tick as the order and applied on
  the same frame. React's index no longer decides where anything is, so there is no longer a pair of
  halves that can arrive separately — which is what 0.74.1 tried to fix by sequencing them, and
  sequencing across two threads is not something you can be sure of.

## [0.74.1] - 2026-09-25

### Fixed
- **Dropping a row in Arrange made the names flicker.** The shifts holding the list apart were
  released a frame or two before the reorder arrived, so the list returned to the arrangement it had
  started in and then swapped — names appearing to trade places twice for one drag. The row now
  settles into its destination first, and the new order and the release of every value happen in one
  tick, the way the folded column already did it.

## [0.74.0] - 2026-09-25

### Fixed
- **Dragging a row in Arrange left the others where they were.** Holding a panel in the ordinary
  view parts the column around it; the rows behind the Arrange button did not, so there was nothing
  to say where a row was going until it was already there. They now share the same pair of values
  the folded column uses — which row is in the hand, and where it would land — and step aside the
  same way.

### Changed
- **The way into arranging is at the foot of the screen**, under everything it arranges, and says
  what it does: "Arrange & add panels". It was a small button in the bar at the top, which is the
  first thing you reach and the last thing you want. It disappears while a panel is being dragged,
  because arranging is what you are already doing.

### Removed
- **The paragraph at the bottom of My Space**, explaining how to hold a panel and where the order is
  kept. Three lines of instructions under a screen whose gestures people had already found.

## [0.73.3] - 2026-09-25

### Changed
- **Plan ends on the full roadmap, and nothing beside it.** The week and the deliverables have their
  own places to be reached from; a row of somewhere-elses under a heading reading "More on this
  track" was a menu appended to a screen that had already finished saying what it came to say. The
  roadmap earns the spot, because the timeline above it is a summary of it — and it opens exactly as
  it did before.

## [0.73.2] - 2026-09-25

### Changed
- **All three streak figures share one row, icons and all.** Side by side at this width a tile has
  about fifty points left for its name once the icon and the padding have taken theirs, and a word
  in small caps needs more — so `StatTile` gained a stacked arrangement that gives the name the
  tile's whole width. It costs one line, which is cheaper than losing either the icon or the end of
  the word, and the graph gets the other row back.

## [0.73.1] - 2026-09-25

### Changed
- **The longest run and the last thirty days are tiles again**, alongside the current streak and
  drawn the same way. 0.73.0 folded them into a line under the streak to save the graph a row, which
  was a trade nobody asked for. Not three across, though: at this width the small-caps label runs
  out of room long before the figure does, so the run you are on takes the first line and the two
  that put it in context share the second.

## [0.73.0] - 2026-09-25

### Added
- **`StatTile`**, one shape for every figure that leads a screen: a mark on the left — an icon, or a
  ring when the number is a proportion — then the name in small caps, then the figure with its unit
  beside it. These were being rebuilt per screen, and numbers meaning the same kind of thing should
  not be laid out three different ways.
- **Progress opens on the streak**, as the website does: a flame, the run you are on, and the days.
  The longest run and the last thirty days sit under it as context rather than as two tiles of their
  own — the run is the number the screen exists to move, and the other two only say whether it is a
  good one. That also gives the graph back the row they were taking.
- **Time spent and work done share one bar** on Plan, one drawn over the other, so the gap between
  their two ends is the pace without having to be read. The card is now headed like the tiles above
  it rather than opening on a sentence.

## [0.72.0] - 2026-09-25

### Added
- **Two tiles at the top of Plan**, in place of the sentence that used to be there: the timeline as
  a ring with the figure beside it, and the days spent in the current phase — the count 0.71.0
  started keeping, which the phone had nowhere to show.
- **A progress ring drawn without SVG.** `react-native-svg` is not in this build and adding it
  would cost every phone a reinstall rather than an update that arrives on its own, which is a
  steep price for a circle. It is two half-rings instead, each clipped to its own side of the box
  and rotated, with the left one parked inside the right one's window until the sweep reaches it.

### Changed
- **The timeline stops being stated twice.** The headline, the subtitle and the bar under them all
  described the same proportion the ring now draws; past the end of a plan the tile says the days
  and the line beneath it says by how much the plan was overrun.

## [0.71.0] - 2026-09-25

A phase's day count was the time since you last entered it, not the time spent in it. Looking at
phase two and coming back turned fifty days in phase one into day one.

### Added
- **`phaseDaysSpent` on a track**: whole days already spent in each phase, banked when the phase is
  left, so returning to one resumes rather than restarts. The day of a switch belongs to the phase
  being *entered*, which is what keeps the sum honest — every calendar day counts for exactly one
  phase, and leaving and returning on the same day cannot count it twice.
- **The field is in the sync schema**, with a test that a track carrying it survives the round trip.
  The schema is strict, so a field missing from it is a field the server quietly refuses — which is
  how a real track once got locked out of syncing.

### Fixed
- **Removing the phase you are standing on no longer credits the next one with your time.** It
  changed which phase was current and left the start date alone, so the phase you landed on
  inherited however long you had spent in the one you deleted. It now starts a fresh stretch, and
  the removed phase's banked days go with it.
- **The website's Phase Day tile computed its own answer**, separately from the detail panel behind
  it, which already asked `phaseStats`. Both now ask the same function, so they cannot disagree.

Existing tracks carry no banked days, so nothing changes for them until the next time a phase is
switched. No migration is needed.

## [0.70.3] - 2026-09-25

### Fixed
- **The step counter sometimes opened on a black screen and stayed there.** Every Health Connect
  call was already wrapped in a `try`, which covers one that fails and does nothing at all for one
  that never answers — and that is the one that happened. Health Connect is a separate app replying
  over a binder; while it is updating, or before its process is up, `initialize()` can sit there
  indefinitely. The screen waited for it before drawing anything, so the result was a spinner with
  no end, and unpredictable because it depended on what the provider happened to be doing. Going
  back and in again started a fresh call, which is why a second try often worked.

  Not answering within four seconds is now itself an answer, for every entry point, and the
  fallback that already exists for when Health Connect says no covers the case. The screen also
  stops treating those numbers as a condition of appearing at all: it draws from the app's own step
  table whatever the provider does, and arrives even if nothing can be read.

## [0.70.2] - 2026-09-25

### Fixed
- **Scrolling My Space to the bottom still landed on Progress.** 0.70.1 assumed the stray press was
  a finger stopping a coasting list, and guarded it with the scroll view's own start and end
  callbacks. The real case was simpler and earlier: a finger dragging the column, reaching the end
  of it, and lifting. The list had stopped moving because there was nowhere left to go, and a press
  that goes down and comes up on a card is a press as far as anything counting touches can tell.

  A panel is no longer a button at all. Opening one is a `Gesture.Tap` with a distance limit,
  composed with the drag that picks it up, so a touch has to prove it stayed still to count as a
  press — a finger that travelled the length of the screen is not pressing what it happens to end
  on. Screen readers keep their way in through `onAccessibilityTap`, which is not a touch and so
  has nothing to be confused with. The scroll-state guard stays as well: it still covers the case
  0.70.1 was aimed at.

## [0.70.1] - 2026-09-25

### Fixed
- **Scrolling My Space quickly could land you on Progress.** A finger put down on a coasting list is
  there to stop it, not to press what happens to be under it — but it arrives as a press and leaves
  as one, and nothing in the touch itself says otherwise. Since 0.64.0 made the whole card the way
  into a panel, the target went from a 50pt header to the size of the screen, so a scroll stopped
  over the consistency panel opened the screen behind it. That screen is Progress, which is a tab,
  so it read as the app changing tabs by itself.

  A panel now opens through a callback rather than a `Link`, so the screen can decline it: it
  ignores the press while the column is moving, and for a moment after it stops, because the last
  frame of a scroll and the first of a tap are the same frame.

## [0.70.0] - 2026-09-25

### Changed
- **One type scale, across the whole phone app.** There were sixteen distinct font sizes — 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 30, 72 — each chosen where it was written. Seven
  of them were heading-ish numbers doing what turned out to be three jobs, and three adjacent sizes
  carried most of the body text between them. Sizes picked one at a time cannot help but disagree,
  and text that disagrees with itself by a point here and there reads as approximate however
  carefully each screen was made. All 235 declarations now name a role from `TYPE` in
  `mobile/src/theme.ts`, and there is no `fontSize:` literal left outside it.
- **The consistency grid's smallest labels went from 9pt to 11pt**, which is the smallest size in
  the scale, and still fits the columns they sit under.

### Fixed
- **The Phases panel said "Day 573 of 92" too.** 0.68.0 fixed the Plan screen and left the panel
  showing the same fact the old way.

## [0.69.0] - 2026-09-25

### Changed
- **Today leads with the date and what kind of day it is.** It used to read "Today · Fri" — naming
  the one day that needs no naming, on the one line that could have carried its date. It now says
  the date and the day's kind, taken from the track's own rhythm, so this screen and the week agree
  about what a Friday is for without being told twice.
- **A heading with nothing under it is not drawn.** Today rendered FOCUS and REVISION over empty
  space on any day with nothing planned. They stay while the day is being edited, because then they
  are the thing you are adding into.
- **Empty screens offer the way in instead of describing the emptiness.** "No materials on this
  track yet" beside an Edit button is a dead end: the screen states a fact and leaves you to work
  out that the toolbar holds the remedy. Today, Materials and Deliverables now name what is missing
  and offer the button that fixes it, through one shared `EmptyState`.
- **Screens stop announcing themselves twice.** Materials and Deliverables repeated their own name
  under the bar that already said it; they now say how many there are. The gym screen's heading is
  the date rather than a second "Gym plan".
- **Settings rows that go somewhere look like it.** Account, Privacy and Security carry a chevron;
  This device and Backup, which only state something, do not. They were indistinguishable.

## [0.68.0] - 2026-09-25

A plan running past its estimate is the ordinary end of a plan, not a failure of one — and the app
treated it as a failure. A 92-day plan a year and a half old read "Day 573 of 92" over a bar pinned
at full, "100 points behind the calendar", and four phases each "Ending" on a date long gone. The
screen meant to tell you where you are said only that you were late.

### Added
- **`overrunDays` on `timelineStats`**, with tests: how far past the planned total a track is, or
  zero while it is still inside it. One number, computed once, so both platforms say the same thing
  about the same track.
- **A way out.** Past the end of its plan the summary offers Extend, which opens the track's own
  settings where the end date is set.

### Changed
- **Past its last day a track is no longer measured against a total it has outlived.** It reads
  "Day 573" and "481 days past the plan" instead of "Day 573 of 92"; the bar fills but turns grey,
  because a bar at its end should not look like a bar at its goal.
- **Two comparisons stop being made once there is nothing left to compare against**: the pace line
  ("N points behind the calendar") and the phase-behind banner. Both measure work against remaining
  time, and there is none.
- **Phase deadlines read "Due" rather than "Ends"**, which is correct whether the date is ahead or
  behind.
- **The website no longer prints "573 / 92 days"** in its day counter either. Its bars were already
  clamped; the number beside them was not.

## [0.67.0] - 2026-09-25

### Fixed
- **The graph ran two directions at once.** Days inside a row went forward in time, while the rows
  themselves went backward — so the day after the last one in a month was not the day under it, it
  was thirty days above it in the block below. Both shapes now run oldest at the top, and the graph
  opens scrolled to its recent end, which is where the month you are in now lives.

### Changed
- **The key and the way through to History share one line at the foot of the screen.** They were
  three stacked rows — a key, a heading reading "More on this track", and a chip repeating the word
  under it — which put more furniture below the graph than the graph had room to spare. History is
  now an icon at the end of the key's own row, and the key is the last thing before the tab bar.

## [0.66.1] - 2026-09-25

### Added
- **The day a track started has a colour of its own**, in both shapes, with a "started" swatch in
  the key. The green scale answers "how much", and the first day is not a quantity — it is the edge
  of the data, and worth being able to find. Everything before it was already left blank in both
  shapes, because the track did not exist to be missed; now the boundary is marked rather than
  merely implied.

### Removed
- **The note under the consistency key.** Three lines explaining what counts as a day, on a screen
  whose whole subject is which days counted. The graph gets the height back.

## [0.66.0] - 2026-09-25

### Changed
- **Progress shows a year at a time, and only the graph scrolls.** The numbers, the shape switch,
  the year, the key and the note all hold their place; the graph is the one thing that moves. The
  whole page used to scroll, so the three numbers you were comparing a month against slid off the
  top the moment you went looking for the month.
- **The grid is a calendar year rather than the track's whole life.** It used to run from the start
  date to today, growing as the track did, which left nothing fixed to navigate. A year is a shape
  you can hold in your head — and the current year stops at today, because reading newest-first an
  uncapped year opens on three months of blank December.
- **The weekday header sits outside the scroller**, so which column a cell is under stays readable
  wherever the graph has been scrolled to.

### Added
- **A year to step through**, either side of the year itself. The arrows stop at the ends rather
  than disappearing — a track cannot have a 2019 and the control should not pretend otherwise — and
  changing the year, or the shape, starts at the top of it rather than at whatever offset the last
  one was left at.

### Fixed
- **`SubNav` was claiming a couple of hundred points of height.** It is a sideways scroll view, and
  a scroll view takes all the room it is offered — so on a screen that does not scroll itself, one
  row of chips was starving the graph beside it of more than half its space.

## [0.65.0] - 2026-09-25

Two different jobs were being drawn the same way. Switching which view you are looking at, and going
to another screen, were both a row of identical outlined pills — so a set of links read as a set of
options where one ought to be on, and a view switch read as two buttons rather than one setting.

### Added
- **A segmented control**, for "which of these am I looking at": one track with a filled thumb that
  slides between positions. The selected option used to be told apart by a border colour, which is
  the weakest signal available and reads as decoration rather than state. The thumb is sprung rather
  than timed — a spring overshoots slightly and settles, which is what makes a small movement read
  as a physical one — and the labels hand their colour over as it passes under them, so the
  selection looks carried rather than reassigned. It is in Progress (by month / continuous) and in
  the week calendar (week / month).

### Changed
- **The consistency grid is centred.** It is a fixed width on purpose — cells stretched to fill a
  phone are big enough to hold a number and leave a handful of weeks on screen, which is the
  opposite of what the grid is for — but a fixed width left at `flex-start` is a grid pushed into
  the left third of the screen with nothing beside it. The month labels down the side now hang into
  the margin instead of taking a column of their own, because a gutter counted into the width
  pushes the columns off-centre by half of itself, and in the month layout nothing is written in it.
- **Changing view fades the new one in** rather than swapping it between frames. Only the container
  animates: the grid below it is a couple of hundred cells, and fading each of them would cost far
  more than the effect is worth.
- **The links to a tab's siblings carry the icon of where they go and a chevron saying they go
  anywhere at all**, and give slightly under the thumb before springing back. They are places, not
  options, and they no longer look like the thing that switches views.

## [0.64.0] - 2026-09-25

### Changed
- **A tap anywhere on a panel opens it**, not just on its heading. A panel reads as one thing — a
  title and the figures under it — so having only the top strip respond meant aiming at a target
  you cannot see, and the rest of the card reading as inert when it is the part you were looking
  at. Holding anywhere still picks the panel up: the drag only activates once the finger has been
  still a moment, so a tap never reaches it and a hold never becomes a tap.
- **The step counter's permission prompt is a Gesture Handler button**, so it still wins against
  the card around it now that the whole card is tappable. It is the only control that lives inside
  a panel's body.

### Fixed
- **A panel could be left permanently unable to fold.** Each one rendered plainly until its height
  had been measured and only then gained the wrapper that folds it — so a panel whose layout event
  did not arrive a second time stayed in that first branch for good: visible, correct, and inert
  under a hold. The wrapper is now always there, constraining with `maxHeight` rather than `height`,
  which leaves an unmeasured panel simply unconstrained instead of wrong. One render path, nothing
  to get stuck in.

## [0.63.5] - 2026-09-25

### Fixed
- **Picking up a panel after scrolling put it back out of reach of the finger.** The column gets
  shorter as it folds, and a ScrollView whose content shrinks pulls its offset back to the new
  bottom — dragging the whole column up out from under the thumb. At the top of the page there is no
  offset to pull back, which is exactly why this only showed up once the page had been scrolled.

  The column is now pinned to the height it had when the panel was picked up, measured at that
  moment, so the page keeps its length for the whole gesture and the scroll position has no reason
  to move. Tested pinned to the very bottom of the page: the scroll offset does not shift, the held
  panel moves 3px, and its neighbours sit at exactly one slot's distance.

### Removed
- **The spacer that used to make up the lost height**, along with the two shared values that fed it.
  It added up every panel's stored height to work out what the fold would cost — the same
  reconstruct-the-layout-in-arithmetic approach, and the same fragility, that 0.63.1 removed from
  the drag offset. One measurement replaces all of it.

## [0.63.4] - 2026-09-25

### Fixed
- **Releasing a panel sent the whole column to the top of the page before it opened back up.** The
  column's offset while folded is `columnShift x collapse`, and the release was zeroing the shift
  outright while animating only the collapse. Zeroing it moves the column back to the top of the
  page in a single frame, so what played was: everything jumps up there, then grows downwards. The
  fold as a cut rather than in reverse.

  The shift is now left where it is and `collapse` falls to zero on its own, which unwinds the
  offset along the path it came in on: the panel just dropped holds its place and the others open
  outward from it, the mirror of them closing in. Nothing needs resetting, because at rest the
  collapse is zero and the offset is zero whatever the shift holds — and the next pick-up recomputes
  it from scratch.
- **A panel dropped exactly where it was picked up waited on an animation with nowhere to go.** The
  release settles the panel into its slot first, and when that slot is the one it is already in, it
  was handing `withTiming` a value it already held and waiting for the callback. It now finishes
  straight away.

## [0.63.3] - 2026-09-25

### Changed
- **The footnote fades out while a panel is held.** The column now folds around the thumb, which
  means it can fold straight over the paragraph explaining how to hold a panel — advice that is of
  no use to someone already doing it. Only panels are in the way now, and it comes back on release.

## [0.63.2] - 2026-09-25

### Fixed
- **The column folded up at the top of the page while the held panel stayed at the thumb**, so the
  gap the panel would drop into opened somewhere else entirely — most of a screen above where you
  were pointing. 0.63.1 fixed where the held panel *looked*, and in doing so separated it from the
  column it belongs to.

  The fold now happens around the held panel instead of at the top of the page: the whole column
  moves so that the held panel's folded slot lands exactly where that panel already is, and the
  others stack up and down from there. Measured while holding the seventh of eight panels: it moves
  3px, every neighbour sits at exactly one slot's distance, and the column arranges itself around it
  rather than collapsing away from it.

## [0.63.1] - 2026-09-25

### Fixed
- **A picked-up panel jumped upward as the others folded**, instead of staying under the finger. It
  could still be dragged and dropped from there, but the panel you were holding was no longer the
  one you were touching — which is the one thing the fold exists to preserve.

  The offset that keeps the held panel under the finger was worked out by adding up the heights of
  every panel above it and subtracting where its folded slot would be. That reproduces Yoga's layout
  in arithmetic, and it has to be exactly right: every gap, every bit of padding, and every height
  arriving from a shared value that the UI thread may not have received yet. It now asks the column
  where it actually is, with Reanimated's `measure`, and works from the finger's real screen
  position. Measured over the whole column: a panel seventh in the list now moves 3px as everything
  around it folds, where the arithmetic put it several hundred pixels away.

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
