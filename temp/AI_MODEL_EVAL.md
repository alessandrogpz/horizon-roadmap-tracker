# Model Screening Guide — run this BEFORE implementing

**Branch:** `feature/ai-roadmap-generator`
**Companion doc:** `temp/AI_ROADMAP_PLAN.md` (the implementation plan)
**Harness:** `temp/ai-eval/run-eval.mjs`
**Written:** 2026-07-27

> ## ✅ This screening has been RUN — 2026-07-27
>
> **Outcome: Stage 4 (on-device WebLLM) is cut.** 1.5B scored 0/30 structural
> passes with zero keepable roadmaps; 3B reached only ~35% against a 70% bar;
> the 7B control passed 9/9 at ~78%, confirming the prompt and schema are sound.
> Separately, **23% of 1.5B generations never terminated.**
>
> **The full result lives in `temp/AI_ROADMAP_PLAN.md` §4 Stage −1.** Read that,
> not this. This document remains useful as the *method* — how to run the
> harness, what each prompt probes, how to score — if the question is ever
> reopened.
>
> ⚠️ **"What I expect you'll find" below was written before the run and several
> of its predictions were wrong** — notably 1.5B at "40–60% would keep" (actual:
> 0%) and the assumption that structural failures would be the repairable kind.
> It is kept for calibration, not as guidance.

---

## Why this exists

Stage 4 of the implementation plan (on-device WebLLM) is the most expensive
stage to build and the easiest to regret. It is only worth building if a ~1.5B
open-weights model can produce a roadmap a user would actually *keep*.

That question is answerable in an afternoon with Ollama, using the same weights
family at a comparable quantization — no WebGPU, no React, no bundler. If the
answer is no, you delete Stage 4 from the plan and ship the BYO-key path alone,
having saved roughly a week.

**Do this before writing implementation code.** The outcome changes the plan.

---

## What this does and does not tell you

| Tells you | Does NOT tell you |
|---|---|
| Whether small models understand the task at all | Real WebLLM speed or memory use |
| Whether the schema and system prompt are well-designed | Whether it runs on a user's laptop or phone |
| Which model size is the quality cliff | Browser compatibility |
| A realistic corpus of malformed output for validator tests | Download-size tolerance |

Ollama and WebLLM are different runtimes with different quantization and
samplers — Ollama uses GBNF grammars for structured output, WebLLM uses
XGrammar. Results correlate but do not match exactly. **This is a screening
tool, not a substitute for testing the real thing.**

### ⚠️ Your hardware will mislead you on speed

Your dev box is an **RTX 5070 Ti, 16 GB VRAM, 62 GB RAM**. A 1.5B model will be
effectively instantaneous on it. That number transfers to *none* of your users
— not a laptop iGPU, not a mid-range Android phone. This is exactly why the plan
demotes on-device to opt-in (decision D1).

**Use this eval to judge output quality only. Ignore the timings entirely.**
Speed gets tested later, on the worst hardware you can find.

---

## Step 1 — Install Ollama

CachyOS is Arch-based, and you have an NVIDIA card, so take the CUDA build:

```fish
sudo pacman -S ollama-cuda
sudo systemctl enable --now ollama
```

Verify it's up:

```fish
curl -s http://localhost:11434/api/version | jq
```

> Your GPU is a GB203 (Blackwell, sm_120). If you hit a CUDA/arch error, it's an
> outdated Ollama build — update rather than debugging it.

## Step 2 — Pull three models

```fish
ollama pull qwen2.5:1.5b-instruct-q4_K_M   # ~1.0 GB — matches the planned WebLLM default
ollama pull qwen2.5:3b-instruct-q4_K_M     # ~1.9 GB — "is one size up enough?"
ollama pull qwen2.5:7b-instruct-q4_K_M     # ~4.7 GB — approximates BYO-key quality
```

~8 GB total; all fit comfortably in 16 GB VRAM. Qwen2.5 is **Apache 2.0**, which
is why it's preferred over Llama 3.2 — see plan §7.

The 7B is not a shipping candidate. It's the control: it shows you what the task
looks like when the model is *not* the bottleneck, so you can tell "small model
is too weak" apart from "my prompt is bad."

## Step 3 — Verify WebGPU in your browser

Separate from Ollama, but do it now so there are no surprises at Stage 4:

