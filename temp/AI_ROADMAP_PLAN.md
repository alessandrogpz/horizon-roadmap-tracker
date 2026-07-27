# AI Roadmap Generator — Implementation Plan

**Branch:** `feature/ai-roadmap-generator` (already created, branched from `development`)
**Status:** Stages 0–2 implemented and shipped in v0.14.0. Stage 3 outstanding, Stage 4 cut.
**Written:** 2026-07-27
**Revised:** 2026-07-27 — after the Stage −1 screening, then again after implementation.

> This document is deliberately self-contained. It assumes the reader has no
> prior conversation context and has not yet read the codebase. Every file path
> and type named here was verified against the repo at the time of writing.

> **The Stage −1 screening has been run. Stage 4 (on-device WebLLM) is CUT.**
> Small open-weights models could not produce keepable roadmaps, and failed to
> terminate on roughly a quarter of generations. Full evidence in §4 Stage −1;
> the cut itself is §4 Stage 4. The shipping scope is now **Stages 0–3**:
> BYO-key as the default path, Chrome's built-in model where it exists.
>
> Do not re-derive this from `temp/AI_MODEL_EVAL.md` — that document describes
> how to run the experiment and records predictions made *before* it ran, several
> of which were wrong. This plan holds the outcome.

---

## 1. Goal

Let a user describe a goal in natural language — *"Learn Vulkan, C++ memory
management, and graphics rendering in 3 months"* — and have Horizon generate a
complete, editable starting roadmap: phases, a weekly rhythm, and a roadmap
outline.

**Hard constraint from the product owner:** no Horizon-operated AI backend. No
subscription, no API keys held by us, no abuse-prevention burden, no inference
bill. Every inference path must be either on the user's own hardware or paid for
with the user's own API key.

---

## 2. Existing architecture (what you are integrating into)

Horizon is a local-first Next.js 16 / React 19 app. State lives in IndexedDB via
Dexie and is mirrored to the user's Google Drive as `database.json`. There is no
application server — `app/api/*` routes exist only for local dev conveniences
(git stats, opening files, notes).

### The data model — `lib/types.ts`

The top-level record is `Workspace`, which holds many independent `TrackState`s
(roadmaps) side by side:

```
Workspace { activeTrackId, tracks: Record<TrackId, TrackState>, schemaVersion?, ...sync bookkeeping }
TrackState extends AppState { meta: TrackMeta, rotations?, roadmapContent?, panelColumns?, hiddenPanels? }
```

`TrackState` is large (~30 fields) and most of it is **bookkeeping the AI must
never touch**: `streakHistory`, `weeklyCompletions`, `completedItemsHistory`,
`itemUpdatedAt`, `historyUpdatedAt`, `lastTasksResetDate`, `configVersion`,
`isSynced`, plus four `@deprecated` legacy fields kept only so old records
round-trip. Several of these drive the Drive last-write-wins merge in
`lib/merge.ts`. Generating them is both pointless and dangerous.

Relevant sub-types:

- `Phase { id: number, title, description, tasks: TaskItem[], detailedInfo: PhaseDetailedInfo, recommendedByDay?: number }`
- `TaskItem { id: string, title, completed: boolean }`
- `PhaseDetailedInfo { focus, deliverable, math, algoDS? }` — each field is
  `PhaseDetailItem[] | string`, where `PhaseDetailItem = { item, desc }`.
  Note `math` is **required by the type** but may be `""`; `algoDS` is optional.
- `Material { id, title, category, type, status, currentPage, totalPages, currentSubject, link, localPath?, repoUrl?, updatedAt? }`
- `WeekDay { name: "Mon".."Sun", type: string, label: string }` — exactly 7.
- `FocusType { label, color }`, keyed by the `type` strings used in `weekSchedule`.

### Track creation path — the seam to hook into

`lib/templates/index.ts`:

```ts
export interface SeedAnswers {
  name: string;
  color: string;
  startDate: string;          // YYYY-MM-DD
  phases: Phase[];
  weekSchedule: WeekDay[];
  focusTypes: Record<string, FocusType>;
  materials?: Omit<Material, "id">[];
  portfolio?: Omit<PortfolioProject, "id">[];
  rotations?: Omit<RotationDef, "id">[];   // added in v0.14.0
  roadmapContent?: string;
}

export function seedTrackFromTemplate(template: TrackTemplate, answers: SeedAnswers): TrackState
```

`seedTrackFromTemplate` (line ~53) assigns IDs to materials/portfolio, generates
the track ID, and fills in every bookkeeping field with correct empty values.
**This is the only correct way to build a new track.**

Persistence: `createTrack(track: TrackState)` in `lib/workspaceRepo.ts:207`.

### The onboarding wizard — `app/onboarding/page.tsx` (297 lines)

Already a complete multi-step flow. It holds a local `WizardDraft`:

```ts
interface WizardDraft {
  templateId: string;
  name: string;
  color: string;
  startDate: string;
  durationDays: number;
  phases: Phase[];
  weekSchedule: WeekDay[];
  focusTypes: Record<string, FocusType>;
  materials: Omit<Material, "id">[];
  portfolio: Omit<PortfolioProject, "id">[];    // added in v0.14.0
  rotations: Omit<RotationDef, "id">[];         // added in v0.14.0
  roadmapContent: string;
}
```

Steps: `["Template", "Identity", "Horizon", "Phases", "Roadmap", "Rhythm", "Materials"]`.
Step components live in `components/onboarding/` — `TemplatePicker`,
`TrackIdentityStep`, `HorizonStep`, `PhaseReviewStep`, `RoadmapStep`,
`RhythmStep`, `MaterialsSeedStep`, plus `WizardStepper` and
`ConnectExistingAccount`.

`handleFinish()` (line ~82) maps the draft into `SeedAnswers`, calls
`seedTrackFromTemplate`, then `createTrack`, then routes to `/`.

The route is reached at `/onboarding` on first run, and at
`/onboarding?mode=add` to add a track to an existing workspace (this skips the
"connect an existing account" entry choice).

### Templates — `lib/templates/`

`TEMPLATES` is a `Record<string, TrackTemplate>` containing `learning`,
`fitness`, `work`, `custom`. A `TrackTemplate` is:

```ts
{ id, label, description, defaultColor, defaultDurationDays,
  buildPhases(durationDays): Phase[],
  defaultWeekSchedule, defaultFocusTypes, defaultMaterials?, defaultPortfolio? }
```

Templates are **seed data only** — `templateId` is stored on the resulting track
purely as provenance and never gates editability. See the doc comment in
`lib/templates/types.ts`.

### Local settings — `lib/settings.ts`

`AppSettings` is persisted to **`localStorage`** under `horizon-settings`
(key constant `STORAGE_KEY`), read through `getSettings()` / `updateSettings()`,
with a `SETTINGS_EVENT` change notification and the `useAppSettings()` hook in
`lib/useAppSettings.ts`. **Critically: this is device-local and is NOT synced to
Google Drive.** That makes it the correct home for an AI provider config.

---

## 3. Design decisions (and why)

These supersede an earlier draft plan that proposed WebLLM-first, prompt-only
JSON, and writing directly into app state. Each decision below exists because
the earlier approach had a concrete failure mode.

### D1 — BYO-key cloud is the ONLY path; on-device is cut

> **Revised after Stage −1.** This decision originally read "BYO-key is the
> default, on-device is opt-in." The screening removed the on-device option
> altogether — not on distribution grounds but on quality and termination
> grounds. See §4 Stage −1. The device-reach argument below still stands and is
> kept because it explains why on-device was demoted from primary *before* the
> quality evidence arrived; the quality evidence then removed it entirely.

The earlier plan made a ~750 MB WebGPU download the primary experience. That
does not work for most of the audience:

- **iOS/iPadOS:** WebGPU only became usable in Safari 26. Worse, iOS caps
  per-origin storage and *evicts* it under pressure — a ~1 GB `CacheStorage`
  entry is precisely what gets reclaimed, so users would re-download repeatedly.
  There is also **no native wrapper in this repo** (no Capacitor / Tauri /
  Electron), so "download from the App Store" is not currently a thing that
  exists.
- **Android:** Chrome has WebGPU, but a 1.5B q4f16 model on a mid-range phone
  will OOM or crawl, and `shader-f16` support is inconsistent across Android GPUs.
- **Desktop Chrome/Edge:** works well.

So on-device realistically covers desktop Chromium and high-end Android — a
minority of a productivity app's users. It is a great *privacy/offline* feature
and a bad *default*.

BYO-key (Google Gemini free tier, or OpenRouter) is 0 MB, works on every device
including iOS, produces markedly better output, and satisfies the "no backend,
no bill, no abuse surface" constraint completely. It is also the mainstream
indie-app solution to this exact problem.

### D2 — Prefer the browser's built-in model when it exists

Chrome ships Gemini Nano behind the built-in **Prompt API** (`LanguageModel`
global). Where available it means **zero download for us and zero cost for the
user**, with Chrome managing storage and model updates. Feature-detect it and
prefer it over a keyed provider *when it is good enough* — see the caveat below.
Treat availability as genuinely uncertain — it is still
stabilising, gated by flags/origin trial on some channels, and the surface has
been renamed more than once. Detect at runtime, never assume.

The provider ladder, in preference order:

1. **Built-in** (`LanguageModel` present and available) — free, no download.
2. **BYO key** (Gemini / OpenRouter) — free tier, works everywhere, best quality.

There is no third rung. WebLLM on-device was cut after Stage −1.

> **Caveat carried forward to Stage 3.** Chrome's built-in model is Gemini Nano
> — a small on-device model in the same class as the ones that failed Stage −1.
> The screening tested Qwen2.5 via Ollama, not Nano, so its result does not
> transfer directly. But it is now a live risk that Stage 3 inherits rather than
> a free win. **Stage 3 must re-run the same eval prompts against the built-in
> provider before it ships**, and must be prepared to offer built-in only for
> Stage 1's low-risk `roadmapContent` drafting while routing full structured
> generation to BYO-key. Do not assume Nano clears the bar the others missed.

### D3 — The AI's output target is `WizardDraft`, not `AppState`

The earlier plan targeted `updateAppState()` in `lib/api.ts`. **Neither exists
in this repo** — that was invented. The real seam is the wizard draft.

Have the model produce a `Partial<WizardDraft>` (really: name, color,
durationDays, phases, weekSchedule, focusTypes, roadmapContent). This is:

- ~6 fields instead of ~30;
- entirely user-facing content, no bookkeeping;
- already routed through `seedTrackFromTemplate`, which fills the rest correctly;
- already rendered by review UI that exists (`PhaseReviewStep`, `RhythmStep`,
  `RoadmapStep`, `MaterialsSeedStep`).

### D4 — It's a template + a prefill, not a new modal

Rather than build a bespoke "AI Assistant Modal" with its own preview pane and
its own apply-to-workspace logic, add an **AI entry point on the wizard's
Template step**. The user types their goal, generation runs, the resulting draft
replaces `draft` state, and they land on `PhaseReviewStep` with everything
pre-filled and fully editable.

Two large wins:

- Far less new UI. The review/edit surface already exists and already writes
  back into the draft correctly.
- **Human-in-the-loop review is what makes a small model's mediocre output
  acceptable** instead of embarrassing. Nothing is persisted until the user
  clicks "Create Track" on the last step, exactly as today.

### D5 — Never overwrite an existing workspace or track

The earlier plan said "merges or overwrites current workspace data." Do not.
Horizon syncs to Drive with per-item last-write-wins merging (`lib/merge.ts`);
a bad overwrite propagates to every one of the user's devices. AI generation
**only ever creates a new track**, via the wizard, via `createTrack`. If the
user dislikes the result they delete the track.