```fish
google-chrome-stable chrome://gpu
```

Look for **WebGPU: Hardware accelerated**. WebGPU reached Linux later than
Windows/macOS, so confirm rather than assume. Then in DevTools console on any
page:

```js
const a = await navigator.gpu?.requestAdapter();
console.log("adapter:", !!a, "shader-f16:", a?.features.has("shader-f16"));
```

Both must be `true`. `shader-f16` is required by the `q4f16_1` WebLLM builds; if
it's false you'd need the `q4f32` variants, which are substantially larger.

## Step 4 — Run the harness

```fish
node temp/ai-eval/run-eval.mjs
```

Defaults: 3 models × 6 prompts × 5 runs = 90 generations. On your GPU the 1.5B
and 3B runs are quick; the 7B is the slow part.

Useful variants:

```fish
node temp/ai-eval/run-eval.mjs --runs 10
node temp/ai-eval/run-eval.mjs --models qwen2.5:1.5b-instruct-q4_K_M --runs 20
node temp/ai-eval/run-eval.mjs --prompts vulkan,fitness,vague
```

Every generated roadmap is saved to `temp/ai-eval/results/<timestamp>.json`.

---

## The test prompts, and what each one is probing

The harness ships with six. Each exists to expose a specific failure mode.

### 1. `vulkan` — *"Learn Vulkan, C++ memory management, and graphics rendering in 3 months"* (90d)

**Probing:** genuine domain knowledge on a niche topic.