### D6 — Constrained decoding, not "please return only JSON"

Prompt-only JSON instructions fail regularly on 1–3B models. Use real
constraints:

- **Gemini** supports `responseMimeType: "application/json"` plus
  `responseSchema`.
- **OpenRouter** exposes structured outputs on models that support it.
- **Chrome built-in Prompt API** accepts a JSON-schema response constraint.

Validate anyway — see §6. Constrained decoding guarantees *shape*, never
*sanity*.

> **Stage −1 demonstrated exactly how far apart those are.** Every generation
> was grammar-constrained, so schema validity was near-total — and 1.5B still
> returned `durationDays: 8` for an eight-*week* goal, phases with no tasks, and
> a week whose day names were phase titles. A grammar also cannot make a model
> *stop*: unbounded array repetition is schema-valid, which is precisely how two
> runs reached 40k and 81k tokens (D12). Constrained decoding is a floor, not a
> guarantee.

### D7 — Multi-turn, not one shot

Small models degrade sharply with output length. Generate in stages:

1. Track identity + horizon + phase skeleton (titles, descriptions, `recommendedByDay`).
2. Per phase: tasks + `detailedInfo`. One call per phase, small output each.
3. Weekly rhythm (`weekSchedule` + `focusTypes`).
4. `roadmapContent` markdown (optional, from the already-generated structure).

Three-to-six short generations beat one 2000-token generation by a wide margin,
and the stages give you a natural progress UI and per-stage retry.

### D8 — Do not let the AI invent study materials with links

> **Resolved in implementation: the second option was taken, not the first.**
> v1 *does* generate materials. `link` is never generated and is forced to `""`
> by the validator unconditionally — not as a repair, as a hard rule — and the
> Materials step carries an explicit "AI-suggested and unverified" warning.
> `category` and `type` are constrained to the exact vocabularies
> `MaterialsTracker` offers, so generation cannot produce a value the UI won't
> let the user edit back.
>
> The same reasoning extends to `portfolio`: titles only, no `repoUrl`, no
> `localPath`. The rule is not "no materials", it is **no generated addresses**.

A small model will confidently produce plausible book titles, page counts, and
**dead or fabricated URLs**. Nothing destroys trust in a new feature faster than
a generated curriculum citing a book that does not exist.

Either omit `materials` from generation entirely (recommended for v1), or emit
them with `link: ""` and a visible "AI-suggested, unverified" affordance in
`MaterialsSeedStep`. Never generate `link`.

### D9 — Assign all IDs ourselves

`Phase.id` is a `number`, `TaskItem.id` is a `string`. Models drift on both and
produce duplicates. Strip whatever the model emits and renumber in the
validator: phases `1..n` in order, tasks `p{phaseId}_t{n}`. Never trust
model-generated identifiers for uniqueness.

### D10 — The prompt must not assume a programming curriculum

`PhaseDetailedInfo.math` is required by the type but is meaningless for a
fitness or work track. Pass the chosen base template into the prompt as context
and let non-technical tracks emit `math: ""` and omit `algoDS`. The generated
`focusTypes` must be consistent with the `type` strings used in `weekSchedule`
— validate this relationship explicitly.

> **Revised after Stage −1: the instruction over-corrected.** The screening
> prompt said `math` "applies only if the goal genuinely involves mathematics —
> otherwise return an empty array." Every model at every size returned `math`
> empty on **every** prompt — including `vulkan`, where linear algebra and
> projection maths are exactly what the field is for. The negative case was
> stated so firmly that the positive case never fired.
>
> When this moves to `lib/ai/prompts.ts`, state the positive case explicitly and
> give an example of a goal that *should* populate `math`. D10's intent was
> "don't force maths onto a fitness track," not "never emit maths."

### D11 — The API key goes in `localStorage`, never in the workspace

Store provider config via `lib/settings.ts` (`localStorage`, device-local).
**Never** put a key on `Workspace` or `TrackState` — those serialise to
`database.json` in the user's Google Drive. Also: never log the key, and never
send it anywhere but the provider's own endpoint. Make the "this key is stored
on this device only and is sent only to <provider>" statement visible in the UI.

### D12 — Every generation call needs a token cap and a wall-clock timeout

**New, from Stage −1.** The screening harness originally sent no `num_predict`
and no request timeout. Two generations ran away — one to 40,000 tokens, one to
**81,275** — repeatedly context-shifting rather than ever emitting a stop token.
The grammar permits unbounded array repetition, so a model that fails to stop
simply appends forever. The job never finished; it had to be killed.

With a cap in place the true rate was measurable: **23% of 1.5B generations and
13% of 3B generations never stopped on their own.**

This is not an on-device-only concern, and it does not disappear now that Stage 4
is cut:

- **BYO-key providers bill by token.** An uncapped runaway on a user's own
  Gemini or OpenRouter key spends *their* money. Silently. That is a far worse
  trust failure than a mediocre roadmap.
- **Chrome built-in is a small model** — the exact class that exhibited this.