**Watch for:** invented or misattributed API names (`vkCreateRenderPipeline`
doesn't exist; `vkCreateGraphicsPipelines` does), conflation of Vulkan with
OpenGL concepts, phases that describe *learning about* Vulkan rather than
building with it.

**Good looks like:** phases progressing instance/device setup → swapchain and
render pass → pipeline and shaders → memory allocation and buffers → a small
renderer. Tasks naming real objects.

### 2. `webdev` — *"Become a competent full-stack web developer in 6 months, from basic HTML"* (180d)

**Probing:** the model's *ceiling*. This topic is massively represented in
training data, so it's the best showing you'll get.

**Interpretation:** if a model is weak here, it will be weak everywhere. If it's
good here but bad on `vulkan`, the limitation is knowledge depth, not capability
— which matters, because Horizon's users are likely to bring niche goals.

### 3. `fitness` — *"Get from couch to running a 5k in 8 weeks"* (56d)

**Probing:** escape from the programming framing.

**Watch for:** a non-empty `math` array (should be `[]` — this is decision D10 in
the plan), `focusTypes` with names like "Coding" or "Debugging", phases that read
like a software curriculum wearing a tracksuit.

**Good looks like:** progressive run/walk intervals, distinct rest and
cross-training days in `weekSchedule`, `deliverable` describing distance or time
milestones.

### 4. `compressed` — *"Master OpenGL and C++ shader programming in 4 weeks"* (28d)

**Probing:** honesty about scope under an unrealistic timeline.

**Watch for:** a plan that cheerfully promises mastery in 28 days, or one that
keeps a 6-month scope and simply squeezes `recommendedByDay` values together.

**Good looks like:** a visibly narrowed goal — one lighting model, one small
project — rather than compressed grandiosity. Realistically, **most small models
fail this one.** That's fine and expected; note it as a known limitation for the
UI copy rather than a blocker.

### 5. `vague` — *"I want to get better at music"* (90d)

**Probing:** behaviour under almost no signal.

**Watch for:** pure filler ("Phase 1: Learn the basics", "Practice regularly").
This is the prompt most likely to produce embarrassing output.

**Good looks like:** the model picking a reasonable concrete interpretation and
committing to it — e.g. assuming an instrument, or structuring around ear
training and theory — so the user has something specific to edit rather than
mush to rewrite.

**This prompt is also a product signal:** if every model produces mush here, the
UI should require or strongly nudge toward a more specific goal before it will
generate.

### 6. `broad` — *"Game engine dev, linear algebra, physics simulation, shipping on Steam in 13 months"* (395d)

**Probing:** pacing across a long horizon. (Also mirrors your own real track.)

**Watch for:** `recommendedByDay` bunched into the first 90 days with a huge
final gap, or phases that ignore three of the four named subjects.

---

## How to score

The harness prints four numbers per model×prompt. **They screen; they don't
decide.**

| Column | Meaning | Target |
|---|---|---|
| `pass` | Ran clean through the structural checks (plan §6) | See below |
| `generic` | Fraction of phase/task titles containing filler phrases | **< 0.15** |
| `words` | Mean words per task title — a specificity proxy | **6–12** |
| `med.s` | Median seconds | **Ignore.** Your GPU isn't representative. |

On `pass`: constrained decoding makes *schema* validity near-certain, so this
column is really measuring semantic rules — monotonic `recommendedByDay`, exactly
7 weekdays, `focusTypes` referential integrity, counts in range. Failures here
are mostly *repairable* by the validator, so a low pass rate is a signal about
how much repair logic you need, not a veto.

### The check that actually decides

**Open `results/<timestamp>.json` and read ten roadmaps per model.** Ask one
question per roadmap:

> If Horizon had generated this for me, would I keep it and edit it — or delete
> it and start over?

That ratio is the metric. Everything else is a proxy for it. A model can score
6/6 on structure and still produce a plan no one would keep.

---

## What I expect you'll find

Stated up front so you can check my predictions against reality — if your
results differ substantially, that itself is worth knowing.

**Qwen2.5-1.5B** — near-perfect schema validity, since the grammar enforces it.
Structural pass rate mediocre: `recommendedByDay` monotonicity and the
"final value equals duration" rule are the likely repeat offenders, and
`focusTypes`/`weekSchedule` referential integrity will slip. Content plausible
but shallow — recognisable topic vocabulary arranged in a generic progression.
Expect weak differentiation between a 28-day and a 180-day plan. My guess:
**roughly 40–60% "would keep and edit"** on mainstream topics, notably worse on
`vulkan` and `vague`.

**Qwen2.5-3B** — clearly better structure and adherence, content still leans
generic but with real specifics appearing in tasks. Guess: **~70%**.

**Qwen2.5-7B** — genuinely usable, ~85%. Not shippable on-device, but it tells
you the task is well-posed and your prompt is sound.

**The likely conclusion:** 1.5B is marginal-but-workable *only because* the user
reviews and edits everything in the wizard before anything is saved (plan D4).
That human-in-the-loop step is what makes it acceptable — which is a good reason
to be confident in that decision, not to abandon on-device.

---

## Decision matrix

| Outcome | What to do |
|---|---|
| 1.5B keeps ≥50% on mainstream prompts | **Stage 4 proceeds as planned** with 1.5B as default. |
| 1.5B <50% but 3B ≥70% | Stage 4 proceeds, but with **3B** — roughly 2 GB download. Re-check whether that's tolerable; it weakens the on-device case further. |
| Both weak, 7B fine | **Cut Stage 4.** Ship BYO-key + Chrome built-in only. Revisit when small models improve. |
| Even 7B is weak | The problem is the **prompt or schema**, not the model. Iterate on `SYSTEM_PROMPT` in the harness and re-run before concluding anything about model size. |

Whatever you find, record it in `AI_ROADMAP_PLAN.md` §4 Stage 4 so the decision
survives a cleared chat.

---

## Side benefit: you're building the validator's test corpus

Every malformed, degenerate, or bizarre output in `results/*.json` is a free
Vitest fixture for `lib/ai/validate.ts` (plan §6). Before deleting a results
file, pull out the interesting failures — non-monotonic day values, 5-day
weeks, orphaned focus types, empty phase arrays — and keep them. Real model
failures make far better tests than ones you invent.

---

## Iterating on the prompt

`SYSTEM_PROMPT` in `run-eval.mjs` is the draft of what ships. It already
encodes several plan decisions:

- no invented books, courses, or URLs (D8);
- `math` empty for non-mathematical goals (D10);
- explicit ban on generic phase titles;
- scope scales to time available, rather than compressing a promise of mastery;
- `weekSchedule`/`focusTypes` referential integrity stated in words as well as
  enforced by schema.

Change it here, re-run, and compare `generic` scores across result files. This is
much faster than iterating inside the app, and **whatever prompt wins here is
what Stage 2 should ship.** Copy it into `lib/ai/prompts.ts` when you get there.

Note what the schema deliberately omits: all IDs, all `completed` flags,
`materials`, `portfolio`, and `startDate`. Those are assigned by the validator
and the wizard, never by the model (plan D8/D9).