So: `maxOutputTokens` (or each provider's equivalent) on every request, plus an
`AbortSignal` on a wall-clock timeout, plus treating a truncation-stop as a
**failure with a retry offer** rather than parsing the partial JSON. Cap at
roughly 1.5× the largest legitimate output observed — real roadmaps ran
1,300–2,200 tokens, so ~3,000 is the right order.

One operational note worth knowing: **killing the client does not stop the
server.** After the harness process was killed, Ollama kept generating for
another ~90 seconds. Whatever cancellation the UI offers, verify it actually
stops the billed work rather than just hiding it.

### D12b — The screening's *numbers* do not transfer to a hosted provider

**New, learned the expensive way during implementation.** Stage −1 answered the
on-device question correctly. But three separate values derived from it were
carried into the BYO-key provider unexamined, and every one of them was wrong
for a hosted frontier model. Each cost a failed user-facing attempt:

1. **Model ids rot.** `gemini-2.0-flash` was hardcoded from training-data
   memory. It had lost its free-tier quota, which surfaces as **HTTP 429** —
   indistinguishable from real rate limiting, on a four-request-old key. The
   replacement, `gemini-2.5-flash`, had been withdrawn from new users entirely.
   Fixed by defaulting to the `gemini-flash-latest` alias, retiring known-dead
   ids on read in `normalize()`, and adding a "Check key" action that lists what
   the key can actually reach.
2. **Token accounting differs.** The 3,000-token cap was measured against
   non-thinking Ollama models. Gemini 2.5+ think by default and bill thinking
   against `maxOutputTokens`, so the cap was consumed by reasoning and returned
   `MAX_TOKENS` with an empty body — deterministically, at every goal length.
   Fixed with an explicit `thinkingBudget` added *on top* of the caller's output
   allowance, so "3000" still means room for the answer.
3. **Output size.** 3,000 tokens described a roadmap of phases and a week. Once
   materials, portfolio, rotations and `algoDS` were added it needed ~8,000.

**The transferable lesson:** the screening was a *model-quality* experiment, not
a *provider-integration* one. Anything it produced that looks like a number —
model ids, token budgets, output sizes, latency — must be re-derived per
provider. What genuinely transferred was the qualitative work: the system
prompt, the schema shape, and the catalogue of failure modes behind the
validator.

**Corollary for error handling:** never diagnose a provider failure from its
status code alone. The original implementation discarded the response body and
guessed, which produced confidently wrong advice ("wait a minute and try again"
for a model that had no quota at all, "API key rejected" for a malformed
request). Read the body; show the provider's own words.

### D13 — Do not let a small model author `weekSchedule` freehand

**New, from Stage −1.** `weekSchedule` was the single worst-performing field at
every size, and it failed in a way no validator can repair, because there is no
signal to repair *from*:

- 1.5B put **phase names in the day slots** — `"Beginner Phase: HTML, CSS,
  JavaScript Basics"` as a weekday name.
- 1.5B echoed the **schema's own field names** back as day types: a seven-day
  week of `focus` / `deliverable`.
- 3B produced **degenerate weeks** — all seven days identical (`focus`, or
  `Study and Practice`), which is structurally valid and completely useless.
- Even 7B, which passed everything, invented a **different type vocabulary every
  single run** (`Learning/Coding/Review/Practical` → `coding/theory/testing` →
  `walk/run/stretch/long_run`).

Two consequences:

1. **The wizard can never assume a fixed type vocabulary or map types to preset
   colours.** Whatever ships must handle arbitrary strings, or constrain them.
2. **Prefer a constrained choice over free generation.** Have the model pick a
   rhythm *pattern* from a small enumerated set, or assign each day one of a
   fixed set of type keys supplied in the prompt — then derive `focusTypes` from
   that set locally. This eliminates the entire orphan-reference problem in §6
   check 5 rather than repairing it, and it is the single highest-leverage
   schema change available.

Falling back wholesale to the base template's `defaultWeekSchedule` is an
acceptable v1 shortcut, and honestly loses little: on this evidence the model
was contributing noise, not a rhythm.

---

## 4. Staged delivery

Each stage is independently shippable and independently useful. Ship them as
separate commits (see §8 on versioning).

### Where this stands

| Stage | Status |
|---|---|
| **−1** Model screening | ✅ Done — 2026-07-27. Result below. |
| **0** Provider abstraction | ✅ Done. `lib/ai/{types,provider}.ts`, `providers/{gemini,openrouter}.ts`. |
| **1** `roadmapContent` only | ✅ Done. "Draft this for me" on `RoadmapStep`. |
| **2** BYO-key structured generation | ✅ Done, and verified end to end against Gemini. |
| **3** Chrome built-in provider | ⬜ Not started. Carries an eval obligation (D2). |
| **4** WebLLM on-device | ❌ **Cut.** See below. |

Stages 0–2 shipped in **v0.14.0**, and generate more than the plan originally
scoped: materials, portfolio, rotations and `algoDS` as well as phases, tasks
and the weekly rhythm. See the note in §10 for which non-goals were lifted and
why, and **D12b** for the three assumptions that did not survive contact with a
hosted provider.

**Remaining work, roughly in order:**

1. **Stage 3** — Chrome's built-in Prompt API, gated on it passing the same eval
   (D2). The provider interface is ready for it: implement `AIProvider`,
   optionally `listModels`, and it appears in settings with no UI changes.
2. **Multi-turn generation (D7)** — still unimplemented. One 8,000-token call
   works on a frontier model, but a failure loses everything and costs a whole
   request. Revisit if truncation reappears.
3. **Ollama is gone from the dev machine** (removed 2026-07-27, once on-device
   was cut). Re-running `temp/ai-eval/run-eval.mjs` now means reinstalling it.
   Nothing in the shipped feature depends on it.

### Stage −1 — Model screening (no code) — ✅ **DONE, 2026-07-27**

Procedure in `temp/AI_MODEL_EVAL.md`; harness in `temp/ai-eval/run-eval.mjs`.
Qwen2.5 at 1.5B / 3B / 7B (all `q4_K_M`) via local Ollama, constrained by the
candidate schema. 1.5B and 3B: 6 prompts × 5 runs each. 7B: 3 prompts × 3 runs,
as a control.

**Outcome: cut Stage 4.** This is the decision matrix's *"both weak, 7B fine"*
branch.

| Model | Structural pass | Runaways (never stopped) | Would-keep-and-edit |
|---|---|---|---|
| Qwen2.5-1.5B | **0 / 30** | 7 / 30 (23%) | **0 of 7** readable |
| Qwen2.5-3B | 2 / 30 | 4 / 30 (13%) | ~2–3 of 7 (~35%) |
| Qwen2.5-7B | 9 / 9 | 0 | 7 of 9 (~78%) |

Raw output: `temp/ai-eval/results/2026-07-27T18-20-12-364Z.json` (1.5B/3B) and
`2026-07-27T17-59-34-866Z.json` (7B control).

**Why 1.5B failed — these are not validator-repairable:**

- `weekSchedule` collapsed completely (see D13 for the detail).
- **`durationDays: 8`** for the 8-week `fitness` goal — weeks parsed as days —
  with phases nonetheless scheduled out to day 72.
- Phases emitted with **zero tasks**.
- `recommendedByDay` carrying no information: seven consecutive phases all at
  day 75.
- A 180-day `webdev` plan structured as *"First 6 Months / Next 6 Months / Final
  6 Months"* — 18 months of content in a 6-month horizon.
- **Content that would injure the user.** For couch-to-5K: *"run at or near race
  pace for 12 miles"*, *"switch to runs longer than an hour"*, *"marathon
  preparation"*. Not blandness — actively harmful advice.

**Why 3B also missed the bar** (needed ≥70%, got ~35%): content was markedly
better — one `webdev` roadmap was genuinely keepable — but degenerate weeks
persisted, `Monday: FocusOnKotlin` appeared in a Vulkan/C++ roadmap, one run
duplicated an entire phase verbatim, one scheduled to **day 270 of a 180-day
plan**, and it hallucinated confident API names that do not exist (*"Vulkan's
pipeline abstraction layer (PASL)"*, *"VkImageDiverces"*).

**The 7B control did its job.** At ~78% keepable with clean structure and no
invented Vulkan API names, it rules out the *"even 7B is weak → the prompt is
wrong"* branch. The prompt and schema are broadly sound; the small models are
the bottleneck. That is what makes the cut safe rather than premature.

**Caveats, stated honestly:**

- This is **Ollama + GBNF, not WebLLM + XGrammar**. As `AI_MODEL_EVAL.md` warns,
  results correlate but do not match. The failures here are severe enough at the
  *content* level — wrong durations, harmful advice, hallucinated APIs — that a
  runtime swap would not rescue them. The runaway rate is the finding most
  likely to shift between runtimes.
- One cheap experiment was **not** run before deciding: tightening the
  `weekSchedule` contract (D13) and re-testing. A large share of small-model
  structural failures cluster on that one field, so the 3B number may be
  somewhat depressed by a fixable prompt defect. It would not change the verdict
  — content errors and runaways are independent of `weekSchedule` — but it is
  the first thing to try if on-device is ever revisited.
- Timings were ignored throughout, per the eval doc. The dev box (RTX 5070 Ti) is
  not representative of any user's hardware.

**By-products now feeding later stages:** the 7B system prompt is the Stage 2
starting point for `lib/ai/prompts.ts` (with the D10 and D13 corrections
applied), and the 60 saved failures are the validator's Vitest corpus (§6).

### Stage 0 — Provider abstraction, no UI

**New:** `lib/ai/types.ts`, `lib/ai/provider.ts`

Define a minimal interface every backend implements:

```ts
interface GenerateOpts {
  prompt: string;
  schema: object;
  signal?: AbortSignal;
  maxOutputTokens: number;   // D12 — required, not optional
}
interface GenerateResult {
  data: unknown;             // parsed JSON
  stopReason: "stop" | "length";   // D12 — "length" is a failure, never parsed
}
interface AIProvider {
  id: "builtin" | "byok-gemini" | "byok-openrouter";
  label: string;
  isAvailable(): Promise<boolean>;
  generate(opts: GenerateOpts): Promise<GenerateResult>;
}
```

Changes from the pre-screening draft: `webllm` is gone from the id union
(Stage 4 cut); `prepare()` is gone with it, since it existed only for the model
download; and `maxOutputTokens` plus `stopReason` are now mandatory per D12 —
every provider must be able to cap output and report whether it hit that cap.

Add AI config to `AppSettings` in `lib/settings.ts` — provider id, key, model
name — extending `normalize()` so malformed/absent values fall back safely
(follow the existing defensive pattern there).

Unit-testable with a fake provider. Vitest is already set up (`npm test`,
`lib/__tests__/`).

### Stage 1 — `roadmapContent` generation only (lowest risk, ship first)

Wire the provider into `RoadmapStep` with a "Draft this for me" button that
fills `draft.roadmapContent` — free-form markdown, no schema to violate, nothing
structural to corrupt, fully editable in the textarea that already exists.

This validates the whole provider/settings/error-handling path end to end with
essentially zero blast radius. Genuinely a one-evening feature.

Note the existing `buildRoadmapOutline(name, phases)` export in
`components/onboarding/RoadmapStep.tsx` — the AI version is a peer of it, and
should respect the same "don't clobber what the user already wrote" rule that
`goNext()` applies at `app/onboarding/page.tsx:~110`.

### Stage 2 — BYO-key structured generation

**New:** `lib/ai/providers/gemini.ts`, `lib/ai/providers/openrouter.ts`,
`lib/ai/roadmapSchema.ts`, `lib/ai/generateRoadmap.ts`, `lib/ai/validate.ts`

**New UI:** `components/onboarding/AIGoalStep.tsx` (or an expandable card inside
`TemplatePicker`) — goal textarea, provider/key config link, generate button,
per-stage progress, error + retry.

**Modify:** `app/onboarding/page.tsx` — an `applyGeneratedDraft(partial)` that
merges the validated result over `draftFromTemplate(baseTemplate)` and advances
to the `Phases` step.

**Modify:** `components/SettingsModal.tsx` — provider selection and key entry.

### Stage 3 — Chrome built-in Prompt API provider

**New:** `lib/ai/providers/builtin.ts`. Pure feature detection; if present,
offer it first with a "free, no key needed" label. No new UI beyond a provider
entry. Fail closed and silently to the other providers when absent.

> **Gate this on evidence, not just on detection (D2).** Gemini Nano is a small
> on-device model in the same class as the ones that failed Stage −1. Detecting
> it proves it *exists*, not that it can do this task. Before offering it for
> structured generation, run the Stage −1 prompts through it and score them the
> same way. If it does not clear the bar, still offer it for Stage 1's free-form
> `roadmapContent` drafting — a weak model is fine at prose that the user
> immediately edits — and route structured generation to BYO-key.

### Stage 4 — WebLLM on-device — ❌ **CUT**

**Do not build this.** Stage −1 ran and answered the question it existed to
answer. Keeping the section (rather than deleting it) so the decision and its
reasoning survive; the implementation notes it used to hold are gone.

The screening's decision matrix said: *both small models weak, 7B fine → cut
Stage 4, ship BYO-key + built-in only.* That is what happened. 1.5B — the model
this stage was specified around, `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` — produced
**zero** keepable roadmaps out of seven readable outputs, passed **none** of 30
structural checks, and failed to terminate on 23% of generations.

The termination failure is the part that would have been hardest to live with.
On-device there is no server to cap tokens and no request timeout to fall back
on: roughly one generation in four pins the user's GPU and produces nothing.
D4's human-in-the-loop review — the thing that was supposed to make mediocre
small-model output acceptable — cannot help, because there is no output to
review.

**What this saves:** the largest stage in the plan. No `@mlc-ai/web-llm`
dependency, no ~750 MB download story, no WebGPU/`shader-f16` capability
matrix, no `CacheStorage` eviction handling, no "remove downloaded model" UI,
no async-chunk bundling work, and no obligation to test on weak hardware and a
mid-range Android phone.

**What is lost:** the fully-private, fully-offline generation path. Worth being
straight about — this was the most philosophically aligned option for a
local-first app, and BYO-key means a user's goal text does leave their device.
Say so plainly in the UI rather than pretending otherwise.

**If this is ever revisited**, the trigger is a materially better small model,
not a retry of the same one. Re-run `temp/ai-eval/run-eval.mjs` first — it is
still the cheapest possible answer — and fix the `weekSchedule` contract (D13)
before concluding anything, since that defect depressed the small-model scores
by an unmeasured amount.

---

## 5. Generation schema (target shape)

The model produces this, **not** `AppState` and **not** `TrackState`:

```jsonc
{
  "name": "string — short track name, max ~40 chars",
  "color": "#rrggbb",
  "durationDays": 90,
  "phases": [
    {
      "title": "string",
      "description": "one or two sentences",
      "recommendedByDay": 30,          // cumulative days from track start, strictly increasing
      "tasks": [ { "title": "string" } ],
      "detailedInfo": {
        "focus":       [ { "item": "string", "desc": "string" } ],
        "deliverable": [ { "item": "string", "desc": "string" } ],
        "math":        [ { "item": "string", "desc": "string" } ]   // may be [] / "" for non-technical tracks
      }
    }
  ],
  "weekSchedule": [ { "name": "Mon", "type": "focus", "label": "Focus" } ],  // exactly 7, Mon..Sun — SEE D13
  "focusTypes": { "focus": { "label": "Focus", "color": "#0ea5e9" } },       // SEE D13
  "roadmapContent": "markdown string"
}
```

> **Superseded — D13 was taken, and the shipped schema differs.** The model no
> longer authors `weekSchedule` objects or `focusTypes` at all. It emits seven
> enum keys (`focus` / `practice` / `build` / `review` / `rest`); labels and
> colours come from `RHYTHM_TYPES` in `lib/ai/prompts.ts`, and `focusTypes` is
> derived locally from the keys actually used. That removes the orphan-reference
> failure mode structurally rather than repairing it.
>
> The shipped schema also carries `materials`, `portfolio`, `rotations` and
> `detailedInfo.algoDS` — see the note in §10. `lib/ai/roadmapSchema.ts` is the
> authority; the block above is the v1 sketch.

**Deliberately absent:** every `id`, every `completed`, all of `materials`,
`portfolio`, `startDate`, and all sync/history bookkeeping. IDs are assigned by
the validator (D9); `startDate` comes from `HorizonStep` / `todayYMD()`;
`completed` is always `false` at seed time; materials are out of scope for v1
(D8).

---

## 6. Validation layer — `lib/ai/validate.ts`

Constrained decoding guarantees shape. This layer guarantees sanity. It must be
pure, synchronous, unit-tested, and must **never throw on bad model output** —
it repairs or drops, and reports what it did.

Required checks. Every one marked **[observed]** fired for real during Stage −1 —
these are not hypothetical defensive coding, and the counts come from 60 logged
generations:

1. **Clamp counts.** 2–8 phases; 1–10 tasks per phase; ≤6 items per
   `detailedInfo` list. Truncate excess rather than rejecting.
   **[observed]** phase count out of range 22×; task counts out of range 19×.
2. **Assign IDs** (D9). Phases `1..n`; tasks `p{phaseId}_t{n}`. Set every
   `completed: false`.
3. **Monotonic `recommendedByDay`.** Strictly increasing, last phase ≤
   `durationDays`. If violated, redistribute evenly across `durationDays` (the
   `custom` template's `buildPhases` in `lib/templates/custom.ts` shows the
   even-split pattern).
   **[observed]** the single most common failure — final value ≠ duration 23×,
   not strictly increasing 20×. Includes a 180-day plan scheduling to day 270,
   and seven consecutive phases pinned to the same day.
4. **Exactly 7 `weekSchedule` entries**, `name` values `Mon..Sun` in order.
   Fall back to the base template's `defaultWeekSchedule` if malformed.
   **[observed]** wrong order 19×, wrong length 12×. See D13 — prefer
   constraining this field over repairing it.
5. **Referential integrity:** every `weekSchedule[].type` must be a key in
   `focusTypes`. Add a generated entry for any orphan, or fall back wholesale.
   **[observed]** orphan types recurred at every model size. D13's constrained
   approach removes this failure mode entirely rather than repairing it.
6. **Colours:** `#rrggbb` only. Reject anything else; fall back to the
   template default. **[observed]** 6×.
7. **Strings:** trim, collapse whitespace, enforce max lengths, drop empties.
   Strip any markdown code fences the model wrapped the JSON in.
8. **Strip unknown keys.** Never spread raw model output into app state.
9. **Report degradations** so the UI can say "generated, with adjustments"
   rather than silently shipping a mangled roadmap.

Three checks the original list missed, all **[observed]**:

10. **Sanity-check `durationDays` against the user's stated horizon.** 1.5B
    returned `durationDays: 8` for an *8-week* goal — units misread — while
    still scheduling phases out to day 72. The user's requested duration is
    known independently of the model (it comes from `HorizonStep`), so treat a
    model value that contradicts it as wrong and prefer the user's. Also reject
    any `recommendedByDay` beyond `durationDays` outright.
11. **Reject empty phases.** A phase with zero tasks is worse than no phase —
    it renders as a dead row in `PhaseReviewStep`. Drop it, or fail the
    generation if it leaves fewer than 2 phases.
12. **Detect degenerate output.** Structurally valid and semantically useless:
    all seven weekdays sharing one type, or two phases with identical
    titles/tasks (3B duplicated an entire phase verbatim). These pass every
    check above. Treat as a degradation worth reporting, or a retry trigger.

**Truncated output is never repaired** (D12). If the provider stopped on a token
limit, discard the response and offer a retry — do not attempt to parse or patch
partial JSON.

### Test corpus

`temp/ai-eval/results/*.json` holds 60 real generations with their failure
modes already classified in each record's `problems[]` array, plus 11 flagged
`truncated: true`. Extract fixtures from these rather than inventing them — real
model failures are stranger than invented ones, and these are the exact
distribution the validator will face. Note the harness records raw text for
truncated runs, which is the natural source for the malformed-JSON cases.

---

## 7. Licensing and cost notes

Most of this section concerned shipping open-weights models, which the Stage 4
cut made moot. What still applies:

- **BYO-key is genuinely zero-cost to us in every sense** — no weights to
  redistribute, no licence to comply with, no CDN to free-ride on. The Stage 4
  cut removed the only part of the plan with a licensing surface.
- **It is not zero-cost to the *user*.** Free tiers have quotas, and tokens are
  billed past them. This is why D12's token cap matters commercially and not
  just technically: an uncapped runaway spends the user's money.
- Model weights are **never** bundled or committed. Still true, now trivially so.

Retained for the record, in case on-device is ever revisited: **Qwen2.5-1.5B is
Apache 2.0** (no attribution, no acceptable-use policy, no naming requirement)
and was preferred over **Llama-3.2-1B**, whose Community Licence is not OSI
open-source and carries a "Built with Llama" display requirement. The correct
term for both is **open-weights**, not open-source. WebLLM would have pulled
weights from the HuggingFace CDN — free to us, but neither owned nor controlled
by us, and not honestly describable as our infrastructure.

---

## 8. Repo conventions to follow

- `CLAUDE.md` → **mandatory: bump the version and add a `CHANGELOG.md` entry
  before every commit.** Rules and file locations are in `DEVELOPMENT.md`'s
  **Versioning** section — that is the single source of truth. Current version
  is `0.13.6` in `package.json`.
- `AGENTS.md` → **this is not the Next.js you know.** Next 16.2.7 / React 19.2.4
  have breaking changes vs. older training data. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing code, and heed deprecation
  notices. This matters here for dynamic imports, client boundaries, and
  bundling behaviour.
- Tests: Vitest (`npm test`), with `fake-indexeddb` available. Existing tests in
  `lib/__tests__/`.
- Lint/build: `npm run lint`, `npm run build`.
- Styling: Tailwind v4, with the existing `glass-panel` / `btn` /
  `text-muted-foreground` / `border-card-border` vocabulary. Match the
  onboarding step components.
- `temp/` is **not** in `.gitignore` — decide deliberately whether these planning
  files (`AI_ROADMAP_PLAN.md`, `AI_MODEL_EVAL.md`, `ai-eval/`) should be
  committed or removed before the first commit on this branch.
  **Recommendation after Stage −1:** commit `AI_ROADMAP_PLAN.md` and
  `ai-eval/run-eval.mjs` — the plan now records a decision that cost real work to
  reach, and the harness is what would re-open it. `results/*.json` is ~120 KB
  and regenerable, but it is also the validator's test corpus (§6), so extract
  the fixtures into `lib/__tests__/` **before** excluding it.

### Prerequisites to have in hand

- **A Google AI Studio API key** (free tier, no card) for Stages 1–2:
  <https://aistudio.google.com/apikey>. With Stage 4 cut this is the *only*
  prerequisite for the entire feature — no model download, no Ollama, no WebGPU.
- Ollama + the Qwen2.5 models are no longer needed to build anything. Keep them
  installed only if you intend to re-run the screening (§4 Stage −1).

---

## 9. Verification plan

### Automated

- `npm test` — validator unit tests (§6) against the **real** corpus in
  `temp/ai-eval/results/` (see §6 "Test corpus"), covering: truncated JSON,
  fenced JSON, duplicate IDs, non-monotonic `recommendedByDay`, `recommendedByDay`
  past `durationDays`, wrong-length `weekSchedule`, orphan focus types,
  degenerate all-identical weeks, phases with no tasks, misread duration units,
  extra unknown keys, empty phases array.
- `npm run build` — must pass with no SSR/prerender failure.
- `npm run lint`.

### Manual

1. **Stage 1:** Wizard → Roadmap step → "Draft this for me" → markdown appears
   and remains editable; does not clobber pre-existing user text.
2. **Stage 2 (BYO key):** Enter a Gemini free-tier key in settings → wizard →
   AI goal → *"Master OpenGL and C++ shader programming in 4 weeks"* → phases
   render in `PhaseReviewStep`, rhythm in `RhythmStep` → "Create Track" →
   verify the new track appears in `TrackSwitcher` and **no existing track was
   modified**.
3. **Non-technical prompt:** *"Get to a 5k run in 8 weeks"* — confirm `math` is
   empty and the generated `focusTypes` are sensible, not programming-flavoured.
4. **Bad key / offline / rate limit:** confirm each produces a readable error
   and the wizard stays usable and falls back to the plain template path.
5. **Cancel mid-generation:** `AbortSignal` honoured, no state left half-applied.
   Per D12, verify the request is *actually* aborted and not merely hidden —
   killing the client did not stop server-side generation during Stage −1.
6. **Token cap (D12):** force a low `maxOutputTokens` and confirm the truncated
   response is reported as a failure with a retry, never parsed as partial JSON.
7. **Stage 3:** In a Chrome build with the built-in API available, confirm it is
   auto-detected and selected. In one without, confirm it is silently absent.
   **Also run the Stage −1 eval prompts through it** (D2 caveat) — Gemini Nano
   is a small model of the class that failed screening, and must clear the same
   bar before it is offered for structured generation.
8. **Privacy:** with a key configured, export the workspace
   (`lib/export.ts`) / inspect `database.json` and confirm **the key is not in
   it**.
9. **Disclosure:** confirm the UI states plainly that the goal text is sent to
   the chosen provider. With on-device cut, there is no longer a private path,
   and a local-first app should not let that pass unmentioned.

---

## 10. Explicit non-goals for v1

- No modification of existing tracks or workspace data. Creation only.

> **Two non-goals were lifted during implementation** (2026-07-27), after the
> BYO-key path proved out on a frontier model. Both are now generated:
>
> - **`materials` and `portfolio`** — see the resolution note on D8. Titles are
>   generated; addresses never are.
> - **`rotations`** — the original objection was correctness, not capability:
>   `startWeek` anchors which item is "current" and drives the daily reset, so a
>   model guessing it desynchronises the rotation from week one. That objection
>   is answered by taking the field away from the model. The validator pins
>   `startWeek: 1` for a new track and `seedTrackFromTemplate` assigns `id`
>   (rotation-generated daily items are namespaced `rotation_<id>`, so a
>   duplicate would have two rotations overwriting each other). Days are
>   intersected against the generated rhythm so a rotation cannot land on a rest
>   day, and a rotation with no items or no usable days is dropped rather than
>   repaired — there is nothing to repair it from.
>
> `algoDS` was also added to the generation schema. It exists on
> `PhaseDetailedInfo` and renders in `PhaseDetailModal`, but was missing from
> the schema, so generation could never reach it.
- No chat interface. Single-shot goal → draft, then the existing wizard.
- No Horizon-hosted inference of any kind, ever. This is the founding constraint.
- No native App Store / Play Store wrapper. It does not exist yet in this repo
  and is a separate project.
- **No on-device inference.** Cut after Stage −1 (§4 Stage 4). This also means
  **no offline generation and no fully-private generation path** in v1 — the
  wizard must degrade gracefully to the plain template flow when the user is
  offline or has no provider configured.

---

## 11. Summary of what changed from the original idea

| Original | Revised | Why |
|---|---|---|
| WebLLM 750 MB download as primary path | BYO-key primary; built-in second; WebLLM opt-in | iOS has no viable WebGPU+storage story; mid-range Android OOMs |
| `"Return ONLY valid raw JSON"` in the prompt | Constrained decoding + a validator that repairs | 1–3B models break JSON regularly; prompts are not guarantees |
| Generate `Partial<AppState>` | Generate a `WizardDraft` subset | `AppState` is 30 fields of sync bookkeeping the model must not invent |
| New `AIAssistantModal` with its own preview | AI entry point in the existing onboarding wizard | Review UI already exists; human-in-the-loop makes small-model output acceptable |
| `updateAppState()` in `lib/api.ts` | `seedTrackFromTemplate` → `createTrack` | `lib/api.ts` and `updateAppState` **do not exist** in this repo |
| "Merges or overwrites current workspace" | Always creates a new track | Overwrites propagate to every device through Drive sync |
| One-shot full-roadmap generation | Staged multi-turn generation | Small models degrade sharply with output length |
| AI generates materials with links | No materials in v1 | Fabricated books and dead URLs destroy trust |
| Schema hardcodes `math` / programming framing | Template-aware prompting | `math` is meaningless for fitness/work tracks |
| Model-supplied IDs | Validator assigns all IDs | Models produce duplicate and drifting identifiers |
| "Zero mandatory server costs" | True for BYO-key; WebLLM free-rides on HF's CDN | Be honest about the dependency |

### Changed again after the Stage −1 screening (2026-07-27)

| Was | Now | Why |
|---|---|---|
| WebLLM on-device as an opt-in third provider | **Cut entirely** (§4 Stage 4) | 1.5B: 0/30 structural passes, 0 keepable roadmaps, 23% never terminated |
| Chrome built-in treated as a free win | Same rung, but must pass the eval first (D2) | Gemini Nano is a small model of the class that just failed |
| No token limits specified | Cap + timeout on every provider (D12) | Two screening runs hit 40k and 81k tokens; on a BYO key that is the user's money |
| Model authors `weekSchedule` freehand | Constrain it, or use the template default (D13) | Worst-performing field at every size; failed unrepairably |
| `math` empty unless clearly mathematical (D10) | State the positive case too | Over-corrected: `math` came back empty on 100% of runs, including Vulkan |
| Validator checks were a priori | Three added from observed failures (§6.10–12) | Misread duration units, empty phases, and degenerate-but-valid output |
| Invent malformed fixtures for tests | Use the 60 real generations already captured | Real failures are stranger than invented ones |
| Fully private / offline path available | No private path in v1 (§10) | Consequence of the cut — disclose it rather than hide it |
